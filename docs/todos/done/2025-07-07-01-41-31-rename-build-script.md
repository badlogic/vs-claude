# Rename build script

**Status:** In Progress
**Created:** 2025-07-07-01-41-31
**Started:** 2025-07-07T01:42:30Z
**Agent PID:** 70450

## Original Todo
- [ ] scripts/build-binaries.sh -> build-mcp-server.sh

## Description
Rename the build script from `build-binaries.sh` to `build-mcp-server.sh` to better reflect its purpose of building the MCP server binaries. This improves clarity as the script specifically builds MCP server binaries, not generic binaries.

## Implementation Plan
- [x] Rename scripts/build-binaries.sh to scripts/build-mcp-server.sh
- [x] Update package.json build script to use new filename
- [x] Update package.json build:debug script to use new filename (not needed - uses direct go build)  
- [x] Update any documentation references to the old filename
- [x] Automated test: Run `npm run build` to ensure it works
- [x] Automated test: Verify MCP binaries are built correctly

## Notes