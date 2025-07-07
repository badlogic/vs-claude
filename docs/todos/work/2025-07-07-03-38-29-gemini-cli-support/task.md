# I want to also support Gemini CLI and rework the installation process

**Status:** Refining
**Created:** 2025-07-07T03:38:29
**Agent PID:** 37672

## Original Todo
- [ ] I want to also support Gemini CLI and rework the installation process
    - Check if MCP server is installed with Claude Claude
        - No? Show popup with install button -> does what we already do, we just don't show the manual button anymore
    - Check if MCP server is installed with Gemini CLI
        - No? Show popup with install button ->
            - Write entry to ~/.gemini/settings.json
                {
                    ... other settings
                    "mcpServers": {
                        "myPythonServer": {
                            "command": "python",
                            "args": ["mcp_server.py", "--port", "8080"],
                            "cwd": "./mcp_tools/python",
                            "timeout": 5000
                        },
                        "myNodeServer": {
                            "command": "node",
                            "args": ["mcp_server.js"],
                            "cwd": "./mcp_tools/node"
                        },
                        "myDockerServer": {
                            "command": "docker",
                            "args": ["run", "i", "--rm", "-e", "API_KEY", "ghcr.io/foo/bar"],
                            "env": {
                            "API_KEY": "$MY_API_TOKEN"
                            }
                        },
                    }
                    ... other settings
                }
    - VS Claude: Install with Claude Code/Gemini CLI
    - VS Claude: Uninstall from Claude Code/Gemini CLI