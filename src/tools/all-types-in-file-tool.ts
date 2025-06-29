import * as vscode from 'vscode';
import { logger } from '../logger';
import type { AllTypesInFileRequest, CodeSymbol, ToolResponse } from './types';

/**
 * This tool is used to get all types and top-level functions in a given file.
 */
export class AllTypesInFileTool {
	public async execute(request: AllTypesInFileRequest): Promise<ToolResponse<CodeSymbol[]>> {
		try {
			const uri = vscode.Uri.file(request.path);

			// Get all symbols in the file
			const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
				'vscode.executeDocumentSymbolProvider',
				uri
			);

			if (!documentSymbols) {
				logger.debug('AllTypesInFileTool', `No symbol provider available for ${uri.fsPath}`);
				return { success: true, data: [] };
			}

			// Open the document to get preview lines
			const document = await vscode.workspace.openTextDocument(uri);

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

						// Add preview
						try {
							const line = document.lineAt(symbol.selectionRange.start.line);
							sym.preview = line.text.trim();
						} catch (_e) {
							// Line might be out of bounds
						}

						// For types, include their members based on includeMembers flag
						if (isType && symbol.children && symbol.children.length > 0) {
							const includeMembers = request.includeMembers !== false; // Default to true
							sym.children = this.extractMembers(symbol.children, document, includeMembers);
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

			logger.info('AllTypesInFileTool', `Found ${results.length} types and functions in ${request.path}`);
			return { success: true, data: results };
		} catch (error) {
			logger.error('AllTypesInFileTool', `Failed to get file types: ${error}`);
			return { success: false, error: `Failed to get file types: ${error}` };
		}
	}

	private extractMembers(
		symbols: vscode.DocumentSymbol[],
		document: vscode.TextDocument,
		includeMembers: boolean
	): CodeSymbol[] {
		const results: CodeSymbol[] = [];

		for (const symbol of symbols) {
			// Check if this is a nested type (class, interface, struct, enum)
			const isNestedType = [
				vscode.SymbolKind.Class,
				vscode.SymbolKind.Interface,
				vscode.SymbolKind.Struct,
				vscode.SymbolKind.Enum,
			].includes(symbol.kind);

			// Check if this is a member (field, method, property, constructor)
			const isMember = [
				vscode.SymbolKind.Field,
				vscode.SymbolKind.Method,
				vscode.SymbolKind.Property,
				vscode.SymbolKind.Constructor,
			].includes(symbol.kind);

			// Include nested types always, or include members only if includeMembers is true
			if (isNestedType || (includeMembers && isMember) || (!isNestedType && !isMember)) {
				const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
				const sym: CodeSymbol = {
					name: symbol.name,
					kind: vscode.SymbolKind[symbol.kind],
					location: this.formatRange(combinedRange),
				};

				// Add preview
				try {
					const line = document.lineAt(symbol.selectionRange.start.line);
					sym.preview = line.text.trim();
				} catch (_e) {
					// Line might be out of bounds
				}

				if (symbol.children && symbol.children.length > 0) {
					sym.children = this.extractMembers(symbol.children, document, includeMembers);
				}

				results.push(sym);
			}
		}

		return results;
	}

	private formatRange(range: vscode.Range): string {
		const startLine = range.start.line + 1;
		const startCol = range.start.character + 1;
		const endLine = range.end.line + 1;
		const endCol = range.end.character + 1;
		return `${startLine}:${startCol}-${endLine}:${endCol}`;
	}
}
