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
        * {
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 13px;
            margin: 0;
            padding: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.5;
        }

        .container {
            padding: 10px 20px;
            max-width: 1800px;
            margin: 0 auto;
        }

        .log-entry {
            margin-bottom: 4px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 12px;
            padding: 2px 0;
        }

        .log-entry:last-child {
            border-bottom: none;
        }

        .log-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 2px;
        }

        .timestamp {
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
            font-size: 11px;
        }

        .level {
            font-weight: 600;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            text-transform: uppercase;
        }

        .level.debug {
            background: rgba(150, 150, 150, 0.2);
            color: #999;
        }

        .level.info {
            background: rgba(0, 122, 204, 0.2);
            color: #007ACC;
        }

        .level.warn {
            background: rgba(255, 165, 0, 0.2);
            color: #FFA500;
        }

        .level.error {
            background: rgba(215, 58, 73, 0.2);
            color: #D73A49;
        }

        .component {
            color: var(--vscode-symbolIcon-namespaceForeground, #4EC9B0);
            font-weight: 500;
        }

        .message {
            color: var(--vscode-editor-foreground);
            margin-left: 8px;
        }

        /* Command styling */
        .command-arrow {
            color: #4EC9B0;
            font-weight: bold;
        }

        .command-name {
            color: #DCDCAA;
            font-weight: 600;
        }

        .success-icon {
            color: #4EC9B0;
        }

        .error-icon {
            color: #F14C4C;
        }

        /* File paths */
        .file-path {
            color: #9CDCFE;
            text-decoration: underline;
            cursor: pointer;
        }

        .file-path:hover {
            color: #B8DFFF;
        }

        /* JSON rendering */
        .json-container {
            background: var(--vscode-textBlockQuote-background, rgba(255, 255, 255, 0.05));
            border: 1px solid var(--vscode-textBlockQuote-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            padding: 8px;
            margin: 4px 0 4px 20px;
            overflow-x: auto;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.3;
        }

        .json-key {
            color: #9CDCFE;
        }

        .json-string {
            color: #CE9178;
        }

        .json-number {
            color: #B5CEA8;
        }

        .json-boolean {
            color: #569CD6;
        }

        .json-null {
            color: #569CD6;
            opacity: 0.7;
        }

        .json-punctuation {
            color: var(--vscode-editor-foreground);
            opacity: 0.6;
        }

        /* Tool-specific styling */
        .tool-section {
            margin: 2px 0;
        }

        .tool-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            margin-bottom: 2px;
            margin-left: 20px;
        }

        .empty-state {
            text-align: center;
            padding: 80px 20px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="container" id="logContainer">
        <div class="empty-state">Waiting for logs...</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let logs = [];

        function formatTimestamp(timestamp) {
            // Extract just the time portion
            const match = timestamp.match(/\\d{2}:\\d{2}:\\d{2}\\.\\d{3}/);
            return match ? match[0] : timestamp;
        }

        function formatMessage(message, level) {
            // Handle special message patterns
            return message
                .replace(/→\\s*([\\w-]+)/g, '<span class="command-arrow">→</span> <span class="command-name">$1</span>')
                .replace(/✓\\s*([\\w-]+)/g, '<span class="success-icon">✓</span> $1')
                .replace(/✗\\s*([\\w-]+)/g, '<span class="error-icon">✗</span> $1')
                .replace(/(\\/[^\\s]+)/g, '<span class="file-path">$1</span>');
        }

        function formatJson(obj) {
            return JSON.stringify(obj, null, 2)
                .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
                .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
                .replace(/: (\\d+)/g, ': <span class="json-number">$1</span>')
                .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
                .replace(/: null/g, ': <span class="json-null">null</span>')
                .replace(/([{}\\[\\],])/g, '<span class="json-punctuation">$1</span>');
        }

        function createLogEntry(log) {
            const levelClass = log.levelStr.toLowerCase().trim();
            const hasArgs = log.args && log.args.length > 0;
            
            let argsHtml = '';
            if (hasArgs) {
                // Check if this is a tool command with args
                const isCommand = log.component === 'Command' || log.component === 'CommandHandler';
                const isQuery = log.component === 'QueryHandler';
                
                if (isCommand || isQuery) {
                    log.args.forEach(arg => {
                        if (typeof arg === 'object' && arg !== null) {
                            const label = isCommand ? 'Arguments' : 'Data';
                            argsHtml += \`
                                <div class="tool-section">
                                    <div class="tool-label">\${label}:</div>
                                    <div class="json-container">\${formatJson(arg)}</div>
                                </div>
                            \`;
                        }
                    });
                } else {
                    // Regular args display
                    log.args.forEach(arg => {
                        if (typeof arg === 'object' && arg !== null) {
                            argsHtml += \`<div class="json-container">\${formatJson(arg)}</div>\`;
                        } else {
                            argsHtml += \`<div style="margin: 4px 0; opacity: 0.8;">\${String(arg)}</div>\`;
                        }
                    });
                }
            }

            return \`
                <div class="log-entry">
                    <div class="log-header">
                        <span class="timestamp">\${formatTimestamp(log.timestamp)}</span>
                        <span class="level \${levelClass}">\${log.levelStr}</span>
                        <span class="component">\${log.component}</span>
                        <span class="message">\${formatMessage(log.message, log.level)}</span>
                    </div>
                    \${argsHtml}
                </div>
            \`;
        }

        function renderLogs() {
            const container = document.getElementById('logContainer');
            
            if (logs.length === 0) {
                container.innerHTML = '<div class="empty-state">Waiting for logs...</div>';
                return;
            }

            container.innerHTML = logs.map(log => createLogEntry(log)).join('');
            
            // Auto-scroll to bottom
            window.scrollTo(0, document.body.scrollHeight);
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
                    // Only keep last 500 logs for performance
                    if (logs.length > 500) {
                        logs = logs.slice(-500);
                    }
                    renderLogs();
                    break;
            }
        });

        // Handle file path clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('file-path')) {
                const path = e.target.textContent;
                vscode.postMessage({
                    command: 'openFile',
                    path: path
                });
            }
        });
    </script>
</body>
</html>`;
	}
}
