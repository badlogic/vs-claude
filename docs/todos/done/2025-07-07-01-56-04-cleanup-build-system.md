# Clean up and standardize the build system

**Status:** In Progress
**Created:** 2025-07-07-01-56-04
**Started:** 2025-01-07T01:58:30Z
**Agent PID:** 7884

## Original Todo
- [ ] the VS code tasks.json has "label": "npm: test:build", which has the test build commands in it verbatim. add that to package.json instead, let "test" use that too

## Description
Clean up and standardize the build system across all build scripts:

1. **build-extension.js** - Remove NODE_ENV dependency from package.json, only use --debug CLI flag
2. **build-mcp-server.sh** - Ensure it supports --debug flag consistently
3. **Create scripts/build-tests.sh** - New script that:
   - Performs all the build steps currently in the "test" npm script
   - Always builds in debug mode
   - Stops before actually running the tests
4. **Update package.json**:
   - Remove NODE_ENV from build scripts
   - Create "build:test" script that calls ./scripts/build-tests.sh
   - Update "test" script to call "npm run build:test" then run the test runner
5. **Update or create .vscode/tasks.json**:
   - Update "npm: test:build" task to simply run "npm run build:test"

This creates a consistent pattern where:
- All build scripts live in scripts/ directory
- All use --debug flag for debug builds (no NODE_ENV)
- All have corresponding npm scripts for orchestration
- No duplication of build commands

## Implementation Plan
- [x] Update build-extension.js to remove NODE_ENV fallback (scripts/build-extension.js:7)
- [x] Add --debug flag support to build-mcp-server.sh (scripts/build-mcp-server.sh)
  - [x] Parse command line arguments for --debug
  - [x] Add debug symbols when --debug is passed (-gcflags="all=-N -l")
  - [x] In debug mode, only build for current platform (faster builds)
- [x] Create scripts/build-tests.sh with test build steps
  - [x] Copy all build steps from "test" script in package.json
  - [x] Always run with debug builds (call other scripts with --debug)
  - [x] Make script executable (chmod +x)
- [x] Update package.json scripts (package.json:59-65)
  - [x] Remove NODE_ENV from "build:debug" script
  - [x] Update "build:debug" to use "./scripts/build-mcp-server.sh --debug"
  - [x] Add "build:test" script that calls "./scripts/build-tests.sh"
  - [x] Update "test" script to use "npm run build:test" instead of inline build steps
  - [x] Add "build:vsix" script that runs "npm run clean && npm run build && vsce package"
- [x] Create or update .vscode/tasks.json
  - [x] Update "npm: test:build" task to run "npm run build:test"
- [x] Automated test: Run npm run clean && npm run build and verify production builds complete
- [x] Automated test: Run npm run clean && npm run build:debug and verify debug builds complete
- [x] Automated test: Run npm run clean && npm run build:test and verify it creates all expected build artifacts
- [x] Automated test: Run npm run clean && npm test and verify tests still pass
- [x] Automated test: Run npm run clean && npm run build:vsix and verify it creates a .vsix file

## Notes
- Fixed issue where debug builds of MCP server need to use platform-specific binary names (e.g., mcp-server-darwin-arm64) to match what tests expect
- Also created scripts/check.sh to consolidate the check command, following the same pattern as other scripts