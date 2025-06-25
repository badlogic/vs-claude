# VS Claude TODO

## 🐛 Bugs
- [ ] Preview mode not working correctly for .md files
  - When `preview: true` is passed, files should open in preview mode (italicized tab title)
  - Currently opens in permanent tab even with preview flag
  - May need to investigate VS Code API behavior with preview/preserveFocus options

## ✨ Features to Implement

### Query Tool
- [ ] Implement MCP query tool for searching/querying the codebase
  - [ ] Define query tool in Go MCP server
  - [ ] Add query handler in extension
  - [ ] Support different query types:
    - File search (by name/pattern)
    - Content search (grep-like)
    - Symbol search across workspace
  - [ ] Return results in structured format

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