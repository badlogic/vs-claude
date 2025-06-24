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

// Tool arguments structs
type OpenFileArgs struct {
	Path     string  `json:"path" jsonschema:"required,description=Absolute path to the file"`
	Line     *int    `json:"line,omitempty" jsonschema:"description=Line number to highlight (optional)"`
	EndLine  *int    `json:"endLine,omitempty" jsonschema:"description=End line for range highlight (optional)"`
	WindowId *string `json:"windowId,omitempty" jsonschema:"description=Window ID to target (optional)"`
}

type OpenDiffArgs struct {
	LeftPath  string  `json:"leftPath" jsonschema:"required,description=Path to the left (original) file"`
	RightPath string  `json:"rightPath" jsonschema:"required,description=Path to the right (modified) file"`
	Title     *string `json:"title,omitempty" jsonschema:"description=Title for the diff view (optional)"`
	WindowId  *string `json:"windowId,omitempty" jsonschema:"description=Window ID to target (optional)"`
}

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

	// Register openFile tool
	mcpServer.AddTool(
		mcp.NewTool("openFile",
			mcp.WithDescription("Open a file in VS Code with optional line highlighting"),
			mcp.WithString("path",
				mcp.Description("Absolute path to the file"),
				mcp.Required(),
			),
			mcp.WithNumber("line",
				mcp.Description("Line number to highlight (optional)"),
			),
			mcp.WithNumber("endLine",
				mcp.Description("End line for range highlight (optional)"),
			),
			mcp.WithString("windowId",
				mcp.Description("Window ID to target (optional)"),
			),
		),
		handleOpenFile,
	)

	// Register openDiff tool
	mcpServer.AddTool(
		mcp.NewTool("openDiff",
			mcp.WithDescription("Open a diff view between two files"),
			mcp.WithString("leftPath",
				mcp.Description("Path to the left (original) file"),
				mcp.Required(),
			),
			mcp.WithString("rightPath",
				mcp.Description("Path to the right (modified) file"),
				mcp.Required(),
			),
			mcp.WithString("title",
				mcp.Description("Title for the diff view (optional)"),
			),
			mcp.WithString("windowId",
				mcp.Description("Window ID to target (optional)"),
			),
		),
		handleOpenDiff,
	)

	// Start serving
	log.Println("Starting MCP server...")
	if err := server.ServeStdio(mcpServer); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func handleOpenFile(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// Extract arguments
	args := request.GetArguments()
	path, _ := args["path"].(string)
	line, _ := args["line"].(float64)
	endLine, _ := args["endLine"].(float64)
	windowId, _ := args["windowId"].(string)

	// Convert to our OpenFileArgs struct
	openFileArgs := OpenFileArgs{
		Path: path,
	}
	if line > 0 {
		lineInt := int(line)
		openFileArgs.Line = &lineInt
	}
	if endLine > 0 {
		endLineInt := int(endLine)
		openFileArgs.EndLine = &endLineInt
	}
	if windowId != "" {
		openFileArgs.WindowId = &windowId
	}

	return handleOpenFileLogic(openFileArgs)
}

func handleOpenFileLogic(args OpenFileArgs) (*mcp.CallToolResult, error) {
	windowId, err := getTargetWindow(args.WindowId)
	if err != nil {
		return nil, err
	}

	// Create command
	cmd := Command{
		ID:   fmt.Sprintf("%d", time.Now().UnixNano()),
		Tool: "openFile",
	}

	// Marshal args to preserve original structure
	argsJson, _ := json.Marshal(args)
	cmd.Args = argsJson

	// Write command to window's command file
	if err := writeCommand(windowId, cmd); err != nil {
		return nil, err
	}

	// Return success message
	message := fmt.Sprintf("Opened %s", filepath.Base(args.Path))
	if args.Line != nil {
		message += fmt.Sprintf(" at line %d", *args.Line)
	}

	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{
				Type: "text",
				Text: message,
			},
		},
	}, nil
}

func handleOpenDiff(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// Extract arguments
	args := request.GetArguments()
	leftPath, _ := args["leftPath"].(string)
	rightPath, _ := args["rightPath"].(string)
	title, _ := args["title"].(string)
	windowId, _ := args["windowId"].(string)

	// Convert to our OpenDiffArgs struct
	openDiffArgs := OpenDiffArgs{
		LeftPath:  leftPath,
		RightPath: rightPath,
	}
	if title != "" {
		openDiffArgs.Title = &title
	}
	if windowId != "" {
		openDiffArgs.WindowId = &windowId
	}

	return handleOpenDiffLogic(openDiffArgs)
}

func handleOpenDiffLogic(args OpenDiffArgs) (*mcp.CallToolResult, error) {
	windowId, err := getTargetWindow(args.WindowId)
	if err != nil {
		return nil, err
	}

	// Create command
	cmd := Command{
		ID:   fmt.Sprintf("%d", time.Now().UnixNano()),
		Tool: "openDiff",
	}

	// Marshal args to preserve original structure
	argsJson, _ := json.Marshal(args)
	cmd.Args = argsJson

	// Write command to window's command file
	if err := writeCommand(windowId, cmd); err != nil {
		return nil, err
	}

	// Return success message
	message := fmt.Sprintf("Opened diff: %s ↔ %s",
		filepath.Base(args.LeftPath),
		filepath.Base(args.RightPath))

	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{
				Type: "text",
				Text: message,
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
		if strings.HasSuffix(file.Name(), ".json") && !strings.Contains(file.Name(), ".cmd.") {
			windowId := strings.TrimSuffix(file.Name(), ".json")
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
				cmdFile := filepath.Join(vsClaudeDir, windowId+".cmd.jsonl")
				os.Remove(cmdFile)
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

func writeCommand(windowId string, cmd Command) error {
	cmdFile := filepath.Join(vsClaudeDir, fmt.Sprintf("%s.cmd.jsonl", windowId))

	f, err := os.OpenFile(cmdFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open command file: %v", err)
	}
	defer f.Close()

	cmdBytes, _ := json.Marshal(cmd)
	if _, err := fmt.Fprintf(f, "%s\n", cmdBytes); err != nil {
		return fmt.Errorf("failed to write command: %v", err)
	}

	return nil
}
