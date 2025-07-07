import * as vscode from 'vscode';
import { logger } from './logger';
import { PanelManager } from './panel-manager';
import { SettingsPanel } from './panels/settings/panel';
import { SetupManager } from './setup';
import { WindowManager } from './window-manager';

let windowManager: WindowManager;
let setupManager: SetupManager;
let panelManager: PanelManager;

export async function activate(context: vscode.ExtensionContext) {
	logger.info('Extension', 'VS Claude extension activating...');

	windowManager = new WindowManager();
	setupManager = new SetupManager(context);
	panelManager = new PanelManager(context);

	await windowManager.initialize();
	await panelManager.restorePanels();

	const showSetupCommand = vscode.commands.registerCommand('vs-claude.showSetup', async () => {
		await setupManager.checkAndInstallMCP();
	});

	const uninstallCommand = vscode.commands.registerCommand('vs-claude.uninstall', async () => {
		await setupManager.uninstallMCP();
	});

	const openSettingsCommand = vscode.commands.registerCommand('vs-claude.openSettings', async () => {
		await panelManager.create(SettingsPanel);
	});

	context.subscriptions.push(showSetupCommand);
	context.subscriptions.push(uninstallCommand);
	context.subscriptions.push(openSettingsCommand);
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
