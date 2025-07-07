#!/bin/bash

set -e

echo "Building for tests..."

# Clean build directory
rm -rf build

# Build extension and MCP server in debug mode
echo "Building extension and MCP server in debug mode..."
node scripts/build-extension.js --debug
./scripts/build-mcp-server.sh --debug

# Compile TypeScript test files
echo "Compiling test files..."
npx tsc -p ./tsconfig.test.json

# Copy test workspace
echo "Copying test workspace..."
cp -r test/test-workspace build/extension/test/

# Copy scripts directory
echo "Copying scripts..."
cp -r scripts build/

# Copy logo.png if it exists
cp logo.png build/extension/ 2>/dev/null || true

# Setup test workspace
echo "Setting up test workspace..."
node test/setup-test-workspace.js

echo "Test build complete!"