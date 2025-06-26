package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var vsClaudeDir = filepath.Join(os.Getenv("HOME"), ".vs-claude")

// No need for specific arg types - we'll pass through as JSON

type WindowInfo struct {
	Workspace   string    `json:"workspace"`
	WindowTitle string    `json:"windowTitle"`
	Timestamp   time.Time `json:"timestamp"`
}

type Command struct {
	ID   string          `json:"id"`
	Tool string          `json:"tool"`
	Args json.RawMessage `json:"args"`
}

type CommandResponse struct {
	ID      string          `json:"id"`
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
}

func main() {
	// Set up logging to stderr
	log.SetOutput(os.Stderr)
	log.Println("VS Claude MCP server starting...")

	// Create MCP server
	mcpServer := server.NewMCPServer(
		"vs-claude",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	// Register open tool
	mcpServer.AddTool(
		mcp.NewTool("open",
			mcp.WithDescription(`Open files, diffs, or navigate to specific locations in VS Code.
This tool opens known file paths and locations. To search for symbols or code, use the query tool first.

Basic usage:
- Single item: {"type": "file", "path": "/path/to/file.ts"}
- Multiple items: [{"type": "file", "path": "/a.ts"}, {"type": "diff", "left": "/b.ts", "right": "/c.ts"}]

File examples:
- Open file: {"type": "file", "path": "/Users/name/project/src/index.ts"}
- With line range: {"type": "file", "path": "/path/to/file.ts", "startLine": 10, "endLine": 20}
- Single line: {"type": "file", "path": "/path/to/file.ts", "startLine": 42}
- Preview mode: {"type": "file", "path": "/path/to/README.md", "preview": true}

Diff examples:
- Compare files: {"type": "diff", "left": "/path/to/old.ts", "right": "/path/to/new.ts"}
- With title: {"type": "diff", "left": "/a.ts", "right": "/b.ts", "title": "Custom Title"}

Git diff examples:
- Working changes: {"type": "gitDiff", "path": "/path/to/file.ts", "from": "HEAD", "to": "working"}
- Staged changes: {"type": "gitDiff", "path": "/path/to/file.ts", "from": "HEAD", "to": "staged"}
- Last commit: {"type": "gitDiff", "path": "/path/to/file.ts", "from": "HEAD~1", "to": "HEAD"}
- Branch diff: {"type": "gitDiff", "path": "/path/to/file.ts", "from": "main", "to": "feature-branch"}
- With context: {"type": "gitDiff", "path": "/path/to/file.ts", "from": "HEAD", "to": "working", "context": 10}

Notes:
- All paths must be absolute
- startLine/endLine are optional and 1-based
- Git diff works even if file doesn't exist in one revision (shows as added/deleted)
- Multiple VS Code windows: the extension will prompt which window to use
- To search for symbols, use the query tool first, then open the results`),
			mcp.WithObject("args",
				mcp.Description("Single item object or array of items to open. All file paths must be absolute."),
			),
		),
		handleOpen,
	)

	// Register query tool
	mcpServer.AddTool(
		mcp.NewTool("query",
			mcp.WithDescription(`Query VS Code's language intelligence for semantic code understanding.

PREFER THIS over grep/ripgrep for finding symbols, understanding code structure, or navigating code.
Uses Language Server Protocol (LSP) for accurate, language-aware results across all file types.

⚠️ IMPORTANT: Workspace and folder queries REQUIRE either 'depth' or 'countOnly' parameter:
- For overview: Use depth:1 (e.g., {"type": "symbols", "kinds": ["class"], "depth": 1})
- To check size first: Use countOnly:true
- Without these, workspace/folder queries will be rejected to prevent excessive results
- File queries don't have this requirement

Supports single query or batch queries (executed in parallel):
Single: {"type": "symbols", "query": "UserService", "kinds": ["class"], "depth": 1}
Batch: [{"type": "symbols", "query": "get*", "kinds": ["method"], "depth": 1}, {"type": "symbols", "path": "/path/to/file.ts"}]

RESPONSE FORMAT: Always returns array, even for single query.
Success: [{"result": [...]}] or [{"result": []}] for no matches
Error: [{"error": "error message"}]

QUERY TYPES:

1. symbols - Unified symbol search with hierarchical results
   Optional: query (string) - Pattern to match (default: "*")
   Optional: path (string) - File or folder path (default: workspace)
   RECOMMENDED: kinds (array) - Symbol types to filter results
   REQUIRED for workspace/folder: depth (number) OR countOnly (boolean) - Prevent excessive results
   Optional: exclude (array) - Glob patterns to exclude files/folders
   Optional: includeDetails (boolean) - Include type signatures (when available)
   
   Depth parameter behavior:
   - depth: 1 = Symbol + immediate children only
   - depth: 2 = Symbol + children + grandchildren
   - No depth = Full hierarchy (only allowed for file queries)

   Symbol kinds: module, namespace, package, class, method, property, field,
                constructor, enum, interface, function, variable, constant,
                string, null, enummember, struct, operator, type

   WORKSPACE QUERIES (must have depth or countOnly):
   {"type": "symbols", "query": "*Test", "kinds": ["class"], "depth": 1}  // overview of test classes
   {"type": "symbols", "query": "*Service", "kinds": ["class", "interface"], "depth": 1}  // service types
   {"type": "symbols", "kinds": ["class"], "depth": 1}  // all top-level classes
   {"type": "symbols", "kinds": ["class"], "exclude": ["**/node_modules/**", "**/*.test.ts"], "depth": 1}  // exclude patterns
   {"type": "symbols", "query": "process*", "countOnly": true}  // check result count first

   FOLDER QUERIES (must have depth or countOnly):
   {"type": "symbols", "path": "/path/to/src", "query": "*Service", "depth": 1}  // services in folder
   {"type": "symbols", "path": "/path/to/src", "kinds": ["class"], "countOnly": true}  // count classes in folder
   
   FILE QUERIES (depth/countOnly optional):
   {"type": "symbols", "path": "/path/to/file.ts"}  // complete file structure
   {"type": "symbols", "path": "/path/to/file.ts", "includeDetails": true}  // with type info

   HIERARCHICAL QUERIES (for drilling down):
   {"type": "symbols", "query": "Animation.*"}  // all members of Animation class
   {"type": "symbols", "query": "Animation.get*"}  // getters in Animation class
   {"type": "symbols", "query": "*.toString"}  // toString in all classes

2. diagnostics - Get errors, warnings, and issues
   Optional: path (string) - Specific file or omit for entire workspace

   {"type": "diagnostics"}  // all workspace diagnostics
   {"type": "diagnostics", "path": "/path/to/file.ts"}  // single file diagnostics

3. references - Find all usages of symbol at specific location
   ⚠️ IMPORTANT: You must FIRST use symbols query to find the symbol's location!
   Required: path (string) - File containing the symbol
   Required: line (number) - Line number, 1-based (from symbols query result)
   Optional: character (number) - Column position, 1-based

   WORKFLOW:
   1. Find symbol: {"type": "symbols", "query": "processData", "kinds": ["function", "method"]}
   2. Get location from result (e.g., "/path/file.ts" at line "42:5-45:10")
   3. Find references: {"type": "references", "path": "/path/file.ts", "line": 42}

   Examples:
   {"type": "references", "path": "/path/to/file.ts", "line": 42}  // find usages
   {"type": "references", "path": "/path/to/file.ts", "line": 42, "character": 15}  // precise

4. definition - Find where a symbol is defined (go to definition)
   Required: path (string) - File containing the symbol usage
   Required: line (number) - Line number, 1-based
   Optional: character (number) - Column position, 1-based

   Returns definition location(s) with preview and symbol kind.
   Useful for jumping from usage to declaration.

   Examples:
   {"type": "definition", "path": "/src/app.ts", "line": 25}  // find definition
   {"type": "definition", "path": "/src/app.ts", "line": 25, "character": 10}  // precise

BEST PRACTICES:
1. WORKSPACE SEARCHES: Must use depth OR countOnly (queries without these are rejected)
2. DRILL DOWN: Use hierarchical queries (Class.*) for specific classes
3. BE SPECIFIC: Combine query + kinds to narrow results
4. ERROR EXAMPLES:
   {"type": "symbols", "kinds": ["class"]}  // ❌ ERROR: Missing depth/countOnly
   {"type": "symbols", "kinds": ["class"], "depth": 1}  // ✅ Good
   {"type": "symbols", "query": "*Test", "countOnly": true}  // ✅ Good

WORKFLOW EXAMPLES:

Finding all test classes efficiently:
1. Check count: {"type": "symbols", "query": "*Test", "kinds": ["class"], "countOnly": true}
2. If reasonable, get overview: {"type": "symbols", "query": "*Test", "kinds": ["class"], "depth": 1}
3. Explore specific class: {"type": "symbols", "query": "UserTest.*"}

Finding where a function is used:
1. Find function: {"type": "symbols", "query": "processData", "kinds": ["function", "method"]}
2. Get location from result (e.g., "/src/utils.ts" line 42)
3. Find usages: {"type": "references", "path": "/src/utils.ts", "line": 42}

Jump to definition:
1. From usage at line 25: {"type": "definition", "path": "/src/app.ts", "line": 25}
2. Returns definition location with preview

Exploring production code only:
1. Exclude tests: {"type": "symbols", "kinds": ["class"], "exclude": ["**/*.test.ts", "**/*.spec.ts"], "depth": 1}
2. Find services: {"type": "symbols", "query": "*Service", "kinds": ["class"], "exclude": ["**/test/**"]}

Getting detailed type information:
1. With types: {"type": "symbols", "path": "/src/utils.ts", "includeDetails": true}
2. Shows function signatures and property types when available

LIMITATIONS:
- Workspace queries without filters may exceed response limits
- Requires language server support (varies by file type)
- All paths must be absolute
- Glob patterns: * (any chars), ? (one char), [abc] (char set), {a,b} (alternatives)
- Queries timeout after 15 seconds to prevent hanging on slow language servers`),
			mcp.WithObject("args",
				mcp.Description("Single query object or array of query objects"),
			),
		),
		handleQuery,
	)

	// Start serving
	log.Println("Starting MCP server...")
	if err := server.ServeStdio(mcpServer); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func handleOpen(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// Get all arguments
	args := request.GetArguments()

	// Extract the actual args (MCP wraps them in an "args" object)
	actualArgs, ok := args["args"]
	if !ok {
		return nil, fmt.Errorf("missing 'args' parameter")
	}

	// Check if there's a windowId at the top level
	windowIdInterface, hasWindowId := args["windowId"]
	var windowIdStr string
	if hasWindowId {
		windowIdStr, _ = windowIdInterface.(string)
	}

	// Get the target window
	windowId, err := getTargetWindow(&windowIdStr)
	if err != nil {
		return nil, err
	}

	// Marshal the actual args to pass through
	argsJson, err := json.Marshal(actualArgs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal arguments: %v", err)
	}

	// Create command
	cmd := Command{
		ID:   fmt.Sprintf("%d", time.Now().UnixNano()),
		Tool: "open",
		Args: argsJson,
	}

	// Send command and wait for response
	log.Printf("[COMMAND SENT] open: %s", string(argsJson))
	resp, err := writeCommand(windowId, cmd, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to execute command: %v", err)
	}

	// Check if command succeeded
	if !resp.Success {
		return nil, fmt.Errorf("command failed: %s", resp.Error)
	}

	// Return success
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{
				Type: "text",
				Text: "Successfully opened items in VS Code",
			},
		},
	}, nil
}

