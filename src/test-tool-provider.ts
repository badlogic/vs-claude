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

		// Track that this panel is open
		this.trackPanelState(true);

		this.panel = vscode.window.createWebviewPanel(
			'vsClaudeTestTool',
			'VS Claude Test Tool',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'out')],
			}
		);

		// Set the icon
		this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'logo.png');

		this.panel.webview.html = this.getWebviewContent(this.panel.webview);

		this.panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'runTest': {
						const command = {
							id: `test-${Date.now()}`,
							tool: message.tool,
							args: message.args,
						};

						try {
							const result = await this.commandHandler.executeCommand(command);
							this.panel?.webview.postMessage({
								command: 'testResult',
								success: result.success,
								data: result.data,
								error: result.error,
								workspaceRoot: this.workspaceRoot,
							});
						} catch (error) {
							this.panel?.webview.postMessage({
								command: 'testResult',
								success: false,
								error: error instanceof Error ? error.message : 'Unknown error',
								workspaceRoot: this.workspaceRoot,
							});
						}
						break;
					}
					case 'openFile': {
						const uri = vscode.Uri.file(message.path);
						const position = new vscode.Position(message.line - 1, message.column - 1);
						const range = new vscode.Range(position, position);

						vscode.window.showTextDocument(uri, {
							selection: range,
							preserveFocus: false,
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
			this.trackPanelState(false);
		});
	}

	private getWebviewContent(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'views', 'test-tool-webview.js')
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'views', 'styles.css')
		);
		const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png'));

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VS Claude Test Tool</title>
    <link rel="icon" href="${logoUri}" type="image/png">
    <link href="${styleUri}" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; overflow: auto;">
    <script>
        window.logoUri = "${logoUri}";
    </script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
	}

	private trackPanelState(isOpen: boolean) {
		// Only track in development mode
		if (this.context.extensionMode === vscode.ExtensionMode.Development) {
			const openPanels = this.context.globalState.get<string[]>('openPanels', []);
			if (isOpen && !openPanels.includes('testTool')) {
				this.context.globalState.update('openPanels', [...openPanels, 'testTool']);
			} else if (!isOpen) {
				this.context.globalState.update(
					'openPanels',
					openPanels.filter((p) => p !== 'testTool')
				);
			}
		}
	}
}
