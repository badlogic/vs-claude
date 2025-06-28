import * as fs from 'fs';
import * as path from 'path';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import { spawnSync, execSync } from 'child_process';

// This function is no longer needed since we use the shared profile setup

async function main() {
	try {
		// Run the extension setup script first
		console.log('Setting up test extensions...');
		const setupScript = path.join(__dirname, '../../scripts/setup-test-extensions.js');
		execSync(`node "${setupScript}"`, { stdio: 'inherit' });

		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
		console.log('Extension development path:', extensionDevelopmentPath);
		console.log(
			'package.json exists:',
			require('fs').existsSync(path.join(extensionDevelopmentPath, 'package.json'))
		);

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		console.log('Extension tests path:', extensionTestsPath);
		console.log('Test index exists:', require('fs').existsSync(extensionTestsPath + '.js'));

		// The test workspace path - use absolute path to compiled location
		const testWorkspacePath = path.resolve(__dirname, './test-workspace');
		console.log('Test workspace path:', testWorkspacePath);
		console.log('Test workspace exists:', require('fs').existsSync(testWorkspacePath));

		// Use the same profile and extensions as development
		// The .vscode-test directory is at the project root, not in build
		const projectRoot = path.resolve(__dirname, '../../../');
		const testDir = path.join(projectRoot, '.vscode-test');
		const profileDir = path.join(testDir, 'profile');
		const extensionsDir = path.join(testDir, 'extensions');

		console.log('Extensions directory:', extensionsDir);
		console.log('Extensions exist:', require('fs').existsSync(extensionsDir));
		if (require('fs').existsSync(extensionsDir)) {
			const extensions = require('fs').readdirSync(extensionsDir);
			console.log('Installed extensions:', extensions.filter((f: string) => !f.startsWith('.')).length);
		}

		// Launch configuration - use test workspace
		const launchArgs = [
			testWorkspacePath, // Open test workspace
			'--disable-workspace-trust', // Don't prompt for trust
			'--skip-welcome', // Skip welcome page
			'--skip-release-notes', // Skip release notes
			'--disable-updates', // Disable update checks during tests
			'--disable-extension-update', // Disable extension updates
			`--user-data-dir=${profileDir}`, // Use the same profile as development
			`--extensions-dir=${extensionsDir}`, // Use the same extensions as development
		];

		console.log('Launch args:', JSON.stringify(launchArgs, null, 2));

		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs,
			extensionTestsEnv: {
				VSCODE_TEST: '1'
			}
		});
	} catch (err) {
		console.error('Failed to run tests:', err);
		process.exit(1);
	}
}

main();
