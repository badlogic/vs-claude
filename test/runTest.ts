import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Launch configuration - use our project as the workspace
        const launchArgs = [
            extensionDevelopmentPath, // Open our project as workspace
            '--disable-extensions', // Disable other extensions
            '--disable-workspace-trust' // Don't prompt for trust
        ];

        // Download VS Code, unzip it and run the integration test
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            launchArgs 
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();