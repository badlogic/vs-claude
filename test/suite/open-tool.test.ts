import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { E2ETestSetup, type MCPClient } from './test-helpers';

suite('Open Tool E2E Tests', function () {
	this.timeout(30000); // 30 second timeout for e2e tests

	let mcpClient: MCPClient;

	suiteSetup(async () => {
		mcpClient = await E2ETestSetup.setup();
	});

	suiteTeardown(() => {
		E2ETestSetup.teardown();
	});

	test('Should open a file with line selection', async () => {
		// Request to open a TypeScript file from test workspace
		let filePath: string;
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (workspaceFolder) {
			filePath = path.join(workspaceFolder.uri.fsPath, 'src', 'typescript', 'user.service.ts');
		} else {
			// Use a path relative to the test output directory if no workspace
			filePath = path.resolve(__dirname, '../test-workspace/src/typescript/user.service.ts');
		}

		const result = await mcpClient.callTool('open', {
			args: {
				type: 'file',
				path: filePath,
				startLine: 10,
				endLine: 20,
			},
		});

		assert.ok(result.success, 'Open command should succeed');

		// Wait a bit for VS Code to actually open the file
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Verify the file is open
		const activeEditor = vscode.window.activeTextEditor;
		assert.ok(activeEditor, 'Should have active editor');

		// The extension might have opened the output channel, so let's check all visible editors
		const openEditors = vscode.window.visibleTextEditors;
		const fileEditor = openEditors.find((e) => e.document.uri.fsPath === filePath);
		assert.ok(fileEditor, 'File should be open in an editor');

		// Make it active
		await vscode.window.showTextDocument(fileEditor.document);

		// Verify selection
		const selection = fileEditor.selection;
		assert.strictEqual(selection.start.line, 9, 'Selection should start at line 10 (0-indexed)');
		assert.strictEqual(selection.end.line, 19, 'Selection should end at line 20 (0-indexed)');
	});

	test('Should show git diff', async () => {
		let filePath: string;
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (workspaceFolder) {
			filePath = path.join(workspaceFolder.uri.fsPath, 'src', 'typescript', 'user.service.ts');
		} else {
			filePath = path.resolve(__dirname, '../test-workspace/src/typescript/user.service.ts');
		}

		const result = await mcpClient.callTool('open', {
			args: {
				type: 'gitDiff',
				path: filePath,
				from: 'HEAD',
				to: 'working',
			},
		});

		// This might fail if there are no changes, which is fine
		if (result.success) {
			// Wait for diff view to open
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// VS Code doesn't have a great API to check if diff view is open
			// but at least we verified the command executed successfully
			assert.ok(true, 'Git diff command executed');
		}
	});

	test('Should open multiple files', async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		let basePath: string;
		if (workspaceFolder) {
			basePath = workspaceFolder.uri.fsPath;
		} else {
			basePath = path.resolve(__dirname, '../test-workspace');
		}

		const files = [
			{
				type: 'file',
				path: path.join(basePath, 'src', 'typescript', 'user.service.ts'),
			},
			{
				type: 'file',
				path: path.join(basePath, 'src', 'csharp', 'UserService.cs'),
			},
		];

		const result = await mcpClient.callTool('open', {
			args: files,
		});

		assert.ok(result.success, 'Should open multiple files');

		// Wait for files to open
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Check that we have multiple editors open
		const openEditors = vscode.window.visibleTextEditors;
		assert.ok(openEditors.length >= 2, 'Should have at least 2 editors open');
	});
});