func handleQuery(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// Get the args argument
	args := request.GetArguments()
	argsArg, exists := args["args"]
	if !exists {
		return nil, fmt.Errorf("missing 'args' argument")
	}

	// Marshal the args to JSON (it's already in the right format)
	argsJSON, err := json.Marshal(argsArg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal args: %v", err)
	}

	// No specific window handling for queries - use any available window
	windowId, err := getTargetWindow(nil)
	if err != nil {
		return nil, err
	}

	// Send command to extension
	cmd := Command{
		ID:   fmt.Sprintf("query-%d", time.Now().UnixNano()),
		Tool: "query",
		Args: argsJSON,
	}

	response, err := writeCommand(windowId, cmd, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}

	// Return the response directly
	if !response.Success {
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				mcp.TextContent{
					Type: "text",
					Text: fmt.Sprintf("Query failed: %s", response.Error),
				},
			},
		}, nil
	}

	// Return the data directly
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{
				Type: "text",
				Text: string(response.Data),
			},
		},
	}, nil
}

func getTargetWindow(windowId *string) (string, error) {
	windows, err := getActiveWindows()
	if err != nil {
		return "", fmt.Errorf("failed to get active windows: %v", err)
	}

	// If windowId specified, use it
	if windowId != nil && *windowId != "" {
		if _, exists := windows[*windowId]; exists {
			return *windowId, nil
		}
		return "", fmt.Errorf("window with ID '%s' not found. Active windows: %d", *windowId, len(windows))
	}

	// If only one window, use it
	if len(windows) == 1 {
		for id := range windows {
			return id, nil
		}
	}

	// Multiple windows, need to specify
	if len(windows) > 1 {
		var windowList []string
		for id, info := range windows {
			windowList = append(windowList, fmt.Sprintf("- %s: %s", id, info.Workspace))
		}
		return "", fmt.Errorf("multiple VS Code windows found. Please specify a windowId:\n%s\n\nCall the tool again with the windowId parameter", strings.Join(windowList, "\n"))
	}

	return "", fmt.Errorf("no VS Code windows found")
}

