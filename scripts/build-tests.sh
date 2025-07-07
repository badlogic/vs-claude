#!/bin/bash

set -e

echo "Building for tests..."

# Clean build directory
rm -rf build

# Build extension and MCP server in debug mode
echo "Building extension and MCP server in debug mode..."
node scripts/build-extension.js --debug
node scripts/build-panels.js
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

# Copy resources if they exist
if [ -d "resources" ]; then
    cp -r resources build/extension/
fi

# Setup test workspace
echo "Setting up test workspace..."
node test/setup-test-workspace.js

echo "Test build complete!"