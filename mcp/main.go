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
		handleTool,
	)

	// Register symbols tool
	mcpServer.AddTool(
		mcp.NewTool("symbols",
			mcp.WithDescription(`Find code elements using VS Code's language intelligence. USE THIS INSTEAD OF GREP/RIPGREP for finding code.

SINGLE REQUEST:
{"query": "UserService", "kinds": ["class"]}

BATCH REQUESTS (execute multiple searches in parallel):
[
  {"query": "get*", "kinds": ["method"]},
  {"query": "User*", "kinds": ["interface"]},
  {"query": "process*", "path": "/path/to/file.ts"}
]

PARAMETERS:
- query?: pattern to match (default "*"). Use . for hierarchy, not :: or ->
  "Class" → just Class | "Class.*" → Class + direct children | "Class.method" → specific method
- path?: file or folder to search (absolute path)
- kinds?: filter ["class","method","property","field","constructor","enum","interface","function","variable","constant","struct","operator","type"]
  "type" = meta-kind matching class/interface/struct/enum
- exclude?: glob patterns to skip ["**/test/**"]
- countOnly?: return count only (faster for broad queries)

RETURNS:
- Single request: {"success": true, "data": [array of symbols]}
- Batch requests: [{"success": true, "data": [...]}, {"success": false, "error": "..."}]

EACH SYMBOL INCLUDES:
- name: symbol name
- kind: symbol type (class, method, etc.)
- location: "path:line:col-line:col" format
- preview: line of code where symbol is defined
- children?: nested symbols

LOCATION FORMAT:
Top-level: "path:line:col-line:col"
Children: "line:col-line:col" (within file in top-level root path)
Use these locations for references/definition/supertype/subtype tools.`),
			mcp.WithObject("args",
				mcp.Description("Single request object or array of requests for batch operations"),
			),
		),
		handleTool,
	)

	// Register references tool
	mcpServer.AddTool(
		mcp.NewTool("references",
			mcp.WithDescription(`Find all usages of a symbol. Get location from symbols tool first.

SINGLE REQUEST:
{"path": "/src/user.ts", "line": 42, "column": 8}

BATCH REQUESTS (find references for multiple symbols):
[
  {"path": "/src/user.ts", "line": 42, "column": 8},
  {"path": "/src/api.ts", "line": 15, "column": 12}
]

RETURNS:
- Single: {"success": true, "data": [{"location": "/src/api/handler.ts:25:10", "preview": "  const result = processUser(data);"}]}
- Batch: [{"success": true, "data": [...]}, {"success": true, "data": [...]}]`),
			mcp.WithObject("args",
				mcp.Description("Single location object or array of locations for batch operations"),
			),
		),
		handleTool,
	)

	// Register allTypesInFile tool
	mcpServer.AddTool(
		mcp.NewTool("allTypesInFile",
			mcp.WithDescription(`Get all types and top-level functions in a file. Best for file overview.

SINGLE REQUEST:
{"path": "/src/models/user.ts"}

BATCH REQUESTS (analyze multiple files):
[
  {"path": "/src/models/user.ts"},
  {"path": "/src/models/product.ts"}
]

RETURNS:
- Single: {"success": true, "data": [{"name": "User", "kind": "Class", "location": "...", "preview": "class User extends BaseModel {", "children": [...]}]}
- Batch: [{"success": true, "data": [...]}, {"success": true, "data": [...]}]

EACH TYPE/FUNCTION INCLUDES:
- name: symbol name
- kind: symbol type (Class, Interface, Function, etc.)
- location: file path with line/column range
- preview: line of code where symbol is defined
- children?: members for types (methods, properties, etc.)`),
			mcp.WithObject("args",
				mcp.Description("Single file path object or array of file paths for batch operations"),
			),
		),
		handleTool,
	)

	// Register diagnostics tool
	mcpServer.AddTool(
		mcp.NewTool("diagnostics",
			mcp.WithDescription(`Get errors and warnings from language servers.

SINGLE REQUEST:
{} // All workspace diagnostics
{"path": "/src/app.ts"} // Specific file

BATCH REQUESTS (check multiple files):
[
  {"path": "/src/app.ts"},
  {"path": "/src/user.ts"},
  {} // Include workspace-wide diagnostics
]

RETURNS:
- Single: {"success": true, "data": [{"path": "/src/app.ts:10:5", "severity": "error", "message": "..."}]}
- Batch: [{"success": true, "data": [...]}, {"success": true, "data": [...]}]`),
			mcp.WithObject("args",
				mcp.Description("Single request object or array of requests for batch operations"),
			),
		),
		handleTool,
	)

	// Register definition tool
	mcpServer.AddTool(
		mcp.NewTool("definition",
			mcp.WithDescription(`Jump to definition of a symbol. Get location from symbols tool first.

SINGLE REQUEST:
{"path": "/src/app.ts", "line": 25, "column": 12}

BATCH REQUESTS (find definitions for multiple symbols):
[
  {"path": "/src/app.ts", "line": 25, "column": 12},
  {"path": "/src/app.ts", "line": 30, "column": 8}
]

RETURNS:
- Single: {"success": true, "data": [{"location": "/src/models/user.ts:42:8", "preview": "...", "kind": "Function"}]}
- Batch: [{"success": true, "data": [...]}, {"success": true, "data": [...]}]`),
			mcp.WithObject("args",
				mcp.Description("Single location object or array of locations for batch operations"),
			),
		),
		handleTool,
	)

	// Register supertype tool
	mcpServer.AddTool(
		mcp.NewTool("supertype",
			mcp.WithDescription(`Find what a type extends or implements. Get location from symbols tool first.

SINGLE REQUEST:
{"path": "/src/models/User.ts", "line": 5, "column": 14}

BATCH REQUESTS (find supertypes for multiple types):
[
  {"path": "/src/models/User.ts", "line": 5, "column": 14},
  {"path": "/src/models/Product.ts", "line": 8, "column": 7}
]

RETURNS:
- Single: {"success": true, "data": [{"name": "BaseEntity", "kind": "Class", "location": "...", "preview": "..."}]}
- Batch: [{"success": true, "data": [...]}, {"success": false, "error": "Type hierarchy not supported..."}]

Note: May not be supported by all language servers`),
			mcp.WithObject("args",
				mcp.Description("Single location object or array of locations for batch operations"),
			),
		),
		handleTool,
	)

	// Register subtype tool
	mcpServer.AddTool(
		mcp.NewTool("subtype",
			mcp.WithDescription(`Find implementations or subclasses of a type. Get location from symbols tool first.

SINGLE REQUEST:
{"path": "/src/base/Repository.ts", "line": 1, "column": 7}

BATCH REQUESTS (find subtypes for multiple types):
[
  {"path": "/src/base/Repository.ts", "line": 1, "column": 7},
  {"path": "/src/base/Service.ts", "line": 3, "column": 10}
]

RETURNS:
- Single: {"success": true, "data": [{"name": "UserRepository", "kind": "Class", "location": "...", "preview": "..."}]}
- Batch: [{"success": true, "data": [...]}, {"success": false, "error": "Type hierarchy not supported..."}]

Note: May not be supported by all language servers`),
			mcp.WithObject("args",
				mcp.Description("Single location object or array of locations for batch operations"),
			),
		),
		handleTool,
	)

	// Start serving
	log.Println("Starting MCP server...")
	if err := server.ServeStdio(mcpServer); err != nil {
		// Check if it's a context canceled error (expected when client closes connection)
		if err.Error() == "context canceled" {
			log.Println("MCP server shutdown (client disconnected)")
		} else {
			log.Fatalf("Server error: %v", err)
		}
	}
}

