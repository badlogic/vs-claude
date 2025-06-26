import * as vscode from 'vscode';
import { logger } from './logger';

export class LogViewerWebviewProvider {
	private panel: vscode.WebviewPanel | undefined;

	constructor(private context: vscode.ExtensionContext) {}

	public show() {
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		this.panel = vscode.window.createWebviewPanel('vsClaudeLogViewer', 'VS Claude Logs', vscode.ViewColumn.Two, {
			enableScripts: true,
			retainContextWhenHidden: true,
		});

		this.panel.webview.html = this.getWebviewContent();

		// Send current logs
		this.panel.webview.postMessage({
			command: 'setLogs',
			logs: logger.getLogs(),
		});

		// Listen for new logs
		const logListener = logger.onDidLog((log) => {
			this.panel?.webview.postMessage({
				command: 'addLog',
				log,
			});
		});

		// Handle messages from webview
		this.panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'clear':
						logger.clearLogs();
						break;
					case 'setLogLevel':
						logger.setLogLevel(message.level);
						break;
				}
			},
			undefined,
			this.context.subscriptions
		);

		this.panel.onDidDispose(
			() => {
				logListener.dispose();
				this.panel = undefined;
			},
			null,
			this.context.subscriptions
		);
	}

	private getWebviewContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VS Claude Logs</title>
    <style>
        :root {
            --vscode-editor-background: var(--vscode-editor-background);
            --vscode-editor-foreground: var(--vscode-editor-foreground);
            --vscode-button-background: var(--vscode-button-background);
            --vscode-button-foreground: var(--vscode-button-foreground);
            --vscode-button-hoverBackground: var(--vscode-button-hoverBackground);
            --vscode-input-background: var(--vscode-input-background);
            --vscode-input-foreground: var(--vscode-input-foreground);
            --vscode-input-border: var(--vscode-input-border);
            --vscode-dropdown-background: var(--vscode-dropdown-background);
            --vscode-dropdown-foreground: var(--vscode-dropdown-foreground);
            --vscode-dropdown-border: var(--vscode-dropdown-border);
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            margin: 0;
            padding: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }

        .container {
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .toolbar {
            display: flex;
            gap: 10px;
            padding: 10px;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            align-items: center;
            flex-shrink: 0;
        }

        .log-container {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', 'Courier New', monospace);
            font-size: 13px;
            line-height: 1.5;
        }

        .log-entry {
            margin-bottom: 2px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .timestamp {
            color: #666;
        }

        .level-debug {
            color: #888;
        }

        .level-info {
            color: #4B9BFF;
        }

        .level-warn {
            color: #FFC936;
        }

        .level-error {
            color: #F14C4C;
            font-weight: bold;
        }

        .component {
            color: #16C3C3;
        }

        .message {
            color: var(--vscode-editor-foreground);
        }

        .message.debug {
            color: #888;
        }

        .message.error {
            font-weight: bold;
        }

        .args {
            color: #888;
            margin-left: 20px;
            font-size: 12px;
        }

        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
        }

        .filter-input {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 2px;
            font-size: 13px;
            flex: 1;
            max-width: 300px;
        }

        .stats {
            margin-left: auto;
            color: #888;
            font-size: 12px;
        }

        .command-arrow {
            color: #16C3C3;
        }

        .command-name {
            font-weight: bold;
        }

        .success-icon {
            color: #4EC34E;
        }

        .error-icon {
            color: #F14C4C;
        }

        .file-path {
            color: #FFC936;
        }

        .query-type {
            color: #C586C0;
        }

        .no-logs {
            text-align: center;
            color: #888;
            margin-top: 50px;
        }

        .log-entry.filtered-out {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <button onclick="clearLogs()">Clear</button>
            <select id="logLevel" onchange="changeLogLevel()">
                <option value="0">Debug</option>
                <option value="1" selected>Info</option>
                <option value="2">Warn</option>
                <option value="3">Error</option>
            </select>
            <input type="text" class="filter-input" id="filterInput" placeholder="Filter logs..." oninput="filterLogs()">
            <div class="stats" id="stats">0 logs</div>
        </div>
        <div class="log-container" id="logContainer">
            <div class="no-logs">No logs yet...</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let logs = [];
        let filter = '';

        function formatTimestamp(timestamp) {
            return \`<span class="timestamp">\${timestamp}</span>\`;
        }

        function formatLevel(level, levelName) {
            const levelClass = \`level-\${levelName.toLowerCase().trim()}\`;
            return \`<span class="\${levelClass}">\${levelName}</span>\`;
        }

        function formatComponent(component) {
            return \`<span class="component">[\${component}]</span>\`;
        }

        function formatMessage(message, level) {
            // Handle special formatting
            message = message
                .replace(/→\\s*(\\w+)/g, '<span class="command-arrow">→</span> <span class="command-name">$1</span>')
                .replace(/✓\\s*(\\w+)/g, '<span class="success-icon">✓</span> $1')
                .replace(/✗\\s*(\\w+)/g, '<span class="error-icon">✗</span> $1')
                .replace(/\\/([^/:]+\\.[^/:]+)(:\\d+)?(:\\d+)?/g, '<span class="file-path">$&</span>');

            const messageClass = level === 0 ? 'debug' : level === 3 ? 'error' : '';
            return \`<span class="message \${messageClass}">\${message}</span>\`;
        }

        function formatArgs(args) {
            if (!args || args.length === 0) return '';
            
            const formatted = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');

            return \`<div class="args">\${formatted}</div>\`;
        }

        function createLogEntry(log) {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.innerHTML = \`
                \${formatTimestamp(log.timestamp)}
                \${formatLevel(log.level, log.levelStr)}
                \${formatComponent(log.component)}
                \${formatMessage(log.message, log.level)}
                \${formatArgs(log.args)}
            \`;
            return div;
        }

        function renderLogs() {
            const container = document.getElementById('logContainer');
            const filtered = logs.filter(log => {
                if (!filter) return true;
                const searchText = \`\${log.component} \${log.message} \${JSON.stringify(log.args || [])}\`.toLowerCase();
                return searchText.includes(filter.toLowerCase());
            });

            if (filtered.length === 0) {
                container.innerHTML = '<div class="no-logs">No logs match the filter...</div>';
            } else {
                container.innerHTML = '';
                filtered.forEach(log => {
                    container.appendChild(createLogEntry(log));
                });
            }

            updateStats();
            
            // Auto-scroll to bottom
            container.scrollTop = container.scrollHeight;
        }

        function updateStats() {
            const filtered = logs.filter(log => {
                if (!filter) return true;
                const searchText = \`\${log.component} \${log.message} \${JSON.stringify(log.args || [])}\`.toLowerCase();
                return searchText.includes(filter.toLowerCase());
            });
            
            document.getElementById('stats').textContent = 
                filter ? \`\${filtered.length}/\${logs.length} logs\` : \`\${logs.length} logs\`;
        }

        function clearLogs() {
            logs = [];
            renderLogs();
            vscode.postMessage({ command: 'clear' });
        }

        function changeLogLevel() {
            const level = parseInt(document.getElementById('logLevel').value);
            vscode.postMessage({ command: 'setLogLevel', level });
        }

        function filterLogs() {
            filter = document.getElementById('filterInput').value;
            renderLogs();
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'setLogs':
                    logs = message.logs;
                    renderLogs();
                    break;
                case 'addLog':
                    logs.push(message.log);
                    renderLogs();
                    break;
            }
        });
    </script>
</body>
</html>`;
	}
}
