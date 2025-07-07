#!/usr/bin/env node

const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatchMode = process.argv.includes('--watch');
const isDebugMode = process.argv.includes('--debug');

async function buildExtension() {
  const options = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'build/extension/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node16',
    sourcemap: true,
    minify: !isWatchMode && !isDebugMode,
    logLevel: 'info',
  };

  if (isWatchMode) {
    const ctx = await build({ ...options, watch: true });
    console.log('Watching for changes...');
  } else {
    await build(options);
    
    // Copy all resources to build directory
    const resourcesDir = path.join(__dirname, '..', 'resources');
    const destResourcesDir = path.join(__dirname, '..', 'build', 'extension', 'resources');
    
    if (fs.existsSync(resourcesDir)) {
      fs.mkdirSync(destResourcesDir, { recursive: true });
      
      // Copy all files from resources directory
      const copyRecursive = (src, dest) => {
        const stats = fs.statSync(src);
        if (stats.isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
          });
        } else {
          fs.copyFileSync(src, dest);
        }
      };
      
      copyRecursive(resourcesDir, destResourcesDir);
    }
    
    console.log('Extension build complete!');
  }
}

buildExtension().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});