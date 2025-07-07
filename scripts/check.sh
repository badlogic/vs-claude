#!/bin/bash

set -e

echo "Running code quality checks..."

# Run Biome for linting and formatting
echo "Running Biome checks..."
npx biome check --write ./src ./test

# Format Go code
echo "Formatting Go code..."
cd mcp
go fmt ./...
cd ..

# Type check main source
echo "Type checking source files..."
npx tsc --noEmit

# Type check test files
echo "Type checking test files..."
npx tsc -p ./tsconfig.test.json --noEmit

echo "All checks passed!"