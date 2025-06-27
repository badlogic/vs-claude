import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { QueryHandler, type QueryRequest } from '../../src/query-handler';

/**
 * Query Handler Unit Tests
 * 
 * Tests the QueryHandler class directly without going through MCP
 */
suite('Query Handler Unit Tests', function () {
	this.timeout(30000); // 30 second timeout

	let queryHandler: QueryHandler;

	suiteSetup(async () => {
		// Wait for VS Code to fully activate
		const extension = vscode.extensions.getExtension('vs-claude.vs-claude');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		// Create query handler instance
		queryHandler = new QueryHandler();

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

	suite('Symbol Queries', () => {
		test('Should find exact symbol match', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: 'UserService',
				kinds: ['class']
			});

			assert.ok(Array.isArray(result), 'Result should be array');
			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find UserService');
			
			const tsUserService = symbols.find(s => 
				s.name === 'UserService' && 
				s.location.includes('typescript')
			);
			assert.ok(tsUserService, 'Should find TypeScript UserService');
			assert.strictEqual(tsUserService.kind, 'Class');
		});

		test('Should find symbols with wildcards at end', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: 'get*',
				kinds: ['method']
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find methods starting with get');
			// Check that we found methods starting with 'get' (they'll be in children of parent classes)
			let foundGetMethods = false;
			for (const symbol of symbols) {
				if (symbol.children) {
					for (const child of symbol.children) {
						if (child.name.startsWith('get') && child.kind === 'Method') {
							foundGetMethods = true;
							break;
						}
					}
				}
				if (symbol.name.startsWith('get') && symbol.kind === 'Method') {
					foundGetMethods = true;
				}
			}
			assert.ok(foundGetMethods, 'Should find methods starting with get');
		});

		test('Should find symbols with wildcards at start', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '*User',
				kinds: ['method']
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find methods ending with User');
			// Check that we found methods ending with 'User' (they'll be in children of parent classes)
			let foundUserMethods = false;
			for (const symbol of symbols) {
				if (symbol.children) {
					for (const child of symbol.children) {
						if (child.name.endsWith('User') && child.kind === 'Method') {
							foundUserMethods = true;
							break;
						}
					}
				}
				if (symbol.name.endsWith('User') && symbol.kind === 'Method') {
					foundUserMethods = true;
				}
			}
			assert.ok(foundUserMethods, 'Should find methods ending with User');
		});

		test('Should find symbols with wildcards in middle', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: 'get*User*',
				kinds: ['method']
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			// Check that we found methods matching pattern (they'll be in children of parent classes)
			let foundMatchingMethods = false;
			for (const symbol of symbols) {
				if (symbol.children) {
					for (const child of symbol.children) {
						if (child.name.startsWith('get') && child.name.includes('User') && child.kind === 'Method') {
							foundMatchingMethods = true;
							break;
						}
					}
				}
				if (symbol.name.startsWith('get') && symbol.name.includes('User') && symbol.kind === 'Method') {
					foundMatchingMethods = true;
				}
			}
			assert.ok(foundMatchingMethods, 'Should find methods matching pattern');
		});

		test('Should handle hierarchical queries - one level', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: 'UserService.*'
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find UserService with members');
			
			// Find a UserService with children
			const userServiceWithChildren = symbols.find((s: any) => 
				s.name === 'UserService' && s.children && s.children.length > 0
			);
			assert.ok(userServiceWithChildren, 'Should find UserService with children');
			assert.ok(userServiceWithChildren.children.length > 0, 'Should have methods');
			
			// Check that children have correct structure
			const firstChild = userServiceWithChildren.children[0];
			assert.ok(firstChild.name, 'Child should have name');
			assert.ok(firstChild.kind, 'Child should have kind');
			assert.ok(firstChild.location, 'Child should have location');
		});

		test('Should handle hierarchical queries with pattern', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: 'UserService.get*',
				kinds: ['method']
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find UserService with get methods');
			
			const userService = symbols.find((s: any) => s.name === 'UserService');
			assert.ok(userService, 'Should find UserService');
			if (userService.children) {
				const getMethods = userService.children.filter((c: any) => c.name.startsWith('get'));
				assert.ok(getMethods.length > 0, 'Should have get methods');
			}
		});

		test('Should filter by multiple symbol kinds', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '*',
				kinds: ['class', 'interface'],
				path: getTestFilePath('typescript/user.service.ts')
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length >= 2, 'Should find both class and interface');
			assert.ok(symbols.some(s => s.kind === 'Class'), 'Should find class');
			assert.ok(symbols.some(s => s.kind === 'Interface'), 'Should find interface');
		});

		test('Should handle countOnly option', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '*',
				kinds: ['method'],
				countOnly: true
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const countResult = response.result as { count: number };
			assert.ok(typeof countResult.count === 'number', 'Should return count');
			assert.ok(countResult.count > 0, 'Should have methods');
		});

		test('Should search in specific file', async () => {
			const filePath = getTestFilePath('typescript/user.service.ts');
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '*',
				path: filePath
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find symbols in file');
			assert.ok(symbols.every(s => s.location.startsWith(filePath)), 
				'All symbols should be from specified file');
		});

		test('Should search in folder', async () => {
			const folderPath = getTestFilePath('typescript');
			const result = await queryHandler.execute({
				type: 'symbols',
				query: 'User*',
				path: folderPath
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find symbols in folder');
			assert.ok(symbols.every(s => s.location.includes('typescript')), 
				'All symbols should be from typescript folder');
		});

		test('Should handle exclude patterns', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: 'UserService',
				exclude: ['**/python/**', '**/java/**']
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(!symbols.some(s => s.location.includes('python')), 
				'Should not include Python files');
			assert.ok(!symbols.some(s => s.location.includes('java')), 
				'Should not include Java files');
		});

		test('Should handle type kind filter', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '*',
				kinds: ['type'],
				path: getTestFilePath('typescript/user.service.ts')
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const symbols = response.result as any[];
			assert.ok(symbols.length > 0, 'Should find type symbols');
			assert.ok(symbols.every(s => 
				['Class', 'Interface', 'Struct', 'Enum'].includes(s.kind)
			), 'Should only include type-related symbols');
		});
	});

	suite('Reference Queries', () => {
		test('Should find references to a method', async () => {
			// First find the method
			const symbolResult = await queryHandler.execute({
				type: 'symbols',
				query: 'getUser',
				kinds: ['method'],
				path: getTestFilePath('typescript/user.service.ts')
			});

			const symbolResponse = symbolResult[0];
			assert.ok('result' in symbolResponse, 'Should find symbol');
			const symbols = symbolResponse.result as any[];
			assert.ok(symbols.length > 0, 'Should find getUser method');

			// Extract location info
			const location = symbols[0].location;
			const match = location.match(/(.+):(\d+):(\d+)-/);
			assert.ok(match, 'Should parse location');

			const [, path, line, column] = match;

			// Find references
			const refResult = await queryHandler.execute({
				type: 'references',
				path,
				line: parseInt(line),
				column: parseInt(column)
			});

			const refResponse = refResult[0];
			assert.ok('result' in refResponse, 'Should have result');
			
			const references = refResponse.result as any[];
			assert.ok(Array.isArray(references), 'Should return array of references');
			// At least the definition itself should be found
			assert.ok(references.length >= 1, 'Should find at least the definition');
		});
	});

	suite('Definition Queries', () => {
		test('Should find definition of a symbol', async () => {
			const filePath = getTestFilePath('typescript/user.service.ts');
			// Find a usage of UserService in UserController constructor
			const result = await queryHandler.execute({
				type: 'definition',
				path: filePath,
				line: 47, // UserController constructor line
				column: 35 // Position of UserService parameter
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const definitions = response.result as any[];
			assert.ok(Array.isArray(definitions), 'Should return array');
			
			if (definitions.length > 0) {
				const def = definitions[0];
				assert.ok(def.path, 'Should have path');
				assert.ok(def.range, 'Should have range');
				assert.ok(def.preview, 'Should have preview');
			}
		});
	});

	suite('Diagnostics Queries', () => {
		test('Should get all workspace diagnostics', async () => {
			const result = await queryHandler.execute({
				type: 'diagnostics'
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const diagnostics = response.result as any[];
			assert.ok(Array.isArray(diagnostics), 'Should return array');
			// May be empty if no errors
		});

		test('Should get file-specific diagnostics', async () => {
			const result = await queryHandler.execute({
				type: 'diagnostics',
				path: getTestFilePath('typescript/user.service.ts')
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const diagnostics = response.result as any[];
			assert.ok(Array.isArray(diagnostics), 'Should return array');
			
			if (diagnostics.length > 0) {
				const diag = diagnostics[0];
				assert.ok(diag.path, 'Should have path');
				assert.ok(diag.severity, 'Should have severity');
				assert.ok(diag.message, 'Should have message');
			}
		});
	});

	suite('File Types Queries', () => {
		test('Should get all types and top-level functions', async () => {
			const result = await queryHandler.execute({
				type: 'fileTypes',
				path: getTestFilePath('typescript/user.service.ts')
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const types = response.result as any[];
			assert.ok(Array.isArray(types), 'Should return array');
			assert.ok(types.length >= 3, 'Should find User interface and both classes');
			
			// Check we found the interface
			const userInterface = types.find(t => t.name === 'User' && t.kind === 'Interface');
			assert.ok(userInterface, 'Should find User interface');
			
			// Check we found the classes
			const userService = types.find(t => t.name === 'UserService' && t.kind === 'Class');
			assert.ok(userService, 'Should find UserService class');
			assert.ok(userService.children && userService.children.length > 0, 
				'UserService should have methods as children');
			
			const userController = types.find(t => t.name === 'UserController' && t.kind === 'Class');
			assert.ok(userController, 'Should find UserController class');
		});

		test('Should include nested types', async () => {
			// Create a test file with nested types
			const testFile = getTestFilePath('test-nested.ts');
			await vscode.workspace.fs.writeFile(
				vscode.Uri.file(testFile),
				Buffer.from(`
					export class OuterClass {
						interface NestedInterface {
							value: string;
						}
						
						enum NestedEnum {
							One,
							Two
						}
						
						doSomething() {}
					}
					
					export function topLevelFunction() {}
				`)
			);

			// Give time for language server to index
			await new Promise(resolve => setTimeout(resolve, 1000));

			const result = await queryHandler.execute({
				type: 'fileTypes',
				path: testFile
			});

			const response = result[0];
			assert.ok('result' in response, 'Should have result');
			
			const types = response.result as any[];
			
			// Clean up test file
			await vscode.workspace.fs.delete(vscode.Uri.file(testFile));
			
			assert.ok(types.some(t => t.name === 'OuterClass'), 'Should find outer class');
			assert.ok(types.some(t => t.name === 'NestedInterface'), 'Should find nested interface');
			assert.ok(types.some(t => t.name === 'NestedEnum'), 'Should find nested enum');
			assert.ok(types.some(t => t.name === 'topLevelFunction'), 'Should find top-level function');
		});
	});

	suite('Batch Queries', () => {
		test('Should execute multiple queries in parallel', async () => {
			const queries: QueryRequest[] = [
				{ type: 'symbols', query: 'UserService', kinds: ['class'] },
				{ type: 'symbols', query: 'get*', kinds: ['method'] },
				{ type: 'diagnostics' }
			];

			const results = await queryHandler.execute(queries);
			
			assert.strictEqual(results.length, 3, 'Should return 3 results');
			
			// Check first query
			assert.ok('result' in results[0], 'First query should succeed');
			const symbols1 = results[0].result as any[];
			assert.ok(symbols1.length > 0, 'Should find UserService');
			
			// Check second query
			assert.ok('result' in results[1], 'Second query should succeed');
			const symbols2 = results[1].result as any[];
			assert.ok(symbols2.length > 0, 'Should find get methods');
			
			// Check third query
			assert.ok('result' in results[2], 'Third query should succeed');
			const diagnostics = results[2].result as any[];
			assert.ok(Array.isArray(diagnostics), 'Diagnostics should be array');
		});

		test('Should handle partial failures in batch', async () => {
			const queries: QueryRequest[] = [
				{ type: 'symbols', query: 'UserService' },
				{ type: 'symbols', path: '/non/existent/path.ts' }, // This should fail
				{ type: 'diagnostics' }
			];

			const results = await queryHandler.execute(queries);
			
			assert.strictEqual(results.length, 3, 'Should return 3 results');
			
			// First should succeed
			assert.ok('result' in results[0], 'First query should succeed');
			
			// Second should fail
			assert.ok('error' in results[1], 'Second query should fail');
			
			// Third should succeed
			assert.ok('result' in results[2], 'Third query should succeed');
		});
	});

	suite('Error Cases', () => {
		test('Should handle non-existent file gracefully', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				path: '/non/existent/file.ts'
			});

			const response = result[0];
			assert.ok('error' in response, 'Should return error');
			assert.ok(response.error.includes('not found') || response.error.includes('not accessible'), 
				'Error should mention file not found');
		});

		test('Should reject overly broad queries', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '*' // No filters, workspace scope
			});

			const response = result[0];
			assert.ok('error' in response, 'Should return error');
			assert.ok(response.error.includes('too broad'), 'Error should mention query too broad');
		});

		test('Should handle invalid query type', async () => {
			const result = await queryHandler.execute({
				type: 'invalidType' as any,
				query: 'test'
			});

			const response = result[0];
			assert.ok('error' in response, 'Should return error');
			assert.ok(response.error.includes('Unknown query type'), 'Error should mention unknown type');
		});

		test('Should handle missing required parameters', async () => {
			const result = await queryHandler.execute({
				type: 'references'
				// Missing required path, line, column
			} as any);

			const response = result[0];
			assert.ok('error' in response, 'Should return error');
		});
	});

	suite('Special Characters and Edge Cases', () => {
		test('Should handle paths with spaces', async () => {
			const testFile = getTestFilePath('file with spaces.ts');
			await vscode.workspace.fs.writeFile(
				vscode.Uri.file(testFile),
				Buffer.from('export class TestClass {}')
			);

			await new Promise(resolve => setTimeout(resolve, 1000));

			const result = await queryHandler.execute({
				type: 'symbols',
				path: testFile
			});

			await vscode.workspace.fs.delete(vscode.Uri.file(testFile));

			const response = result[0];
			assert.ok('result' in response, 'Should handle paths with spaces');
		});

		test('Should handle symbols with special characters', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '*',
				kinds: ['operator']
			});

			const response = result[0];
			// May or may not find operators depending on language server
			assert.ok('result' in response || 'error' in response, 'Should complete');
		});

		test('Should handle empty query patterns', async () => {
			const result = await queryHandler.execute({
				type: 'symbols',
				query: '',
				path: getTestFilePath('typescript/user.service.ts')
			});

			const response = result[0];
			assert.ok('result' in response, 'Should handle empty query');
			const symbols = response.result as any[];
			// Empty query defaults to '*' and should match all symbols in the file
			assert.ok(symbols.length > 0, 'Empty query should default to * and match symbols');
		});
	});
});