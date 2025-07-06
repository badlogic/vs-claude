import { runTests } from '@vscode/test-electron';
import * as path from 'path';

// This function is no longer needed since we use the shared profile setup

async function main() {
	try {
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
		console.log('Test index exists:', require('fs').existsSync(`${extensionTestsPath}.js`));

		// The test workspace path - use absolute path to compiled location
		const testWorkspacePath = path.resolve(__dirname, './test-workspace');
		console.log('Test workspace path:', testWorkspacePath);
		console.log('Test workspace exists:', require('fs').existsSync(testWorkspacePath));

		// Clean VS Code test environment - no extensions needed

		// Launch configuration - use test workspace
		const launchArgs = [
			testWorkspacePath, // Open test workspace
			'--disable-workspace-trust', // Don't prompt for trust
			'--skip-welcome', // Skip welcome page
			'--skip-release-notes', // Skip release notes
			'--disable-updates', // Disable update checks during tests
			'--disable-extension-update', // Disable extension updates
		];

		console.log('Launch args:', JSON.stringify(launchArgs, null, 2));

		// Parse CLI arguments
		const args = process.argv.slice(2);
		let testFile: string | undefined;
		let testPattern: string | undefined;

		for (let i = 0; i < args.length; i++) {
			if (args[i] === '--file' && i + 1 < args.length) {
				testFile = args[i + 1];
				i++;
			} else if (args[i] === '--test-pattern' && i + 1 < args.length) {
				testPattern = args[i + 1];
				i++;
			}
		}

		if (testFile) {
			console.log('Test file filter:', testFile);
		}
		if (testPattern) {
			console.log('Test pattern filter:', testPattern);
		}

		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs,
			extensionTestsEnv: {
				VSCODE_TEST: '1',
				TEST_FILE: testFile || '',
				TEST_PATTERN: testPattern || '',
			},
		});
	} catch (err) {
		console.error('Failed to run tests:', err);
		process.exit(1);
	}
}

main();
