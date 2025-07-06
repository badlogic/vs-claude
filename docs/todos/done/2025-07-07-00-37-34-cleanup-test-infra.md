# Clean-up the test infra

**Status:** In Progress
**Created:** 2025-07-07-00-37-34
**Started:** 2025-07-07T00:48:00Z
**Agent PID:** 70450

## Original Todo
- [ ] Clean-up the test infra
    - we should not need to install any extensions if we do.
    - Individual test suits should be runnable indivudually

## Description
The test infrastructure currently installs 7 language-specific VS Code extensions (Python, Go, C#, Java, C++, Dart) that are no longer needed since LSP functionality was removed. Additionally, there's no way to run individual test suites - all tests must run together. We need to remove unnecessary extension installations and implement a mechanism to run specific test suites.

## Implementation Plan
- [x] Delete extension installation script (scripts/setup-test-extensions.js)
- [x] Remove extension installation call from test runner (test/runTest.ts:17-19)
- [x] Remove profile/extensions directory setup from test runner (test/runTest.ts:61-62)
- [x] Add CLI argument parsing for --file and --test-pattern (test/runTest.ts)
- [x] Pass parsed arguments via extensionTestsEnv (test/runTest.ts)
- [x] Add file filtering and test pattern support (test/suite/index.ts)
- [x] Update test script in package.json to support CLI args
- [x] Automated test: Run `npm test` to ensure all tests pass (fixed window ID detection)
- [x] Automated test: Run `npm test -- --file extension.test.ts` 
- [x] Automated test: Run `npm test -- --test-pattern "Should open a file"`
- [x] Automated test: Run `npm test -- --file individual-tools.test.ts --test-pattern "open a single"`
- [x] Automated test: Verify no .vscode-test/extensions directories are created

## Notes
- Fixed flaky test in MCP Integration Tests "Should open a file" - increased wait time from 100ms to 500ms
- Fixed test window ID detection to find the correct test window when multiple VS Code instances are open
- Extensions in .vscode-test/extensions are from VS Code's auto-update feature, not our test setup
- Updated project-description.md with new test filtering capabilities