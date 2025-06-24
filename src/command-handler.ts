import * as path from 'path';
import * as vscode from 'vscode';

interface OpenFileArgs {
    path: string;
    line?: number;
    endLine?: number;
    windowId?: string;
}

interface OpenDiffArgs {
    leftPath: string;
    rightPath: string;
    title?: string;
    windowId?: string;
}

type CommandArgs = OpenFileArgs | OpenDiffArgs;

export interface Command {
    id: string;
    tool: string;
    args: CommandArgs;
}

export class CommandHandler {
    constructor(private outputChannel: vscode.OutputChannel) {}

    async executeCommand(command: Command): Promise<void> {
        this.outputChannel.appendLine(`Executing command: ${command.tool}`);

        try {
            switch (command.tool) {
                case 'openFile':
                    await this.handleOpenFile(command.args as OpenFileArgs);
                    break;

                case 'openDiff':
                    await this.handleOpenDiff(command.args as OpenDiffArgs);
                    break;

                default:
                    this.outputChannel.appendLine(`Unknown command: ${command.tool}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Command execution error: ${error}`);
        }
    }

    private async handleOpenFile(args: OpenFileArgs): Promise<void> {
        const { path: filePath, line, endLine } = args;
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);

        if (line) {
            const startLine = line - 1;
            const endLineNum = endLine ? endLine - 1 : startLine;

            // Get the actual line lengths to create proper selection
            const startPos = new vscode.Position(startLine, 0);
            const endLineLength = doc.lineAt(endLineNum).text.length;
            const endPos = new vscode.Position(endLineNum, endLineLength);

            const range = new vscode.Range(startPos, endPos);

            // Set selection to highlight the entire range
            editor.selection = new vscode.Selection(startPos, endPos);

            // Reveal the range in the center of the editor
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    }

    private async handleOpenDiff(args: OpenDiffArgs): Promise<void> {
        const { leftPath, rightPath, title } = args;
        const leftUri = vscode.Uri.file(leftPath);
        const rightUri = vscode.Uri.file(rightPath);

        await vscode.commands.executeCommand(
            'vscode.diff',
            leftUri,
            rightUri,
            title || `${path.basename(leftPath)} ↔ ${path.basename(rightPath)}`
        );
    }
}
