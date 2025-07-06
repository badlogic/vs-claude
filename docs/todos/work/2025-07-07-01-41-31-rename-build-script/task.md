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
- [ ] Rename scripts/build-binaries.sh to scripts/build-mcp-server.sh
- [ ] Update package.json build script to use new filename
- [ ] Update package.json build:debug script to use new filename  
- [ ] Update any documentation references to the old filename
- [ ] Automated test: Run `npm run build` to ensure it works
- [ ] Automated test: Verify MCP binaries are built correctly

## Notes