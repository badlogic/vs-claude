#!/bin/bash

set -e

# Parse command line arguments
DEBUG_MODE=false
for arg in "$@"; do
    case $arg in
        --debug)
            DEBUG_MODE=true
            shift
            ;;
    esac
done

echo "Building VS Claude MCP server binaries..."

cd "$(dirname "$0")/.."
cd mcp
mkdir -p ../build/mcp

# Set build flags
BUILD_FLAGS=""
if [ "$DEBUG_MODE" = true ]; then
    echo "Debug mode enabled"
    BUILD_FLAGS="-gcflags='all=-N -l'"
fi

if [ "$DEBUG_MODE" = true ]; then
    # In debug mode, only build for current platform
    echo "Building for current platform only (debug mode)..."
    
    # Determine binary name based on current platform
    BINARY_NAME="mcp-server-"
    GOOS=$(go env GOOS)
    GOARCH=$(go env GOARCH)
    
    if [ "$GOOS" = "darwin" ]; then
        BINARY_NAME+="darwin-$GOARCH"
    elif [ "$GOOS" = "linux" ]; then
        BINARY_NAME+="linux-$GOARCH"
    elif [ "$GOOS" = "windows" ]; then
        BINARY_NAME+="windows-$GOARCH.exe"
    fi
    
    eval go build $BUILD_FLAGS -o ../build/mcp/$BINARY_NAME .
else
    # Build for all platforms in production mode
    # Build for macOS Intel
    echo "Building for macOS Intel..."
    GOOS=darwin GOARCH=amd64 go build -o ../build/mcp/mcp-server-darwin-amd64 .

    # Build for macOS ARM64
    echo "Building for macOS ARM64..."
    GOOS=darwin GOARCH=arm64 go build -o ../build/mcp/mcp-server-darwin-arm64 .

    # Build for Linux
    echo "Building for Linux..."
    GOOS=linux GOARCH=amd64 go build -o ../build/mcp/mcp-server-linux-amd64 .

    # Build for Windows
    echo "Building for Windows..."
    GOOS=windows GOARCH=amd64 go build -o ../build/mcp/mcp-server-windows-amd64.exe .
fi

cd ..

echo "Build complete! Binaries are in the build/mcp/ directory."