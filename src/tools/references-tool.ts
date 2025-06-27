import * as vscode from 'vscode';
import { logger } from '../logger';
import type { Reference, ReferenceRequest as ReferencesRequest, ToolResponse } from './types';

/**
 * This tool is used to find the references of a symbol at a given position.
 */
export class ReferencesTool {
	public async execute(request: ReferencesRequest): Promise<ToolResponse<Reference[]>> {
		try {
			const uri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.column - 1
			);

			// Find references at this position
			const references = await vscode.commands.executeCommand<vscode.Location[]>(
				'vscode.executeReferenceProvider',
				uri,
				position
			);

			if (!references || references.length === 0) {
				return { success: true, data: [] };
			}

			// Get preview text for each reference
			const referencesWithPreview = await Promise.all(
				references.map(async (ref) => {
					const document = await vscode.workspace.openTextDocument(ref.uri);
					const line = document.lineAt(ref.range.start.line);

					return {
						location: `${ref.uri.fsPath}:${ref.range.start.line + 1}:${ref.range.start.character + 1}`,
						preview: line.text.trim(),
					};
				})
			);

			logger.info('ReferencesTool', `Found ${referencesWithPreview.length} references`);
			return { success: true, data: referencesWithPreview };
		} catch (error) {
			logger.error('ReferencesTool', `Failed to find references: ${error}`);
			return { success: false, error: `Failed to find references: ${error}` };
		}
	}
}
