import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export class SetupManager {
    constructor(
        private outputChannel: vscode.OutputChannel,
        private context: vscode.ExtensionContext
    ) {}

    async checkAndInstallMCP(): Promise<void> {
        this.outputChannel.appendLine('=== Checking VS Claude MCP installation ===');

        const mcpServerPath = this.getMCPServerPath();
        if (!mcpServerPath) return;

        if (!fs.existsSync(mcpServerPath)) {
            this.outputChannel.appendLine(`ERROR: MCP server binary not found at ${mcpServerPath}`);
            vscode.window.showErrorMessage('VS Claude MCP server binary not found. Please rebuild the extension.');
            return;
        }

        const installedPath = await this.checkInstallation();

        if (installedPath) {
            this.outputChannel.appendLine(`VS Claude MCP server found at: ${installedPath}`);

            if (installedPath === mcpServerPath) {
                this.outputChannel.appendLine('VS Claude MCP server is correctly installed');
                return;
            } else {
                this.outputChannel.appendLine(`Path mismatch! Expected: ${mcpServerPath}, Found: ${installedPath}`);

                const result = await vscode.window.showWarningMessage(
                    'VS Claude MCP server is installed at an unexpected location',
                    {
                        modal: false,
                        detail: `Found at: ${installedPath}\nExpected at: ${mcpServerPath}\n\nWould you like to remove the old installation and install the correct one?`,
                    },
                    'Update',
                    'Keep Current',
                    'Manual Setup'
                );

                if (result === 'Update') {
                    this.outputChannel.appendLine('Removing old VS Claude installation...');
                    try {
                        await execAsync('claude mcp remove -s user vs-claude');
                        this.outputChannel.appendLine('Old installation removed');
                        await this.installMCP(mcpServerPath);
                    } catch (error) {
                        this.outputChannel.appendLine(`Failed to remove old installation: ${error}`);
                        vscode.window.showErrorMessage(
                            'Failed to update VS Claude. Check the output panel for details.'
                        );
                    }
                } else if (result === 'Manual Setup') {
                    await this.showManualInstructions(mcpServerPath);
                }
                return;
            }
        }

        this.outputChannel.appendLine('Showing installation prompt...');
        const result = await vscode.window.showInformationMessage(
            'VS Claude MCP not configured',
            {
                modal: false,
                detail: 'Would you like to install the VS Claude MCP server to enable Claude integration?',
            },
            'Install',
            'Manual Setup'
        );
        this.outputChannel.appendLine(`User selected: ${result}`);

        if (result === 'Install') {
            await this.installMCP(mcpServerPath);
        } else if (result === 'Manual Setup') {
            await this.showManualInstructions(mcpServerPath);
        }
    }

    async uninstallMCP(): Promise<void> {
        const installedPath = await this.checkInstallation();
        if (!installedPath) {
            this.outputChannel.appendLine('VS Claude MCP server is not installed.');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to uninstall VS Claude MCP server?',
            'Uninstall',
            'Cancel'
        );

        if (confirm !== 'Uninstall') {
            return;
        }

        try {
            this.outputChannel.appendLine('Uninstalling VS Claude MCP server...');
            this.outputChannel.appendLine('Command: claude mcp remove -s user vs-claude');

            const { stdout, stderr } = await execAsync('claude mcp remove -s user vs-claude');

            if (stdout) this.outputChannel.appendLine(`Output: ${stdout}`);
            if (stderr) this.outputChannel.appendLine(`Error: ${stderr}`);

            vscode.window.showInformationMessage('VS Claude has been uninstalled!', {
                modal: false,
                detail: 'You may need to restart Claude for changes to take effect.',
            });
        } catch (error) {
            this.outputChannel.appendLine(`Failed to uninstall MCP server: ${error}`);
            vscode.window.showErrorMessage('Failed to uninstall VS Claude. Check the output panel for details.');
        }
    }

    private async checkInstallation(): Promise<string | null> {
        try {
            this.outputChannel.appendLine('Running: claude mcp list');
            const { stdout, stderr } = await execAsync('claude mcp list');
            this.outputChannel.appendLine(`MCP list output: ${stdout}`);
            if (stderr) this.outputChannel.appendLine(`MCP list stderr: ${stderr}`);

            // Check if vs-claude is actually in the list and extract its path
            // The output format is: "name: path" on each line
            const lines = stdout.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('vs-claude:')) {
                    // Extract the path after "vs-claude: "
                    const path = trimmedLine.substring('vs-claude:'.length).trim();
                    return path;
                }
            }
            return null;
        } catch (error) {
            this.outputChannel.appendLine(`Error checking MCP list: ${error}`);
            this.outputChannel.appendLine('Claude CLI might not be installed or not in PATH');
            return null;
        }
    }

    private getMCPServerPath(): string | null {
        const platform = os.platform();
        const arch = os.arch();
        let binaryName = 'mcp-server-';

        this.outputChannel.appendLine(`Platform: ${platform}, Architecture: ${arch}`);

        if (platform === 'darwin') {
            binaryName += arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
        } else if (platform === 'linux') {
            binaryName += 'linux-amd64';
        } else if (platform === 'win32') {
            binaryName += 'windows-amd64.exe';
        } else {
            vscode.window.showErrorMessage(`Unsupported platform: ${platform}`);
            return null;
        }

        const mcpServerPath = path.join(this.context.extensionPath, 'bin', binaryName);
        this.outputChannel.appendLine(`MCP server path: ${mcpServerPath}`);
        return mcpServerPath;
    }

    private async installMCP(mcpServerPath: string): Promise<void> {
        try {
            this.outputChannel.appendLine(`Installing VS Claude MCP server...`);
            this.outputChannel.appendLine(`Command: claude mcp add -s user vs-claude "${mcpServerPath}"`);

            const { stdout, stderr } = await execAsync(`claude mcp add -s user vs-claude "${mcpServerPath}"`);

            if (stdout) this.outputChannel.appendLine(`Output: ${stdout}`);
            if (stderr) this.outputChannel.appendLine(`Error: ${stderr}`);

            vscode.window.showInformationMessage('VS Claude has been installed!', {
                modal: false,
                detail: 'You may need to restart Claude for changes to take effect.',
            });
        } catch (error) {
            this.outputChannel.appendLine(`Failed to install MCP server: ${error}`);
            vscode.window.showErrorMessage('Failed to install VS Claude. Check the output panel for details.');
        }
    }

    private async showManualInstructions(mcpServerPath: string): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'vsClaudeSetup',
            'Install VS Claude MCP',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, '')],
            }
        );

        const escapedPath = mcpServerPath.replace(/\\/g, '\\\\');
        const command = `claude mcp add -s user vs-claude "${mcpServerPath}"`;

        const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png'));

        panel.webview.html = this.getWebviewContent(command, escapedPath, mcpServerPath, logoUri);

        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'copy':
                        await vscode.env.clipboard.writeText(message.text);
                        break;
                }
            },
            undefined,
            []
        );
    }

    private getWebviewContent(
        command: string,
        escapedPath: string,
        mcpServerPath: string,
        logoUri: vscode.Uri
    ): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install VS Claude</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            font-size: 14px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            line-height: 1.6;
            padding: 0;
            margin: 0;
            overflow-x: hidden;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 48px;
        }

        .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            display: block;
        }

        h1 {
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 16px;
            margin: 0;
        }

        .options {
            display: grid;
            gap: 24px;
            margin-bottom: 32px;
        }

        .option-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 12px;
            padding: 24px;
            transition: all 0.3s ease;
        }

        .option-card:hover {
            border-color: #667eea;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.1);
        }

        .option-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }

        .option-number {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 14px;
        }

        h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }

        .recommended {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .code-block {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
            position: relative;
            overflow-x: auto;
        }

        .code-block pre {
            margin: 0;
            white-space: pre;
            overflow-x: auto;
        }

        code {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre;
            background: none;
        }

        .copy-button {
            position: absolute;
            top: 8px;
            right: 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .copy-button:hover {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }

        .copy-button:active {
            transform: translateY(0);
        }

        .file-path {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 12px;
        }

        .success-message {
            color: #10b981;
            font-size: 13px;
            margin-top: 8px;
            display: none;
            font-weight: 500;
        }

        .final-step {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
        }

        .final-step h3 {
            margin-bottom: 8px;
            font-size: 20px;
        }

        .description {
            color: var(--vscode-descriptionForeground);
            margin: 8px 0 16px;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${logoUri}" alt="VS Claude Logo" class="logo" />
            <h1>Install VS Claude MCP</h1>
            <p class="subtitle">Connect Claude to your VS Code environment</p>
        </div>

        <div class="options">
            <div class="option-card">
                <div class="option-header">
                    <div class="option-number">1</div>
                    <h3>Quick Install</h3>
                    <span class="recommended">Recommended</span>
                </div>
                <p class="description">Use the Claude CLI to automatically configure the MCP server</p>
                <div class="code-block">
                    <code id="cli-command">${command}</code>
                    <button class="copy-button" onclick="copyCommand()">Copy</button>
                </div>
                <div id="success-cli" class="success-message">Command copied to clipboard!</div>
            </div>

            <div class="option-card">
                <div class="option-header">
                    <div class="option-number">2</div>
                    <h3>Manual Configuration</h3>
                </div>
                <p class="description">Add this to your Claude configuration file</p>
                <div class="code-block">
                    <pre><code id="config-json">{
  "mcpServers": {
    "vs-claude": {
      "command": "${escapedPath}"
    }
  }
}</code></pre>
                    <button class="copy-button" onclick="copyConfig()">Copy</button>
                </div>
                <div id="success-config" class="success-message">Configuration copied to clipboard!</div>
            </div>
        </div>

        <div class="final-step">
            <h3>Almost Done!</h3>
            <p>After installation, restart Claude to activate the VS Claude connection</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function copyCommand() {
            vscode.postMessage({ type: 'copy', text: '${command}' });
            showSuccess('success-cli');
        }

        function copyConfig() {
            const config = {
                mcpServers: {
                    "vs-claude": {
                        command: "${mcpServerPath}"
                    }
                }
            };
            vscode.postMessage({ type: 'copy', text: JSON.stringify(config, null, 2) });
            showSuccess('success-config');
        }

        function showSuccess(id) {
            const element = document.getElementById(id);
            element.style.display = 'block';
            setTimeout(() => {
                element.style.display = 'none';
            }, 3000);
        }
    </script>
</body>
</html>`;
    }
}
