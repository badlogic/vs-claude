import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from '../logger';

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
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, '')],
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
			},
			null,
			this.context.subscriptions
		);
	}

	private getWebviewContent(webview: vscode.Webview): string {
		const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png'));
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'views', 'log-viewer-webview.content.js')
		);

		// Read the HTML template
		const htmlPath = path.join(this.context.extensionPath, 'out', 'views', 'log-viewer-webview.content.html');
		let html = fs.readFileSync(htmlPath, 'utf8');

		// Replace template variables
		html = html.replace(/\${logoUri}/g, logoUri.toString());
		html = html.replace(/\${scriptUri}/g, scriptUri.toString());

		return html;
	}
}
