#!/usr/bin/env node

const { build } = require('esbuild');
const path = require('path');

const isWatchMode = process.argv.includes('--watch');

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
    minify: !isWatchMode,
    logLevel: 'info',
  };

  if (isWatchMode) {
    const ctx = await build({ ...options, watch: true });
    console.log('Watching for changes...');
  } else {
    await build(options);
    console.log('Extension build complete!');
  }
}

buildExtension().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});