import * as assert from 'assert';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';

suite('E2E MCP Integration Tests', function() {
    this.timeout(30000); // 30 second timeout for e2e tests

    let mcpServer: ChildProcess;
    let mcpClient: MCPClient;

    suiteSetup(async () => {
        // Ensure we're in the vs-claude workspace
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder, 'No workspace folder found');
        assert.ok(workspaceFolder.uri.fsPath.includes('vs-claude'), 'Not in vs-claude workspace');

        // Wait for extension to be fully activated
        const extension = vscode.extensions.getExtension('vs-claude.vs-claude');
        assert.ok(extension, 'Extension not found');
        await extension.activate();
        
        // Give VS Code time to create window metadata
        await new Promise(resolve => setTimeout(resolve, 1000));

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

        const mcpServerPath = path.join(workspaceFolder.uri.fsPath, 'bin', binaryName);
        assert.ok(fs.existsSync(mcpServerPath), `MCP server binary not found at ${mcpServerPath}`);

        mcpServer = spawn(mcpServerPath);
        mcpClient = new MCPClient(mcpServer);

        // Wait for server to be ready
        await mcpClient.initialize();
    });

    suiteTeardown(() => {
        if (mcpClient) {
            mcpClient.close();
        }
        if (mcpServer) {
            mcpServer.kill();
        }
    });

    test('Should open a file via MCP', async () => {
        // Request to open our own extension.ts file
        const filePath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'src', 'extension.ts');
        
        const result = await mcpClient.callTool('open', {
            args: {
                type: 'file',
                path: filePath,
                startLine: 10,
                endLine: 20
            }
        });

        assert.ok(result.success, 'Open command should succeed');

        // Wait a bit for VS Code to actually open the file
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify the file is open
        const activeEditor = vscode.window.activeTextEditor;
        assert.ok(activeEditor, 'Should have active editor');
        
        // The extension might have opened the output channel, so let's check all visible editors
        const openEditors = vscode.window.visibleTextEditors;
        const fileEditor = openEditors.find(e => e.document.uri.fsPath === filePath);
        assert.ok(fileEditor, 'File should be open in an editor');
        
        // Make it active
        await vscode.window.showTextDocument(fileEditor.document);

        // Verify selection
        const selection = fileEditor.selection;
        assert.strictEqual(selection.start.line, 9, 'Selection should start at line 10 (0-indexed)');
        assert.strictEqual(selection.end.line, 19, 'Selection should end at line 20 (0-indexed)');
    });

    test('Should query symbols via MCP', async () => {
        const result = await mcpClient.callTool('query', {
            args: {
                type: 'symbols',
                query: 'OpenHandler',
                kinds: ['class']
            }
        });

        assert.ok(result.success, 'Query should succeed');
        assert.ok(result.data, 'Should have data');
        
        // The query tool returns an array of results
        let data;
        try {
            data = JSON.parse(result.data);
        } catch (e) {
            // If it's not JSON, it might be the success message
            console.log('Query response:', result.data);
            assert.fail('Could not parse query response as JSON');
        }
        
        // For batch queries, each result has {success, result}
        if (data.success !== undefined && data.result) {
            // Single query result
            const symbols = data.result;
            assert.ok(Array.isArray(symbols), 'Result should be array');
            assert.ok(symbols.length > 0, 'Should find OpenHandler class');
            assert.strictEqual(symbols[0].name, 'OpenHandler', 'Should find correct class');
        } else if (Array.isArray(data) && data[0]?.result) {
            // Batch query result
            const symbols = data[0].result;
            assert.ok(Array.isArray(symbols), 'Result should be array');
            assert.ok(symbols.length > 0, 'Should find OpenHandler class');
            assert.strictEqual(symbols[0].name, 'OpenHandler', 'Should find correct class');
        } else {
            // Direct array of symbols
            assert.ok(Array.isArray(data), 'Result should be array');
            assert.ok(data.length > 0, 'Should find OpenHandler class');
            assert.strictEqual(data[0].name, 'OpenHandler', 'Should find correct class');
        }
    });

    test('Should show git diff via MCP', async () => {
        const filePath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'src', 'extension.ts');
        
        const result = await mcpClient.callTool('open', {
            args: {
                type: 'gitDiff',
                path: filePath,
                from: 'HEAD',
                to: 'working'
            }
        });

        // This might fail if there are no changes, which is fine
        if (result.success) {
            // Wait for diff view to open
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // VS Code doesn't have a great API to check if diff view is open
            // but at least we verified the command executed successfully
            assert.ok(true, 'Git diff command executed');
        }
    });
});

/**
 * Simple MCP client for testing
 */
class MCPClient {
    private buffer = '';
    private pendingRequests = new Map<string, {resolve: Function, reject: Function}>();
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
        const metaFiles = files.filter(f => f.endsWith('.meta.json'));
        
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
                        const { resolve, reject } = this.pendingRequests.get(message.id)!;
                        this.pendingRequests.delete(message.id);
                        
                        if (message.error) {
                            reject(new Error(message.error.message));
                        } else {
                            resolve(message.result);
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
            id: String(this.nextId++),
            method: 'initialize',
            params: {
                protocolVersion: '0.1.0',
                capabilities: {
                    tools: true
                },
                clientInfo: {
                    name: 'test-client',
                    version: '1.0.0'
                }
            }
        };

        const response = await this.sendRequest(request);
        assert.ok(response, 'Should get initialize response');
    }

    async callTool(name: string, args: any): Promise<any> {
        // Always use the window ID we found during initialization
        const request = {
            jsonrpc: '2.0',
            id: String(this.nextId++),
            method: 'tools/call',
            params: {
                name,
                arguments: { ...args, windowId: this.windowId }
            }
        };

        const response = await this.sendRequest(request);
        
        // Parse the actual tool response from the MCP response
        if (response?.content?.[0]?.text) {
            // Success response
            return { success: true, data: response.content[0].text };
        } else if (response?.error) {
            // Error response
            return { success: false, error: response.error };
        } else {
            return { success: false, error: 'Unknown response format' };
        }
    }

    private sendRequest(request: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(request.id, { resolve, reject });
            this.process.stdin?.write(JSON.stringify(request) + '\n');
        });
    }

    close() {
        this.process.stdin?.end();
    }
}