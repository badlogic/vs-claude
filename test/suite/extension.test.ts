import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	let _extension: vscode.Extension<any> | undefined;

	suiteSetup(async function () {
		// Increase timeout for suite setup
		this.timeout(60000);

		// For development extensions in test mode, VS Code doesn't list them normally
		// Instead, we need to verify the extension is active by checking its effects
		// The extension should have already been activated by VS Code

		// Wait a bit for extension to fully initialize
		await new Promise((resolve) => setTimeout(resolve, 2000));
	});

	test('Extension is loaded by checking commands', async () => {
		// Since development extensions don't show up in extensions list,
		// we verify the extension is active by checking its commands
		const commands = await vscode.commands.getCommands();
		assert.ok(commands.includes('vs-claude.showSetup'), 'vs-claude.showSetup command should be registered');
		assert.ok(commands.includes('vs-claude.uninstall'), 'vs-claude.uninstall command should be registered');
	});

	test('VS Claude directory should be created', async function () {
		this.timeout(10000);

		// Check immediately - extension should already be initialized

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
