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
- [ ] Delete extension installation script (scripts/setup-test-extensions.js)
- [ ] Remove extension installation call from test runner (test/runTest.ts:17-19)
- [ ] Remove profile/extensions directory setup from test runner (test/runTest.ts:61-62)
- [ ] Add CLI argument parsing for --file and --test-pattern (test/runTest.ts)
- [ ] Pass parsed arguments via extensionTestsEnv (test/runTest.ts)
- [ ] Add file filtering and test pattern support (test/suite/index.ts)
- [ ] Update test script in package.json to support CLI args
- [ ] Automated test: Run `npm test` to ensure all tests pass
- [ ] Automated test: Run `npm test -- --file extension.test.ts` 
- [ ] Automated test: Run `npm test -- --test-pattern "Should open a file"`
- [ ] Automated test: Run `npm test -- --file individual-tools.test.ts --test-pattern "open a single"`
- [ ] Automated test: Verify no .vscode-test/extensions directories are created

## Notes