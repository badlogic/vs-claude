# Clean up and standardize the build system

**Status:** Refining
**Created:** 2025-07-07-01-56-04
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
- [ ] Update build-extension.js to remove NODE_ENV fallback (scripts/build-extension.js:7)
- [ ] Add --debug flag support to build-mcp-server.sh (scripts/build-mcp-server.sh)
  - [ ] Parse command line arguments for --debug
  - [ ] Add debug symbols when --debug is passed (-gcflags="all=-N -l")
  - [ ] In debug mode, only build for current platform (faster builds)
- [ ] Create scripts/build-tests.sh with test build steps
  - [ ] Copy all build steps from "test" script in package.json
  - [ ] Always run with debug builds (call other scripts with --debug)
  - [ ] Make script executable (chmod +x)
- [ ] Update package.json scripts (package.json:59-65)
  - [ ] Remove NODE_ENV from "build:debug" script
  - [ ] Update "build:debug" to use "./scripts/build-mcp-server.sh --debug"
  - [ ] Add "build:test" script that calls "./scripts/build-tests.sh"
  - [ ] Update "test" script to use "npm run build:test" instead of inline build steps
  - [ ] Add "build:vsix" script that runs "npm run clean && npm run build && vsce package"
- [ ] Create or update .vscode/tasks.json
  - [ ] Update "npm: test:build" task to run "npm run build:test"
- [ ] Automated test: Run npm run clean && npm run build and verify production builds complete
- [ ] Automated test: Run npm run clean && npm run build:debug and verify debug builds complete
- [ ] Automated test: Run npm run clean && npm run build:test and verify it creates all expected build artifacts
- [ ] Automated test: Run npm run clean && npm test and verify tests still pass
- [ ] Automated test: Run npm run clean && npm run build:vsix and verify it creates a .vsix file

## Notes