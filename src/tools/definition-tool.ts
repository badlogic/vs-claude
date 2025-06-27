import * as vscode from 'vscode';
import { logger } from '../logger';
import type { Definition, DefinitionRequest, ToolResponse } from './types';

/**
 * This tool is used to find the definition of a symbol at a given position.
 */
export class DefinitionTool {
	public async execute(request: DefinitionRequest): Promise<ToolResponse<Definition[]>> {
		try {
			const requestUri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.column - 1
			);

			// Find definition at this position
			const definitions = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
				'vscode.executeDefinitionProvider',
				requestUri,
				position
			);

			if (!definitions) {
				return { success: true, data: [] };
			}

			// Convert to our format
			const results = await Promise.all(
				definitions.map(async (definition) => {
					// Check if it's a LocationLink or Location
					const isLocationLink = 'targetUri' in definition;
					const uri = isLocationLink
						? (definition as vscode.LocationLink).targetUri
						: (definition as vscode.Location).uri;
					const range = isLocationLink
						? (definition as vscode.LocationLink).targetRange
						: (definition as vscode.Location).range;

					const document = await vscode.workspace.openTextDocument(uri);
					const line = document.lineAt(range.start.line);

					// Try to get symbol information at the definition location
					const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
						'vscode.executeDocumentSymbolProvider',
						uri
					);

					let symbolKind: string | undefined;
					if (symbols) {
						// Find the symbol at this location
						const symbol = this.findSymbolAtPosition(symbols, range.start);
						if (symbol) {
							symbolKind = vscode.SymbolKind[symbol.kind];
						}
					}

					return {
						location: `${uri.fsPath}:${this.formatRange(range)}`,
						preview: line.text.trim(),
						kind: symbolKind,
					};
				})
			);

			logger.info('DefinitionTool', `Found ${results.length} definitions`);
			return { success: true, data: results };
		} catch (error) {
			logger.error('DefinitionTool', `Failed to find definition: ${error}`);
			return {
				success: false,
				error: `Failed to find definition: ${error}`,
			};
		}
	}

	private formatRange(range: vscode.Range): string {
		const startLine = range.start.line + 1;
		const startCol = range.start.character + 1;
		const endLine = range.end.line + 1;
		const endCol = range.end.character + 1;
		return `${startLine}:${startCol}-${endLine}:${endCol}`;
	}

	private findSymbolAtPosition(
		symbols: vscode.DocumentSymbol[],
		position: vscode.Position
	): vscode.DocumentSymbol | undefined {
		for (const symbol of symbols) {
			if (symbol.range.contains(position)) {
				// Check if any child contains the position more precisely
				if (symbol.children && symbol.children.length > 0) {
					const child = this.findSymbolAtPosition(symbol.children, position);
					if (child) {
						return child;
					}
				}
				return symbol;
			}
		}
		return undefined;
	}
}
