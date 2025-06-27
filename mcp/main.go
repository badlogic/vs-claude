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

	// Register symbols tool
	mcpServer.AddTool(
		mcp.NewTool("symbols",
			mcp.WithDescription(`Find code elements using VS Code's language intelligence. USE THIS INSTEAD OF GREP/RIPGREP for finding code.

PARAMETERS:
- query?: pattern to match (default "*"). Use . for hierarchy, not :: or ->
  "Class" → just Class | "Class.*" → Class + direct children | "Class.method" → specific method
- path?: file or folder to search (absolute path)
- kinds?: filter ["class","method","property","field","constructor","enum","interface","function","variable","constant","struct","operator","type"]
  "type" = meta-kind matching class/interface/struct/enum
- exclude?: glob patterns to skip ["**/test/**"]
- countOnly?: return count only (faster for broad queries)

EXAMPLES:
Find class: {"query": "UserService"}
→ [{"name": "UserService", "kind": "Class", "location": "/src/user.ts:15:7-15:18"}]

Find methods: {"query": "UserService.*", "kinds": ["method"]}
→ [{"name": "UserService", "kind": "Class", "location": "/src/user.ts:15:7-15:18",
    "children": [{"name": "create", "kind": "Method", "location": "20:3-20:9"}]}]

Count test classes: {"query": "*Test", "kinds": ["class"], "countOnly": true}
→ {"count": 42}

LOCATION FORMAT:
Top-level: "path:line:col-line:col"
Children: "line:col-line:col" (relative to parent)
Use these locations for references/definition/supertype/subtype tools.`),
			mcp.WithObject("args",
				mcp.Description("Parameters for symbol search"),
			),
		),
		handleSymbols,
	)

	// Register references tool
	mcpServer.AddTool(
		mcp.NewTool("references",
			mcp.WithDescription(`Find all usages of a symbol. Get location from symbols tool first.

EXAMPLE:
{"path": "/src/user.ts", "line": 42, "column": 8}
→ [{"path": "/src/api/handler.ts:25:10", "preview": "  const result = processUser(data);"}]`),
			mcp.WithString("path",
				mcp.Description("File containing the symbol"),
			),
			mcp.WithNumber("line",
				mcp.Description("Line number of the symbol (1-based)"),
			),
			mcp.WithNumber("column",
				mcp.Description("Column position (1-based)"),
			),
		),
		handleReferences,
	)

	// Register fileTypes tool
	mcpServer.AddTool(
		mcp.NewTool("fileTypes",
			mcp.WithDescription(`Get all types and top-level functions in a file. Best for file overview.

EXAMPLE:
{"path": "/src/models/user.ts"}
→ [{"name": "User", "kind": "Class", "location": "/src/models/user.ts:15:7-15:11"},
   {"name": "createUser", "kind": "Function", "location": "/src/models/user.ts:45:10-45:20"}]`),
			mcp.WithString("path",
				mcp.Description("File to analyze (absolute path)"),
			),
		),
		handleFileTypes,
	)

	// Register diagnostics tool
	mcpServer.AddTool(
		mcp.NewTool("diagnostics",
			mcp.WithDescription(`Get errors and warnings from language servers.

EXAMPLES:
All workspace issues: {}
→ [{"path": "/src/app.ts:10:5", "severity": "error", "message": "Cannot find name 'foo'.", "source": "ts"}]

Specific file: {"path": "/src/app.ts"}
→ [{"path": "/src/app.ts:10:5", "severity": "error", "message": "Cannot find name 'foo'.", "source": "ts"}]`),
			mcp.WithObject("args",
				mcp.Description("Optional file path parameter"),
			),
		),
		handleDiagnostics,
	)

	// Register definition tool
	mcpServer.AddTool(
		mcp.NewTool("definition",
			mcp.WithDescription(`Jump to definition of a symbol. Get location from symbols tool first.

EXAMPLE:
{"path": "/src/app.ts", "line": 25, "column": 12}
→ [{"path": "/src/models/user.ts:42:8", "range": "42:8-42:18", "preview": "export function processUser(data: UserData) {"}]`),
			mcp.WithString("path",
				mcp.Description("File containing the symbol"),
			),
			mcp.WithNumber("line",
				mcp.Description("Line number (1-based)"),
			),
			mcp.WithNumber("column",
				mcp.Description("Column position (1-based)"),
			),
		),
		handleDefinition,
	)

	// Register supertype tool
	mcpServer.AddTool(
		mcp.NewTool("supertype",
			mcp.WithDescription(`Find what a type extends or implements. Get location from symbols tool first.

EXAMPLE:
{"path": "/src/models/User.ts", "line": 5, "column": 14}
→ [{"name": "BaseEntity", "kind": "Class", "path": "/src/models/base.ts:10:7", "range": "10:7-10:17"}]`),
			mcp.WithString("path",
				mcp.Description("File containing the type"),
			),
			mcp.WithNumber("line",
				mcp.Description("Line number (1-based)"),
			),
			mcp.WithNumber("column",
				mcp.Description("Column position (1-based)"),
			),
		),
		handleSupertype,
	)

	// Register subtype tool
	mcpServer.AddTool(
		mcp.NewTool("subtype",
			mcp.WithDescription(`Find implementations or subclasses of a type. Get location from symbols tool first.

EXAMPLE:
{"path": "/src/base/Repository.ts", "line": 1, "column": 7}
→ [{"name": "UserRepository", "kind": "Class", "path": "/src/repos/user.ts:5:7", "range": "5:7-5:21"}]`),
			mcp.WithString("path",
				mcp.Description("File containing the type"),
			),
			mcp.WithNumber("line",
				mcp.Description("Line number (1-based)"),
			),
			mcp.WithNumber("column",
				mcp.Description("Column position (1-based)"),
			),
		),
		handleSubtype,
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

func handleSymbols(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return handleQueryType(ctx, request, "symbols")
}

func handleReferences(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return handleQueryType(ctx, request, "references")
}

func handleFileTypes(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return handleQueryType(ctx, request, "fileTypes")
}

func handleDiagnostics(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return handleQueryType(ctx, request, "diagnostics")
}

func handleDefinition(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return handleQueryType(ctx, request, "definition")
}

func handleSupertype(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return handleQueryType(ctx, request, "supertype")
}

func handleSubtype(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return handleQueryType(ctx, request, "subtype")
}

// Common handler for all query types
func handleQueryType(ctx context.Context, request mcp.CallToolRequest, queryType string) (*mcp.CallToolResult, error) {
	// Get the args argument
	args := request.GetArguments()
	argsArg, exists := args["args"]
	if !exists {
		return nil, fmt.Errorf("missing 'args' argument")
	}

	// Add the type field to the args
	argsMap, ok := argsArg.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("args must be an object")
	}
	argsMap["type"] = queryType

	// Marshal the args to JSON
	argsJSON, err := json.Marshal(argsMap)
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
