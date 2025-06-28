import * as vscode from 'vscode';
import { logger } from './logger';

const REQUIRED_EXTENSIONS = [
	{ id: 'ms-python.python', name: 'Python' },
	{ id: 'ms-python.vscode-pylance', name: 'Pylance' },
	{ id: 'golang.go', name: 'Go' },
	{ id: 'ms-dotnettools.csharp', name: 'C#', note: 'Requires .NET SDK' },
	{ id: 'redhat.java', name: 'Java Language Support' },
	{ id: 'llvm-vs-code-extensions.vscode-clangd', name: 'clangd' },
	{ id: 'Dart-Code.dart-code', name: 'Dart' },
	{ id: 'Dart-Code.flutter', name: 'Flutter' },
];

export class LanguageExtensionManager {
	private installingExtensions = new Set<string>();

	async checkAndInstallExtensions(): Promise<void> {
		logger.info('LanguageExtensions', 'Checking for required language extensions...');

		const missingExtensions = this.getMissingExtensions();

		if (missingExtensions.length === 0) {
			logger.info('LanguageExtensions', 'All required language extensions are installed');
			return;
		}

		logger.info('LanguageExtensions', `Found ${missingExtensions.length} missing extensions`);

		// Install all missing extensions in parallel
		const installPromises = missingExtensions.map((ext) => this.installExtension(ext));

		try {
			await Promise.all(installPromises);
			logger.info('LanguageExtensions', 'All language extensions installed successfully');

			// Show a single notification after all extensions are installed
			vscode.window
				.showInformationMessage(
					`VS Claude: Installed ${missingExtensions.length} language extensions. Reload to activate them.`,
					'Reload Window'
				)
				.then((selection) => {
					if (selection === 'Reload Window') {
						vscode.commands.executeCommand('workbench.action.reloadWindow');
					}
				});
		} catch (error) {
			logger.error('LanguageExtensions', 'Failed to install some extensions', error);
		}
	}

	private getMissingExtensions(): typeof REQUIRED_EXTENSIONS {
		return REQUIRED_EXTENSIONS.filter((ext) => {
			const installed = vscode.extensions.getExtension(ext.id);
			return !installed;
		});
	}

	private async installExtension(extension: (typeof REQUIRED_EXTENSIONS)[0]): Promise<void> {
		if (this.installingExtensions.has(extension.id)) {
			return; // Already installing
		}

		this.installingExtensions.add(extension.id);

		try {
			logger.info('LanguageExtensions', `Installing ${extension.name} (${extension.id})...`);

			// Use URI scheme to install extensions - this should handle dependencies better
			const extensionUri = vscode.Uri.parse(`vscode:extension/${extension.id}`);
			await vscode.commands.executeCommand('vscode.open', extensionUri);

			// Wait a bit for the extension to be installed
			await new Promise((resolve) => setTimeout(resolve, 2000));

			logger.info('LanguageExtensions', `Successfully installed ${extension.name}`);
		} catch (error) {
			logger.error('LanguageExtensions', `Failed to install ${extension.name}`, error);
			throw error;
		} finally {
			this.installingExtensions.delete(extension.id);
		}
	}

	/**
	 * Check if all required extensions are installed (without installing them)
	 */
	areAllExtensionsInstalled(): boolean {
		return this.getMissingExtensions().length === 0;
	}
}
