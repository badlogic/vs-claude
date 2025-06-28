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

		// Track that this panel is open
		this.trackPanelState(true);

		this.panel = vscode.window.createWebviewPanel('vsClaudeLogViewer', 'VS Claude Logs', vscode.ViewColumn.Two, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'build', 'extension')],
		});

		// Set the icon
		this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'logo.png');

		this.panel.webview.html = this.getWebviewContent(this.panel.webview);

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
				this.trackPanelState(false);
			},
			null,
			this.context.subscriptions
		);
	}

	private getWebviewContent(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'build', 'extension', 'views', 'log-viewer-webview.js')
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'build', 'extension', 'views', 'styles.css')
		);
		const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png'));

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VS Claude Logs</title>
    <link rel="icon" href="${logoUri}" type="image/png">
    <link href="${styleUri}" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; overflow: hidden;">
    <script src="${scriptUri}"></script>
</body>
</html>`;
	}

	private trackPanelState(isOpen: boolean) {
		// Only track in development mode
		if (this.context.extensionMode === vscode.ExtensionMode.Development) {
			const openPanels = this.context.globalState.get<string[]>('openPanels', []);
			if (isOpen && !openPanels.includes('logViewer')) {
				this.context.globalState.update('openPanels', [...openPanels, 'logViewer']);
			} else if (!isOpen) {
				this.context.globalState.update(
					'openPanels',
					openPanels.filter((p) => p !== 'logViewer')
				);
			}
		}
	}
}
