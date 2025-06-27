import * as vscode from 'vscode';
import { LogViewerWebviewProvider } from './log-viewer-provider';
import { logger } from './logger';
import { SetupManager } from './setup';
import { TestToolWebviewProvider } from './test-tool-provider';
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

	context.subscriptions.push(showSetupCommand);
	context.subscriptions.push(uninstallCommand);
	context.subscriptions.push(testToolCommand);
	context.subscriptions.push(showLogsCommand);
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
	logger.dispose();
}
