# VS Claude Query Tool Examples

This document shows common query patterns you can use with Claude to explore your codebase.

## Finding Symbols

### Find all classes in the workspace
```
"Find all classes in the codebase"
```
Claude will use: `{"type": "findSymbols", "query": "*", "kind": "class"}`

### Find getters and setters
```
"Show me all getter and setter methods"
```
Claude will use: `{"type": "findSymbols", "query": "{get,set}*", "kind": "method"}`

### Find test classes
```
"Find all test classes"
```
Claude will use: `{"type": "findSymbols", "query": "*Test", "kind": "class"}`

### Find specific symbols
```
"Where is the UserService class defined?"
```
Claude will use: `{"type": "findSymbols", "query": "UserService"}`

## Exploring File Structure

### Get file outline
```
"Show me the structure of Animation.java"
```
Claude will use: `{"type": "outline", "path": "/path/to/Animation.java"}`

### List only top-level types
```
"What are the main classes in this file without their members?"
```
Claude will use: `{"type": "outline", "path": "/path/to/file.java", "depth": 1}`

### Find methods in a specific class
```
"Show me all methods in the Animation class"
```
Claude will use: `{"type": "outline", "path": "/path/to/Animation.java", "symbol": "Animation.*", "kind": "method"}`

### Find getters in a specific class
```
"What getter methods does the Animation class have?"
```
Claude will use: `{"type": "outline", "path": "/path/to/Animation.java", "symbol": "Animation.get*"}`

## Finding References

### Find all usages of a function
```
"Where is the processData function used?"
```
Claude will:
1. First find the function: `{"type": "findSymbols", "query": "processData"}`
2. Then find references: `{"type": "references", "path": "/path/to/file.ts", "line": 42}`

### Find references to a class
```
"Show me all places where UserService is used"
```
Claude will:
1. Find the class location
2. Use references to find all usages

## Getting Diagnostics

### Check all errors in workspace
```
"What TypeScript errors are in the codebase?"
```
Claude will use: `{"type": "diagnostics"}`

### Check errors in specific file
```
"Are there any errors in UserService.ts?"
```
Claude will use: `{"type": "diagnostics", "path": "/path/to/UserService.ts"}`

## Complex Queries

### Explore a large Java file with many classes
```
"I have an Animation.java file with 80 classes. Show me just the Animation class methods"
```
Claude will use: `{"type": "outline", "path": "/path/to/Animation.java", "symbol": "Animation.*", "kind": "method"}`

### Find all error handling
```
"Find all catch blocks or error handlers"
```
Claude might use multiple queries:
- `{"type": "findSymbols", "query": "*catch*"}`
- `{"type": "findSymbols", "query": "*error*"}`
- `{"type": "findSymbols", "query": "*Error", "kind": "class"}`

### Understand inheritance
```
"What classes extend BaseController?"
```
Claude will:
1. Find BaseController: `{"type": "findSymbols", "query": "BaseController"}`
2. Search for classes that might extend it
3. Use outline to explore the hierarchy

## Tips for Effective Queries

1. **Use glob patterns** - More powerful than simple text search
   - `*Service` - ends with Service
   - `get*` - starts with get
   - `{get,set}*` - starts with get or set
   - `[A-Z]*` - starts with uppercase

2. **Combine filters** - Use symbol patterns with kind filters
   - Find all test methods: `symbol: "*test*", kind: "method"`
   - Find interfaces starting with I: `query: "I*", kind: "interface"`

3. **Use hierarchical queries** - Navigate complex structures
   - `Animation.*` - all members of Animation
   - `Animation.get*` - all getters in Animation
   - `MyNamespace.MyClass.*` - nested hierarchies

4. **Chain queries** - First find, then explore
   - Find a class with findSymbols
   - Explore its structure with outline
   - Find its usages with references