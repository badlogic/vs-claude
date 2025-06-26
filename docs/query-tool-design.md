# Query Tool Design

The `query` tool allows Claude to get information about the codebase using VS Code's language intelligence features. This enables better code understanding than grep/ripgrep by leveraging Language Server Protocol (LSP) capabilities.

## Bare Minimum Query Types

### 1. Find Symbols
```json
{
  "type": "findSymbols",
  "query": "handle*",        // supports wildcards/partial matching
  "path": "/path/to/file.ts" // optional - if provided, searches only in this file
}
```
Returns: All symbols matching the query pattern with their locations and types

### 2. Get File Outline
```json
{
  "type": "fileOutline",
  "path": "/path/to/file.ts"
}
```
Returns: All types, interfaces, classes, functions defined in the file with their line numbers

### 3. Get Diagnostics
```json
{
  "type": "diagnostics",
  "path": "/path/to/file.ts" // optional - if provided, shows only diagnostics for this file
}
```
Returns: All errors and warnings with line numbers and messages

### 4. Find References
```json
{
  "type": "references",
  "symbol": "processUser",      // symbol name to find
  "path": "/path/to/file.ts"    // optional - search in specific file or workspace
}
```
Returns: All locations where this symbol is used

## Nice to Have Query Types

### 5. Go to Definition
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