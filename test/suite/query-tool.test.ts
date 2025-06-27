import * as assert from 'assert';
import { E2ETestSetup, type MCPClient } from './test-helpers';

/**
 * Individual Query Tools E2E Tests
 * 
 * Tests the individual query tools through the MCP server
 */
suite('Individual Query Tools E2E Tests', function () {
	this.timeout(30000); // 30 second timeout

	let mcpClient: MCPClient;

	suiteSetup(async () => {
		mcpClient = await E2ETestSetup.setup();
	});

	suiteTeardown(() => {
		E2ETestSetup.teardown();
	});

	test('Should find symbols by name', async () => {
		// Give language servers time to initialize and index the test workspace
		console.log('Waiting for language servers to initialize...');
		await new Promise((resolve) => setTimeout(resolve, 5000));

		const result = await mcpClient.callTool('symbols', {
			query: 'UserService',
			kinds: ['class']
		});

		console.log('Raw result:', JSON.stringify(result, null, 2));
		assert.ok(result.success, 'Query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch (err) {
			console.error('Failed to parse response:', result.data);
			console.error('Parse error:', err);
			assert.fail('Could not parse query response as JSON');
		}

		// Individual tool response format: {success: boolean, data: any}
		assert.ok(data.success, 'Query should succeed');
		assert.ok(data.data, 'Should have data');
		const symbols = data.data;
		
		assert.ok(Array.isArray(symbols), 'Result should be array');
		assert.ok(symbols.length > 0, 'Should find UserService class');
		// UserService exists in multiple languages
		const tsUserService = symbols.find((s: any) => s.name === 'UserService' && s.location?.includes('typescript'));
		assert.ok(tsUserService, 'Should find TypeScript UserService');
	});

	test('Should get workspace diagnostics', async () => {
		const result = await mcpClient.callTool('diagnostics', {});

		assert.ok(result.success, 'Diagnostics query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch (err) {
			console.error('Failed to parse response:', result.data);
			console.error('Parse error:', err);
			assert.fail('Could not parse query response as JSON');
		}

		// Individual tool response format
		assert.ok(data.success, 'Diagnostics should succeed');
		assert.ok(Array.isArray(data.data), 'Diagnostics data should be an array');
	});

	test('Should find symbols with wildcards', async () => {
		const result = await mcpClient.callTool('symbols', {
			query: '*Service',
			kinds: ['class']
		});

		assert.ok(result.success, 'Wildcard query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch (err) {
			console.error('Failed to parse response:', result.data);
			console.error('Parse error:', err);
			assert.fail('Could not parse query response as JSON');
		}

		// Individual tool response format
		assert.ok(data.success, 'Query should succeed');
		const symbols = data.data;
		
		assert.ok(Array.isArray(symbols), 'Result should be array');
		
		// Check that we found classes ending with Service
		let foundServiceClass = false;
		for (const symbol of symbols) {
			if (symbol.name?.endsWith('Service')) {
				foundServiceClass = true;
				break;
			}
			if (symbol.children) {
				for (const child of symbol.children) {
					if (child.name?.endsWith('Service')) {
						foundServiceClass = true;
						break;
					}
				}
			}
		}
		assert.ok(foundServiceClass, 'Should find at least one class ending with Service');
	});

	test('Should handle hierarchical queries', async () => {
		const result = await mcpClient.callTool('symbols', {
			query: 'UserService.*'
		});

		assert.ok(result.success, 'Hierarchical query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch (err) {
			console.error('Failed to parse response:', result.data);
			console.error('Parse error:', err);
			assert.fail('Could not parse query response as JSON');
		}

		// Individual tool response format
		assert.ok(data.success, 'Query should succeed');
		const symbols = data.data;
		
		assert.ok(Array.isArray(symbols), 'Result should be array');
		
		// Filter to just UserService results
		const userServices = symbols.filter((s: any) => s.name === 'UserService');
		assert.ok(userServices.length > 0, 'Should find UserService classes');

		// Check if we have a hierarchical result with children
		if (userServices.length > 0 && userServices[0].children) {
			// We got a hierarchical result
			const methodCount = userServices.reduce((sum: number, service: any) => 
				sum + (service.children?.length || 0), 0);
			assert.ok(methodCount > 0, 'Should find methods within UserService children');
		}
	});
});