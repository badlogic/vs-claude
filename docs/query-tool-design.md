# Query Tool Design

The `query` tool allows Claude to get information about the codebase, project structure, and code intelligence data from VS Code.

## Query Types

### 1. Symbol Information
```json
{
  "type": "symbolInfo",
  "symbol": "functionName",
  "path": "/path/to/file.ts",  // optional, current file if not specified
  "line": 42,                  // optional - will search for symbol if not provided
  "column": 15                 // optional
}
```
Returns: Type signature, documentation, references count

### 2. Type Definition
```json
{
  "type": "typeDefinition",
  "symbol": "variableName",    // optional if line/column provided
  "path": "/path/to/file.ts",
  "line": 42,                  // optional - will search for symbol
  "column": 15                 // optional
}
```
Returns: Full type information, interface/class definition

### 3. References
```json
{
  "type": "references",
  "symbol": "functionName",
  "path": "/path/to/file.ts",
  "line": 10,
  "includeDeclaration": false  // optional
}
```
Returns: All locations where symbol is used

### 4. Call Hierarchy
```json
{
  "type": "callHierarchy",
  "symbol": "functionName",
  "path": "/path/to/file.ts",
  "direction": "incoming"  // or "outgoing"
}
```
Returns: What calls this function (incoming) or what this function calls (outgoing)

### 5. Type Hierarchy
```json
{
  "type": "typeHierarchy", 
  "symbol": "ClassName",
  "path": "/path/to/file.ts",
  "direction": "supertypes"  // or "subtypes"
}
```
Returns: Class/interface inheritance hierarchy

### 6. Workspace Symbols
```json
{
  "type": "workspaceSymbols",
  "query": "handle*",  // supports wildcards
  "kind": "function"   // optional: function, class, interface, variable, etc.
}
```
Returns: All matching symbols in workspace

### 7. Document Symbols
```json
{
  "type": "documentSymbols",
  "path": "/path/to/file.ts"
}
```
Returns: Outline of all symbols in a file

### 8. Diagnostics
```json
{
  "type": "diagnostics",
  "path": "/path/to/file.ts",  // optional, all files if not specified
  "severity": "error"           // optional: error, warning, info, hint
}
```
Returns: Current errors/warnings

### 9. Git Status
```json
{
  "type": "gitStatus",
  "path": "/path/to/file"  // optional, whole repo if not specified
}
```
Returns: Git status, branch info, uncommitted changes

### 10. Project Info
```json
{
  "type": "projectInfo"
}
```
Returns: Workspace folders, active file, open editors, installed extensions

### 11. Hover Info
```json
{
  "type": "hover",
  "path": "/path/to/file.ts",
  "line": 42,
  "column": 15
}
```
Returns: Hover tooltip info (types, docs, etc.)

### 12. Code Actions
```json
{
  "type": "codeActions",
  "path": "/path/to/file.ts",
  "startLine": 10,
  "endLine": 20
}
```
Returns: Available refactorings, quick fixes

### 13. Implementations
```json
{
  "type": "implementations",
  "symbol": "interfaceName",
  "path": "/path/to/file.ts",
  "line": 5
}
```
Returns: All implementations of an interface/abstract class

### 14. File Dependencies
```json
{
  "type": "dependencies",
  "path": "/path/to/file.ts",
  "direction": "imports"  // or "importedBy"
}
```
Returns: What this file imports or what imports this file

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

### Symbol Info Response
```json
{
  "success": true,
  "data": {
    "name": "processUser",
    "kind": "function",
    "type": "(user: User) => Promise<ProcessedUser>",
    "documentation": "Processes user data and returns enhanced user object",
    "references": 12,
    "location": {
      "path": "/src/utils/user.ts",
      "line": 45,
      "column": 8
    }
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

## Implementation Notes

1. **Go MCP Server**: Just passes the entire query object through as JSON - no need to parse individual query types
2. **Extension**: Does all the heavy lifting using VS Code APIs
3. **Smart Symbol Resolution**: When line/column not provided, extension searches for symbol in file
4. **Language Server Protocol**: Most code intelligence comes from LSP
5. **Graceful Degradation**: Not all features available for all languages
6. **Performance**: Some queries might be slow (e.g., finding all references) - handle timeouts