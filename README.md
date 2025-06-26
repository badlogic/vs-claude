# VS Claude

A VS Code extension that provides MCP (Model Context Protocol) tools for AI assistants to interact with Visual Studio Code.

## Overview

VS Claude enables MCP clients (like Claude) to interact with your VS Code workspace through two powerful tools:

1. **query** - Semantic code search using VS Code's language intelligence
2. **open** - File navigation, diff viewing, and code highlighting

These tools give AI assistants deep integration with VS Code's language servers, enabling them to understand your codebase structure, find definitions, locate usages, and navigate code intelligently.

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/your-username/vs-claude.git
cd vs-claude
```

2. Install dependencies and build:
```bash
npm install
npm run build
```

3. Install the extension in VS Code:
   - Open VS Code
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Run "Developer: Install Extension from VSIX"
   - Select the generated `.vsix` file

### Setting up Claude Integration

1. Open VS Code and run command: "VS Claude: Install MCP"
2. Follow the on-screen instructions to configure Claude CLI
3. Restart Claude to activate the integration

## Quick Start for MCP Clients

Once installed, you'll have access to two tools:

- **mcp_vs-claude_query** - Semantic code search using VS Code's language intelligence
- **mcp_vs-claude_open** - Open files, show diffs, and navigate to code

### Essential Examples

```javascript
// Find a class and explore it
mcp_vs-claude_query({ args: {"type": "symbols", "query": "UserService.*"} })

// Find all usages of a method
mcp_vs-claude_query({ args: {"type": "references", "path": "/src/user.ts", "line": 42} })

// Open a file with highlighting
mcp_vs-claude_open({ args: {"type": "file", "path": "/src/app.ts", "startLine": 10, "endLine": 20} })

// Show git changes
mcp_vs-claude_open({ args: {"type": "gitDiff", "path": "/src/app.ts", "from": "HEAD", "to": "working"} })
```

## Using the Tools from an MCP Client

When connected to VS Claude through MCP, you have access to two tools:

### 🔍 mcp_vs-claude_query

The query tool provides semantic code search powered by VS Code's language servers. Unlike text-based search, it understands code structure, hierarchies, and relationships.

#### Tool Parameters

```typescript
{
  args: {
    // Single query object or array for batch queries
    type: "symbols" | "references" | "definition" | "diagnostics" | "supertype" | "subtype"
    // Additional parameters depend on query type
  }
}
```

#### Query Types and Examples

**1. Symbol Search** - Find and explore code structure

The most powerful query type. Use hierarchical queries to control depth:

```javascript
// Find a specific class
mcp_vs-claude_query({
  args: {"type": "symbols", "query": "UserService"}
})

// Get class with all its methods
mcp_vs-claude_query({
  args: {"type": "symbols", "query": "UserService.*"}
})

// Find specific methods in a class
mcp_vs-claude_query({
  args: {"type": "symbols", "query": "UserService.get*", "kinds": ["method"]}
})

// Find all test classes
mcp_vs-claude_query({
  args: {"type": "symbols", "query": "*Test", "kinds": ["class"]}
})

// Explore a file's structure
mcp_vs-claude_query({
  args: {"type": "symbols", "path": "/src/models/user.ts"}
})

// Count symbols before fetching (for large queries)
mcp_vs-claude_query({
  args: {"type": "symbols", "query": "*Controller", "kinds": ["class"], "countOnly": true}
})
```

**Hierarchical Query Syntax:**
- `.` controls depth (NOT a wildcard like file paths!)
- `UserService` - Just the UserService symbol
- `UserService.*` - UserService + its direct members
- `UserService.*.*` - Three levels deep
- `*.toString` - All toString methods in any class

**Pattern Matching:**
- `*` - Any characters
- `?` - Single character
- `[abc]` - Character set
- `{get,set}*` - Alternatives

**2. Find References** - Locate all usages of a symbol

```javascript
// First, find the symbol to get its location
const symbolResult = await mcp_vs-claude_query({
  args: {"type": "symbols", "query": "processPayment"}
})
// Returns: [{name: "processPayment", location: "/src/payment.ts:42:1-45:2", ...}]

