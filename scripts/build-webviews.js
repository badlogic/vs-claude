#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWatchMode = process.argv.includes('--watch');

const viewsDir = path.join(__dirname, '..', 'src', 'views');
const outDir = path.join(__dirname, '..', 'build', 'extension', 'views');

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Build or watch JavaScript files
const jsCommand = [
  'esbuild',
  'src/views/log-viewer-webview.ts',
  'src/views/test-tool-webview.ts',
  '--bundle',
  '--sourcemap',
  '--outdir=build/extension/views',
  '--format=iife',
  '--platform=browser',
  '--external:vscode',
  isWatchMode ? '--watch' : ''
].filter(Boolean).join(' ');

// Build or watch CSS files
const cssCommand = [
  'tailwindcss',
  '-c', 'src/views/tailwind.config.js',
  '-i', 'src/views/styles.css',
  '-o', 'build/extension/views/styles.css',
  isWatchMode ? '--watch' : '--minify'
].filter(Boolean).join(' ');

console.log(`${isWatchMode ? 'Watching' : 'Building'} webviews...`);

if (isWatchMode) {
  // Run both commands in parallel for watch mode
  const { spawn } = require('child_process');
  
  const jsProcess = spawn('npx', jsCommand.split(' '), { 
    stdio: 'inherit',
    shell: true
  });
  
  const cssProcess = spawn('npx', cssCommand.split(' '), { 
    stdio: 'inherit',
    shell: true
  });
  
  // Handle exit
  process.on('SIGINT', () => {
    jsProcess.kill();
    cssProcess.kill();
    process.exit();
  });
} else {
  // Run commands sequentially for build mode
  try {
    console.log('Building JavaScript bundles...');
    execSync(`npx ${jsCommand}`, { stdio: 'inherit' });
    
    console.log('Building CSS...');
    execSync(cssCommand, { stdio: 'inherit' });
    
    console.log('Webview build complete!');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}