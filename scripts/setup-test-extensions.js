#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Required extensions for testing
const requiredExtensions = [
    'ms-python.python',
    'ms-python.vscode-pylance',
    'golang.go',
    'ms-dotnettools.csharp',
    'redhat.java',
    'llvm-vs-code-extensions.vscode-clangd',
    'Dart-Code.dart-code',
    'Dart-Code.flutter'
];

async function main() {
    console.log('Setting up test extensions...');
    
    // Find the project root - handle both original location and build directory
    let projectRoot;
    if (__dirname.includes('build/scripts')) {
        // Running from build directory
        projectRoot = path.resolve(__dirname, '../..');
    } else {
        // Running from original location
        projectRoot = path.resolve(__dirname, '..');
    }
    const testDir = path.join(projectRoot, '.vscode-test');
    const profileDir = path.join(testDir, 'profile');
    const extensionsDir = path.join(testDir, 'extensions');
    
    // Create directories if they don't exist
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
    }
    if (!fs.existsSync(extensionsDir)) {
        fs.mkdirSync(extensionsDir, { recursive: true });
    }
    
    // Check if extensions are already installed
    let missingExtensions = requiredExtensions;
    try {
        console.log(`Checking extensions in: ${extensionsDir}`);
        const installedOutput = execSync(
            `code --user-data-dir="${profileDir}" --extensions-dir="${extensionsDir}" --list-extensions`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const installedExtensions = installedOutput.trim().split('\n').filter(e => e).map(e => e.toLowerCase());
        
        console.log(`Found ${installedExtensions.length} installed extensions:`, installedExtensions);
        
        // Find missing extensions (case-insensitive comparison)
        missingExtensions = requiredExtensions.filter(ext => 
            !installedExtensions.includes(ext.toLowerCase())
        );
        
        if (missingExtensions.length === 0) {
            console.log('All required extensions are already installed');
            return;
        }
        
        console.log(`Installing ${missingExtensions.length} missing extensions: ${missingExtensions.join(', ')}`);
    } catch (error) {
        console.log('Could not check installed extensions:', error.message);
        console.log('Installing all extensions...');
    }
    
    // Install only missing extensions with proper error handling
    for (const ext of missingExtensions) {
        try {
            console.log(`Installing ${ext}...`);
            execSync(
                `code --user-data-dir="${profileDir}" --extensions-dir="${extensionsDir}" --install-extension "${ext}" --force`,
                { stdio: 'inherit' }
            );
        } catch (error) {
            console.error(`Warning: Failed to install ${ext}. It may require additional dependencies.`);
            // Continue with other extensions even if one fails
        }
    }
    
    console.log('Test extension setup complete!');
}

main();