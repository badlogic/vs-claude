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
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // The test workspace path - use absolute path to compiled location
        const testWorkspacePath = path.resolve(__dirname, './test-workspace');
        console.log('Test workspace path:', testWorkspacePath);
        console.log('Test workspace exists:', require('fs').existsSync(testWorkspacePath));
        
        // Use the same profile and extensions as development
        const testDir = path.resolve(__dirname, '../../.vscode-test');
        const profileDir = path.join(testDir, 'profile');
        const extensionsDir = path.join(testDir, 'extensions');
        
        // Launch configuration - use test workspace
        const launchArgs = [
            testWorkspacePath, // Open test workspace
            '--disable-workspace-trust', // Don't prompt for trust
            '--skip-welcome', // Skip welcome page
            '--skip-release-notes', // Skip release notes
            '--disable-updates', // Disable update checks during tests
            `--user-data-dir=${profileDir}`, // Use the same profile as development
            `--extensions-dir=${extensionsDir}` // Use the same extensions as development
        ];

        // Download VS Code, unzip it and run the integration test
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            launchArgs 
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();