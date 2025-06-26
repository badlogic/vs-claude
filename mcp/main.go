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
			mcp.WithDescription(`Open files and diffs in VS Code.

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
- Multiple VS Code windows: the extension will prompt which window to use`),
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

WHEN TO USE: Choose this over grep/ripgrep when you need to:
- Find where code elements are defined (classes, functions, methods, types)
- Explore code structure and relationships
- Find all usages of a symbol
- Navigate to definitions
- Understand type hierarchies

KEY CONCEPT - Hierarchical Query Syntax:
The number of dots controls result depth. This is NOT like file paths - each dot means "show me the children":
- "Animation" → just Animation symbol (no children)
- "Animation.*" → Animation + its direct children
- "Animation.get*" → Animation + children starting with "get"

The 'kinds' filter applies to what matches your pattern, not the entire tree.

QUERY TYPES:

1. symbols - Find code elements and explore structure
   Parameters:
   - query: Pattern to match (default: "*"). Supports wildcards and hierarchy
   - path: File or folder to search in (default: workspace)
   - kinds: Filter leaf nodes matching query by symbol type ["module", "namespace", "package", "class", "method", "property", "field", "constructor", "enum", "interface", "function", "variable", "constant", "string", "null", "enummember", "struct", "operator", "type"]
   - exclude: Glob path patterns to exclude ["**/test/**", "**/*.spec.ts"]
   - countOnly: Return count of matched leaf nodes only

   Most useful patterns:
   {"type": "symbols", "query": "UserService"}  // find UserService class/interface
   {"type": "symbols", "query": "UserService.*"}  // UserService with all members
   {"type": "symbols", "query": "UserService.*", "kinds": ["method"]}  // just methods
   {"type": "symbols", "query": "*.get*", "kinds": ["method"]}  // all getter methods
   {"type": "symbols", "query": "*", "kinds": ["class"]}  // all top-level classes
   {"type": "symbols", "path": "/src/user.ts"}  // explore entire file
   {"type": "symbols", "path": "/src", "query": "*Service"}  // all services in folder
   {"type": "symbols", "query": "*Test", "kinds": ["class"], "countOnly": true}  // count test classes

2. references - Find all usages of a symbol
   Required: path, line, column (from symbols query)

   Workflow:
   1. {"type": "symbols", "query": "processUser"}  // find it first
   2. {"type": "references", "path": "/src/user.ts", "line": 42, "column": 8}  // find usages

3. definition - Get the location of the definition of the symbol, e.g. function in header -> implementation in .cpp file.
   Required: path, line, column

   {"type": "definition", "path": "/src/app.ts", "line": 25, "column": 12}

4. supertype - Find what a type extends/implements
   Required: path, line, column

   {"type": "supertype", "path": "/src/models/User.ts", "line": 5, "column": 14}

5. subtype - Find implementations/subclasses
   Required: path, line, column

   {"type": "subtype", "path": "/src/base/Repository.ts", "line": 1, "column": 7}

6. diagnostics - Get errors and warnings
   {"type": "diagnostics"}  // all workspace issues
   {"type": "diagnostics", "path": "/src/app.ts"}  // specific file

RESPONSE: Always returns array of [{result: ...}] or [{error: ...}]
For symbols: {name, kind, location, children?}

COMMON PATTERNS:

Explore a class:
{"type": "symbols", "query": "UserService.*"}  // see all members
{"type": "symbols", "query": "UserService.{get,set}*", "kinds": ["method"]}  // getters/setters

Find implementations:
{"type": "symbols", "query": "Repository", "kinds": ["interface"]}  // find interface
{"type": "subtype", "path": "/result/path", "line": 5}  // find implementations

Check before refactoring:
{"type": "symbols", "query": "oldMethodName"}  // find it
{"type": "references", "path": "/path", "line": 42}  // check usage

File overview:
{"type": "symbols", "path": "/src/controller.ts", "query": "*"}  // top-level only
{"type": "symbols", "path": "/src/controller.ts", "query": "*.*"}  // with members

TIPS:
- Always use hierarchical queries for depth control
- Add 'kinds' to filter results
- Use 'exclude' to skip test files
- Try 'countOnly' first for broad queries
- Paths must be absolute`),
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
