#!/bin/bash

set -e

echo "Building VS Claude MCP server binaries..."

cd "$(dirname "$0")/.."
cd mcp
mkdir -p ../bin

# Build for macOS Intel
echo "Building for macOS Intel..."
GOOS=darwin GOARCH=amd64 go build -o ../bin/mcp-server-darwin-amd64 .

# Build for macOS ARM64
echo "Building for macOS ARM64..."
GOOS=darwin GOARCH=arm64 go build -o ../bin/mcp-server-darwin-arm64 .

# Build for Linux
echo "Building for Linux..."
GOOS=linux GOARCH=amd64 go build -o ../bin/mcp-server-linux-amd64 .

# Build for Windows
echo "Building for Windows..."
GOOS=windows GOARCH=amd64 go build -o ../bin/mcp-server-windows-amd64.exe .

cd ..

echo "Build complete! Binaries are in the bin/ directory."