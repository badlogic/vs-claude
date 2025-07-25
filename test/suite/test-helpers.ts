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
		// Find the metadata file for the test window
		const vsClaudeDir = path.join(os.homedir(), '.vs-claude');
		const files = fs.readdirSync(vsClaudeDir);
		const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

		// Get the test workspace path to match against
		const testWorkspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!testWorkspacePath) {
			console.error('No test workspace found');
			return undefined;
		}

		// Find the window ID that matches our test workspace
		for (const file of metaFiles) {
			const fullPath = path.join(vsClaudeDir, file);
			try {
				const metadata = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
				if (metadata.workspace?.includes('test-workspace')) {
					const windowId = file.replace('.meta.json', '');
					console.log(`Found test window ID: ${windowId} for workspace: ${metadata.workspace}`);
					return windowId;
				}
			} catch (_err) {
				// Ignore files that can't be read
			}
		}

		console.error(`No window found for test workspace: ${testWorkspacePath}`);
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
		if (response?.content?.[0]?.text === '') {
			// Empty success response (e.g., for open tool)
			return { success: true, data: '' };
		}
		if (response?.error) {
			// Error response
			return { success: false, error: response.error };
		}
		// Unknown format - log it
		console.error('Unknown MCP response format:', JSON.stringify(response));
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

		// For development extensions in test mode, VS Code doesn't list them normally
		// The extension should have already been activated by VS Code

		// Wait a bit for extension to fully initialize
		await new Promise((resolve) => setTimeout(resolve, 2000));

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

		// The MCP server is in the build/mcp directory
		// __dirname is build/extension/test/suite, so we need to go up to get to project root
		const extensionPath = path.resolve(__dirname, '../../../..');
		const mcpServerPath = path.join(extensionPath, 'build', 'mcp', binaryName);
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