func getActiveWindows() (map[string]*WindowInfo, error) {
	windows := make(map[string]*WindowInfo)

	files, err := os.ReadDir(vsClaudeDir)
	if err != nil {
		if os.IsNotExist(err) {
			return windows, nil
		}
		return nil, err
	}

	staleThreshold := 5 * time.Second
	now := time.Now()

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".meta.json") {
			windowId := strings.TrimSuffix(file.Name(), ".meta.json")
			filePath := filepath.Join(vsClaudeDir, file.Name())

			// Check file modification time
			fileInfo, err := os.Stat(filePath)
			if err != nil {
				continue
			}

			// If file hasn't been touched in the last 5 seconds, it's stale
			if now.Sub(fileInfo.ModTime()) > staleThreshold {
				// Clean up stale window files
				os.Remove(filePath)
				cmdFile := filepath.Join(vsClaudeDir, windowId+".in")
				os.Remove(cmdFile)
				respFile := filepath.Join(vsClaudeDir, windowId+".out")
				os.Remove(respFile)
				log.Printf("Cleaned up stale window: %s", windowId)
				continue
			}

			// Read window metadata
			data, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}

			var info WindowInfo
			if err := json.Unmarshal(data, &info); err != nil {
				continue
			}

			windows[windowId] = &info
		}
	}

	return windows, nil
}

