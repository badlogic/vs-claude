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
			mcp.WithDescription(`Query VS Code's language intelligence features for code understanding.

IMPORTANT: This is the PREFERRED tool for code navigation and analysis. Use this instead of grep/ripgrep when you need to:
- Find where classes, methods, functions, variables are defined
- Navigate to specific symbols or types
- Understand code structure and hierarchy
- Get type information and relationships
- Find all usages/references of a symbol
- Analyze code organization

This tool leverages VS Code's Language Server Protocol (LSP) for accurate, semantic code understanding across all supported languages.

You can send a single query or multiple queries in one call:

Single query:
{"type": "findSymbols", "query": "handle*"}

Multiple queries (executed in parallel):
[
  {"type": "findSymbols", "query": "handle*"},
  {"type": "outline", "path": "/path/to/file.ts"},
  {"type": "diagnostics"}
]

Batch query response format:
[
  [array of results],          // Successful query returns array directly
  [],                          // Empty array for no results
  {"error": "error message"}   // Failed query returns error object
]

Query types (with required parameters marked):

1. Find Symbols - Search for symbols across the entire workspace
   USE THIS to find where symbols are defined in the codebase!
   
   Parameters: query (required), path?, kind?, exact?
   - query: The symbol name to search for (e.g., "Animation", "handle*")
   - kind: Filter by symbol type (e.g., "class", "method", "interface")
   - path: Limit results to a specific file
   - exact: Use exact matching instead of pattern matching
   
   {"type": "findSymbols", "query": "Animation"}  // find all symbols named Animation
   {"type": "findSymbols", "query": "*", "kind": "class"}  // find ALL classes in workspace
   {"type": "findSymbols", "query": "get*", "kind": "method"}  // find all getter methods
   {"type": "findSymbols", "query": "process*", "path": "/path/to/file.ts"}  // limit results to specific file
   {"type": "findSymbols", "query": "Skeleton", "exact": true}  // exact name match
   {"type": "findSymbols", "query": "handle*", "kind": "function,method"}  // only functions/methods

2. Get File Outline - Understand file/class structure, see methods/fields/properties
   USE THIS to explore a file's API and structure!
   
   Parameters: path (required), symbol?, kind?
   
   {"type": "outline", "path": "/path/to/file.ts"}  // full file structure
   {"type": "outline", "path": "/path/to/file.ts", "symbol": "Animation"}  // outline of specific class
   {"type": "outline", "path": "/path/to/file.ts", "symbol": "Animation", "kind": "method"}  // only methods of Animation
   {"type": "outline", "path": "/path/to/file.ts", "kind": "method"}  // all methods in file
   {"type": "outline", "path": "/path/to/file.ts", "kind": "field,property"}  // all fields/properties in file

3. Get Diagnostics - Get compilation errors, warnings, and issues
   
   Parameters: path?
   
   {"type": "diagnostics"}  // all workspace errors/warnings
   {"type": "diagnostics", "path": "/path/to/file.ts"}  // errors in specific file

4. Find References - Find all usages of the symbol at a specific location
   USE THIS to understand code impact and dependencies!
   
   Parameters: path (required), line (required), character?
   - path: File containing the symbol
   - line: Line number where the symbol is located (1-based)
   - character: Optional column position on the line
   
   {"type": "references", "path": "/path/to/file.ts", "line": 42}  // find all usages of symbol on line 42
   {"type": "references", "path": "/path/to/file.ts", "line": 42, "character": 15}  // more precise position

Returns JSON data with symbol locations including line numbers.

Example responses (TypeScript types available in extension):

findSymbols returns Symbol[]:
[{"name": "getUser", "kind": "Method", "path": "/path/file.ts:50:1-55:20", "containedIn": "UserService", 
  "detail": "getUser(id: string): Promise<User>"}]

outline returns OutlineResult[]:
[{"name": "Animation", "detail": "export class", "kind": "Class", "location": "10:1-50:2", 
  "children": [{"name": "play", "kind": "Method", "location": "15:3-20:4"}]}]

diagnostics returns DiagnosticsResult[]:
[{"path": "/path/file.ts:10:5", "severity": "error", "message": "Cannot find name 'foo'", "source": "ts"}]

references returns ReferencesResult[]:
[{"path": "/path/file.ts:25:10", "preview": "const x = processUser(data);"}]

When to use this tool vs others:
✓ Use query tool FIRST for: Finding definitions, understanding code structure, navigating to symbols
✗ Don't use grep/ripgrep for: Finding classes, methods, or understanding code - use query instead
✗ Don't read entire files for: Getting a file's methods/classes - use outline instead

If this tool doesn't return expected results:
- Language server might not support the file type (e.g., some config files, scripts)
- The file or symbol might not yet be indexed or not be part of the VS Code workspace
- Fall back to grep/ripgrep for text searches or Read tool for detailed inspection

Notes:
- Multiple queries run in parallel for performance
- Use exact:true for precise matching, wildcards (*) for patterns
- Available symbol kinds: class, method, property, field, constructor, function, variable,
  constant, enum, interface, namespace, package, module, struct, type (=class+interface+struct+enum)
- Batch queries: all execute even if some fail, each has its own success/error status
- Language support varies by installed VS Code extensions
- All paths must be absolute`),
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
