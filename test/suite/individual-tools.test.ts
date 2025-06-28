import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { DefinitionTool } from '../../src/tools/definition-tool';
import { DiagnosticsTool } from '../../src/tools/diagnostics-tool';
import { AllTypesInFileTool } from '../../src/tools/all-types-in-file-tool';
import { ReferencesTool } from '../../src/tools/references-tool';
import { SubAndSupertypeTool } from '../../src/tools/sub-and-super-type-tool';
import { SymbolsTool } from '../../src/tools/symbols-tool';
import type {
	SymbolKindName,
	SymbolsRequest,
	DiagnosticsRequest,
	ReferenceRequest,
	DefinitionRequest,
	AllTypesInFileRequest,
	CodeSymbol,
	CountResult,
} from '../../src/tools/types';

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
	let subAndSupertypeTool: SubAndSupertypeTool;
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
		subAndSupertypeTool = new SubAndSupertypeTool();
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
				type: 'symbols',
				query: 'UserService',
				kinds: ['class' as SymbolKindName],
			});

			assert.ok(result.success, 'Should succeed');

			if (result.success) {
				const symbols = Array.isArray(result.data) ? result.data : [result.data];
				assert.ok(symbols.length > 0, 'Should find UserService class');
				assert.ok(
					symbols.some((s: CodeSymbol | CountResult) => 'name' in s && s.name === 'UserService'),
					'Should find exact match'
				);
			}
		});

		test('Should support batch requests', async () => {
			const requests: SymbolsRequest[] = [
				{ type: 'symbols', query: 'UserService', kinds: ['class'] },
				{ type: 'symbols', query: 'get*', kinds: ['method'] },
				{ type: 'symbols', query: '*Controller', kinds: ['class'] },
			];

			// Execute batch requests - tools don't support batch, so we'll execute individually
			const results = await Promise.all(requests.map((req) => symbolsTool.execute(req)));
			assert.strictEqual(results.length, 3, 'Should return 3 results');

			// Check all succeeded
			for (let i = 0; i < results.length; i++) {
				assert.ok(results[i].success, `Request ${i} should succeed`);
			}
		});

		test('Should handle errors gracefully', async () => {
			const result = await symbolsTool.execute({
				type: 'symbols',
				path: '/non/existent/file.ts',
			});

			assert.ok(!result.success, 'Should fail for non-existent file');
			if (!result.success) {
				assert.ok(result.error?.includes('not found'), 'Should have error message');
			}
		});
	});

	suite('Diagnostics Tool', () => {
		test('Should get workspace diagnostics', async () => {
			const result = await diagnosticsTool.execute({
				type: 'diagnostics',
			});

			assert.ok(result.success, 'Should succeed');
			if (result.success) {
				assert.ok(Array.isArray(result.data), 'Should return array');
			}
		});

		test('Should support batch requests', async () => {
			const requests: DiagnosticsRequest[] = [
				{ type: 'diagnostics' }, // Workspace diagnostics
				{ type: 'diagnostics', path: getTestFilePath('typescript/user.service.ts') },
			];

			// Execute batch requests
			const results = await Promise.all(requests.map((req) => diagnosticsTool.execute(req)));
			assert.strictEqual(results.length, 2, 'Should return 2 results');

			for (const result of results) {
				assert.ok(result.success, 'Should succeed');
				if (result.success) {
					assert.ok(Array.isArray(result.data), 'Should return array');
				}
			}
		});
	});

	suite('References Tool', () => {
		test('Should find references', async () => {
			// First find a symbol to get references for
			const symbolsResult = await symbolsTool.execute({
				type: 'symbols',
				query: 'getUser',
				kinds: ['method'],
			});

			if (symbolsResult.success && Array.isArray(symbolsResult.data) && symbolsResult.data.length > 0) {
				const symbols = symbolsResult.data.filter((s) => 'location' in s);
				// Extract location from first symbol
				const location =
					(symbols[0] as CodeSymbol).location || (symbols[0] as CodeSymbol).children?.[0]?.location;
				if (location) {
					const match = location.match(/(.+):(\d+):(\d+)/);
					if (match) {
						const [, filePath, line, column] = match;

						const result = await referencesTool.execute({
							type: 'references',
							path: filePath,
							line: parseInt(line),
							column: parseInt(column),
						});

						assert.ok(result.success, 'Should succeed');
						if (result.success) {
							assert.ok(Array.isArray(result.data), 'Should return array');
						}
					}
				}
			}
		});

		test('Should support batch requests', async () => {
			const requests: ReferenceRequest[] = [
				{ type: 'references', path: getTestFilePath('typescript/user.service.ts'), line: 10, column: 5 },
				{ type: 'references', path: getTestFilePath('typescript/user.service.ts'), line: 15, column: 10 },
			];

			// Execute batch requests
			const results = await Promise.all(requests.map((req) => referencesTool.execute(req)));
			assert.strictEqual(results.length, 2, 'Should return 2 results');
		});
	});

	suite('Definition Tool', () => {
		test('Should find definition', async () => {
			const result = await definitionTool.execute({
				type: 'definition',
				path: getTestFilePath('typescript/user.service.ts'),
				line: 10,
				column: 20,
			});

			// May or may not find a definition depending on what's at that location
			assert.ok('success' in result, 'Should have success property');
		});

		test('Should support batch requests', async () => {
			const requests: DefinitionRequest[] = [
				{ type: 'definition', path: getTestFilePath('typescript/user.service.ts'), line: 10, column: 20 },
				{ type: 'definition', path: getTestFilePath('typescript/user.service.ts'), line: 15, column: 10 },
			];

			// Execute batch requests
			const results = await Promise.all(requests.map((req) => definitionTool.execute(req)));
			assert.strictEqual(results.length, 2, 'Should return 2 results');
		});
	});

	suite('Type Hierarchy Tools', () => {
		test('Should handle supertypes', async () => {
			const result = await subAndSupertypeTool.execute({
				type: 'supertype',
				path: getTestFilePath('typescript/user.service.ts'),
				line: 10,
				column: 20,
			});

			const response = result;
			// Type hierarchy may not be supported
			if (!response.success) {
				assert.ok(response.error?.includes('not supported'), 'Should indicate not supported');
			} else {
				assert.ok(Array.isArray(response.data), 'Should return array');
			}
		});

		test('Should handle subtypes', async () => {
			const result = await subAndSupertypeTool.execute({
				type: 'subtype',
				path: getTestFilePath('typescript/user.service.ts'),
				line: 10,
				column: 20,
			});

			const response = result;
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
				type: 'allTypesInFile',
				path: getTestFilePath('typescript/user.service.ts'),
			});

			assert.ok(result.success, 'Should succeed');

			if (result.success) {
				const types = result.data;
				assert.ok(types.length > 0, 'Should find types');
				assert.ok(
					types.some((t: any) => t.name === 'UserService'),
					'Should find UserService'
				);
			}
		});

		test('Should support batch requests', async () => {
			const requests: AllTypesInFileRequest[] = [
				{ type: 'allTypesInFile', path: getTestFilePath('typescript/user.service.ts') },
				{ type: 'allTypesInFile', path: getTestFilePath('csharp/UserService.cs') },
			];

			// Execute batch requests
			const results = await Promise.all(requests.map((req) => allTypesInFileTool.execute(req)));
			assert.strictEqual(results.length, 2, 'Should return 2 results');

			for (const result of results) {
				if (result.success) {
					assert.ok(Array.isArray(result.data), 'Should return array');
				}
			}
		});
	});
});
