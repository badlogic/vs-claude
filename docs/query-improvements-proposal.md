# Query Tool Improvements Proposal

This document outlines future improvements for the VS Claude query tool, focusing on pagination to handle large result sets.

## Pagination Implementation

### Problem
When querying large codebases, symbol searches can return thousands of results, exceeding the MCP response size limits. While we've added `countOnly` to check result sizes and encouraged filtering, pagination would provide a more robust solution.

### Proposed Solution

#### 1. API Design
Add pagination parameters to the symbols query:

```typescript
interface SymbolsRequest {
  type: 'symbols';
  query?: string;
  path?: string;
  kinds?: SymbolKindName[];
  depth?: number;
  exclude?: string[];
  includeDetails?: boolean;
  countOnly?: boolean;
  
  // New pagination parameters
  limit?: number;   // Results per page (default: 100, max: 500)
  offset?: number;  // Starting index (default: 0)
}

interface PaginatedSymbolsResponse {
  result: Symbol[];
  total: number;      // Total results available
  offset: number;     // Current offset
  limit: number;      // Current limit
  hasMore: boolean;   // More results available?
}
```

#### 2. Cache Implementation

```typescript
interface CachedQuery {
  request: SymbolsRequest;  // Original request (without limit/offset)
  results: Symbol[];         // Full result set
  timestamp: number;         // For TTL-based eviction
}

class QueryCache {
  private cache = new Map<string, CachedQuery>();
  private maxCacheSize = 10; // Max number of cached queries
  private ttl = 60000;       // 1 minute TTL
  
  getCacheKey(request: SymbolsRequest): string {
    // Create deterministic key from request params (excluding limit/offset)
    const { limit, offset, ...keyParams } = request;
    return JSON.stringify(keyParams, Object.keys(keyParams).sort());
  }
  
  get(key: string): CachedQuery | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return cached;
  }
  
  set(key: string, value: CachedQuery): void {
    this.cache.set(key, value);
    
    // Evict oldest if cache is full
    if (this.cache.size > this.maxCacheSize) {
      this.evictOldest();
    }
  }
  
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
```

#### 3. Implementation Flow

```typescript
private async symbolsWithPagination(request: SymbolsRequest): Promise<PaginatedSymbolsResponse> {
  const limit = Math.min(request.limit || 100, 500);
  const offset = request.offset || 0;
  
  // Check cache
  const cacheKey = this.queryCache.getCacheKey(request);
  let cached = this.queryCache.get(cacheKey);
  
  if (!cached) {
    // Execute full query
    const fullResults = await this.executeFullSymbolsQuery(request);
    
    // Cache if results are large enough to benefit from pagination
    if (fullResults.length > limit) {
      cached = {
        request,
        results: fullResults,
        timestamp: Date.now()
      };
      this.queryCache.set(cacheKey, cached);
    } else {
      // Return all results without caching
      return {
        result: fullResults,
        total: fullResults.length,
        offset: 0,
        limit: fullResults.length,
        hasMore: false
      };
    }
  }
  
  // Paginate from cache
  const paginatedResults = cached.results.slice(offset, offset + limit);
  
  return {
    result: paginatedResults,
    total: cached.results.length,
    offset,
    limit,
    hasMore: offset + limit < cached.results.length
  };
}
```

### Usage Examples

```json
// First request - get first page
{
  "type": "symbols",
  "query": "*",
  "kinds": ["class"],
  "limit": 100
}

// Response
{
  "result": [...100 symbols...],
  "total": 523,
  "offset": 0,
  "limit": 100,
  "hasMore": true
}

// Next page
{
  "type": "symbols",
  "query": "*",
  "kinds": ["class"],
  "limit": 100,
  "offset": 100
}
```

### Benefits

1. **Handles large result sets** - No more response size limit errors
2. **Efficient caching** - Subsequent pages are served from cache
3. **Predictable performance** - Consistent response sizes
4. **User control** - Can request smaller chunks for faster responses

### Considerations

1. **Cache invalidation** - Need to handle file changes
2. **Memory usage** - Large cached result sets
3. **Concurrent requests** - Multiple clients with different pagination

### Alternative: Cursor-based Pagination

Instead of offset/limit, use opaque cursors:

```json
// First request
{
  "type": "symbols",
  "query": "*Test",
  "kinds": ["class"],
  "pageSize": 50
}

// Response includes cursor
{
  "result": [...],
  "nextCursor": "eyJvZmZzZXQiOjUwLCJjYWNoZUtleSI6IjEyMzQ1In0=",
  "hasMore": true
}

// Next request
{
  "type": "symbols",
  "cursor": "eyJvZmZzZXQiOjUwLCJjYWNoZUtleSI6IjEyMzQ1In0="
}
```

Benefits:
- More flexible implementation
- Can encode cache key in cursor
- Prevents clients from jumping to arbitrary pages

### Implementation Priority

Given that Claude (Cline) can handle streaming responses, pagination might not be immediately necessary. The current approach of using:
- `countOnly` to check result size
- `kinds` and `depth` filters to limit results
- `exclude` patterns to filter out unwanted files

...provides sufficient control for most use cases. Pagination would be most valuable for:
1. Interactive exploration tools
2. Very large monorepos
3. Clients with strict response size limits

## Other Future Improvements

### Configurable Timeout
Currently, all queries timeout after 15 seconds. This could be made configurable:

```typescript
interface QueryRequest {
  // ... existing fields ...
  timeout?: number; // Optional timeout in milliseconds (default: 15000)
}
```

This would allow:
- Longer timeouts for complex workspace searches
- Shorter timeouts for quick file queries
- Per-query customization based on expected complexity