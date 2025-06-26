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

        // The test workspace path - use absolute path to compiled location
        const testWorkspacePath = path.resolve(__dirname, './test-workspace');
        console.log('Test workspace path:', testWorkspacePath);
        console.log('Test workspace exists:', require('fs').existsSync(testWorkspacePath));
        
        // Launch configuration - use test workspace
        const launchArgs = [
            testWorkspacePath, // Open test workspace
            '--disable-workspace-trust', // Don't prompt for trust
            '--skip-welcome', // Skip welcome page
            '--skip-release-notes' // Skip release notes
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