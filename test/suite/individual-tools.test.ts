import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { DefinitionTool } from '../../src/tools/definition-tool';
import { DiagnosticsTool } from '../../src/tools/diagnostics-tool';
import { AllTypesInFileTool } from '../../src/tools/all-types-in-file-tool';
import { ReferencesTool } from '../../src/tools/references-tool';
import { SubtypeTool } from '../../src/tools/subtype-tool';
import { SupertypeTool } from '../../src/tools/supertype-tool';
import { SymbolsTool } from '../../src/tools/symbols-tool';
import type { SymbolKindName } from '../../src/tools/types';

/**
 * Individual Tools Unit Tests
 * 
 * Tests the individual tool classes directly
 */
suite('Individual Tools Unit Tests', function () {
	this.timeout(30000); // 30 second timeout

	let symbolsTool: SymbolsTool;
	let diagnosticsTool: DiagnosticsTool;
	let referencesTool: ReferencesTool;
	let definitionTool: DefinitionTool;
	let supertypeTool: SupertypeTool;
	let subtypeTool: SubtypeTool;
	let allTypesInFileTool: AllTypesInFileTool;

	suiteSetup(async () => {
		// Wait for VS Code to fully activate
		const extension = vscode.extensions.getExtension('vs-claude.vs-claude');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		// Create tool instances
		symbolsTool = new SymbolsTool();
		diagnosticsTool = new DiagnosticsTool();
		referencesTool = new ReferencesTool();
		definitionTool = new DefinitionTool();
		supertypeTool = new SupertypeTool();
		subtypeTool = new SubtypeTool();
		allTypesInFileTool = new AllTypesInFileTool();

		// Give language servers time to initialize
		console.log('Waiting for language servers to initialize...');
		await new Promise((resolve) => setTimeout(resolve, 5000));
	});

	// Helper to get test file path
	function getTestFilePath(relativePath: string): string {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		assert.ok(workspaceFolder, 'No workspace folder');
		return path.join(workspaceFolder.uri.fsPath, 'src', relativePath);
	}

	suite('Symbols Tool', () => {
		test('Should find exact symbol matches', async () => {
			const result = await symbolsTool.execute({
				query: 'UserService',
				kinds: ['class' as SymbolKindName]
			});

			const response = result[0];
			assert.ok(response.success, 'Should succeed');
			
			const symbols = response.data as any[];
			assert.ok(symbols.length > 0, 'Should find UserService class');
			assert.ok(symbols.some(s => s.name === 'UserService'), 'Should find exact match');
		});

		test('Should support batch requests', async () => {
			const requests = [
				{ query: 'UserService', kinds: ['class' as SymbolKindName] },
				{ query: 'get*', kinds: ['method' as SymbolKindName] },
				{ query: '*Controller', kinds: ['class' as SymbolKindName] }
			];

			const results = await symbolsTool.execute(requests);
			assert.strictEqual(results.length, 3, 'Should return 3 results');
			
			// Check all succeeded
			for (let i = 0; i < results.length; i++) {
				assert.ok(results[i].success, `Request ${i} should succeed`);
			}
		});

		test('Should handle errors gracefully', async () => {
			const result = await symbolsTool.execute({
				path: '/non/existent/file.ts'
			});

			const response = result[0];
			assert.ok(!response.success, 'Should fail for non-existent file');
			assert.ok(response.error?.includes('not found'), 'Should have error message');
		});
	});

	suite('Diagnostics Tool', () => {
		test('Should get workspace diagnostics', async () => {
			const result = await diagnosticsTool.execute({});

			const response = result[0];
			assert.ok(response.success, 'Should succeed');
			assert.ok(Array.isArray(response.data), 'Should return array');
		});

		test('Should support batch requests', async () => {
			const requests = [
				{}, // Workspace diagnostics
				{ path: getTestFilePath('typescript/user.service.ts') }
			];

			const results = await diagnosticsTool.execute(requests);
			assert.strictEqual(results.length, 2, 'Should return 2 results');
			
			for (const result of results) {
				assert.ok(result.success, 'Should succeed');
				assert.ok(Array.isArray(result.data), 'Should return array');
			}
		});
	});

	suite('References Tool', () => {
		test('Should find references', async () => {
			// First find a symbol to get references for
			const symbolsResult = await symbolsTool.execute({
				query: 'getUser',
				kinds: ['method']
			});

			const symbolsResponse = symbolsResult[0];
			if (symbolsResponse.success && (symbolsResponse.data as any[]).length > 0) {
				const symbols = symbolsResponse.data as any[];
				// Extract location from first symbol
				const location = symbols[0].location || (symbols[0].children?.[0]?.location);
				if (location) {
					const match = location.match(/(.+):(\d+):(\d+)/);
					if (match) {
						const [, filePath, line, column] = match;
						
						const result = await referencesTool.execute({
							path: filePath,
							line: parseInt(line),
							column: parseInt(column)
						});

						const response = result[0];
						assert.ok(response.success, 'Should succeed');
						assert.ok(Array.isArray(response.data), 'Should return array');
					}
				}
			}
		});

		test('Should support batch requests', async () => {
			const requests = [
				{ path: getTestFilePath('typescript/user.service.ts'), line: 10, column: 5 },
				{ path: getTestFilePath('typescript/user.service.ts'), line: 15, column: 10 }
			];

			const results = await referencesTool.execute(requests);
			assert.strictEqual(results.length, 2, 'Should return 2 results');
		});
	});

	suite('Definition Tool', () => {
		test('Should find definition', async () => {
			const result = await definitionTool.execute({
				path: getTestFilePath('typescript/user.service.ts'),
				line: 10,
				column: 20
			});

			const response = result[0];
			// May or may not find a definition depending on what's at that location
			assert.ok('success' in response, 'Should have success property');
		});

		test('Should support batch requests', async () => {
			const requests = [
				{ path: getTestFilePath('typescript/user.service.ts'), line: 10, column: 20 },
				{ path: getTestFilePath('typescript/user.service.ts'), line: 15, column: 10 }
			];

			const results = await definitionTool.execute(requests);
			assert.strictEqual(results.length, 2, 'Should return 2 results');
		});
	});

	suite('Type Hierarchy Tools', () => {
		test('Should handle supertypes', async () => {
			const result = await supertypeTool.execute({
				path: getTestFilePath('typescript/user.service.ts'),
				line: 10,
				column: 20
			});

			const response = result[0];
			// Type hierarchy may not be supported
			if (!response.success) {
				assert.ok(response.error?.includes('not supported'), 'Should indicate not supported');
			} else {
				assert.ok(Array.isArray(response.data), 'Should return array');
			}
		});

		test('Should handle subtypes', async () => {
			const result = await subtypeTool.execute({
				path: getTestFilePath('typescript/user.service.ts'),
				line: 10,
				column: 20
			});

			const response = result[0];
			// Type hierarchy may not be supported
			if (!response.success) {
				assert.ok(response.error?.includes('not supported'), 'Should indicate not supported');
			} else {
				assert.ok(Array.isArray(response.data), 'Should return array');
			}
		});
	});

	suite('File Types Tool', () => {
		test('Should extract types from file', async () => {
			const result = await allTypesInFileTool.execute({
				path: getTestFilePath('typescript/user.service.ts')
			});

			const response = result[0];
			assert.ok(response.success, 'Should succeed');
			
			const types = response.data as any[];
			assert.ok(types.length > 0, 'Should find types');
			assert.ok(types.some(t => t.name === 'UserService'), 'Should find UserService');
		});

		test('Should support batch requests', async () => {
			const requests = [
				{ path: getTestFilePath('typescript/user.service.ts') },
				{ path: getTestFilePath('csharp/UserService.cs') }
			];

			const results = await allTypesInFileTool.execute(requests);
			assert.strictEqual(results.length, 2, 'Should return 2 results');
			
			for (const result of results) {
				if (result.success) {
					assert.ok(Array.isArray(result.data), 'Should return array');
				}
			}
		});
	});
});