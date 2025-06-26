import * as fs from 'fs';
import * as path from 'path';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import { spawnSync } from 'child_process';

async function installExtensions(vscodeExecutablePath: string) {
    console.log('Checking and installing required language extensions...');
    console.log('VS Code executable path:', vscodeExecutablePath);
    console.log('Executable exists:', fs.existsSync(vscodeExecutablePath));
    
    // List of extensions needed for our test languages
    const extensions = [
        'ms-python.python',              // Python
        'golang.go',                     // Go
        'ms-dotnettools.csharp',         // C#
        'redhat.java',                   // Java
        'ms-vscode.cpptools',            // C/C++
        'Dart-Code.dart-code',           // Dart
        'ms-python.vscode-pylance',      // Python language server
    ];

    // Check if extensions marker file exists
    // Determine the installation directory based on the executable path
    let installDir: string;
    if (process.platform === 'darwin') {
        // On macOS, extract the .vscode-test directory path
        installDir = vscodeExecutablePath.split('/Visual Studio Code.app')[0];
    } else {
        // On Linux/Windows, go up from bin/code to the VS Code directory
        installDir = path.dirname(path.dirname(vscodeExecutablePath));
    }
    const markerFile = path.join(installDir, '.extensions-installed');
    console.log('Marker file path:', markerFile);
    if (fs.existsSync(markerFile)) {
        console.log('Language extensions already installed, skipping...');
        return;
    }

    // Install each extension
    let allSuccessful = true;
    const installedExtensions: string[] = [];
    
    for (const ext of extensions) {
        console.log(`Installing ${ext}...`);
        const result = spawnSync(vscodeExecutablePath, ['--install-extension', ext, '--force'], {
            encoding: 'utf8',
            shell: false
        });
        
        if (result.status !== 0) {
            // Check if it's actually installed despite the error
            const stdout = result.stdout || '';
            const stderr = result.stderr || '';
            
            if (stdout.includes('is already installed') || 
                stdout.includes('was successfully installed') ||
                stderr.includes('is already installed')) {
                console.log(`${ext} installed (despite exit code ${result.status})`);
                installedExtensions.push(ext);
            } else {
                allSuccessful = false;
                console.error(`Failed to install ${ext} with exit code ${result.status}`);
                if (result.error) {
                    console.error('Error:', result.error.message);
                }
                if (stderr) {
                    console.error('Stderr:', stderr);
                }
                if (stdout) {
                    console.log('Stdout:', stdout);
                }
            }
        } else {
            console.log(`Successfully installed ${ext}`);
            installedExtensions.push(ext);
        }
    }
    
    // Only create marker file if ALL extensions were installed successfully
    if (allSuccessful) {
        fs.writeFileSync(markerFile, JSON.stringify({
            date: new Date().toISOString(),
            extensions: installedExtensions
        }, null, 2));
        console.log('All language extensions installed successfully.');
    } else {
        console.warn('Some extensions failed to install. Will retry on next run.');
        console.log(`Successfully installed: ${installedExtensions.join(', ') || 'none'}`);
    }
}

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
        
        // First, ensure VS Code is downloaded
        const vscodeVersion = 'stable';
        const vscodePath = await downloadAndUnzipVSCode(vscodeVersion);
        console.log('Downloaded VS Code path:', vscodePath);
        
        // Determine the executable path based on platform
        let vscodeExecutablePath: string;
        if (process.platform === 'darwin') {
            // On macOS, vscodePath points to the executable, not the app bundle
            // We need to go back to find the code CLI tool
            const appPath = vscodePath.split('/Contents/')[0];
            vscodeExecutablePath = path.join(appPath, 'Contents', 'Resources', 'app', 'bin', 'code');
        } else if (process.platform === 'win32') {
            vscodeExecutablePath = path.join(vscodePath, '..', 'bin', 'code.cmd');
        } else {
            vscodeExecutablePath = path.join(vscodePath, '..', 'bin', 'code');
        }
        
        // Install extensions if they don't exist
        await installExtensions(vscodeExecutablePath);
        
        // Launch configuration - use test workspace
        const launchArgs = [
            testWorkspacePath, // Open test workspace
            '--disable-workspace-trust', // Don't prompt for trust
            '--skip-welcome', // Skip welcome page
            '--skip-release-notes', // Skip release notes
            '--disable-updates' // Disable update checks during tests
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