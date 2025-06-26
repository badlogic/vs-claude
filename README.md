# VS Claude

A VS Code extension with an integrated MCP server that allows MCP clients like Claude to interact with Visual Studio Code.

## Overview

VS Claude provides two tools for AI assistants:

1. **query** - Semantic code search using VS Code's language intelligence
   - Find symbols (classes, methods, functions) with hierarchical queries
   - Get references, definitions, and diagnostics
   - Explore type hierarchies (supertypes/subtypes)
   - See [`mcp/main.go`](mcp/main.go) for the full tool description

2. **open** - File navigation and diff viewing
   - Open files with line highlighting
   - Show git diffs and file comparisons
   - See [`mcp/main.go`](mcp/main.go) for the full tool description

## Installation

### Option 1: From VS Code Extension Marketplace
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for "VS Claude"
4. Click Install

### Option 2: Build from Source
1. Build the VSIX package:
```bash
git clone https://github.com/your-username/vs-claude.git
cd vs-claude
npm install
npm run build
```

2. Install in VS Code:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Run "Extensions: Install from VSIX..."
   - Select the generated `.vsix` file

### Set up Claude Integration
After installation:
1. Run command "VS Claude: Install MCP"
2. The extension will install the MCP server for Claude
3. Restart Claude to activate




## Architecture

VS Claude consists of two components:

### VS Code Extension (TypeScript)
- Installs the MCP server with Claude CLI
- Implements the business logic for tools using VS Code's Language Server Protocol APIs
- Executes commands from MCP servers in response to tool calls
- Manages file-based IPC for communication

**Commands:**
- `VS Claude: Install MCP` - Install the MCP server with Claude
- `VS Claude: Uninstall MCP` - Remove the MCP server from Claude  
- `VS Claude: Test Query Tool` - Open interactive query tester

### MCP Server (Go)
- Simple proxy that forwards tool calls from MCP clients to VS Code
- Returns responses from VS Code back to the MCP client

### Communication Flow
```
MCP Client (Claude) ↔ MCP Server ↔ File System ↔ VS Code Extension
```

- MCP Server writes commands to `~/.vs-claude/{windowId}.in`
- VS Code Extension writes responses to `~/.vs-claude/{windowId}.out`
- Each VS Code window has a unique ID with metadata in `~/.vs-claude/{windowId}.meta.json`
- When multiple windows are open, the MCP server returns an error listing available windows


## Development

### Prerequisites
- Node.js 16+
- Go 1.21+
- VS Code

### Scripts

```bash
npm run build  # Build TypeScript and Go binaries
npm run check  # Format, lint, and type check all code
npm run test   # Run e2e tests (builds MCP server, compiles tests, launches VS Code)
npm run clean  # Remove build artifacts
```

### Project Structure
```
vs-claude/
├── src/                 # TypeScript extension source
│   ├── extension.ts     # Main entry point
│   ├── query-handler.ts # Query tool implementation
│   ├── open-handler.ts  # Open tool implementation
│   ├── command-handler.ts # Command dispatcher
│   ├── window-manager.ts # Window IPC management
│   └── setup.ts         # MCP installation logic
├── mcp/                 # Go MCP server source
│   └── main.go         # MCP server implementation
├── test/                # Test suite
│   ├── suite/
│   │   ├── open-tool.test.ts  # Open tool e2e tests
│   │   ├── query-tool.test.ts # Query tool e2e tests
│   │   ├── extension.test.ts  # Extension unit tests
│   │   └── test-helpers.ts    # Shared test utilities
│   ├── test-workspace/  # Multi-language test project
│   │   └── src/        # Sample code in various languages
│   ├── setup-test-workspace.js # Git setup for tests
│   └── runTest.ts      # Test runner
├── bin/                # Built binaries (generated)
└── out/                # Compiled TypeScript (generated)
```

### Testing

The project includes comprehensive end-to-end tests that:
- Launch VS Code with the extension in a dedicated test workspace
- Spawn the MCP server as a subprocess
- Act as an MCP client sending real commands
- Verify actual VS Code behavior (files open, queries return results, etc.)

#### Test Workspace

The `test/test-workspace` directory contains a multi-language sample project used for testing:
- **Purpose**: Provides consistent test files for language server features
- **Languages**: TypeScript, C#, Go, Java, Python, C, C++
- **Git Integration**: Automatically initialized as a git repository with test changes for diff testing
- **Isolation**: Tests run in an isolated VS Code instance with this workspace

Run tests with:
```bash
npm test
```

The test process:
1. Cleans and rebuilds the extension
2. Compiles test files
3. Copies test workspace to output directory
4. Initializes git repository with test changes
5. Launches VS Code with the test workspace
6. Runs all test suites

## Troubleshooting

### Tool Not Available
1. Ensure VS Code is running with the extension installed
2. Check that the MCP server is configured: `claude mcp list`
3. Restart Claude after installation

### Query Returns Empty Results
- Language servers activate lazily - open a file of the target language first
- Check your query syntax - dots (.) control hierarchy depth
- Try simpler queries first

### Multiple VS Code Windows
When multiple windows are open, you'll get an error listing available windows. Include the windowId in subsequent calls:
```javascript
mcp_vs-claude_query({
  args: {"type": "symbols", "query": "UserService"},
  windowId: "window-123"
})
```


## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

[License information here]