// Generic handler for all tools
func handleTool(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// Get the tool name from request
	toolName := request.Params.Name

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
		ID:   fmt.Sprintf("%s-%d", toolName, time.Now().UnixNano()),
		Tool: toolName,
		Args: argsJson,
	}

	// Send command and wait for response
	log.Printf("[COMMAND SENT] %s: %s", toolName, string(argsJson))
	response, err := writeCommand(windowId, cmd, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to execute %s: %v", toolName, err)
	}

	// Log the response
	log.Printf("[RESPONSE RECEIVED] ID: %s, Success: %v", response.ID, response.Success)
	if !response.Success {
		log.Printf("[ERROR] %s", response.Error)
	}

	// Handle response based on success/failure
	if !response.Success {
		// Return error text directly
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				mcp.TextContent{
					Type: "text",
					Text: response.Error,
				},
			},
		}, nil
	}

	// Success case - check if data is a JSON string
	dataStr := string(response.Data)
	trimmed := strings.TrimSpace(dataStr)

	if len(trimmed) > 0 && trimmed[0] == '"' {
		// It's a JSON string - unmarshal and return raw
		var str string
		if err := json.Unmarshal(response.Data, &str); err == nil {
			return &mcp.CallToolResult{
				Content: []mcp.Content{
					mcp.TextContent{
						Type: "text",
						Text: str,
					},
				},
			}, nil
		}
	}

	// Not a string or failed to unmarshal - return JSON as-is
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{
				Type: "text",
				Text: dataStr,
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

// writeCommand writes a command and waits for a response with 30s timeout
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
