import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from './logger';

interface LanguageConfig {
	language: string;
	extension: string;
	content: string;
}

const LANGUAGE_CONFIGS: LanguageConfig[] = [
	{
		language: 'python',
		extension: '.py',
		content: '# VS Claude LSP initializer\npass\n',
	},
	{
		language: 'go',
		extension: '.go',
		content: '// VS Claude LSP initializer\npackage main\n',
	},
	{
		language: 'csharp',
		extension: '.cs',
		content: '// VS Claude LSP initializer\nnamespace VSClaude { }\n',
	},
	{
		language: 'java',
		extension: '.java',
		content: '// VS Claude LSP initializer\npublic class VSClaudeInit { }\n',
	},
	{
		language: 'cpp',
		extension: '.cpp',
		content: '// VS Claude LSP initializer\nint main() { return 0; }\n',
	},
	{
		language: 'c',
		extension: '.c',
		content: '// VS Claude LSP initializer\nint main() { return 0; }\n',
	},
	{
		language: 'dart',
		extension: '.dart',
		content: '// VS Claude LSP initializer\nvoid main() { }\n',
	},
	{
		language: 'typescript',
		extension: '.ts',
		content: '// VS Claude LSP initializer\nexport {};\n',
	},
	{
		language: 'javascript',
		extension: '.js',
		content: '// VS Claude LSP initializer\n',
	},
];

export class LSPInitializer {
	private initialized = false;
	private tempDir: string;

	constructor() {
		// Create a temp directory for dummy files
		this.tempDir = path.join(os.tmpdir(), 'vs-claude-lsp-init');
	}

	/**
	 * Initialize all language servers by opening dummy files
	 */
	async initializeAllLSPs(): Promise<void> {
		if (this.initialized) {
			return;
		}

		logger.info('LSPInitializer', 'Initializing language servers...');

		try {
			// Create temp directory if it doesn't exist
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.tempDir));

			// Process each language
			for (const config of LANGUAGE_CONFIGS) {
				await this.initializeLSP(config);
			}

			this.initialized = true;
			logger.info('LSPInitializer', 'All language servers initialized');
		} catch (error) {
			logger.error('LSPInitializer', 'Failed to initialize some language servers', error);
		}
	}

	private async initializeLSP(config: LanguageConfig): Promise<void> {
		try {
			// Create dummy file path
			const filePath = path.join(this.tempDir, `dummy${config.extension}`);
			const fileUri = vscode.Uri.file(filePath);

			// Write dummy content
			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(config.content, 'utf8'));

			// Open the document silently
			const document = await vscode.workspace.openTextDocument(fileUri);

			// Show it briefly to trigger LSP activation
			await vscode.window.showTextDocument(document, {
				viewColumn: vscode.ViewColumn.Active,
				preserveFocus: false,
				preview: true,
			});

			// Wait a moment for LSP to start
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Close the editor
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

			// Clean up the file
			try {
				await vscode.workspace.fs.delete(fileUri);
			} catch {
				// Ignore cleanup errors
			}

			logger.debug('LSPInitializer', `Initialized LSP for ${config.language}`);
		} catch (error) {
			logger.warn('LSPInitializer', `Failed to initialize LSP for ${config.language}`, error);
		}
	}

	/**
	 * Clean up temp directory
	 */
	async cleanup(): Promise<void> {
		try {
			await vscode.workspace.fs.delete(vscode.Uri.file(this.tempDir), { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}
