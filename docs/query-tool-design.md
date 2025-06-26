# Query Tool Design

The `query` tool allows Claude to get information about the codebase using VS Code's language intelligence features. This enables better code understanding than grep/ripgrep by leveraging Language Server Protocol (LSP) capabilities.

## Implemented Query Types

### 1. Find Symbols
```json
{
  "type": "findSymbols",
  "query": "handle*",        // supports glob patterns: *, ?, [abc], {a,b}
  "path": "/path/to/file.ts", // optional - filter results to this file
  "kind": "class,interface"   // optional - filter by symbol type
}
```

Examples:
- `"*"` - all symbols
- `"get*"` - all getters
- `"*Test"` - all test classes
- `"{get,set}*"` - getters and setters
- `"[A-Z]*Service"` - services starting with uppercase

Returns: Symbol name, kind, full path with line:col ranges, container, and hover detail

### 2. Get File Outline
```json
{
  "type": "outline",
  "path": "/path/to/file.ts",
  "symbol": "Animation.get*",  // optional - filter with hierarchical patterns
  "kind": "method,property",   // optional - filter by symbol type
  "depth": 1                  // optional - limit depth (1 = top-level only)
}
```

Examples:
- `"symbol": "Animation"` - show Animation class only
- `"symbol": "Animation.*"` - show Animation's members
- `"symbol": "Animation.get*"` - show Animation's getters
- `"depth": 1` - show only top-level symbols

Returns: Hierarchical tree structure with names, kinds, locations, and optional children

### 3. Get Diagnostics
```json
{
  "type": "diagnostics",
  "path": "/path/to/file.ts" // optional - if omitted, returns all workspace diagnostics
}
```

Returns: File path with line:col, severity (error/warning/info), message, and source

### 4. Find References
```json
{
  "type": "references",
  "path": "/path/to/file.ts",  // required - file containing the symbol
  "line": 42,                  // required - line number (1-based)
  "character": 15              // optional - character position (1-based)
}
```

Returns: All locations where the symbol at this position is referenced, with preview text

## Pattern Matching

All symbol queries support glob patterns via minimatch:
- `*` - matches any number of characters
- `?` - matches exactly one character  
- `[abc]` - matches any character in the set
- `[a-z]` - matches any character in the range
- `{a,b,c}` - matches any of the alternatives

Hierarchical queries use dot notation:
- `ClassName.methodName` - specific method in a class
- `ClassName.*` - all members of a class
- `Namespace.Class.method*` - nested hierarchies

## Response Format

Queries can be single or batched:

**Single query:**
```json
{"type": "findSymbols", "query": "handle*"}
```

**Batch query:**
```json
[
  {"type": "findSymbols", "query": "handle*"},
  {"type": "outline", "path": "/path/to/file.ts"}
]
```

**Response format:**
```json
[
  {"result": [...]},           // Success with results
  {"error": "error message"}   // Failed query
]
```

## Future Query Types

### Go to Definition
```json
{
  "type": "definition",
  "symbol": "processUser",      // symbol name to find
  "path": "/path/to/file.ts"    // optional - search in specific file or workspace
}
```
Returns: Location(s) where the symbol is defined

### 6. Find Implementations
```json
{
  "type": "implementations",
  "symbol": "UserInterface",    // interface/abstract class name
  "path": "/path/to/file.ts"    // optional - search in specific file or workspace
}
```
Returns: All implementations of this interface/abstract class

### 7. Get Type Info (replaces hover)
```json
{
  "type": "typeInfo",
  "symbol": "processUser",      // symbol name
  "path": "/path/to/file.ts"    // optional - specific file or workspace
}
```
Returns: Type signature and documentation for the symbol

### 8. Get Completions (questionable value)
```json
{
  "type": "completions",
  "prefix": "user.",            // what comes before the completion point
  "path": "/path/to/file.ts",
  "context": "const result = user." // optional surrounding code
}
```
Returns: Available methods/properties after the prefix

## Response Format

Success case:
```json
{
  "success": true,
  "data": {
    // Query-specific data
  }
}
```

Error case:
```json
{
  "success": false,
  "error": "Language server not available for this file type"
}
```

## Example Responses

### Find Symbols Response
```json
{
  "success": true,
  "data": {
    "symbols": [
      {
        "name": "handleOpen",
        "kind": "function",
        "path": "/src/handler.ts",
        "line": 45,
        "containerName": "OpenHandler"
      },
      {
        "name": "handleClose", 
        "kind": "method",
        "path": "/src/handler.ts",
        "line": 67,
        "containerName": "CloseHandler"
      }
    ]
  }
}
```

### File Outline Response
```json
{
  "success": true,
  "data": {
    "symbols": [
      {
        "name": "UserInterface",
        "kind": "interface",
        "line": 5,
        "children": [
          {"name": "id", "kind": "property", "line": 6},
          {"name": "name", "kind": "property", "line": 7}
        ]
      },
      {
        "name": "processUser",
        "kind": "function", 
        "line": 15
      }
    ]
  }
}
```

### Diagnostics Response
```json
{
  "success": true,
  "data": {
    "diagnostics": [
      {
        "path": "/src/index.ts",
        "line": 10,
        "column": 5,
        "severity": "error",
        "message": "Cannot find name 'nonExistentVar'",
        "source": "ts"
      }
    ]
  }
}
```

### References Response
```json
{
  "success": true,
  "data": {
    "references": [
      {
        "path": "/src/api/handler.ts",
        "line": 23,
        "column": 15,
        "preview": "  const result = await processUser(userData);"
      },
      {
        "path": "/src/tests/user.test.ts", 
        "line": 45,
        "column": 20,
        "preview": "    expect(processUser(mockUser)).resolves.toBeDefined();"
      }
    ]
  }
}
```

## Implementation Notes

1. **Critical Question**: Can VS Code's language features work on unopened files? This determines if the tool provides value over grep/ripgrep.
2. **Symbol-based queries**: Most queries now use symbol names instead of line/column positions, making them more practical for Claude to use
3. **Symbol resolution**: The extension needs to search for symbols by name when line/column not provided
4. **Go MCP Server**: Just passes the entire query object through as JSON - no parsing needed
5. **Extension**: Uses VS Code APIs (`vscode.languages.*`, `vscode.workspace.*`)
6. **Language Server Protocol**: Most intelligence comes from LSP
7. **Graceful Degradation**: Not all features available for all languages
8. **Performance**: Some queries might be slow - handle timeouts appropriately

## Why These Queries Help Claude

- **Find Symbols**: Better than grep because it understands code structure (e.g., distinguishes between `handleOpen` function vs `handleOpen` string)
- **File Outline**: Quickly understand what's in a file without reading all of it
- **Diagnostics**: See errors without running build commands
- **References**: Understand impact before making changes (e.g., "where is this function used?")
- **Type Info**: Get type signatures without finding and reading type definitions