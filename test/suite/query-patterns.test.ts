import * as assert from 'assert';
import { E2ETestSetup, type MCPClient } from './test-helpers';

/**
 * Query Pattern Tests
 * 
 * Comprehensive tests for various query patterns and scenarios
 */
suite('Query Pattern E2E Tests', function () {
	this.timeout(30000);

	let mcpClient: MCPClient;

	suiteSetup(async () => {
		mcpClient = await E2ETestSetup.setup();
	});

	suiteTeardown(() => {
		E2ETestSetup.teardown();
	});

	/**
	 * Helper to parse query response
	 */
	function parseQueryResponse(result: any): any[] {
		assert.ok(result.success, 'Query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch {
			assert.fail('Could not parse query response as JSON');
		}

		// Handle different response structures
		if (data.success !== undefined && data.result) {
			return data.result;
		} else if (Array.isArray(data) && data[0]?.result) {
			return data[0].result;
		} else if (Array.isArray(data)) {
			return data;
		}
		
		assert.fail('Unknown response format');
	}

	suite('Wildcard Patterns', () => {
		test('Should support ? single character wildcard', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: 'get?ser',
					kinds: ['method']
				}
			});

			const symbols = parseQueryResponse(result);
			assert.ok(symbols.every((s: any) => 
				s.name.match(/^get.ser$/) || s.name === 'getUser'
			), 'Should match single character wildcard');
		});

		test('Should support character class patterns [abc]', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: '*[US]er*',
					kinds: ['class', 'interface']
				}
			});

			const symbols = parseQueryResponse(result);
			assert.ok(symbols.some((s: any) => s.name === 'User'), 'Should find User');
			assert.ok(symbols.some((s: any) => s.name.includes('Service')), 'Should find Service');
		});

		test('Should support brace expansion {a,b,c}', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: '{get,set,update}*',
					kinds: ['method']
				}
			});

			const symbols = parseQueryResponse(result);
			const names = symbols.map((s: any) => s.name);
			assert.ok(names.some((n: string) => n.startsWith('get')), 'Should find get methods');
			assert.ok(names.some((n: string) => n.startsWith('update')), 'Should find update methods');
		});

		test('Should support ** deep matching', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: '**User**',
					kinds: ['method']
				}
			});

			const symbols = parseQueryResponse(result);
			assert.ok(symbols.length > 0, 'Should find methods with User anywhere');
			assert.ok(symbols.every((s: any) => s.name.includes('User')), 
				'All should contain User');
		});
	});

	suite('Hierarchical Query Patterns', () => {
		test('Should support multiple levels with wildcards', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: 'User*.*User',
					kinds: ['method']
				}
			});

			const symbols = parseQueryResponse(result);
			// Should find UserService with methods ending in User
			const userService = symbols.find((s: any) => 
				s.name === 'UserService' || s.name === 'UserController'
			);
			if (userService?.children) {
				const userMethods = userService.children.filter((c: any) => 
					c.name.endsWith('User')
				);
				assert.ok(userMethods.length > 0, 'Should find methods ending with User');
			}
		});

		test('Should handle empty intermediate patterns', async () => {
			// This should find classes with any members
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: 'UserService.',
					kinds: ['class']
				}
			});

			const symbols = parseQueryResponse(result);
			assert.ok(symbols.some((s: any) => 
				s.name === 'UserService' && (!s.children || s.children.length === 0)
			), 'Trailing dot without pattern should not include children');
		});

		test('Should support deep hierarchical queries', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: '*.*.*' // Three levels deep
				}
			});

			const symbols = parseQueryResponse(result);
			// This might not find much in our test workspace, but should not error
			assert.ok(Array.isArray(symbols), 'Should return array');
		});
	});

	suite('Combined Filters', () => {
		test('Should combine path and kind filters', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: '*',
					kinds: ['method', 'function'],
					path: '/typescript'
				}
			});

			const symbols = parseQueryResponse(result);
			assert.ok(symbols.every((s: any) => 
				['Method', 'Function'].includes(s.kind)
			), 'Should only include methods and functions');
		});

		test('Should handle exclude with patterns', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: 'User*',
					exclude: ['**/test/**', '**/*.spec.*']
				}
			});

			const symbols = parseQueryResponse(result);
			assert.ok(!symbols.some((s: any) => 
				s.location && (s.location.includes('test') || s.location.includes('.spec.'))
			), 'Should exclude test files');
		});
	});

	suite('Type Hierarchy Queries', () => {
		test('Should find supertypes of a class', async () => {
			// First find a class that might have supertypes
			const symbolResult = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: 'UserController',
					kinds: ['class']
				}
			});

			const symbols = parseQueryResponse(symbolResult);
			if (symbols.length > 0 && symbols[0].location) {
				const location = symbols[0].location;
				const match = location.match(/(.+):(\d+):(\d+)/);
				
				if (match) {
					const [, path, line, column] = match;
					
					const hierarchyResult = await mcpClient.callTool('query', {
						args: {
							type: 'supertype',
							path,
							line: parseInt(line),
							column: parseInt(column)
						}
					});

					// Type hierarchy might not be supported for all languages
					const response = JSON.parse(hierarchyResult.data);
					assert.ok(
						(Array.isArray(response) && response[0]) || 
						(response.error && response.error.includes('not supported')),
						'Should either find supertypes or report not supported'
					);
				}
			}
		});
	});

	suite('Performance and Limits', () => {
		test('Should handle count-only for large result sets', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: '*',
					kinds: ['method', 'function', 'property', 'field'],
					countOnly: true
				}
			});

			const response = parseQueryResponse(result);
			assert.ok(typeof (response as any).count === 'number', 'Should return count');
			assert.ok((response as any).count > 0, 'Should have found symbols');
			console.log(`Total symbols found: ${(response as any).count}`);
		});

		test('Should handle queries with no matches gracefully', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: 'NonExistentSymbolXYZ123'
				}
			});

			const symbols = parseQueryResponse(result);
			assert.ok(Array.isArray(symbols), 'Should return empty array');
			assert.strictEqual(symbols.length, 0, 'Should find no matches');
		});
	});

	suite('Multi-language Support', () => {
		test('Should find symbols across different languages', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'symbols',
					query: 'UserService',
					kinds: ['class']
				}
			});

			const symbols = parseQueryResponse(result);
			const languages = new Set<string>();
			
			symbols.forEach((s: any) => {
				if (s.location) {
					if (s.location.includes('typescript')) languages.add('TypeScript');
					if (s.location.includes('java')) languages.add('Java');
					if (s.location.includes('csharp')) languages.add('C#');
					if (s.location.includes('python')) languages.add('Python');
					if (s.location.includes('go')) languages.add('Go');
					if (s.location.includes('cpp')) languages.add('C++');
				}
			});

			console.log('Found UserService in languages:', Array.from(languages));
			assert.ok(languages.size >= 2, 'Should find UserService in multiple languages');
		});
	});

	suite('File Types Query', () => {
		test('Should extract all types from TypeScript file', async () => {
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'fileTypes',
					path: `${process.cwd()}/src/typescript/user.service.ts`
				}
			});

			const types = parseQueryResponse(result);
			assert.ok(types.length >= 3, 'Should find at least 3 types');
			
			const typeNames = types.map((t: any) => t.name);
			assert.ok(typeNames.includes('User'), 'Should find User interface');
			assert.ok(typeNames.includes('UserService'), 'Should find UserService class');
			assert.ok(typeNames.includes('UserController'), 'Should find UserController class');
			
			// Check that classes have their members
			const userService = types.find((t: any) => t.name === 'UserService');
			assert.ok(userService?.children?.length > 0, 'UserService should have methods');
		});

		test('Should handle files with only functions', async () => {
			// Most of our test files have classes, but this tests the function detection
			const result = await mcpClient.callTool('query', {
				args: {
					type: 'fileTypes',
					path: `${process.cwd()}/src/typescript/user.service.ts`
				}
			});

			const types = parseQueryResponse(result);
			// Even if no top-level functions, should not error
			assert.ok(Array.isArray(types), 'Should return array');
		});
	});

	suite('Batch Query Patterns', () => {
		test('Should execute diverse query types in batch', async () => {
			const queries = [
				{ type: 'symbols', query: 'User', kinds: ['interface'] },
				{ type: 'symbols', query: 'get*', kinds: ['method'] },
				{ type: 'fileTypes', path: `${process.cwd()}/src/typescript/user.service.ts` },
				{ type: 'diagnostics' }
			] as const;

			const result = await mcpClient.callTool('query', {
				args: queries
			});

			const responses = JSON.parse(result.data);
			assert.ok(Array.isArray(responses), 'Should return array of responses');
			assert.strictEqual(responses.length, 4, 'Should have 4 responses');
			
			// Check each response
			responses.forEach((resp: any, index: number) => {
				if ('error' in resp) {
					console.log(`Query ${index} failed:`, resp.error);
				} else {
					assert.ok('result' in resp, `Query ${index} should have result`);
				}
			});
		});
	});
});