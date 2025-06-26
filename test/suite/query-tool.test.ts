import * as assert from 'assert';
import { E2ETestSetup, type MCPClient } from './test-helpers';

suite('Query Tool E2E Tests', function () {
	this.timeout(30000); // 30 second timeout for e2e tests

	let mcpClient: MCPClient;

	suiteSetup(async () => {
		mcpClient = await E2ETestSetup.setup();
	});

	suiteTeardown(() => {
		E2ETestSetup.teardown();
	});

	test('Should find symbols by name', async () => {
		// Give language servers time to index the test workspace
		await new Promise((resolve) => setTimeout(resolve, 3000));

		const result = await mcpClient.callTool('query', {
			args: {
				type: 'symbols',
				query: 'UserService',
				kinds: ['class'],
			},
		});

		assert.ok(result.success, 'Query should succeed');
		assert.ok(result.data, 'Should have data');

		// The query tool returns an array of results
		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch {
			// If it's not JSON, it might be the success message
			console.log('Query response:', result.data);
			assert.fail('Could not parse query response as JSON');
		}

		// For batch queries, each result has {success, result}
		if (data.success !== undefined && data.result) {
			// Single query result
			const symbols = data.result;
			assert.ok(Array.isArray(symbols), 'Result should be array');
			console.log('Found symbols:', symbols);
			assert.ok(symbols.length > 0, 'Should find UserService class');
			// UserService exists in multiple languages
			const tsUserService = symbols.find((s: any) => s.name === 'UserService' && (s.path?.includes('typescript') || s.location?.includes('typescript')));
			assert.ok(tsUserService, 'Should find TypeScript UserService');
		} else if (Array.isArray(data) && data[0]?.result) {
			// Batch query result
			const symbols = data[0].result;
			assert.ok(Array.isArray(symbols), 'Result should be array');
			console.log('Found symbols (batch):', symbols);
			assert.ok(symbols.length > 0, 'Should find UserService class');
			const tsUserService = symbols.find((s: any) => s.name === 'UserService' && (s.path?.includes('typescript') || s.location?.includes('typescript')));
			assert.ok(tsUserService, 'Should find TypeScript UserService');
		} else {
			// Direct array of symbols
			assert.ok(Array.isArray(data), 'Result should be array');
			console.log('Found symbols (direct):', data);
			assert.ok(data.length > 0, 'Should find UserService class');
			const tsUserService = data.find((s: any) => s.name === 'UserService' && s.path?.includes('typescript'));
			assert.ok(tsUserService, 'Should find TypeScript UserService');
		}
	});

	test('Should get workspace diagnostics', async () => {
		const result = await mcpClient.callTool('query', {
			args: {
				type: 'diagnostics',
			},
		});

		assert.ok(result.success, 'Diagnostics query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch {
			console.log('Diagnostics response:', result.data);
			assert.fail('Could not parse diagnostics response as JSON');
		}

		// Diagnostics should be an array (might be empty if no errors)
		const diagnostics = data.result || data;
		assert.ok(Array.isArray(diagnostics), 'Diagnostics should be an array');
	});

	test('Should find symbols with wildcards', async () => {
		const result = await mcpClient.callTool('query', {
			args: {
				type: 'symbols',
				query: '*Service',
				kinds: ['class'],
			},
		});

		assert.ok(result.success, 'Wildcard query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch {
			assert.fail('Could not parse query response as JSON');
		}

		// Handle different response structures
		let symbols;
		if (data.success !== undefined && data.result) {
			symbols = data.result;
		} else if (Array.isArray(data) && data[0]?.result) {
			symbols = data[0].result;
		} else {
			symbols = data;
		}
		
		assert.ok(Array.isArray(symbols), 'Result should be array');
		assert.ok(symbols.length > 0, 'Should find service classes');
		assert.ok(
			symbols.every((s: any) => s.name?.endsWith('Service')),
			'All results should end with Service'
		);
	});

	test('Should handle hierarchical queries', async () => {
		const result = await mcpClient.callTool('query', {
			args: {
				type: 'symbols',
				query: 'UserService.*',
			},
		});

		assert.ok(result.success, 'Hierarchical query should succeed');
		assert.ok(result.data, 'Should have data');

		let data: any;
		try {
			data = JSON.parse(result.data);
		} catch {
			assert.fail('Could not parse query response as JSON');
		}

		// Handle different response structures
		let symbols;
		if (data.success !== undefined && data.result) {
			symbols = data.result;
		} else if (Array.isArray(data) && data[0]?.result) {
			symbols = data[0].result;
		} else {
			symbols = data;
		}
		
		assert.ok(Array.isArray(symbols), 'Result should be array');
		console.log('Hierarchical query results:', JSON.stringify(symbols, null, 2));
		assert.ok(symbols.length > 0, 'Should find UserService and its members');

		// Should include both UserService classes and their methods
		const userServices = symbols.filter((s: any) => s.name === 'UserService');
		assert.ok(userServices.length > 0, 'Should find UserService classes');

		// Check if we have a hierarchical result with children
		if (userServices.length > 0 && userServices[0].children) {
			// We got a hierarchical result
			const methodCount = userServices.reduce((sum: number, service: any) => 
				sum + (service.children?.length || 0), 0);
			assert.ok(methodCount > 0, 'Should find methods within UserService children');
		} else {
			// We got a flat result
			const methods = symbols.filter((s: any) => s.name !== 'UserService' && s.kind === 'Method');
			console.log('Found methods:', methods);
			assert.ok(methods.length > 0, 'Should find methods of UserService');
		}
	});
});