// Then find all references using the file and line
mcp_vs-claude_query({
  args: {"type": "references", "path": "/src/payment.ts", "line": 42}
})
// Returns all locations where processPayment is used
```

**3. Go to Definition** - Jump from usage to declaration

```javascript
// When looking at code that uses a symbol
mcp_vs-claude_query({
  args: {"type": "definition", "path": "/src/app.ts", "line": 25, "column": 15}
})
// Returns the definition location
```

**4. Get Diagnostics** - Find errors and warnings

```javascript
// All workspace errors
mcp_vs-claude_query({
  args: {"type": "diagnostics"}
})

// Specific file errors
mcp_vs-claude_query({
  args: {"type": "diagnostics", "path": "/src/app.ts"}
})
```

**5. Type Hierarchy** - Explore inheritance

```javascript
// Find parent types (extends/implements)
mcp_vs-claude_query({
  args: {"type": "supertype", "path": "/src/models/User.ts", "line": 10}
})

// Find implementations/subclasses
mcp_vs-claude_query({
  args: {"type": "subtype", "path": "/src/interfaces/Repository.ts", "line": 1}
})
```

#### Batch Queries

Execute multiple queries in parallel for better performance:

```javascript
mcp_vs-claude_query({
  args: [
    {"type": "symbols", "query": "User*", "kinds": ["class"]},
    {"type": "symbols", "query": "*Service", "kinds": ["class"]},
    {"type": "diagnostics"}
  ]
})
```

### 📂 mcp_vs-claude_open

The open tool navigates files and shows diffs in VS Code.

#### Tool Parameters

```typescript
{
  args: {
    // Single item or array of items to open
    type: "file" | "diff" | "gitDiff" | "symbol"
    // Additional parameters depend on type
  }
}
```

#### Examples

**Open Files:**

```javascript
// Simple file open
mcp_vs-claude_open({
  args: {"type": "file", "path": "/src/app.ts"}
})

// Open with line highlighting
mcp_vs-claude_open({
  args: {"type": "file", "path": "/src/app.ts", "startLine": 10, "endLine": 20}
})

// Open multiple selections in same file
mcp_vs-claude_open({
  args: [
    {"type": "file", "path": "/src/app.ts", "startLine": 10, "endLine": 15},
    {"type": "file", "path": "/src/app.ts", "startLine": 30, "endLine": 35}
  ]
})
```

**Show Diffs:**

```javascript
// Compare two files
mcp_vs-claude_open({
  args: {"type": "diff", "left": "/src/old.ts", "right": "/src/new.ts"}
})

// Git working changes
mcp_vs-claude_open({
  args: {"type": "gitDiff", "path": "/src/app.ts", "from": "HEAD", "to": "working"}
})

// Compare commits
mcp_vs-claude_open({
  args: {"type": "gitDiff", "path": "/src/app.ts", "from": "HEAD~1", "to": "HEAD"}
})
```

**Symbol Search (simple text match):**

```javascript
// Jump to a symbol by name
mcp_vs-claude_open({
  args: {"type": "symbol", "query": "handleRequest"}
})
```

## Common Workflows

### Understanding a Codebase

```javascript
// 1. Get overview of main classes
const classes = await mcp_vs-claude_query({
  args: {"type": "symbols", "query": "*", "kinds": ["class"], "exclude": ["**/test/**"]}
})

// 2. Explore a specific class
const userService = await mcp_vs-claude_query({
  args: {"type": "symbols", "query": "UserService.*"}
})

// 3. Find where it's used
const usage = await mcp_vs-claude_query({
  args: {"type": "references", "path": "/src/services/UserService.ts", "line": 5}
})
```

### Before Refactoring

```javascript
// 1. Find the method
const method = await mcp_vs-claude_query({
  args: {"type": "symbols", "query": "calculateTotal"}
})

// 2. Check all usages
const refs = await mcp_vs-claude_query({
  args: {"type": "references", "path": method[0].result[0].location.split(':')[0], "line": 42}
})

// 3. Open each usage to review
mcp_vs-claude_open({
  args: refs[0].result.map(ref => ({
    type: "file",
    path: ref.path.split(':')[0],
    startLine: parseInt(ref.path.split(':')[1])
  }))
})
```

### Debugging Errors

```javascript
// 1. Get all errors
const errors = await mcp_vs-claude_query({
  args: {"type": "diagnostics"}
})

