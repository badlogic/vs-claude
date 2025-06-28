const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testWorkspacePath = path.join(__dirname, '../build/extension/test/test-workspace');

// Ensure test workspace exists
if (!fs.existsSync(testWorkspacePath)) {
    console.error('Test workspace not found at:', testWorkspacePath);
    process.exit(1);
}

console.log('Setting up test workspace at:', testWorkspacePath);

// Change to test workspace directory
process.chdir(testWorkspacePath);

try {
    // Check if .git directory exists and remove it to start fresh
    const gitDir = path.join(testWorkspacePath, '.git');
    if (fs.existsSync(gitDir)) {
        console.log('Removing existing git repository...');
        fs.rmSync(gitDir, { recursive: true, force: true });
    }
    
    // Initialize git repository
    console.log('Initializing git repository...');
    execSync('git init', { stdio: 'inherit' });
    
    // Configure git (minimal config for tests)
    execSync('git config user.email "test@example.com"', { stdio: 'inherit' });
    execSync('git config user.name "Test User"', { stdio: 'inherit' });
    
    // Add all files and commit
    console.log('Creating initial commit...');
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Initial test commit"', { stdio: 'inherit' });
    
    // Modify a file for git diff test
    console.log('Modifying TypeScript file for git diff test...');
    const tsFilePath = path.join(testWorkspacePath, 'src/typescript/user.service.ts');
    const content = fs.readFileSync(tsFilePath, 'utf8');
    const modifiedContent = content.replace(
        'console.log(`User ${user.id} created`);',
        'console.log(`User ${user.id} created successfully!`);'
    );
    fs.writeFileSync(tsFilePath, modifiedContent);
    
    console.log('Test workspace setup complete!');
} catch (error) {
    console.error('Error setting up test workspace:', error.message);
    process.exit(1);
}