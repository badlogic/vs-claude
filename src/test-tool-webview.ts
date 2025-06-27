import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CommandHandler } from './command-handler';

export class TestToolWebviewProvider {
	private panel: vscode.WebviewPanel | undefined;
	private commandHandler: CommandHandler;
	private workspaceRoot: string | undefined;

	constructor(private context: vscode.ExtensionContext) {
		this.commandHandler = new CommandHandler();
		this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}

	public show() {
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'vsClaudeTestTool',
			'VS Claude Test Tool',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, '')],
			}
		);

		// Set the icon
		this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'logo.png');

		this.panel.webview.html = this.getWebviewContent(this.panel.webview);

		this.panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'runQuery': {
						const command = {
							id: `test-${Date.now()}`,
							tool: 'query',
							args: message.query,
						};

						const result = await this.commandHandler.executeCommand(command);

						this.panel?.webview.postMessage({
							command: 'queryResult',
							result: result,
							queryType: message.queryType,
							workspaceRoot: this.workspaceRoot,
						});
						break;
					}
				}
			},
			undefined,
			this.context.subscriptions
		);

		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	private getWebviewContent(webview: vscode.Webview): string {
		const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png'));
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'test-tool-webview.content.js')
		);

		// Read the HTML template
		const htmlPath = path.join(this.context.extensionPath, 'out', 'test-tool-webview.content.html');
		let html = fs.readFileSync(htmlPath, 'utf8');

		// Replace template variables
		html = html.replace(/\${logoUri}/g, logoUri.toString());
		html = html.replace(/\${scriptUri}/g, scriptUri.toString());

		return html;
	}
}
