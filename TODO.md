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

### Exec Tool
- [ ] Implement MCP exec tool for running commands
  - [ ] Define exec tool in Go MCP server
  - [ ] Add exec handler in extension
  - [ ] Security considerations:
    - Whitelist allowed commands?
    - Working directory handling
    - Environment variable handling

## Random stuff
  - [ ] e2e tests for all tools through MCP server
  - [ ] Typed tool definition parameters, not "WithObject("args") in main.go
  - [x] Return preview for symbols (name may or may not include symbol signature, preview more likely to include full signature)
  - [ ] Add depth operator for symbols tool (e.g., "Class.**" to get all descendants regardless of depth, similar to allTypesInFile behavior)
  - [ ] Include doc strings above a symbol? Requires manual parsing per language (or just parse any type of comment above a symbol and assume it's doc string)
  - [ ] See how/if we can get variable info for methods/functions
  - [ ] Evluate differences in functionality across LSP servers for all supported languages
  - [ ] Think about how we could test Claude using our shit
  - [ ] Document how to instruct Claude to always use the tool. Tool definitions are not enough. Users need to add to Claude.md or manually prompt accordingly depending on task
