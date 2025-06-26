import * as vscode from 'vscode';
import { logger } from './logger';
import { SetupManager } from './setup';
import { TestQueryWebviewProvider } from './test-query-webview';
import { WindowManager } from './window-manager';

let windowManager: WindowManager;
let setupManager: SetupManager;
let testQueryProvider: TestQueryWebviewProvider;

export async function activate(context: vscode.ExtensionContext) {
	logger.info('Extension', 'VS Claude extension activating...');

	windowManager = new WindowManager();
	setupManager = new SetupManager(context);
	testQueryProvider = new TestQueryWebviewProvider(context);

	await windowManager.initialize();

	const showSetupCommand = vscode.commands.registerCommand('vs-claude.showSetup', async () => {
		await setupManager.checkAndInstallMCP();
	});

	const uninstallCommand = vscode.commands.registerCommand('vs-claude.uninstall', async () => {
		await setupManager.uninstallMCP();
	});

	const testQueryCommand = vscode.commands.registerCommand('vs-claude.testQuery', () => {
		testQueryProvider.show();
	});

	context.subscriptions.push(showSetupCommand);
	context.subscriptions.push(uninstallCommand);
	context.subscriptions.push(testQueryCommand);
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
