# Query Tool Design

The `query` tool allows Claude to get information about the codebase using VS Code's language intelligence features. This enables better code understanding than grep/ripgrep by leveraging Language Server Protocol (LSP) capabilities.

## Implemented Query Types

### 1. Symbols - Unified Symbol Search
```json
{
  "type": "symbols",
  "query": "handle*",           // Optional: glob pattern to match (default: "*")
  "path": "/path/to/folder",    // Optional: file or folder path (default: workspace)
  "kinds": ["class", "method"], // Optional: filter by symbol types
  "depth": 1,                   // Optional: limit tree depth
  "exclude": ["**/test/**"],    // Optional: exclude patterns
  "includeDetails": true,       // Optional: include type signatures
  "countOnly": true            // Optional: return only count
}
```

**Symbol kinds**: module, namespace, package, class, method, property, field, constructor, enum, interface, function, variable, constant, string, null, enummember, struct, operator, type

**Glob patterns**: 
- `*` - matches any characters
- `?` - matches one character
- `[abc]` - matches any character in set
- `{a,b}` - matches alternatives

**Hierarchical queries**:
- `Animation.*` - all members of Animation
- `Animation.get*` - getters in Animation
- `*.toString` - toString in all classes

**Scope determination**:
- No path → workspace search
- File path → file structure
- Folder path → folder search

Returns: Hierarchical symbol tree with names, kinds, locations, and optionally type info

### 2. Diagnostics - Errors and Warnings
```json
{
  "type": "diagnostics",
  "path": "/path/to/file.ts" // Optional: specific file or entire workspace
}
```

Returns: File paths with line:col, severity (error/warning/info), message, and source

### 3. References - Find All Usages
```json
{
  "type": "references",
  "path": "/path/to/file.ts",  // Required: file containing the symbol
  "line": 42,                  // Required: line number (1-based)
  "character": 15              // Optional: column position (1-based)
}
```

**Important**: You must first use symbols query to find the symbol's location!

Workflow:
1. Find symbol: `{"type": "symbols", "query": "processData", "kinds": ["function"]}`
2. Get location from result (e.g., line 42)
3. Find references: `{"type": "references", "path": "/path/file.ts", "line": 42}`

Returns: All locations where the symbol is referenced, with preview text

### 4. Definition - Go to Definition
```json
{
  "type": "definition",
  "path": "/path/to/file.ts",  // Required: file containing the usage
  "line": 25,                  // Required: line number (1-based)
  "character": 10              // Optional: column position (1-based)
}
```

Returns: Definition location(s) with preview, range, and symbol kind

## Response Format

Queries can be single or batched:

**Single query:**
```json
{"type": "symbols", "query": "handle*", "kinds": ["function"]}
```

**Batch query:**
```json
[
  {"type": "symbols", "query": "handle*", "kinds": ["function"]},
  {"type": "symbols", "path": "/path/to/file.ts"}
]
```

**Response format:**
Always returns an array:
```json
[
  {"result": [...]},           // Success with results
  {"error": "error message"}   // Failed query
]
```

## Example Responses

### Symbols Response
```json
[{
  "result": [
    {
      "name": "UserService",
      "kind": "Class",
      "location": "42:1-156:2",
      "detail": "export class UserService",
      "type": "export class UserService", // When includeDetails: true
      "children": [
        {
          "name": "getUser",
          "kind": "Method",
          "location": "45:3-48:4",
          "type": "getUser(id: string): Promise<User>"
        }
      ]
    }
  ]
}]
```

### Count Only Response
```json
[{
  "result": {
    "count": 523
  }
}]
```

### References Response
```json
[{
  "result": [
    {
      "path": "/src/api/handler.ts:23:15",
      "preview": "  const result = await processUser(userData);"
    },
    {
      "path": "/src/tests/user.test.ts:45:20",
      "preview": "    expect(processUser(mockUser)).resolves.toBeDefined();"
    }
  ]
}]
```

### Definition Response
```json
[{
  "result": [
    {
      "path": "/src/services/user.ts:15:1",
      "range": "15:1-20:2",
      "preview": "export function processUser(data: UserData): Promise<User> {",
      "kind": "Function"
    }
  ]
}]
```

### Diagnostics Response
```json
[{
  "result": [
    {
      "path": "/src/index.ts:10:5",
      "severity": "error",
      "message": "Cannot find name 'nonExistentVar'",
      "source": "ts"
    }
  ]
}]
```

## Best Practices for LLMs

### 1. Workspace and Folder Searches - MUST Use depth or countOnly!
```json
// ERROR - Workspace/folder queries without depth/countOnly are rejected
{"type": "symbols", "query": "*"}  // ❌ Error: workspace query
{"type": "symbols", "kinds": ["class"]}  // ❌ Error: workspace query
{"type": "symbols", "path": "/src", "query": "*Service"}  // ❌ Error: folder query

// GOOD - Always include depth or countOnly
{"type": "symbols", "query": "*", "kinds": ["class"], "depth": 1}  // ✅
{"type": "symbols", "query": "*Test", "countOnly": true}  // ✅
{"type": "symbols", "path": "/src", "query": "*Service", "depth": 1}  // ✅

// File queries don't need depth/countOnly
{"type": "symbols", "path": "/src/file.ts"}  // ✅ OK for files
```

Depth parameter behavior:
- `depth: 1` = Symbol + immediate children only
- `depth: 2` = Symbol + children + grandchildren
- No depth = Full hierarchy (only allowed for file queries)

### 2. Check Count First
```json
// Step 1: Check how many results
{"type": "symbols", "query": "*Test", "kinds": ["class"], "countOnly": true}

// Step 2: If reasonable, get results
{"type": "symbols", "query": "*Test", "kinds": ["class"], "depth": 1}
```

### 3. Exclude Patterns
```json
// Production code only
{
  "type": "symbols",
  "kinds": ["class"],
  "exclude": ["**/test/**", "**/node_modules/**", "**/*.spec.ts"]
}
```

### 4. Hierarchical Exploration
```json
// Step 1: Find classes
{"type": "symbols", "kinds": ["class", "interface"], "depth": 1}

// Step 2: Explore specific class
{"type": "symbols", "query": "UserService.*"}

// Step 3: Find specific members
{"type": "symbols", "query": "UserService.get*", "kinds": ["method"]}
```

## Implementation Notes

1. **Language Server Integration**: All queries use VS Code's language servers for accurate results
2. **File Processing**: When searching workspace/folder, processes each file individually
3. **Error Handling**: Continues processing even if some files fail (e.g., JAR files)
4. **Performance**: Large workspace queries can be slow - use filters
5. **Caching**: Currently no caching - each query executes fresh
6. **Details Limitation**: `includeDetails` provides what's available from DocumentSymbol (mainly the detail field)

## Why These Queries Help Claude

- **Symbols**: Better than grep - understands code structure, hierarchies, and relationships
- **Diagnostics**: See errors without running build commands
- **References**: Understand impact before making changes
- **Definition**: Navigate from usage to declaration
- **Exclude/Count**: Handle large codebases efficiently
- **Hierarchical**: Explore code structure naturally (Class → Methods → Details)