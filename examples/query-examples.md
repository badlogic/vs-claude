# VS Claude Query Tool Examples

This document shows common query patterns you can use with Claude to explore your codebase.

## Finding Symbols

### Find all classes in the workspace (overview)
```
"Find all classes in the codebase"
```
Claude will use: `{"type": "symbols", "kinds": ["class"], "depth": 1}`

### Find test classes (efficiently)
```
"Find all test classes"
```
Claude will use: `{"type": "symbols", "query": "*Test", "kinds": ["class"], "depth": 1}`

### Find getters and setters (specific search)
```
"Show me all getter and setter methods"
```
Claude will use: `{"type": "symbols", "query": "{get,set}*", "kinds": ["method"]}`

### Find specific symbols
```
"Where is the UserService class defined?"
```
Claude will use: `{"type": "symbols", "query": "UserService", "kinds": ["class", "interface"]}`

### Find members of a class
```
"What methods does the Pixmap class have?"
```
Claude will use: `{"type": "symbols", "query": "Pixmap.*", "kinds": ["method"]}`

### Find getters in a specific class
```
"Show me all getter methods in the Animation class"
```
Claude will use: `{"type": "symbols", "query": "Animation.get*"}`

## Exploring File Structure

### Get file structure
```
"Show me the structure of Animation.java"
```
Claude will use: `{"type": "symbols", "path": "/path/to/Animation.java"}`

### List only top-level types
```
"What are the main classes in this file without their members?"
```
Claude will use: `{"type": "symbols", "path": "/path/to/file.java", "depth": 1}`

### Find methods in a specific class
```
"Show me all methods in the Animation class"
```
Claude will use: `{"type": "symbols", "query": "Animation.*", "kinds": ["method"]}`

### Find getters in a specific class
```
"What getter methods does the Animation class have?"
```
Claude will use: `{"type": "symbols", "query": "Animation.get*", "kinds": ["method"]}`

## Finding References

### Find all usages of a function
```
"Where is the processData function used?"
```
Claude will:
1. First find the function: `{"type": "symbols", "query": "processData", "kinds": ["function", "method"]}`
2. Extract location from result (e.g., "/src/utils.ts" at line "42:5-45:10")
3. Then find references: `{"type": "references", "path": "/src/utils.ts", "line": 42}`

### Find references to a class
```
"Show me all places where UserService is used"
```
Claude will:
1. Find the class: `{"type": "symbols", "query": "UserService", "kinds": ["class", "interface"]}`
2. Extract location from result
3. Use references: `{"type": "references", "path": "/path/to/file.ts", "line": X}`

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

## Recommended Workflows

### Exploring a large codebase
```
"I need to understand the architecture of this codebase"
```
Claude will:
1. Get overview: `{"type": "symbols", "kinds": ["class", "interface"], "depth": 1}`
2. Find patterns: `{"type": "symbols", "query": "*Service", "kinds": ["class"], "depth": 1}`
3. Drill down: `{"type": "symbols", "query": "UserService.*"}`

### Finding all test classes efficiently
```
"Show me all the test classes in the project"
```
Claude will:
1. Overview search: `{"type": "symbols", "query": "*Test", "kinds": ["class"], "depth": 1}`
2. For specific test class: `{"type": "symbols", "query": "UserTest.*"}`

## Complex Queries

### Explore a large Java file with many classes
```
"I have an Animation.java file with 80 classes. Show me just the Animation class methods"
```
Claude will use: `{"type": "symbols", "query": "Animation.*", "kinds": ["method"]}`

### Find all error handling
```
"Find all catch blocks or error handlers"
```
Claude might use multiple queries:
- `{"type": "symbols", "query": "*catch*"}`
- `{"type": "symbols", "query": "*error*"}`
- `{"type": "symbols", "query": "*Error", "kinds": ["class"]}`

### Understand inheritance
```
"What classes extend BaseController?"
```
Claude will:
1. Find BaseController: `{"type": "symbols", "query": "BaseController", "kinds": ["class"]}`
2. Search for classes that might extend it
3. Explore the class hierarchy with symbols queries

## Tips for Effective Queries

1. **Use glob patterns** - More powerful than simple text search
   - `*Service` - ends with Service
   - `get*` - starts with get
   - `{get,set}*` - starts with get or set
   - `[A-Z]*` - starts with uppercase

2. **Combine filters** - Use symbol patterns with kind filters
   - Find all test methods: `query: "*test*", kinds: ["method"]`
   - Find interfaces starting with I: `query: "I*", kinds: ["interface"]`

3. **Use hierarchical queries** - Navigate complex structures
   - `"Pixmap.get*"` - find getters in Pixmap class
   - `"Animation.*"` - all members of Animation
   - `"Animation.get*"` - all getters in Animation
   - `"*.toString"` - toString in all classes
   - `MyNamespace.MyClass.*` - nested hierarchies

4. **Chain queries** - First find, then explore
   - Find a class with symbols query
   - Explore its structure with hierarchical queries
   - Find its usages with references
   - Jump to definition when needed

5. **Use new features** - For efficient searching
   - Check count first: `"countOnly": true`
   - Exclude tests: `"exclude": ["**/test/**"]`
   - Get type info: `"includeDetails": true`