// 2. Open files with errors
const errorFiles = errors[0].result
  .filter(d => d.severity === "error")
  .map(d => ({
    type: "file",
    path: d.path.split(':')[0],
    startLine: parseInt(d.path.split(':')[1])
  }))

mcp_vs-claude_open({ args: errorFiles })
```

## Architecture

VS Claude consists of two main components:

### 1. VS Code Extension (TypeScript)
- Runs inside VS Code
- Manages window communication via file system
- Executes commands from Claude
- Provides access to VS Code's language intelligence

### 2. MCP Server (Go)
- Implements Model Context Protocol
- Communicates with Claude via stdio
- Routes commands to appropriate VS Code windows
- Handles multi-window scenarios

### Communication Flow
```
Claude ↔ MCP Server ↔ File System ↔ VS Code Extension
```

The extension uses a file-based IPC mechanism:
- Each VS Code window has a unique ID
- Commands are written to `~/.vs-claude/{windowId}.in`
- Responses are written to `~/.vs-claude/{windowId}.out`
- Metadata is maintained in `~/.vs-claude/{windowId}.meta.json`

## Commands

- **VS Claude: Install MCP** - Set up Claude integration
- **VS Claude: Uninstall MCP** - Remove Claude integration  
- **VS Claude: Test Query Tool** - Open interactive query tester

## Development

### Prerequisites
- Node.js 16+
- Go 1.21+
- VS Code

### Setup
```bash
# Install dependencies
npm install

# Build TypeScript and Go components
npm run build

# Build for debugging (current platform only)
npm run build:debug

# Watch mode for TypeScript
npm run watch

# Run tests
npm test
```

### Project Structure
```
vs-claude/
├── src/                 # TypeScript extension source
│   ├── extension.ts     # Main entry point
│   ├── query-handler.ts # Query tool implementation
│   ├── open-handler.ts  # Open tool implementation
│   └── ...
├── mcp/                 # Go MCP server source
│   └── main.go         # MCP server implementation
├── bin/                # Built binaries (generated)
└── out/                # Compiled TypeScript (generated)
```

### Code Quality
- **Linting:** `npm run lint`
- **Formatting:** `npm run format`
- **Type Checking:** `npm run typecheck`

## Troubleshooting

### Tool Not Available
If the tools don't appear in your MCP client:
1. Ensure VS Code is running with the extension installed
2. Check that the MCP server is properly configured in Claude CLI
3. Restart your MCP client after installation

### Query Returns Empty Results
- **Language servers activate lazily** - Open a file of the target language first
- **Check your query syntax** - Remember: dots (.) control hierarchy, not wildcards
- **Use countOnly first** - `{"type": "symbols", "query": "*Service", "countOnly": true}`
- **Start simple** - Try `"*"` with a kinds filter before complex queries

### Multiple VS Code Windows
The tools will return an error listing available windows. Include the windowId in subsequent calls:
```javascript
// If multiple windows are open, you'll get an error with window list
// Then retry with windowId:
mcp_vs-claude_open({
  args: {"type": "file", "path": "/src/app.ts"},
  windowId: "window-123"
})
```

### Common Issues

**"No symbol provider available"**
- The language server for that file type isn't active yet
- Open a file of that type in VS Code and wait a moment

**Git diff errors**
- Ensure you're in a git repository
- The VS Code git extension must be enabled

**Large result sets**
- Use `exclude` patterns: `["**/node_modules/**", "**/dist/**"]`
- Add `kinds` filter to narrow results
- Use `countOnly: true` to check size first

## Performance Tips

When working with large codebases:

1. **Use kinds filters** - `"kinds": ["class", "interface"]` to narrow results
2. **Exclude patterns** - `"exclude": ["**/node_modules/**", "**/test/**", "**/*.spec.ts"]`
3. **Count first** - `"countOnly": true` to check result size
4. **Specify path** - Limit search to specific folders
5. **Batch queries** - Send multiple queries in one call for parallel execution

### Symbol Kind Reference

Available kinds for filtering:
- **Types**: `class`, `interface`, `enum`, `struct`, `type`
- **Members**: `method`, `property`, `field`, `constructor`
- **Functions**: `function`, `variable`, `constant`
- **Organization**: `module`, `namespace`, `package`

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

[License information here]

## Acknowledgments

Built with the Model Context Protocol (MCP) to enable AI assistants to interact with development environments.