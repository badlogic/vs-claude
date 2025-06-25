import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { GitAPI, GitExtension } from './git';
import { findGitRoot } from './git-utils';

const execPromise = promisify(exec);

// Types for the open command
interface OpenFileItem {
    type: 'file';
    path: string;
    startLine?: number;
    endLine?: number;
    preview?: boolean;
}

interface OpenDiffItem {
    type: 'diff';
    left: string;
    right: string;
    title?: string;
}

interface OpenGitDiffItem {
    type: 'gitDiff';
    path: string;
    from: string;
    to: string;
    context?: number;
}

interface OpenSymbolItem {
    type: 'symbol';
    query: string;
    path?: string;
}

type OpenItem = OpenFileItem | OpenDiffItem | OpenGitDiffItem | OpenSymbolItem;

// OpenArgs can be:
// 1. A single OpenItem object
// 2. An array of OpenItem objects
type OpenArgs = OpenItem | OpenItem[];

export class OpenHandler {
    constructor(private outputChannel: vscode.OutputChannel) {}

    async execute(args: OpenArgs): Promise<{ success: boolean; error?: string }> {
        try {
            // Normalize to array of items
            let items: OpenItem[];

            if (Array.isArray(args)) {
                // Array of items
                items = args;
            } else {
                // Single item
                items = [args];
            }

            // Process each item
            for (const item of items) {
                await this.openItem(item);
            }

            return { success: true };
        } catch (error) {
            this.outputChannel.appendLine(`Open command error: ${error}`);
            return { success: false, error: String(error) };
        }
    }

    private async openItem(item: OpenItem): Promise<void> {
        switch (item.type) {
            case 'file':
                await this.openFile(item);
                break;
            case 'diff':
                await this.openDiff(item);
                break;
            case 'gitDiff':
                await this.openGitDiff(item);
                break;
            case 'symbol':
                await this.openSymbol(item);
                break;
            default:
                throw new Error(`Unknown item type: ${(item as OpenItem).type}`);
        }
    }

    private async openFile(item: OpenFileItem): Promise<void> {
        const uri = vscode.Uri.file(item.path);
        const doc = await vscode.workspace.openTextDocument(uri);

        // Use the preview property from the item, defaulting to false
        const editor = await vscode.window.showTextDocument(doc, {
            preview: item.preview ?? false, // Use item.preview if specified, otherwise default to false
            preserveFocus: item.preview === true, // Keep focus on current editor if preview mode
        });

        if (item.startLine) {
            const startLine = item.startLine - 1;
            const endLine = item.endLine ? item.endLine - 1 : startLine;

            const startPos = new vscode.Position(startLine, 0);
            const endLineLength = doc.lineAt(endLine).text.length;
            const endPos = new vscode.Position(endLine, endLineLength);

            const range = new vscode.Range(startPos, endPos);
            editor.selection = new vscode.Selection(startPos, endPos);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    }

    private async openDiff(item: OpenDiffItem): Promise<void> {
        const leftUri = vscode.Uri.file(item.left);
        const rightUri = vscode.Uri.file(item.right);

        await vscode.commands.executeCommand(
            'vscode.diff',
            leftUri,
            rightUri,
            item.title || `${path.basename(item.left)} ↔ ${path.basename(item.right)}`,
            { preview: false } // Don't open in preview mode
        );
    }

    private async openGitDiff(item: OpenGitDiffItem): Promise<void> {
        // Get git extension
        const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
        if (!gitExtension) {
            throw new Error('Git extension not available');
        }

        // Ensure git extension is activated
        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }

        const git: GitAPI = gitExtension.exports.getAPI(1);

        // Log current git API state
        this.outputChannel.appendLine(`Git API state: ${git.state}`);

        // Wait for git extension to initialize
        if (git.state !== 'initialized') {
            this.outputChannel.appendLine('Waiting for git extension to initialize...');
            await new Promise<void>((resolve) => {
                const disposable = git.onDidChangeState((state) => {
                    if (state === 'initialized') {
                        disposable.dispose();
                        resolve();
                    }
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    disposable.dispose();
                    resolve();
                }, 5000);
            });
        }

        // Get repositories
        const repos = git.repositories;

        // If still no repositories, check workspace state
        if (repos.length === 0) {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                throw new Error(
                    'No folder open in VS Code. Please open the project folder first (File > Open Folder).'
                );
            } else {
                // Check if we're in a subfolder of a git repository
                const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
                this.outputChannel.appendLine(`No repositories found. Current workspace folder: ${workspaceFolder}`);

                const gitRoot = findGitRoot(workspaceFolder);
                if (gitRoot && gitRoot !== workspaceFolder) {
                    const relative = path.relative(gitRoot, workspaceFolder);
                    throw new Error(
                        `You opened a subfolder (${relative}) of a git repository.\n` +
                            `Git root found at: ${gitRoot}\n` +
                            'Please open the repository root folder to use git features.'
                    );
                } else {
                    throw new Error(
                        'No git repositories found in the current workspace.\n' +
                            'Make sure the folder contains a git repository (.git folder).'
                    );
                }
            }
        }

