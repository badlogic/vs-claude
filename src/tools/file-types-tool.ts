import * as vscode from 'vscode';
import { logger } from '../logger';
import type { CodeSymbol, FileTypesRequest, ToolResponse } from './types';

/**
 * This tool is used to get the types and top-levelfunctions in a given file.
 */
export class FileTypesTool {
	public async execute(request: FileTypesRequest): Promise<ToolResponse<CodeSymbol[]>> {
		try {
			const uri = vscode.Uri.file(request.path);

			// Get all symbols in the file
			const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
				'vscode.executeDocumentSymbolProvider',
				uri
			);

			if (!documentSymbols) {
				logger.debug('FileTypesTool', `No symbol provider available for ${uri.fsPath}`);
				return { success: true, data: [] };
			}

			const results: CodeSymbol[] = [];

			// Extract all types (classes, interfaces, structs, enums) and top-level functions
			const extractTypesAndFunctions = (symbols: vscode.DocumentSymbol[], isTopLevel = true) => {
				for (const symbol of symbols) {
					const isType = [
						vscode.SymbolKind.Class,
						vscode.SymbolKind.Interface,
						vscode.SymbolKind.Struct,
						vscode.SymbolKind.Enum,
					].includes(symbol.kind);

					const isTopLevelFunction = isTopLevel && symbol.kind === vscode.SymbolKind.Function;

					if (isType || isTopLevelFunction) {
						const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
						const sym: CodeSymbol = {
							name: symbol.name,
							kind: vscode.SymbolKind[symbol.kind],
							location: `${request.path}:${this.formatRange(combinedRange)}`,
						};

						// For types, include their members
						if (isType && symbol.children && symbol.children.length > 0) {
							sym.children = this.extractMembers(symbol.children);
						}

						results.push(sym);
					}

					// Recursively check for nested types
					if (symbol.children && symbol.children.length > 0) {
						extractTypesAndFunctions(symbol.children, false);
					}
				}
			};

			extractTypesAndFunctions(documentSymbols);

			logger.info('FileTypesTool', `Found ${results.length} types and functions in ${request.path}`);
			return { success: true, data: results };
		} catch (error) {
			logger.error('FileTypesTool', `Failed to get file types: ${error}`);
			return { success: false, error: `Failed to get file types: ${error}` };
		}
	}

	private extractMembers(symbols: vscode.DocumentSymbol[]): CodeSymbol[] {
		return symbols.map((symbol) => {
			const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
			const sym: CodeSymbol = {
				name: symbol.name,
				kind: vscode.SymbolKind[symbol.kind],
				location: this.formatRange(combinedRange),
			};

			if (symbol.children && symbol.children.length > 0) {
				sym.children = this.extractMembers(symbol.children);
			}

			return sym;
		});
	}

	private formatRange(range: vscode.Range): string {
		const startLine = range.start.line + 1;
		const startCol = range.start.character + 1;
		const endLine = range.end.line + 1;
		const endCol = range.end.character + 1;
		return `${startLine}:${startCol}-${endLine}:${endCol}`;
	}
}
