# VS Claude

A VS Code extension with an integrated MCP server that allows MCP clients like Claude to interact with Visual Studio Code.

## ✨ Key Features

- 🔍 **Advanced Symbol Search** - Find code elements with wildcards, hierarchical queries, and type filtering
- 📊 **Batch Operations** - Execute multiple queries in parallel for optimal performance  
- 🎨 **Modern UI** - Interactive test tool and log viewer built with Lit + Tailwind CSS
- 🔧 **Full LSP Support** - References, definitions, diagnostics, and type hierarchy
- 📁 **Smart File Operations** - Open files, diffs, and Git comparisons
- 🚀 **Developer Friendly** - Hot reload, panel persistence, and comprehensive logging

## Overview

VS Claude provides powerful tools for AI assistants to interact with VS Code, featuring modern webviews, comprehensive code intelligence, and batch operations for optimal performance.

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

6. **allTypesInFile** - Get all types and top-level functions in a file
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

## 🎨 Modern UI Features

### Interactive Test Tool
- **Live testing interface** for all VS Claude tools
- **Non-collapsible sections** showing all tools at once
- **Toggleable symbol kind badges** for easy filtering
- **Clickable locations** that auto-fill other tool inputs
- **Open file buttons** (↗) next to paths and symbol locations
- **Colored badges** for different symbol types with consistent theming

### Enhanced Log Viewer
- **Real-time log streaming** with auto-scroll
- **Colored component badges** with hash-based color assignment
- **Horizontal scrolling** for long messages
- **JSON syntax highlighting** for structured data
- **Fixed-width columns** for consistent alignment
- **Smart auto-scroll** that respects user scroll position

### Development Features
- **Panel persistence** - Webview panels automatically reopen after extension reload
- **Modern tech stack** - Built with Lit Web Components and Tailwind CSS
- **Light DOM rendering** - Full VS Code theme integration
- **Responsive design** - Adapts to different panel sizes

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
- `VS Claude: Test Query Tool` - Open interactive query tester with all tools
- `VS Claude: Show Logs` - View real-time extension logs with colored output

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
npm run build       # Build TypeScript, webviews, and Go binaries
npm run build:debug # Build with Go debug symbols (no cross-compilation)
npm run check       # Format with Biome, lint, and type check all code
npm run test        # Run e2e tests (builds MCP server, compiles tests, launches VS Code)
npm run clean       # Remove build artifacts
```

### Build System
- **Unified webview building** with `scripts/build-webviews.js`
- **Parallel JavaScript bundling** with esbuild
- **Tailwind CSS compilation** with automatic VS Code theme variables
- **Cross-platform Go binaries** for macOS (Intel/ARM), Linux, and Windows

### Project Structure
```
vs-claude/
├── src/                 # TypeScript extension source
│   ├── extension.ts     # Main entry point
│   ├── tools/           # Individual tool implementations
│   │   ├── symbols-tool.ts           # Symbol search with wildcards
│   │   ├── references-tool.ts        # Find all usages
│   │   ├── definition-tool.ts        # Go to definition
│   │   ├── diagnostics-tool.ts       # Error/warning detection
│   │   ├── all-types-in-file-tool.ts # Extract all types from file
│   │   ├── sub-and-super-type-tool.ts # Type hierarchy navigation
│   │   ├── open-tool.ts              # Open files/diffs
│   │   └── types.ts                  # Shared TypeScript types
│   ├── views/           # Modern webview implementations
│   │   ├── components/  # Lit Web Components
│   │   │   ├── log-entry.ts    # Individual log entry component
│   │   │   ├── log-viewer.ts   # Log viewer container
│   │   │   └── test-tool.ts    # Test tool interface
│   │   ├── log-viewer-webview.ts  # Log viewer entry point
│   │   ├── test-tool-webview.ts   # Test tool entry point
│   │   ├── webview-base.ts        # Shared webview utilities
│   │   ├── styles.css             # Tailwind CSS styles
│   │   ├── tailwind.config.js    # Tailwind configuration
│   │   └── tsconfig.json          # Browser-specific TypeScript config
│   ├── command-handler.ts   # Command dispatcher with batch support
│   ├── window-manager.ts    # Window IPC management
│   ├── logger.ts            # Structured logging system
│   ├── log-viewer-provider.ts  # Log viewer webview provider
│   ├── test-tool-provider.ts   # Test tool webview provider
│   └── setup.ts             # MCP installation logic
├── mcp/                 # Go MCP server source
│   └── main.go         # MCP server implementation
├── scripts/             # Build and utility scripts
│   ├── build-webviews.js    # Webview bundling script
│   └── build-binaries.sh    # Cross-platform Go compilation
├── test/                # Comprehensive test suite
│   ├── suite/
│   │   ├── individual-tools.test.ts # Individual tool tests
│   │   ├── query-patterns.test.ts   # Pattern matching tests
│   │   ├── open-tool.test.ts        # Open tool tests
│   │   └── test-helpers.ts          # Shared test utilities
│   ├── test-workspace/  # Multi-language test project
│   │   └── src/        # Sample code in various languages
│   ├── setup-test-workspace.js # Git setup for tests
│   └── runTest.ts      # Test runner
├── bin/                # Built binaries (generated)
├── out/                # Compiled TypeScript (generated)
└── CLAUDE.md           # Project-specific instructions
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


## Recent Improvements

### 🚀 Performance
- **Batch operations** for all code intelligence tools
- **Parallel processing** of multiple requests
- **Optimized file traversal** for folder searches
- **Count-only mode** for large result sets

### 🛠️ Code Quality
- **TypeScript strict mode** throughout the codebase
- **Biome** for fast, opinionated formatting and linting
- **Comprehensive test coverage** with real VS Code integration tests
- **Modular architecture** with single-responsibility tools

### 🎯 Developer Experience
- **CLAUDE.md integration** for project-specific AI instructions
- **Hot reload support** with webview persistence
- **Detailed logging** with structured output
- **Clear error messages** with actionable feedback

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

[License information here]