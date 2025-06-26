import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function findGitRoot(startPath: string): string | null {
	let currentPath = startPath;

	// Keep going up until we find .git or reach the root
	while (currentPath !== path.dirname(currentPath)) {
		const gitPath = path.join(currentPath, '.git');

		if (fs.existsSync(gitPath)) {
			return currentPath;
		}

		currentPath = path.dirname(currentPath);
	}

	return null;
}

export async function suggestOpenGitRoot(workspacePath: string, outputChannel: vscode.OutputChannel): Promise<void> {
	const gitRoot = findGitRoot(workspacePath);

	if (gitRoot && gitRoot !== workspacePath) {
		outputChannel.appendLine(`Found git repository at: ${gitRoot}`);

		const relative = path.relative(gitRoot, workspacePath);
		const answer = await vscode.window.showErrorMessage(
			`You opened a subfolder (${relative}) of a git repository. Git features require opening the repository root.`,
			'Open Repository Root',
			'Cancel'
		);

		if (answer === 'Open Repository Root') {
			await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(gitRoot));
		}
	}
}
