# VS Claude

A VS Code extension with an integrated MCP server that allows MCP clients like Claude to interact with Visual Studio Code.

## Overview

VS Claude provides these tools for AI assistants to interact with VS Code:

### Navigation Tools

1. **open** - Open files, diffs, and symbols in VS Code
   - Open files with line highlighting
   - Show git diffs and file comparisons
   - Jump to specific lines or ranges
   - See [`mcp/main.go`](mcp/main.go) for the full tool description

### Code Intelligence Tools

2. **symbols** - Find code elements by pattern with support for wildcards and hierarchical queries
   - Supports wildcards (*, ?, [abc], {a,b,c}, **) and hierarchical queries (Class.method)
   - Filter by symbol types (class, method, function, etc.)
   - Search in specific files, folders, or entire workspace
   - **Batch support**: Execute multiple symbol searches in parallel

3. **references** - Find all usages of a symbol at a specific location
   - Requires symbol location from symbols tool
   - Returns file paths with preview of usage
   - **Batch support**: Find references for multiple symbols

4. **definition** - Get the definition location of a symbol
   - Jump to where a symbol is defined
   - Returns location with preview and symbol kind
   - **Batch support**: Get definitions for multiple symbols

5. **diagnostics** - Get errors and warnings from the language server
   - Get all workspace diagnostics or for specific files
   - Returns severity, message, and location
   - **Batch support**: Check multiple files

6. **fileTypes** - Get all types and top-level functions in a file
   - Extract classes, interfaces, structs, enums
   - Include top-level functions
   - Returns complete type hierarchy with members
   - **Batch support**: Analyze multiple files

7. **supertype** - Find what a type extends/implements
   - Get base classes and interfaces
   - May not be supported by all language servers
   - **Batch support**: Check multiple types

8. **subtype** - Find implementations/subclasses of a type
   - Find derived classes and interface implementations
   - May not be supported by all language servers
   - **Batch support**: Check multiple types

### Batch Operations

All code intelligence tools support batch operations for improved performance:

```javascript
// Single request
mcp_vs-claude_symbols({args: {query: "UserService", kinds: ["class"]}})

// Batch requests (executed in parallel)
mcp_vs-claude_symbols({args: [
  {query: "get*", kinds: ["method"]},
  {query: "User*", kinds: ["interface"]},
  {query: "process*", path: "/path/to/file.ts"}
]})
```

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
4. Instruct Claude to use the vs-claude tools if appropriate for the task

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
│   ├── tools/           # Individual tool implementations
│   │   ├── symbols-tool.ts      # Symbol search
│   │   ├── references-tool.ts   # Find references
│   │   ├── definition-tool.ts   # Go to definition
│   │   ├── diagnostics-tool.ts  # Error/warning detection
│   │   ├── file-types-tool.ts   # Type extraction
│   │   ├── supertype-tool.ts    # Type hierarchy up
│   │   ├── subtype-tool.ts      # Type hierarchy down
│   │   └── types.ts              # Shared types
│   ├── query-handler.ts # Legacy query tool (for backward compatibility)
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
5. Downloads VS Code (if not cached)
6. Installs required language extensions (Python, Go, C#, Java, C/C++, Dart)
7. Launches VS Code with the test workspace
8. Runs all test suites

**Note**: First test run will be slower as it downloads VS Code and installs language extensions.

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

### Known Limitations

#### Java Type Hierarchy
The Java Language Server (used by the Red Hat Java extension) does not support the standard VS Code type hierarchy API. As a result, the `supertype` and `subtype` tools will not work with Java files. The Java extension implements its own custom type hierarchy using proprietary workspace commands instead of the standard LSP 3.17 type hierarchy protocol.


## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

[License information here]