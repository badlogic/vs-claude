# Project: VS Claude

VS Code extension that enables AI assistants like Claude to interact with VS Code through the Model Context Protocol (MCP).
TypeScript extension with Go MCP server for file operations.

## Features
- Open files with line highlighting
- Show diffs between files  
- View git diffs (working, staged, commits)
- Multi-window support
- MCP protocol integration

## Commands
- **Check**: `npm run check` (format, lint, typecheck source and tests)
- **Test**: `npm run test` (runs all tests)
- **Build**: `npm run build` (builds extension + MCP binaries)
- **Watch**: `npm run watch` (development mode)
- **Clean**: `npm run clean` (remove build artifacts)

## Structure

### Core Extension (TypeScript)
- `src/extension.ts` - Main entry point, registers commands
- `src/window-manager.ts` - Manages VS Code window state
- `src/setup.ts` - MCP installation/uninstallation logic
- `src/logger.ts` - Logging utilities with output channel
- `src/command-handler.ts` - Command execution and responses
- `src/tools/open-tool.ts` - File/diff opening implementation
- `src/tools/types.ts` - TypeScript type definitions

### MCP Server (Go)
- `mcp/main.go` - MCP server implementation
- `mcp/go.mod` - Go dependencies

### Tests
- `test/suite/extension.test.ts` - Basic extension tests
- `test/suite/individual-tools.test.ts` - Unit tests for tools
- `test/suite/mcp-integration.test.ts` - E2E MCP tests
- `test/suite/test-helpers.ts` - Test utilities (MCPClient, E2ETestSetup)
- `test/test-workspace/` - Sample files for testing

### Configuration
- `package.json` - Extension manifest and scripts
- `tsconfig.json` - TypeScript compiler config
- `biome.json` - Code formatting/linting rules

## Testing

### Running Tests
- `npm test` - Run all test suites
- `npm test -- --file extension.test.ts` - Run tests from a specific file  
- `npm test -- --test-pattern "Should open a file"` - Run tests matching a pattern
- `npm test -- --file individual-tools.test.ts --test-pattern "open a single"` - Combine both filters

### Adding New Tests
1. Create test file in `test/suite/` ending with `.test.ts`
2. Use Mocha's `suite()` and `test()` functions
3. For MCP tests, use the E2ETestSetup helper:

```typescript
import { E2ETestSetup, type MCPClient } from './test-helpers';

suite('My Test Suite', () => {
    let mcpClient: MCPClient;
    
    suiteSetup(async () => {
        mcpClient = await E2ETestSetup.setup();
    });
    
    suiteTeardown(() => {
        E2ETestSetup.teardown();
    });
    
    test('Should do something', async () => {
        const result = await mcpClient.callTool('vs-claude.open', { args });
        assert.ok(result.success);
    });
});
```

### Test Infrastructure
- Tests run in VS Code test environment
- Test workspace with sample files is created automatically
- No language extensions required - tests focus on file operations only
- MCP server binaries must be built before testing