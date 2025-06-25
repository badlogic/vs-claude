import * as vscode from 'vscode';
import { SetupManager } from './setup';
import { WindowManager } from './window-manager';

let outputChannel: vscode.OutputChannel;
let windowManager: WindowManager;
let setupManager: SetupManager;

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('VS Claude');
    outputChannel.appendLine('VS Claude extension activated');
    outputChannel.show();

    windowManager = new WindowManager(outputChannel);
    setupManager = new SetupManager(outputChannel, context);

    await windowManager.initialize();

    const showSetupCommand = vscode.commands.registerCommand('vs-claude.showSetup', async () => {
        await setupManager.checkAndInstallMCP();
    });

    const uninstallCommand = vscode.commands.registerCommand('vs-claude.uninstall', async () => {
        await setupManager.uninstallMCP();
    });

    context.subscriptions.push(showSetupCommand);
    context.subscriptions.push(uninstallCommand);
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('Checking MCP installation on startup...');
    await setupManager.checkAndInstallMCP();

    context.subscriptions.push({
        dispose: () => {
            windowManager.dispose();
        },
    });
}

export function deactivate() {
    windowManager?.dispose();
    outputChannel?.dispose();
}
