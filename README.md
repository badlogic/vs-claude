# VS Claude

A VS Code extension with an integrated MCP server that allows MCP clients like Claude to interact with Visual Studio Code.

## Key Features

- **Smart File Operations** - Open files, diffs, and Git comparisons in VS Code
- **Batch Operations** - Open multiple files at once for efficient workflow
- **Git Integration** - View git diffs between different versions of files
- **Line Highlighting** - Jump to specific lines or highlight line ranges

## Overview

VS Claude provides a simple tool for AI assistants to open files and diffs in VS Code through the MCP (Model Context Protocol) interface.

### Navigation Tool

**open** - Open files, diffs, and git comparisons in VS Code
- Open files with optional line highlighting
- Show diffs between two files
- View git diffs (working changes, staged, commits)
- Open multiple files in a single operation
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
npm install -g @vscode/vsce
vsce package
```

2. Install in VS Code:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Run "Extensions: Install from VSIX..."
   - Select the generated `.vsix` file

### Set up Claude Integration
After installation, you will be prompted to install the MCP server for Claude. Click "Install" to proceed.

If you need to install it later or manually:
1. Open the Command Palette (`Cmd+Shift+P` on Mac or `Ctrl+Shift+P` on Windows/Linux)
2. Run "VS Claude: Install MCP"
3. Restart Claude to activate
4. Instruct Claude to use the vs-claude tools if appropriate for the task

### Set up Integration with Other AI Assistants
If your AI assistant supports MCP servers:
1. Open the Command Palette (`Cmd+Shift+P` on Mac or `Ctrl+Shift+P` on Windows/Linux)
2. Run "VS Claude: Install MCP"
3. Click "Manual Setup"
4. Follow the MCP server configuration instructions for your AI assistant

## Architecture

VS Claude consists of two components:

### VS Code Extension (TypeScript)
- Installs the MCP server with Claude CLI
- Implements the file opening logic using VS Code APIs
- Handles file-based IPC for communication with MCP clients

**Commands:**
- `VS Claude: Install MCP` - Install the MCP server with Claude
- `VS Claude: Uninstall MCP` - Remove the MCP server from Claude

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
npm run build       # Build TypeScript and Go binaries
npm run build:debug # Build with Go debug symbols (no cross-compilation)
npm run check       # Format with Biome, lint, and type check all code
npm run test        # Run tests
npm run clean       # Remove build artifacts
```

### Build System
- **Extension bundling** with esbuild
- **Cross-platform Go binaries** for macOS (Intel/ARM), Linux, and Windows

### Project Structure
```
vs-claude/
├── src/                 # TypeScript extension source
│   ├── extension.ts     # Main entry point
│   ├── tools/           # Tool implementations
│   │   ├── open-tool.ts # File opening logic
│   │   └── types.ts     # TypeScript types
│   ├── command-handler.ts     # Command dispatcher
│   ├── window-manager.ts      # Window IPC management
│   ├── logger.ts              # Logging system
│   └── setup.ts               # MCP installation logic
├── mcp/                 # Go MCP server source
│   └── main.go         # MCP server implementation
├── scripts/             # Build scripts
│   ├── build-extension.js        # Extension bundling
│   └── build-binaries.sh         # Cross-platform Go compilation
├── test/                # Test suite
│   ├── suite/           # Test implementations
│   └── test-workspace/  # Sample project for testing
├── build/              # Build outputs (generated)
│   ├── mcp/            # Cross-platform Go binaries
│   └── extension/      # TypeScript compilation output
└── CLAUDE.md           # Project-specific instructions
```

### Testing

The project includes comprehensive tests that:
- Launch VS Code with the extension
- Test file opening functionality
- Verify the MCP integration

Run tests with:
```bash
npm test
```

### Development

Press F5 to run the extension in development mode.

## Troubleshooting

### Tool Not Available
1. Ensure VS Code is running with the extension installed
2. Check that the MCP server is configured: `claude mcp list`
3. Restart Claude after installation

### Multiple VS Code Windows
When multiple windows are open, the MCP server returns an error listing available windows. The MCP client must then specify a windowId with each request:
```javascript
mcp_vs-claude_open({
  args: {"type": "file", "path": "/path/to/file.ts"},
  windowId: "window-123"
})
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

[License information here]