// writeCommand writes a command and waits for a response.
// Recommended timeout values:
//   - 5s for quick operations (file open, navigation)
//   - 30s for operations that might require user interaction
//   - 60s for operations that might involve heavy computation
func writeCommand(windowId string, cmd Command, timeout time.Duration) (*CommandResponse, error) {
	// Write the command
	cmdFile := filepath.Join(vsClaudeDir, fmt.Sprintf("%s.in", windowId))

	f, err := os.OpenFile(cmdFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open command file: %v", err)
	}
	defer f.Close()

	cmdBytes, _ := json.Marshal(cmd)
	if _, err := fmt.Fprintf(f, "%s\n", cmdBytes); err != nil {
		return nil, fmt.Errorf("failed to write command: %v", err)
	}

	// Flush to ensure the command is written immediately
	if err := f.Sync(); err != nil {
		return nil, fmt.Errorf("failed to flush command: %v", err)
	}

	// Watch for response
	respFile := filepath.Join(vsClaudeDir, fmt.Sprintf("%s.out", windowId))

	// Set up timeout
	deadline := time.Now().Add(timeout)

	// Track last read position and incomplete line buffer
	var lastPosition int64 = 0
	var incompleteBuffer string = ""

	// Poll for response every 50ms until timeout
	for time.Now().Before(deadline) {
		// Open file to check size and read from last position
		file, err := os.Open(respFile)
		if err != nil {
			if os.IsNotExist(err) {
				// Response file doesn't exist, extension might not be running
				time.Sleep(50 * time.Millisecond)
				continue
			}
			return nil, fmt.Errorf("failed to open response file: %v", err)
		}

		// Get file info to check if there's new data
		fileInfo, err := file.Stat()
		if err != nil {
			file.Close()
			return nil, fmt.Errorf("failed to stat response file: %v", err)
		}

		// If file has grown, read new data
		if fileInfo.Size() > lastPosition {
			// Seek to last read position
			if _, err := file.Seek(lastPosition, 0); err != nil {
				file.Close()
				return nil, fmt.Errorf("failed to seek in response file: %v", err)
			}

			// Read new data
			newData := make([]byte, fileInfo.Size()-lastPosition)
			n, err := file.Read(newData)
			if err != nil {
				file.Close()
				return nil, fmt.Errorf("failed to read response file: %v", err)
			}

			// Update last position to reflect all bytes read
			lastPosition += int64(n)

			// Combine with any incomplete buffer from last read
			dataStr := incompleteBuffer + string(newData)
			lines := strings.Split(dataStr, "\n")

			// Check if last line is complete
			if len(lines) > 0 && !strings.HasSuffix(dataStr, "\n") {
				// Last line is incomplete, save it for next iteration
				incompleteBuffer = lines[len(lines)-1]
				lines = lines[:len(lines)-1]
			} else {
				// All lines are complete
				incompleteBuffer = ""
			}

			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}

				var resp CommandResponse
				if err := json.Unmarshal([]byte(line), &resp); err != nil {
					log.Printf("Failed to parse response line: %v", err)
					continue
				}

				// Check if this is our response
				if resp.ID == cmd.ID {
					file.Close()
					log.Printf("[RESPONSE RECEIVED] ID: %s, Success: %v", resp.ID, resp.Success)
					return &resp, nil
				}
			}
		}

		file.Close()

		// Wait a bit before next check
		time.Sleep(50 * time.Millisecond)
	}

	return nil, fmt.Errorf("timeout waiting for response to command %s", cmd.ID)
}
