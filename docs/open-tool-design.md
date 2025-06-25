# Streamlined Open Tool Design

## Core Types

### 1. File
```json
{
  "type": "file",
  "path": "/absolute/path/to/file",
  "startLine": 1,      // optional
  "endLine": 10        // optional
}
```

### 2. Diff
```json
{
  "type": "diff",
  "left": "/path/to/original",
  "right": "/path/to/modified",
  "title": "Custom Title"  // optional
}
```

### 3. Git Diff
```json
{
  "type": "gitDiff",
  "path": "/path/to/file",
  "from": "HEAD~1",        // commit/branch/tag/HEAD/working/staged
  "to": "working",         // commit/branch/tag/HEAD/working/staged
  "context": 3             // optional - lines of context around changes
}
```

### 4. Symbol
```json
{
  "type": "symbol",
  "query": "functionName",  // function, class, interface, etc.
  "path": "/path/to/file"   // optional - search in specific file, otherwise searches workspace
}
```

## Tool Arguments

```json
{
  "tool": "open",
  "args": {
    "items": [
      // Can be a single object or array of objects
      {
        "type": "file",
        "path": "/src/index.ts",
        "startLine": 10,
        "endLine": 20
      },
      {
        "type": "gitDiff",
        "path": "/src/utils.ts",
        "from": "main",
        "to": "working"
      }
    ]
  }
}
```

## Single Item Shorthand

For convenience, when opening a single item:

```json
{
  "tool": "open",
  "args": {
    "type": "file",
    "path": "/src/index.ts",
    "startLine": 10
  }
}
```

## Git Diff Special Values

- `"HEAD"` - The current commit
- `"HEAD~1"`, `"HEAD~2"`, etc. - Previous commits
- `"working"` - Uncommitted changes in working directory
- `"staged"` - Staged changes (in index)
- Any branch name, tag, or commit hash

## Examples

### Open a file at specific lines
```json
{
  "type": "file",
  "path": "/src/components/Button.tsx",
  "startLine": 15,
  "endLine": 45
}
```

### Compare two files
```json
{
  "type": "diff",
  "left": "/src/old-version.ts",
  "right": "/src/new-version.ts"
}
```

### Show git changes for a file
```json
{
  "type": "gitDiff",
  "path": "/src/api/handler.ts",
  "from": "main",
  "to": "working"
}
```

### Show what changed in last commit
```json
{
  "type": "gitDiff",
  "path": "/src/utils.ts",
  "from": "HEAD~1",
  "to": "HEAD"
}
```

## Response Format

Success case:
```json
{
  "success": true
}
```

Error case:
```json
{
  "success": false,
  "error": "Failed to open git diff: File has no changes between main and working"
}
```

## Implementation Notes

1. The extension will use VS Code's built-in git extension for git operations
2. For gitDiff, if the file doesn't exist in one of the revisions, it should still work (showing file creation/deletion)
3. Error handling should be graceful - if one item fails, others should still open
4. Git operations require the path to be within a git repository