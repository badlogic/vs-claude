import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { E2ETestSetup, type MCPClient } from './test-helpers';

/**
 * MCP Integration Tests
 *
 * Tests the MCP server integration with the VS Code extension tools
 * Based on the current implementation in src/tools/ and src/command-handler.ts
 */
suite('MCP Integration Tests', function () {
	this.timeout(60000); // 60 second timeout for MCP tests

	let mcpClient: MCPClient;
	let testWorkspacePath: string;

	suiteSetup(async () => {
		mcpClient = await E2ETestSetup.setup();

		// Get the test workspace path
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		assert.ok(workspaceFolder, 'Test workspace should be open');
		testWorkspacePath = workspaceFolder.uri.fsPath;

		// Open files to activate language servers
		try {
			const tsFile = vscode.Uri.file(path.join(testWorkspacePath, 'src', 'typescript', 'user.service.ts'));
			await vscode.window.showTextDocument(tsFile);
			console.log('Opened TypeScript file to activate language server');

			const pyFile = vscode.Uri.file(path.join(testWorkspacePath, 'src', 'python', 'user_service.py'));
			await vscode.window.showTextDocument(pyFile);
			console.log('Opened Python file to activate language server');
			
			// Check if Python extension is active
			const pythonExt = vscode.extensions.getExtension('ms-python.python');
			if (pythonExt) {
				console.log('Python extension found, active:', pythonExt.isActive);
				if (!pythonExt.isActive) {
					console.log('Activating Python extension...');
					await pythonExt.activate();
				}
			} else {
				console.log('Python extension not found!');
			}
			
			// Also check Pylance
			const pylanceExt = vscode.extensions.getExtension('ms-python.vscode-pylance');
			if (pylanceExt) {
				console.log('Pylance extension found, active:', pylanceExt.isActive);
			}
		} catch (err) {
			console.log('Failed to open files for language server activation:', err);
		}

		// Give language servers more time to initialize (especially Python/Pylance)
		console.log('Waiting for language servers to fully initialize...');
		await new Promise((resolve) => setTimeout(resolve, 10000));
	});

	suiteTeardown(() => {
		E2ETestSetup.teardown();
	});

	suite('Open Tool Tests', () => {
		test('Should open a file', async () => {
			const filePath = path.join(testWorkspacePath, 'src', 'typescript', 'user.service.ts');

			const result = await mcpClient.callTool('open', {
				type: 'file',
				path: filePath,
			});

			// The open tool returns an empty string on success
			assert.ok(result.success || result.data === '', 'Open command should succeed');

			// Give VS Code time to open the file
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Check if file is open
			const openEditors = vscode.window.visibleTextEditors;
			const isOpen = openEditors.some((editor) => editor.document.uri.fsPath === filePath);
			assert.ok(isOpen, 'File should be open in editor');
		});

		test('Should open a file with line range', async () => {
			const filePath = path.join(testWorkspacePath, 'src', 'typescript', 'user.service.ts');

			const result = await mcpClient.callTool('open', {
				type: 'file',
				path: filePath,
				startLine: 10,
				endLine: 20,
			});

			assert.ok(result.success || result.data === '', 'Open command should succeed');

			await new Promise((resolve) => setTimeout(resolve, 100));

			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document.uri.fsPath === filePath) {
				const selection = activeEditor.selection;
				assert.strictEqual(selection.start.line, 9, 'Selection should start at line 10 (0-indexed)');
				assert.strictEqual(selection.end.line, 19, 'Selection should end at line 20 (0-indexed)');
			}
		});

		test('Should open multiple files', async () => {
			const files = [
				{
					type: 'file' as const,
					path: path.join(testWorkspacePath, 'src', 'typescript', 'user.service.ts'),
				},
				{
					type: 'file' as const,
					path: path.join(testWorkspacePath, 'src', 'python', 'user_service.py'),
				},
			];

			const result = await mcpClient.callTool('open', files);
			assert.ok(result.success || result.data === '', 'Open command should succeed');

			// Give VS Code more time to open multiple files
			console.log('Waiting for editors to open...');
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Check open tabs instead of visible editors
			const tabGroups = vscode.window.tabGroups;
			let totalTabs = 0;
			const openFiles: string[] = [];

			tabGroups.all.forEach((group) => {
				group.tabs.forEach((tab) => {
					totalTabs++;
					// Check if tab has a URI (file tabs do)
					const tabInput = tab.input as any;
					if (tabInput?.uri) {
						openFiles.push(tabInput.uri.fsPath);
					}
				});
			});

			console.log('Total open tabs:', totalTabs);
			console.log('Open files:', openFiles);

			// Also log visible editors for comparison
			const openEditors = vscode.window.visibleTextEditors;
			console.log('Number of visible editors:', openEditors.length);
			console.log(
				'Visible editor files:',
				openEditors.map((e) => e.document.fileName)
			);

			assert.ok(totalTabs >= 2, 'Should have at least 2 tabs open');
		});
	});

	suite('Symbols Tool Tests', () => {
		test('Should find symbols by exact name', async () => {
			const result = await mcpClient.callTool('symbols', {
				query: 'UserService',
				kinds: ['class'],
			});

			assert.ok(result.success, 'Query should succeed');
			assert.ok(result.data, 'Should have data');

			// Parse the response - MCP returns the VS Code tool result as JSON string
			const symbols = JSON.parse(result.data);
			assert.ok(Array.isArray(symbols), 'Result should be array');
			assert.ok(symbols.length > 0, 'Should find UserService class');

			const userService = symbols.find((s: any) => s.name === 'UserService');
			assert.ok(userService, 'Should find UserService');
			assert.strictEqual(userService.kind, 'Class', 'Should be a class');
		});

		test('Should support wildcard patterns', async () => {
			const result = await mcpClient.callTool('symbols', {
				query: 'get*',
				kinds: ['method'],
			});

			assert.ok(result.success, 'Query should succeed');
			const symbols = JSON.parse(result.data);
			assert.ok(Array.isArray(symbols), 'Result should be array');

			// Should find methods starting with 'get'
			const getMethods = flattenSymbols(symbols).filter(
				(s: any) => s.name.startsWith('get') && s.kind === 'Method'
			);
			assert.ok(getMethods.length > 0, 'Should find methods starting with get');
		});

		test('Should support hierarchical queries', async () => {
			const result = await mcpClient.callTool('symbols', {
				query: 'UserService.*',
			});

			assert.ok(result.success, 'Query should succeed');
			const symbols = JSON.parse(result.data);
			const userService = symbols.find((s: any) => s.name === 'UserService');
			assert.ok(userService, 'Should find UserService');
			assert.ok(userService.children && userService.children.length > 0, 'UserService should have child members');
		});

		test('Should support count-only queries', async () => {
			const result = await mcpClient.callTool('symbols', {
				query: 'UserService',
				kinds: ['class'],
				countOnly: true,
			});

			assert.ok(result.success, 'Query should succeed');
			const data = JSON.parse(result.data);
			assert.ok(typeof data.count === 'number', 'Should return count');
			assert.ok(data.count > 0, 'Should return a valid count');
		});
	});

	suite('Diagnostics Tool Tests', () => {
		test('Should get workspace diagnostics', async () => {
			const result = await mcpClient.callTool('diagnostics', {});

			assert.ok(result.success, 'Diagnostics should succeed');
			const diagnostics = JSON.parse(result.data);
			assert.ok(Array.isArray(diagnostics), 'Diagnostics should be array');

			// Check diagnostic structure if any exist
			if (diagnostics.length > 0) {
				const diag = diagnostics[0];
				assert.ok(diag.path, 'Diagnostic should have path');
				assert.ok(diag.severity, 'Diagnostic should have severity');
				assert.ok(diag.message, 'Diagnostic should have message');
			}
		});

		test('Should get file-specific diagnostics', async () => {
			const filePath = path.join(testWorkspacePath, 'src', 'typescript', 'user.service.ts');
			const result = await mcpClient.callTool('diagnostics', {
				path: filePath,
			});

			assert.ok(result.success, 'Diagnostics should succeed');
			const diagnostics = JSON.parse(result.data);
			assert.ok(Array.isArray(diagnostics), 'Diagnostics should be array');

			// All diagnostics should be for the requested file
			for (const diag of diagnostics) {
				assert.ok(diag.path.includes('user.service.ts'), 'Diagnostic should be for requested file');
			}
		});
	});

	suite('AllTypesInFile Tool Tests', () => {
		test('Should extract types from TypeScript file', async () => {
			const filePath = path.join(testWorkspacePath, 'src', 'typescript', 'user.service.ts');
			const result = await mcpClient.callTool('allTypesInFile', {
				path: filePath,
			});

			assert.ok(result.success, 'Query should succeed');
			const types = JSON.parse(result.data);
			assert.ok(Array.isArray(types), 'Result should be array');
			assert.ok(types.length > 0, 'Should find types in file');

			// Should find the UserService class
			const userService = types.find((t: any) => t.name === 'UserService' && t.kind === 'Class');
			assert.ok(userService, 'Should find UserService class');
			assert.ok(userService.children && userService.children.length > 0, 'UserService should have members');
		});

		// TODO: Fix Python language server initialization in tests
		// The Python LSP doesn't initialize properly during tests because LSP init is skipped when VSCODE_TEST is set
		test.skip('Should handle files in different languages', async () => {
			const filePath = path.join(testWorkspacePath, 'src', 'python', 'user_service.py');

			// Ensure Python language server is active by opening the file
			try {
				const pyFile = vscode.Uri.file(filePath);
				await vscode.window.showTextDocument(pyFile);
				console.log('Opened Python file to ensure language server is active');
				await new Promise((resolve) => setTimeout(resolve, 2000));
			} catch (err) {
				console.log('Failed to open Python file:', err);
			}

			const result = await mcpClient.callTool('allTypesInFile', {
				path: filePath,
			});

			assert.ok(result.success, 'Query should succeed');
			const types = JSON.parse(result.data);
			assert.ok(Array.isArray(types), 'Result should be array');

			console.log('Python file types found:', types.length);
			console.log(
				'Types:',
				types.map((t: any) => `${t.name} (${t.kind})`)
			);

			// Python files should have classes or functions
			const hasTypes = types.some((t: any) => t.kind === 'Class' || t.kind === 'Function');
			assert.ok(hasTypes, 'Should find types in Python file');
		});
	});

	suite('Batch Request Tests', () => {
		test('Should handle batch symbol requests', async () => {
			const requests = [
				{ query: 'UserService', kinds: ['class'] as any },
				{ query: 'get*', kinds: ['method'] as any },
				{ query: '*Controller', kinds: ['class'] as any },
			];

			const result = await mcpClient.callTool('symbols', requests);
			assert.ok(result.success, 'Batch query should succeed');

			// For batch requests, the command handler wraps the results
			const batchData = JSON.parse(result.data);
			assert.ok(Array.isArray(batchData), 'Batch response should be array');
			assert.strictEqual(batchData.length, 3, 'Should have 3 responses');

			// Check each response
			for (let i = 0; i < batchData.length; i++) {
				assert.ok(batchData[i].success, `Request ${i} should succeed`);
				assert.ok(Array.isArray(batchData[i].data), `Request ${i} should return array`);
			}
		});
	});
});

/**
 * Helper to flatten symbols with children into a flat array
 */
function flattenSymbols(symbols: any[]): any[] {
	const result: any[] = [];

	for (const symbol of symbols) {
		result.push(symbol);
		if (symbol.children) {
			result.push(...flattenSymbols(symbol.children));
		}
	}

	return result;
}
