import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { GitAPI, GitExtension } from './git';
import { findGitRoot } from './git-utils';
import { logger } from './logger';

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

type OpenItem = OpenFileItem | OpenDiffItem | OpenGitDiffItem;

// OpenArgs can be:
// 1. A single OpenItem object
// 2. An array of OpenItem objects
type OpenArgs = OpenItem | OpenItem[];

export class OpenHandler {
	async execute(args: OpenArgs): Promise<{ success: boolean; error?: string }> {
		// Log the open command
		if (Array.isArray(args)) {
			logger.info('OpenHandler', `Opening ${args.length} items`);
		} else {
			const type =
				args.type === 'file'
					? `file ${args.path}`
					: args.type === 'diff'
						? `diff ${args.left} ↔ ${args.right}`
						: `git diff ${args.path} (${args.from} → ${args.to})`;
			logger.info('OpenHandler', `Opening ${type}`);
		}

		// Normalize to array of items
		let items: OpenItem[];

		if (Array.isArray(args)) {
			// Array of items
			items = args;
		} else {
			// Single item
			items = [args];
		}

		// Track successes and failures
		let successCount = 0;
		const failedItems: Array<{ item: OpenItem; error: string }> = [];

		// Group file items by path to handle multiple highlights
		const fileGroups = new Map<string, OpenFileItem[]>();
		const otherItems: OpenItem[] = [];

		for (const item of items) {
			if (item.type === 'file') {
				const existing = fileGroups.get(item.path) || [];
				existing.push(item);
				fileGroups.set(item.path, existing);
			} else {
				otherItems.push(item);
			}
		}

		// Process grouped file items
		for (const [path, fileItems] of fileGroups) {
			try {
				await this.openFileWithMultipleSelections(fileItems);
				successCount += fileItems.length;
			} catch (error) {
				const errorMsg = this.formatFileError(path, error);
				logger.error('OpenHandler', `Failed to open file ${path}: ${errorMsg}`);
				for (const item of fileItems) {
					failedItems.push({ item, error: errorMsg });
				}
			}
		}

		// Process other items
		for (const item of otherItems) {
			try {
				await this.openItem(item);
				successCount++;
			} catch (error) {
				const errorMsg = this.formatItemError(item, error);
				logger.error('OpenHandler', `Failed to open item: ${errorMsg}`);
				failedItems.push({ item, error: errorMsg });
			}
		}

		// Determine overall result
		if (failedItems.length === 0) {
			return { success: true };
		} else if (successCount === 0) {
			// All items failed
			return {
				success: false,
				error: `Failed to open all ${items.length} items. First error: ${failedItems[0].error}`,
			};
		} else {
			// Partial success
			if (failedItems.length > 0) {
				logger.warn(
					'OpenHandler',
					`Opened ${successCount}/${items.length} items (${failedItems.length} failed)`
				);
			}
			return {
				success: true, // Return success if at least one item opened
			};
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
			default:
				throw new Error(`Unknown item type: ${(item as OpenItem).type}`);
		}
	}

	private async openFile(item: OpenFileItem): Promise<void> {
		const uri = vscode.Uri.file(item.path);
		logger.debug('OpenHandler', `Opening file: ${item.path}`);
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

	private async openFileWithMultipleSelections(items: OpenFileItem[]): Promise<void> {
		if (items.length === 0) return;

		const uri = vscode.Uri.file(items[0].path);
		const doc = await vscode.workspace.openTextDocument(uri);

		// Use the preview property from the first item
		const editor = await vscode.window.showTextDocument(doc, {
			preview: items[0].preview ?? false,
			preserveFocus: items[0].preview === true,
		});

		// Create selections for all items with line ranges
		const selections: vscode.Selection[] = [];
		let firstRange: vscode.Range | undefined;

		for (const item of items) {
			if (item.startLine) {
				const startLine = item.startLine - 1;
				const endLine = item.endLine ? item.endLine - 1 : startLine;

				const startPos = new vscode.Position(startLine, 0);
				const endLineLength = doc.lineAt(endLine).text.length;
				const endPos = new vscode.Position(endLine, endLineLength);

				selections.push(new vscode.Selection(startPos, endPos));

				if (!firstRange) {
					firstRange = new vscode.Range(startPos, endPos);
				}
			}
		}

		if (selections.length > 0) {
			// Set all selections at once
			editor.selections = selections;

			// Reveal the first range
			if (firstRange) {
				editor.revealRange(firstRange, vscode.TextEditorRevealType.InCenter);
			}
		}
	}

	private async openDiff(item: OpenDiffItem): Promise<void> {
		const leftUri = vscode.Uri.file(item.left);
		const rightUri = vscode.Uri.file(item.right);
		logger.debug('OpenHandler', `Opening diff: ${item.left} ↔ ${item.right}`);

		await vscode.commands.executeCommand(
			'vscode.diff',
			leftUri,
			rightUri,
			item.title || `${path.basename(item.left)} ↔ ${path.basename(item.right)}`,
			{ preview: false } // Don't open in preview mode
		);
	}

	private async openGitDiff(item: OpenGitDiffItem): Promise<void> {
		logger.debug('OpenHandler', `Opening git diff: ${item.path} (${item.from} → ${item.to})`);

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

		// Wait for git extension to initialize
		if (git.state !== 'initialized') {
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
				logger.warn('OpenHandler', 'No git repositories found in workspace');

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
		if (repos.length === 0) {
			logger.warn('OpenHandler', 'No git repositories found');
		} else if (repos.length > 1) {
			logger.debug('OpenHandler', `Multiple git repositories found: ${repos.length}`);
		}

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
			// Create URIs for diff
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
				if (!fromHash) {
					logger.warn('OpenHandler', `From ref '${item.from}' not found`);
				}
			}

			if (item.to !== 'working' && item.to !== 'staged') {
				const toHash = await checkRef(item.to);
				if (!toHash) {
					logger.warn('OpenHandler', `To ref '${item.to}' not found`);
				}
			}
		} catch (error) {
			logger.warn('OpenHandler', `Failed to verify refs: ${error}`);
		}

		await vscode.commands.executeCommand(
			'vscode.diff',
			leftUri,
			rightUri,
			`${path.basename(item.path)} (${item.from} ↔ ${item.to})`,
			{ preview: false } // Don't open in preview mode
		);
	}

	private formatFileError(path: string, error: unknown): string {
		if (error instanceof Error) {
			// Check for common error types
			if (error.message.includes('ENOENT') || error.message.includes('file not found')) {
				return `File not found: ${path}`;
			} else if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
				return `Permission denied: ${path}`;
			} else if (error.message.includes('EISDIR')) {
				return `Path is a directory, not a file: ${path}`;
			}
			return error.message;
		}
		return String(error);
	}

	private formatItemError(item: OpenItem, error: unknown): string {
		const errorStr = error instanceof Error ? error.message : String(error);

		switch (item.type) {
			case 'file':
				return this.formatFileError(item.path, error);
			case 'diff':
				return `Failed to open diff (${item.left} ↔ ${item.right}): ${errorStr}`;
			case 'gitDiff':
				return `Failed to open git diff for ${item.path}: ${errorStr}`;
			default:
				return errorStr;
		}
	}
}
