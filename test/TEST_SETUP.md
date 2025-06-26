# VS Claude Testing Framework

## Overview

A comprehensive testing framework has been set up for the VS Claude extension with the following structure:

```
test/
├── runTest.ts              # Main test runner
├── suite/
│   ├── index.ts           # Test suite loader
│   ├── extension.test.ts  # Extension integration tests
│   ├── open-handler.test.ts    # OpenHandler unit tests
│   ├── git-utils.test.ts       # Git utilities unit tests
│   └── command-handler.test.ts  # CommandHandler unit tests (template)
└── TEST_SETUP.md          # This documentation
```

## Configuration

### package.json Scripts
- `npm test` - Run all tests (builds first, then runs tests)

### TypeScript Configuration
- `tsconfig.test.json` - Separate TypeScript config for tests
- Tests are excluded from main build via tsconfig.json

### VS Code Launch Configuration
- `.vscode/launch.json` includes configurations for:
  - Running the extension
  - Running tests
  - Debugging tests

## Test Structure

### Integration Tests (extension.test.ts)
✅ **Working Tests:**
- Extension presence check
- Extension activation
- Command registration verification

### Unit Tests
Currently, unit tests face challenges with stubbing Node.js built-in modules in the VS Code test environment. The following patterns work:

#### Working Pattern Example:
```typescript
test('Should handle errors gracefully', async () => {
    const result = await openHandler.execute({
        type: 'file',
        path: '/test/nonexistent.ts'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error);
});
```

#### Stubbing Limitations:
- Cannot stub `fs.existsSync`, `fs.readSync` etc. (non-configurable properties)
- Cannot stub `vscode.Uri` (non-configurable)
- VS Code APIs need careful mocking

## Running Tests

### Local Development
```bash
# Install dependencies
npm install

# Build and run tests
npm test
```

### Debugging Tests
1. Open VS Code
2. Go to Run and Debug (Ctrl+Shift+D)
3. Select "Debug Tests" from dropdown
4. Press F5 to start debugging

## Writing New Tests

### Integration Test Template
```typescript
test('Should do something in VS Code', async function() {
    this.timeout(30000); // Longer timeout for integration tests
    
    const extension = vscode.extensions.getExtension('vs-claude.vs-claude');
    assert.ok(extension);
    
    // Your test logic here
});
```

### Unit Test Template (Limited by stubbing constraints)
```typescript
test('Should handle specific case', async () => {
    // Test public APIs without stubbing Node.js internals
    const handler = new MyHandler(mockOutputChannel);
    
    try {
        const result = await handler.doSomething();
        assert.strictEqual(result.success, true);
    } catch (error) {
        assert.fail('Should not throw');
    }
});
```

## Test Results

Current test results show:
- ✅ 5 tests passing (integration tests)
- ❌ 12 tests failing (unit tests with stubbing issues)

The failing tests are primarily due to stubbing limitations in the VS Code test environment. Consider:
1. Using dependency injection for better testability
2. Creating wrapper functions for Node.js APIs
3. Focusing on integration tests for file system operations

## Future Improvements

1. **Dependency Injection**: Refactor code to inject fs dependencies
2. **Test Doubles**: Create test-specific implementations instead of stubbing
3. **Mock Server**: For testing MCP server communication
4. **E2E Tests**: Add end-to-end tests using VS Code's testing API

## Resources

- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Mocha Documentation](https://mochajs.org/)
- [Sinon.js Documentation](https://sinonjs.org/)
- [@vscode/test-electron](https://www.npmjs.com/package/@vscode/test-electron)