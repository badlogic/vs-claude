import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { OpenHandler } from '../../src/tools/open-tool';
import type { OpenRequest } from '../../src/tools/types';

/**
 * Individual Tools Unit Tests
 *
 * Tests the individual tool classes directly
 */
suite('Individual Tools Unit Tests', function () {
	this.timeout(30000); // 30 second timeout

	let openHandler: OpenHandler;

	suiteSetup(async () => {
		// For development extensions in test mode, VS Code doesn't list them normally
		// The extension should have already been activated by VS Code
		
		// Wait a bit for extension to fully initialize
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Create tool instances
		openHandler = new OpenHandler();
	});

	// Helper to get test file path
	function getTestFilePath(relativePath: string): string {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		assert.ok(workspaceFolder, 'No workspace folder');
		return path.join(workspaceFolder.uri.fsPath, 'src', relativePath);
	}

	suite('Open Tool', () => {
		test('Should open a single file', async () => {
			const request: OpenRequest[] = [{
				type: 'file',
				path: getTestFilePath('typescript/user.service.ts'),
			}];

			const result = await openHandler.execute(request);
			assert.ok(result.success, 'Should succeed');
			
			// Give VS Code time to open the file
			await new Promise((resolve) => setTimeout(resolve, 100));
			
			// Check if file is open
			const openEditors = vscode.window.visibleTextEditors;
			const isOpen = openEditors.some((editor) => 
				editor.document.uri.fsPath === getTestFilePath('typescript/user.service.ts')
			);
			assert.ok(isOpen, 'File should be open in editor');
		});

		test('Should open a file with line range', async () => {
			const filePath = getTestFilePath('typescript/user.service.ts');
			const request: OpenRequest[] = [{
				type: 'file',
				path: filePath,
				startLine: 10,
				endLine: 20,
			}];

			const result = await openHandler.execute(request);
			assert.ok(result.success, 'Should succeed');
			
			await new Promise((resolve) => setTimeout(resolve, 100));
			
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document.uri.fsPath === filePath) {
				const selection = activeEditor.selection;
				assert.strictEqual(selection.start.line, 9, 'Selection should start at line 10 (0-indexed)');
				assert.strictEqual(selection.end.line, 19, 'Selection should end at line 20 (0-indexed)');
			}
		});

		test('Should open multiple files', async () => {
			const requests: OpenRequest[] = [
				{
					type: 'file',
					path: getTestFilePath('typescript/user.service.ts'),
				},
				{
					type: 'file',
					path: getTestFilePath('python/user_service.py'),
				},
			];

			const result = await openHandler.execute(requests);
			assert.ok(result.success, 'Should succeed');
			
			// Give VS Code more time to open multiple files
			await new Promise((resolve) => setTimeout(resolve, 1000));
			
			// Check open tabs
			const tabGroups = vscode.window.tabGroups;
			let totalTabs = 0;
			tabGroups.all.forEach((group) => {
				totalTabs += group.tabs.length;
			});
			
			assert.ok(totalTabs >= 2, 'Should have at least 2 tabs open');
		});

		test('Should handle errors gracefully', async () => {
			const request: OpenRequest[] = [{
				type: 'file',
				path: '/non/existent/file.ts',
			}];

			const result = await openHandler.execute(request);
			assert.ok(!result.success, 'Should fail for non-existent file');
			if (!result.success) {
				assert.ok(result.error?.includes('Failed to open'), 'Should have error message');
			}
		});
	});
});