# Project: VS Claude

VS Code extension that enables AI assistants like Claude to interact with VS Code through the Model Context Protocol (MCP).
TypeScript extension with Go MCP server for file operations.

## Features
- Open files with line highlighting
- Show diffs between files  
- View git diffs (working, staged, commits)
- Multi-window support
- MCP protocol integration
- Webview panel infrastructure with Lit + Tailwind CSS
- Settings panel with bidirectional communication
- Panel state persistence across VS Code restarts

## Commands
- **Check**: `npm run check` (format, lint, typecheck source and tests)
- **Test**: `npm run test` (runs all tests)
- **Build**: `npm run build` (builds extension + panels + MCP binaries)
- **Build Panels**: `npm run build:panels` (builds panel JavaScript and CSS)
- **Watch**: `npm run watch` (development mode)
- **Clean**: `npm run clean` (remove build artifacts)

## Structure

### Core Extension (TypeScript)
- `src/extension.ts` - Main entry point, registers commands, initializes managers
- `src/window-manager.ts` - Manages VS Code window state
- `src/setup.ts` - MCP installation/uninstallation logic
- `src/logger.ts` - Logging utilities with output channel
- `src/command-handler.ts` - Command execution and responses
- `src/tools/open-tool.ts` - File/diff opening implementation
- `src/tools/types.ts` - TypeScript type definitions

### Panel Infrastructure
- `src/panel-base.ts` - Base class for extension-side panel management
- `src/panel-manager.ts` - Manages panel lifecycle and persistence
- `src/webview-base.ts` - Base class for Lit-based webview components
- `src/panels/styles.css` - Tailwind CSS directives for panels
- `src/panels/settings/` - Sample settings panel implementation
  - `panel.ts` - Extension-side settings panel class
  - `webview.ts` - Lit component for settings UI
  - `messages.ts` - TypeScript message types

### MCP Server (Go)
- `mcp/main.go` - MCP server implementation
- `mcp/go.mod` - Go dependencies

### Build Scripts
- `scripts/build-extension.js` - Builds extension with esbuild, copies resources
- `scripts/build-panels.js` - Builds panel JavaScript and CSS with Tailwind
- `scripts/build-mcp-server.sh` - Builds Go MCP server binaries
- `scripts/build-tests.sh` - Prepares test environment
- `scripts/check.sh` - Runs linting and type checking

### Tests
- `test/suite/extension.test.ts` - Basic extension tests
- `test/suite/individual-tools.test.ts` - Unit tests for tools
- `test/suite/mcp-integration.test.ts` - E2E MCP tests
- `test/suite/panel-build.test.ts` - Panel build process tests
- `test/suite/panel-messages.test.ts` - Panel communication E2E tests
- `test/suite/panel-persistence.test.ts` - Panel state persistence tests
- `test/suite/test-helpers.ts` - Test utilities (MCPClient, E2ETestSetup)
- `test/test-workspace/` - Sample files for testing

### Resources
- `resources/logo.png` - Extension logo (automatically copied to build)
- Resources are automatically enumerated and injected into panels

### Configuration
- `package.json` - Extension manifest, scripts, and dependencies
- `tsconfig.json` - TypeScript compiler config for extension
- `tsconfig.panels.json` - TypeScript config for panel components
- `tsconfig.test.json` - TypeScript config for tests
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration for Tailwind
- `biome.json` - Code formatting/linting rules
- `CLAUDE.md` - Project-specific instructions for AI assistants

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

## Panel Infrastructure

### Overview
The extension includes a reusable panel infrastructure for creating webview-based UI panels with bidirectional communication between the extension and the panel content.

### Key Components

#### Panel Base Classes
- `src/webview-base.ts` - Base class for Lit-based webview components
- `src/panel-base.ts` - Base class for extension-side panel management
- `src/panel-manager.ts` - Manages panel lifecycle and persistence

#### Panel Structure
Each panel lives in `src/panels/<panel-name>/` with:
- `webview.ts` - Lit component that runs in the webview context
- `messages.ts` - TypeScript message types for type-safe communication
- `panel.ts` - Extension-side panel class

#### Build System
- `scripts/build-panels.js` - Builds panel JavaScript and CSS
- Panels use esbuild for bundling and Tailwind CSS for styling
- Output goes to `build/panels/`

### Creating a New Panel

1. Create directory: `src/panels/my-panel/`
2. Define message types in `messages.ts`
3. Create Lit component in `webview.ts` extending `WebviewBase`
4. Create panel class in `panel.ts` extending `Panel`
5. Register panel type in `PanelManager`
6. Add command to open panel in `extension.ts`

### Example: Settings Panel
The extension includes a sample settings panel demonstrating:
- Lit components with Tailwind styling
- Bidirectional message passing
- State persistence across VS Code restarts
- Logo and resource loading