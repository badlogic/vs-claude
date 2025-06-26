# VS Claude TODO

## 🐛 Bugs
- [ ] Preview mode not working correctly for .md files
  - When `preview: true` is passed, files should open in preview mode (italicized tab title)
  - Currently opens in permanent tab even with preview flag
  - May need to investigate VS Code API behavior with preview/preserveFocus options

- [ ] Race condition when multiple MCP servers write to .in file simultaneously
  - Multiple MCP server instances could write to the same command file at the same time
  - Could result in corrupted/interleaved JSON commands
  - Need to implement cross-platform file locking mechanism in Go MCP server
  - Options:
    - Use github.com/gofrs/flock for cross-platform support
    - Use lock files (.lock approach)
    - Use OS-specific locking with build tags

## ✨ Features to Implement

### Query Tool ✅
- [x] Implement MCP query tool for searching/querying the codebase
  - [x] Define query tool in Go MCP server
  - [x] Add query handler in extension
  - [x] Support different query types:
    - Unified symbol search (replaces file/content search with better LSP-based approach)
    - Diagnostics (errors/warnings)
    - References (find usages)
    - Definition (go to definition)
  - [x] Return results in structured format
  - [x] Advanced features:
    - Exclude patterns
    - Count only mode
    - Include type details
    - Hierarchical queries (e.g., Class.method*)

### Exec Tool  
- [ ] Implement MCP exec tool for running commands
  - [ ] Define exec tool in Go MCP server
  - [ ] Add exec handler in extension
  - [ ] Security considerations:
    - Whitelist allowed commands?
    - Working directory handling
    - Environment variable handling
  - [ ] Output handling:
    - Stream output back to Claude?
    - Handle long-running commands
    - Error handling

## 🔧 Improvements
- [ ] Add more comprehensive error messages for common issues
- [ ] Improve logging for debugging
- [ ] Add configuration options for tool behavior