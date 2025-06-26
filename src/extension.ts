import * as vscode from 'vscode';
import { LogViewerWebviewProvider } from './log-viewer-webview';
import { logger } from './logger';
import { SetupManager } from './setup';
import { TestToolWebviewProvider } from './test-tool-webview';
import { WindowManager } from './window-manager';

let windowManager: WindowManager;
let setupManager: SetupManager;
let testToolProvider: TestToolWebviewProvider;
let logViewerProvider: LogViewerWebviewProvider;

export async function activate(context: vscode.ExtensionContext) {
	logger.info('Extension', 'VS Claude extension activating...');

	windowManager = new WindowManager();
	setupManager = new SetupManager(context);
	testToolProvider = new TestToolWebviewProvider(context);
	logViewerProvider = new LogViewerWebviewProvider(context);

	await windowManager.initialize();

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

	context.subscriptions.push(showSetupCommand);
	context.subscriptions.push(uninstallCommand);
	context.subscriptions.push(testToolCommand);
	context.subscriptions.push(showLogsCommand);
	context.subscriptions.push(logger);

	await setupManager.checkAndInstallMCP();

	logger.info('Extension', 'VS Claude extension ready');

	// Show logs by default in development
	if (context.extensionMode === vscode.ExtensionMode.Development) {
		logger.show();
	}

	context.subscriptions.push({
		dispose: () => {
			windowManager.dispose();
		},
	});
}

export function deactivate() {
	logger.info('Extension', 'VS Claude extension deactivating...');
	windowManager?.dispose();
	logger.dispose();
}
