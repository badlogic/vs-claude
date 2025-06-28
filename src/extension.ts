import * as vscode from 'vscode';
import { LanguageExtensionManager } from './language-extensions';
import { LogViewerWebviewProvider } from './log-viewer-provider';
import { logger } from './logger';
import { LSPInitializer } from './lsp-initializer';
import { SetupManager } from './setup';
import { TestToolWebviewProvider } from './test-tool-provider';
import { WindowManager } from './window-manager';

let windowManager: WindowManager;
let setupManager: SetupManager;
let testToolProvider: TestToolWebviewProvider;
let logViewerProvider: LogViewerWebviewProvider;
let languageExtensionManager: LanguageExtensionManager;
let lspInitializer: LSPInitializer;

export async function activate(context: vscode.ExtensionContext) {
	logger.info('Extension', 'VS Claude extension activating...');

	windowManager = new WindowManager();
	setupManager = new SetupManager(context);
	testToolProvider = new TestToolWebviewProvider(context);
	logViewerProvider = new LogViewerWebviewProvider(context);
	languageExtensionManager = new LanguageExtensionManager();
	lspInitializer = new LSPInitializer();

	await windowManager.initialize();

	// Check and install language extensions in development mode
	if (context.extensionMode === vscode.ExtensionMode.Development) {
		languageExtensionManager.checkAndInstallExtensions().catch((error) => {
			logger.error('Extension', 'Failed to check/install language extensions', error);
		});
	}

	// Initialize LSPs after a delay to ensure extensions are loaded
	setTimeout(async () => {
		try {
			await lspInitializer.initializeAllLSPs();
		} catch (error) {
			logger.error('Extension', 'Failed to initialize LSPs', error);
		}
	}, 5000); // Wait 5 seconds after activation

	// Restore previously open panels in development mode
	if (context.extensionMode === vscode.ExtensionMode.Development) {
		const openPanels = context.globalState.get<string[]>('openPanels', []);
		if (openPanels.includes('testTool')) {
			testToolProvider.show();
		}
		if (openPanels.includes('logViewer')) {
			logViewerProvider.show();
		}
	}

	const showSetupCommand = vscode.commands.registerCommand('vs-claude.showSetup', async () => {
		await setupManager.checkAndInstallMCP();
	});

	const uninstallCommand = vscode.commands.registerCommand('vs-claude.uninstall', async () => {
		await setupManager.uninstallMCP();
	});

	const testToolCommand = vscode.commands.registerCommand('vs-claude.testTool', () => {
		testToolProvider.show();
	});

	const showLogsCommand = vscode.commands.registerCommand('vs-claude.showLogs', () => {
		logViewerProvider.show();
	});

	const initializeLSPsCommand = vscode.commands.registerCommand('vs-claude.initializeLSPs', async () => {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Initializing language servers...',
				cancellable: false,
			},
			async () => {
				await lspInitializer.initializeAllLSPs();
			}
		);
		vscode.window.showInformationMessage('Language servers initialized');
	});

	context.subscriptions.push(showSetupCommand);
	context.subscriptions.push(uninstallCommand);
	context.subscriptions.push(testToolCommand);
	context.subscriptions.push(showLogsCommand);
	context.subscriptions.push(initializeLSPsCommand);
	context.subscriptions.push(logger);

	await setupManager.checkAndInstallMCP();

	logger.info('Extension', 'VS Claude extension ready');

	context.subscriptions.push({
		dispose: () => {
			windowManager.dispose();
		},
	});
}

export function deactivate() {
	logger.info('Extension', 'VS Claude extension deactivating...');
	windowManager?.dispose();
	lspInitializer?.cleanup();
	logger.dispose();
}