        // Find repo containing the file
        const fileUri = vscode.Uri.file(item.path);

        // Log available repositories for debugging
        this.outputChannel.appendLine(`Git repositories found: ${repos.length}`);
        repos.forEach((r, i) => {
            this.outputChannel.appendLine(`  ${i}: ${r.rootUri.path}`);
        });
        this.outputChannel.appendLine(`Looking for repository containing: ${fileUri.path}`);

        const repo = repos.find((r) => fileUri.path.startsWith(r.rootUri.path));
        if (!repo) {
            // Provide helpful error message
            const repoList = repos.map((r) => `  - ${r.rootUri.path}`).join('\n');
            throw new Error(
                `File not in any open git repository.\n` +
                    `File: ${fileUri.path}\n` +
                    `Open repositories:\n${repoList}\n\n` +
                    `Please open the folder containing this file in VS Code first.`
            );
        }

        // Use the git extension's toGitUri method to create proper git URIs
        let leftUri: vscode.Uri;
        let rightUri: vscode.Uri;

        try {
            if (item.from === 'working') {
                leftUri = fileUri;
            } else if (item.from === 'staged') {
                leftUri = git.toGitUri(fileUri, '');
            } else {
                leftUri = git.toGitUri(fileUri, item.from);
            }

            if (item.to === 'working') {
                rightUri = fileUri;
            } else if (item.to === 'staged') {
                rightUri = git.toGitUri(fileUri, '');
            } else {
                rightUri = git.toGitUri(fileUri, item.to);
            }

            // Log the URIs for debugging
            this.outputChannel.appendLine(`Left URI: ${leftUri.toString()}`);
            this.outputChannel.appendLine(`Right URI: ${rightUri.toString()}`);
        } catch (error) {
            throw new Error(`Failed to create git URIs: ${error}`);
        }

        // Try to verify the refs exist
        try {
            // Check if the refs exist
            const checkRef = async (ref: string) => {
                try {
                    const { stdout } = await execPromise(`git rev-parse ${ref}`, { cwd: repo.rootUri.fsPath });
                    return stdout.trim();
                } catch (_e) {
                    return null;
                }
            };

            if (item.from !== 'working' && item.from !== 'staged') {
                const fromHash = await checkRef(item.from);
                this.outputChannel.appendLine(`From ref '${item.from}' resolves to: ${fromHash || 'NOT FOUND'}`);
            }

            if (item.to !== 'working' && item.to !== 'staged') {
                const toHash = await checkRef(item.to);
                this.outputChannel.appendLine(`To ref '${item.to}' resolves to: ${toHash || 'NOT FOUND'}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Failed to verify refs: ${error}`);
        }

        await vscode.commands.executeCommand(
            'vscode.diff',
            leftUri,
            rightUri,
            `${path.basename(item.path)} (${item.from} ↔ ${item.to})`,
            { preview: false } // Don't open in preview mode
        );
    }

    private async openSymbol(item: OpenSymbolItem): Promise<void> {
        // If path is specified, search in that file
        if (item.path) {
            const uri = vscode.Uri.file(item.path);
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (!symbols) {
                throw new Error('No symbols found');
            }

            // Find matching symbol
            const symbol = this.findSymbol(symbols, item.query);
            if (!symbol) {
                throw new Error(`Symbol '${item.query}' not found`);
            }

            // Open and navigate to symbol
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, {
                preview: false, // Don't open in preview mode
                preserveFocus: false, // Focus the new tab
            });
            editor.selection = new vscode.Selection(symbol.range.start, symbol.range.end);
            editor.revealRange(symbol.range, vscode.TextEditorRevealType.InCenter);
        } else {
            // Search in workspace
            await vscode.commands.executeCommand('workbench.action.showAllSymbols', item.query);
        }
    }

    private findSymbol(symbols: vscode.DocumentSymbol[], query: string): vscode.DocumentSymbol | undefined {
        for (const symbol of symbols) {
            if (symbol.name === query) {
                return symbol;
            }
            // Search children
            if (symbol.children.length > 0) {
                const found = this.findSymbol(symbol.children, query);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    }
}
