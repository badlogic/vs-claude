# VS Claude Test Framework

This document describes the comprehensive test framework for the VS Claude query handler.

## Overview

The test framework consists of three main test suites:

1. **Query Tool E2E Tests** (`query-tool.test.ts`) - Basic end-to-end tests through MCP
2. **Query Handler Unit Tests** (`query-handler.test.ts`) - Direct unit tests of QueryHandler
3. **Query Pattern Tests** (`query-patterns.test.ts`) - Comprehensive pattern and edge case tests

## Test Structure

### Unit Tests (query-handler.test.ts)

Direct tests of the QueryHandler class without going through MCP:

- **Symbol Queries**
  - Exact symbol matching
  - Wildcard patterns (start, end, middle)
  - Hierarchical queries
  - Multiple symbol kinds
  - Count-only option
  - File and folder scoping
  - Exclude patterns
  - Type kind filter

- **Reference Queries**
  - Finding method references
  - Cross-file references

- **Definition Queries**
  - Finding symbol definitions
  - Navigation from usage to definition

- **Diagnostics Queries**
  - Workspace-wide diagnostics
  - File-specific diagnostics

- **File Types Queries**
  - Extracting all types and top-level functions
  - Handling nested types

- **Batch Queries**
  - Parallel execution
  - Partial failure handling

- **Error Cases**
  - Non-existent files
  - Overly broad queries
  - Invalid query types
  - Missing parameters

- **Edge Cases**
  - Paths with spaces
  - Special characters
  - Empty queries

### E2E Pattern Tests (query-patterns.test.ts)

Comprehensive tests through the MCP interface:

- **Wildcard Patterns**
  - `?` single character
  - `[abc]` character classes
  - `{a,b,c}` brace expansion
  - `**` deep matching

- **Hierarchical Patterns**
  - Multiple levels with wildcards
  - Empty intermediate patterns
  - Deep queries

- **Combined Filters**
  - Path + kind filters
  - Exclude patterns

- **Type Hierarchy**
  - Supertype queries
  - Subtype queries

- **Performance**
  - Count-only for large results
  - No-match queries

- **Multi-language**
  - Cross-language symbol search

- **Batch Patterns**
  - Diverse query types in batch

## Test Data

The test framework uses a multi-language test workspace located in `test/test-workspace/src/`:

```
test-workspace/src/
├── typescript/
│   └── user.service.ts    # TypeScript classes and interfaces
├── java/
│   └── UserService.java   # Java implementation
├── csharp/
│   └── UserService.cs     # C# implementation
├── python/
│   └── user_service.py    # Python implementation
├── go/
│   └── user_service.go    # Go implementation
└── cpp/
    ├── user_service.cpp   # C++ implementation
    └── user_service.hpp   # C++ header
```

Each language implements similar classes (UserService, User) to enable cross-language testing.

## Running Tests

### Run all tests:
```bash
npm test
```

### Run specific test suite:
```bash
npm test -- --grep "Query Handler Unit Tests"
npm test -- --grep "Query Pattern E2E Tests"
```

### Debug tests in VS Code:
1. Set breakpoints in test files
2. Open test file
3. Click "Debug Test" above test functions

## Test Helpers

### MCPClient
A simple MCP client implementation for E2E tests that:
- Spawns the MCP server as subprocess
- Handles JSON-RPC communication
- Automatically finds test window ID
- Provides `callTool` method for testing

### E2ETestSetup
Shared setup/teardown for E2E tests:
- Activates VS Code extension
- Starts MCP server
- Waits for language servers
- Handles cleanup

### parseQueryResponse
Helper function to parse various query response formats:
- Single query results
- Batch query results
- Error responses

## Writing New Tests

### Unit Test Example:
```typescript
test('Should find symbols with new pattern', async () => {
    const result = await queryHandler.execute({
        type: 'symbols',
        query: 'newPattern*',
        kinds: ['method']
    });
    
    const response = result[0];
    assert.ok('result' in response, 'Should have result');
    
    const symbols = response.result as any[];
    assert.ok(symbols.length > 0, 'Should find symbols');
});
```

### E2E Test Example:
```typescript
test('Should support new query feature', async () => {
    const result = await mcpClient.callTool('query', {
        args: {
            type: 'symbols',
            query: 'pattern',
            newOption: true
        }
    });
    
    const symbols = parseQueryResponse(result);
    assert.ok(symbols.length > 0, 'Should find symbols');
});
```

## Test Coverage

The test framework covers:

1. **All query types**: symbols, references, definition, diagnostics, allTypesInFile, hierarchy
2. **All query options**: kinds, exclude, countOnly, path
3. **Pattern matching**: wildcards, hierarchical, brace expansion
4. **Error handling**: invalid inputs, missing files, unsupported operations
5. **Performance**: large result sets, count-only optimization
6. **Multi-language**: TypeScript, Java, C#, Python, Go, C++
7. **Batch operations**: parallel queries, partial failures

## Best Practices

1. **Wait for language servers**: Add delays after file creation/modification
2. **Clean up test files**: Delete any files created during tests
3. **Check multiple response formats**: Handle both successful and error responses
4. **Use descriptive test names**: Clearly indicate what is being tested
5. **Test both positive and negative cases**: Verify both success and failure paths
6. **Log useful information**: Help debug test failures with console.log

## Troubleshooting

### Language server not ready:
- Increase timeout in `suiteSetup`
- Add delays after file operations

### Window ID not found:
- Ensure VS Code extension is activated
- Check `.vs-claude` directory exists

### Flaky tests:
- Add retries for language server operations
- Increase timeouts for slower operations
- Ensure proper cleanup between tests