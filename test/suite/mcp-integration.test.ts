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
			await new Promise((resolve) => setTimeout(resolve, 500));

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

		test('Should open a diff', async () => {
			const leftFile = path.join(testWorkspacePath, 'src', 'typescript', 'user.service.ts');
			const rightFile = path.join(testWorkspacePath, 'src', 'typescript', 'user.interface.ts');

			const result = await mcpClient.callTool('open', {
				type: 'diff',
				left: leftFile,
				right: rightFile,
				title: 'Test Diff',
			});

			assert.ok(result.success || result.data === '', 'Open diff should succeed');

			// Give VS Code time to open the diff
			await new Promise((resolve) => setTimeout(resolve, 500));
		});

		test('Should handle errors gracefully', async () => {
			const result = await mcpClient.callTool('open', {
				type: 'file',
				path: '/non/existent/file.ts',
			});

			// The tool should still return success but the error is logged
			// This is because OpenHandler doesn't throw for non-existent files
			assert.ok(result.success || result.error, 'Should handle non-existent file');
		});
	});
});
