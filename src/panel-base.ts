import * as vscode from 'vscode';
import type { PanelManager } from './panel-manager';

export abstract class Panel<T> {
	protected panel?: vscode.WebviewPanel;

	abstract get type(): string;
	abstract get title(): string;
	abstract get elementName(): string;
	abstract onMessage(message: T): void;

	constructor(private manager: PanelManager) {}

	async create(context: vscode.ExtensionContext): Promise<string> {
		this.panel = vscode.window.createWebviewPanel(this.type, this.title, vscode.ViewColumn.One, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [
				vscode.Uri.joinPath(context.extensionUri, 'build'),
				vscode.Uri.joinPath(context.extensionUri, ''),
			],
		});

		const webview = this.panel.webview;

		// Get resource URIs
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(context.extensionUri, 'build', 'panels', this.type, `${this.type}.js`)
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(context.extensionUri, 'build', 'panels', 'panel-styles.css')
		);
		// Enumerate and inject all extension resources
		const resources: Record<string, string> = {};
		const resourcesPath = vscode.Uri.joinPath(context.extensionUri, 'resources');

		// Recursively enumerate all resources
		const enumerateResources = async (dir: vscode.Uri, prefix: string = '') => {
			try {
				const entries = await vscode.workspace.fs.readDirectory(dir);
				for (const [name, type] of entries) {
					const fullPath = vscode.Uri.joinPath(dir, name);
					const key = prefix ? `${prefix}/${name}` : name;

					if (type === vscode.FileType.File) {
						// Use original file name as key (e.g., logo.png -> logo.png)
						resources[key] = webview.asWebviewUri(fullPath).toString();
					} else if (type === vscode.FileType.Directory) {
						await enumerateResources(fullPath, key);
					}
				}
			} catch (e) {
				// Resources directory might not exist in development
				console.warn('Could not enumerate resources:', e);
			}
		};

		await enumerateResources(resourcesPath);

		this.panel.webview.html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <${this.elementName}></${this.elementName}>
        <script>
          window.vsClaudeResources = ${JSON.stringify(resources)};
        </script>
        <script src="${scriptUri}"></script>
      </body>
      </html>`;

		// Set up message handling
		this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg));

		// Register with manager
		const id = this.manager.register(this);

		// Handle disposal
		this.panel.onDidDispose(() => {
			this.manager.unregister(id);
			this.dispose();
		});

		return id;
	}

	sendMessage(message: T): void {
		this.panel?.webview.postMessage(message);
	}

	dispose(): void {
		this.panel?.dispose();
	}
}
