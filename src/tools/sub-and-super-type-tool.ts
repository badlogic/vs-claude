import * as vscode from 'vscode';
import { logger } from '../logger';
import type { ToolResponse, TypeHierarchyItem, TypeHierarchyRequest } from './types';

/**
 * This tool is used to find the subtypes of a symbol at a given position.
 */
export class SubAndSupertypeTool {
	public async execute(request: TypeHierarchyRequest): Promise<ToolResponse<TypeHierarchyItem[]>> {
		try {
			const uri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.column - 1
			);

			// Prepare type hierarchy at position
			const typeHierarchyItems = await vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
				'vscode.prepareTypeHierarchy',
				uri,
				position
			);

			if (!typeHierarchyItems || typeHierarchyItems.length === 0) {
				return { success: true, data: [] };
			}

			// Get subtypes
			const results: TypeHierarchyItem[] = [];

			for (const item of typeHierarchyItems) {
				const hierarchyItems = await vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
					request.type === 'subtype' ? 'vscode.provideSubtypes' : 'vscode.provideSupertypes',
					item
				);

				if (hierarchyItems) {
					for (const hierarchyItem of hierarchyItems) {
						// Get document to extract preview
						let preview = '';
						try {
							const doc = await vscode.workspace.openTextDocument(hierarchyItem.uri);
							const line = doc.lineAt(hierarchyItem.range.start.line);
							preview = line.text.trim();
						} catch {
							// Ignore preview errors
						}

						results.push({
							name: hierarchyItem.name,
							kind: vscode.SymbolKind[hierarchyItem.kind],
							location: `${hierarchyItem.uri.fsPath}:${this.formatRange(hierarchyItem.range)}`,
							preview,
						});
					}
				}
			}

			logger.info('SubAndSupertypeTool', `Found ${results.length} ${request.type}s`);
			return { success: true, data: results };
		} catch (error) {
			// Type hierarchy might not be supported by the language server
			if (error instanceof Error) {
				const errorMsg = error.message.toLowerCase();
				if (
					errorMsg.includes('no provider') ||
					errorMsg.includes('not supported') ||
					errorMsg.includes('no type hierarchy provider')
				) {
					return {
						success: false,
						error: 'Type hierarchy not supported by the language server for this file type',
					};
				}
			}
			return { success: false, error: `Failed to find ${request.type}s: ${error}` };
		}
	}

	private formatRange(range: vscode.Range): string {
		const startLine = range.start.line + 1;
		const startCol = range.start.character + 1;
		const endLine = range.end.line + 1;
		const endCol = range.end.character + 1;
		return `${startLine}:${startCol}-${endLine}:${endCol}`;
	}
}
