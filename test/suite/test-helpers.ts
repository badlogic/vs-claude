import * as assert from 'assert';
import { type ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Simple MCP client for testing
 */
export class MCPClient {
	private buffer = '';
	private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
	private nextId = 1;
	private windowId: string | undefined;

	constructor(private process: ChildProcess) {
		// Listen to stdout for responses
		this.process.stdout?.on('data', (data) => {
			this.buffer += data.toString();
			this.processBuffer();
		});

		this.process.stderr?.on('data', (data) => {
			console.error('MCP Server stderr:', data.toString());
		});
	}

	private findTestWindowId(): string | undefined {
		// Find the newest metadata file in .vs-claude directory
		const vsClaudeDir = path.join(os.homedir(), '.vs-claude');
		const files = fs.readdirSync(vsClaudeDir);
		const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

		let newestFile = '';
		let newestTime = 0;

		for (const file of metaFiles) {
			const fullPath = path.join(vsClaudeDir, file);
			const stat = fs.statSync(fullPath);
			if (stat.mtimeMs > newestTime) {
				newestTime = stat.mtimeMs;
				newestFile = file;
			}
		}

		if (newestFile) {
			const windowId = newestFile.replace('.meta.json', '');
			console.log('Found test window ID:', windowId);
			return windowId;
		}

		return undefined;
	}

	private processBuffer() {
		const lines = this.buffer.split('\n');
		this.buffer = lines.pop() || '';

		for (const line of lines) {
			if (line.trim()) {
				try {
					const message = JSON.parse(line);
					if (message.id && this.pendingRequests.has(message.id)) {
						const pending = this.pendingRequests.get(message.id);
						if (pending) {
							const { resolve, reject } = pending;
							this.pendingRequests.delete(message.id);

							if (message.error) {
								reject(new Error(message.error.message));
							} else {
								resolve(message.result);
							}
						}
					}
				} catch (err) {
					console.error('Failed to parse MCP message:', line, err);
				}
			}
		}
	}

	async initialize(): Promise<void> {
		// Find the test window ID before initializing
		this.windowId = this.findTestWindowId();
		assert.ok(this.windowId, 'Could not find test window ID');

		const request = {
			jsonrpc: '2.0',
			id: `${this.nextId++}`,
			method: 'initialize',
			params: {
				protocolVersion: '0.1.0',
				capabilities: {
					tools: true,
				},
				clientInfo: {
					name: 'test-client',
					version: '1.0.0',
				},
			},
		};

		const response = await this.sendRequest(request);
		assert.ok(response, 'Should get initialize response');
	}

	async callTool(name: string, args: Record<string, any>): Promise<any> {
		// Always use the window ID we found during initialization
		const request = {
			jsonrpc: '2.0',
			id: `${this.nextId++}`,
			method: 'tools/call',
			params: {
				name,
				arguments: { args, windowId: this.windowId },
			},
		};

		const response = await this.sendRequest(request);

		// Parse the actual tool response from the MCP response
		if (response?.content?.[0]?.text) {
			// Success response
			return { success: true, data: response.content[0].text };
		}
		if (response?.error) {
			// Error response
			return { success: false, error: response.error };
		}
		return { success: false, error: 'Unknown response format' };
	}

	private sendRequest(request: Record<string, any>): Promise<any> {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(request.id, { resolve, reject });
			this.process.stdin?.write(`${JSON.stringify(request)}\n`);
		});
	}

	close() {
		this.process.stdin?.end();
	}
}

/**
 * Shared test setup for E2E tests
 */

// biome-ignore lint/complexity/noStaticOnlyClass: Test setup needs to be shared across test files
export class E2ETestSetup {
	private static mcpServer: ChildProcess;
	private static mcpClient: MCPClient;
	private static setupCount = 0;

	static async setup(): Promise<MCPClient> {
		// If already setup, return existing client
		if (E2ETestSetup.mcpClient && E2ETestSetup.setupCount > 0) {
			E2ETestSetup.setupCount++;
			return E2ETestSetup.mcpClient;
		}
		// Ensure we have a workspace
		console.log('Workspace folders:', vscode.workspace.workspaceFolders);
		console.log('Workspace name:', vscode.workspace.name);
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			// For test purposes, we'll continue without a workspace
			console.warn('No workspace folder found, continuing without one');
		} else {
			console.log('Test workspace:', workspaceFolder.uri.fsPath);
		}

		// Wait for extension to be fully activated
		const extension = vscode.extensions.getExtension('vs-claude.vs-claude');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		// Give VS Code more time to create window metadata
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Start the MCP server
		const platform = os.platform();
		const arch = os.arch();
		let binaryName = 'mcp-server-';

		if (platform === 'darwin') {
			binaryName += arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
		} else if (platform === 'linux') {
			binaryName += 'linux-amd64';
		} else if (platform === 'win32') {
			binaryName += 'windows-amd64.exe';
		}

		// The MCP server is in the extension's bin directory, not the test workspace
		const extensionPath = path.resolve(__dirname, '../../..');
		const mcpServerPath = path.join(extensionPath, 'bin', binaryName);
		assert.ok(fs.existsSync(mcpServerPath), `MCP server binary not found at ${mcpServerPath}`);

		E2ETestSetup.mcpServer = spawn(mcpServerPath);
		E2ETestSetup.mcpClient = new MCPClient(E2ETestSetup.mcpServer);

		// Wait for server to be ready
		await E2ETestSetup.mcpClient.initialize();

		E2ETestSetup.setupCount = 1;
		return E2ETestSetup.mcpClient;
	}

	static teardown(): void {
		E2ETestSetup.setupCount--;
		
		// Only actually teardown when all suites are done
		if (E2ETestSetup.setupCount === 0) {
			if (E2ETestSetup.mcpClient) {
				E2ETestSetup.mcpClient.close();
			}
			if (E2ETestSetup.mcpServer) {
				E2ETestSetup.mcpServer.kill();
			}
		}
	}
}
