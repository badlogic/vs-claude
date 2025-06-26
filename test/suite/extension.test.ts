import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	let extension: vscode.Extension<any> | undefined;

	suiteSetup(async function () {
		// Increase timeout for suite setup
		this.timeout(60000);

		console.log('Starting extension test suite setup...');
		
		// Get the extension
		extension = vscode.extensions.getExtension('vs-claude.vs-claude');
		console.log('Extension found:', !!extension);
		assert.ok(extension, 'Extension should be present');

		// Wait for extension to activate
		if (extension && !extension.isActive) {
			console.log('Activating extension...');
			await extension.activate();
			console.log('Extension activated');
			// Give it more time to fully initialize
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
		
		// Check if VS Claude directory exists
		const vsClaudeDir = path.join(os.homedir(), '.vs-claude');
		console.log('VS Claude directory exists:', fs.existsSync(vsClaudeDir));
		if (fs.existsSync(vsClaudeDir)) {
			const files = fs.readdirSync(vsClaudeDir);
			console.log('Files in VS Claude directory:', files);
		}
	});

	test('Extension should be present', () => {
		assert.ok(extension);
	});

	test('Extension should be active', () => {
		assert.ok(extension?.isActive);
	});

	test('Commands should be registered', async function () {
		this.timeout(10000);

		const commands = await vscode.commands.getCommands();
		assert.ok(commands.includes('vs-claude.showSetup'), 'vs-claude.showSetup command should be registered');
		assert.ok(commands.includes('vs-claude.uninstall'), 'vs-claude.uninstall command should be registered');
	});

	test('VS Claude directory should be created', async function () {
		this.timeout(10000);

		// Wait a bit for the extension to fully initialize
		await new Promise((resolve) => setTimeout(resolve, 500));

		const vsClaudeDir = path.join(os.homedir(), '.vs-claude');
		assert.ok(fs.existsSync(vsClaudeDir), 'VS Claude directory should exist');
	});

	test('Window metadata file should be created', async function () {
		this.timeout(10000);

		const vsClaudeDir = path.join(os.homedir(), '.vs-claude');

		// List files in the directory to find metadata files
		const files = fs.readdirSync(vsClaudeDir);
		const metaFiles = files.filter((f) => f.endsWith('.meta.json'));

		assert.ok(metaFiles.length > 0, 'At least one metadata file should exist');
	});

	test('Command and response files should be created', async function () {
		this.timeout(10000);

		const vsClaudeDir = path.join(os.homedir(), '.vs-claude');

		// List files in the directory
		const files = fs.readdirSync(vsClaudeDir);
		const inFiles = files.filter((f) => f.endsWith('.in'));
		const outFiles = files.filter((f) => f.endsWith('.out'));

		assert.ok(inFiles.length > 0, 'At least one command file should exist');
		assert.ok(outFiles.length > 0, 'At least one response file should exist');
	});
});
