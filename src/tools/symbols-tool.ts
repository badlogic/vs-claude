import { minimatch } from 'minimatch';
import * as vscode from 'vscode';
import { logger } from '../logger';
import type { CodeSymbol, CountResult, SymbolKindName, SymbolsRequest, ToolResponse } from './types';

/**
 * This tool is used to find the symbols in a given path.
 */
export class SymbolsTool {
	public async execute(request: SymbolsRequest): Promise<ToolResponse<CodeSymbol[] | CountResult>> {
		try {
			let query = request.query?.trim() || '';
			if (query === '*' || query === '**') query = '';

			// Check for overly broad queries
			const isBroadQuery = query === '*' || query === '**' || query === '';
			const hasNoKindFilter = !request.kinds || request.kinds.length === 0;
			const isWorkspaceScope = !request.path;

			if (isBroadQuery && hasNoKindFilter && isWorkspaceScope && !request.countOnly) {
				return {
					success: false,
					error: "Query too broad: searching for '*' without any filters in workspace scope would return too many results. Please add 'kinds' filter, specify a 'path', use a more specific query pattern, or use 'countOnly' to check the size first.",
				};
			}

			// Determine scope from path
			let result: { result: CodeSymbol[] } | { error: string };
			if (request.path) {
				const uri = vscode.Uri.file(request.path);
				try {
					const stat = await vscode.workspace.fs.stat(uri);
					if (stat.type === vscode.FileType.File) {
						result = await this.symbolsInFile(uri, query, request.kinds);
					} else {
						result = await this.symbolsInFolder(request.path, query, request.kinds, request.exclude);
					}
				} catch {
					return { success: false, error: `Path not found or not accessible: ${request.path}` };
				}
			} else {
				result = await this.symbolsInWorkspace(query, request.kinds, request.exclude);
			}

			// Handle countOnly
			if (request.countOnly && 'result' in result) {
				const count = result.result.length;
				logger.info('SymbolsTool', `Symbol count: ${count}`);
				return { success: true, data: { count } };
			}

			if ('result' in result) {
				logger.info('SymbolsTool', `Found ${result.result.length} symbols`);
				return { success: true, data: result.result };
			}

			return { success: false, error: result.error };
		} catch (error) {
			logger.error('SymbolsTool', `Failed to find symbols: ${error}`);
			return { success: false, error: `Failed to find symbols: ${error}` };
		}
	}

	private async symbolsInFile(
		uri: vscode.Uri,
		query: string,
		kindFilter?: SymbolKindName[]
	): Promise<{ result: CodeSymbol[] } | { error: string }> {
		const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
			'vscode.executeDocumentSymbolProvider',
			uri
		);

		if (!documentSymbols) {
			logger.debug(
				'SymbolsTool',
				`No symbol provider available for ${uri.fsPath} - language server may not be active yet`
			);
			return { result: [] };
		}

		if (documentSymbols.length === 0) {
			return { result: [] };
		}

		const filtered = this.filterSymbols(documentSymbols, query, kindFilter);
		const filePath = uri.fsPath;
		for (const symbol of filtered) {
			symbol.location = `${filePath}:${symbol.location}`;
		}

		return { result: filtered };
	}

	private async symbolsInWorkspace(
		query: string,
		kindFilter?: SymbolKindName[],
		exclude?: string[]
	): Promise<{ result: CodeSymbol[] } | { error: string }> {
		// Extract root query for workspace search
		const rootQuery = query.split('.')[0];

		// Strip glob characters from the root query for VS Code's workspace symbol provider
		const cleanedRootQuery = rootQuery.replace(/[*?[\]{}]/g, '');

		// Search workspace with cleaned query
		const workspaceSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
			'vscode.executeWorkspaceSymbolProvider',
			cleanedRootQuery
		);

		if (workspaceSymbols && workspaceSymbols.length > 50) {
			logger.debug('SymbolsTool', `Workspace search returned ${workspaceSymbols.length} symbols`);
		}

		if (!workspaceSymbols || workspaceSymbols.length === 0) {
			return { result: [] };
		}

		// Group symbols by file to avoid processing same file multiple times
		const fileMap = new Map<string, vscode.SymbolInformation[]>();
		for (const symbol of workspaceSymbols) {
			const filePath = symbol.location.uri.fsPath;
			if (!fileMap.has(filePath)) {
				fileMap.set(filePath, []);
			}
			const symbols = fileMap.get(filePath);
			if (symbols) {
				symbols.push(symbol);
			}
		}

		// Process each file and collect results
		const results: CodeSymbol[] = [];
		for (const [filePath] of fileMap) {
			// Check exclude patterns
			if (exclude && exclude.length > 0) {
				const shouldExclude = exclude.some((pattern) => minimatch(filePath, pattern));
				if (shouldExclude) {
					continue;
				}
			}

			try {
				const uri = vscode.Uri.file(filePath);
				// Use symbolsInFile for consistent logic
				const fileResult = await this.symbolsInFile(uri, query, kindFilter);
				if ('result' in fileResult) {
					results.push(...fileResult.result);
				}
			} catch (fileError) {
				logger.debug('SymbolsTool', `Failed to get symbols for file ${filePath}: ${fileError}`);
			}
		}

		return { result: results };
	}

	private async symbolsInFolder(
		folderPath: string,
		query: string,
		kindFilter?: SymbolKindName[],
		exclude?: string[]
	): Promise<{ result: CodeSymbol[] } | { error: string }> {
		// Instead of searching workspace and filtering, enumerate files in folder
		const folderUri = vscode.Uri.file(folderPath);
		const results: CodeSymbol[] = [];

		// Find all files in the folder recursively
		const findFiles = async (uri: vscode.Uri): Promise<vscode.Uri[]> => {
			const files: vscode.Uri[] = [];
			try {
				const entries = await vscode.workspace.fs.readDirectory(uri);

				for (const [name, type] of entries) {
					const childUri = vscode.Uri.joinPath(uri, name);
					const childPath = childUri.fsPath;

					// Check exclude patterns
					if (exclude?.some((pattern) => minimatch(childPath, pattern))) {
						continue;
					}

					if (type === vscode.FileType.File) {
						files.push(childUri);
					} else if (type === vscode.FileType.Directory) {
						// Skip common non-source directories
						if (!name.match(/^\.|node_modules|vendor|target|dist|build|out|bin|obj|\.git$/)) {
							files.push(...(await findFiles(childUri)));
						}
					}
				}
			} catch (error) {
				logger.debug('SymbolsTool', `Failed to read directory ${uri.fsPath}: ${error}`);
			}
			return files;
		};

		const files = await findFiles(folderUri);
		if (files.length > 20) {
			logger.debug('SymbolsTool', `Searching ${files.length} files in ${folderPath}`);
		}

		// Process each file
		for (const fileUri of files) {
			try {
				// Use symbolsInFile for consistent logic
				const fileResult = await this.symbolsInFile(fileUri, query, kindFilter);
				if ('result' in fileResult) {
					results.push(...fileResult.result);
				}
			} catch (fileError) {
				// Log the error but continue processing other files
				logger.debug('SymbolsTool', `Failed to get symbols for file ${fileUri.fsPath}: ${fileError}`);
			}
		}

		return { result: results };
	}

	private matchesQuery(name: string, query: string): boolean {
		// Use minimatch for glob-style pattern matching
		// This supports *, ?, [abc], {a,b,c}, and ** patterns
		return minimatch(name, query, { nocase: true });
	}

	private formatRange(range: vscode.Range): string {
		// Convert VS Code 0-based lines/columns to 1-based for display
		const startLine = range.start.line + 1;
		const startCol = range.start.character + 1;
		const endLine = range.end.line + 1;
		const endCol = range.end.character + 1;
		return `${startLine}:${startCol}-${endLine}:${endCol}`;
	}

	private nameAndKindMatches(
		name: string,
		kind: vscode.SymbolKind,
		query: string,
		kindFilter?: SymbolKindName[]
	): boolean {
		const matches = this.matchesQuery(name, query);
		const matchesKind = !kindFilter || kindFilter.length === 0 || this.parseSymbolKinds(kindFilter).includes(kind);
		return matches && matchesKind;
	}

	private filterSymbols(
		symbols: vscode.DocumentSymbol[],
		query: string,
		kindFilter?: SymbolKindName[]
	): CodeSymbol[] {
		const result: CodeSymbol[] = [];

		// Check if this is a hierarchical query (e.g., "Animation.get*")
		const queryParts = query.split('.');
		const isHierarchicalQuery = queryParts.length > 1;

		for (const symbol of symbols) {
			if (isHierarchicalQuery) {
				// For hierarchical queries like "Animation.get*" or "spine.Animation.get*"
				const firstPart = queryParts[0];
				const remainingQuery = queryParts.slice(1).join('.');

				// Check if this symbol matches the first part of the query, no kind matching, we only do that for leafs
				if (this.nameAndKindMatches(symbol.name, symbol.kind, firstPart)) {
					// Symbol matches first part - consume it and continue with remaining query
					if (remainingQuery && symbol.children && symbol.children.length > 0) {
						const filteredChildren = this.filterSymbols(symbol.children, remainingQuery, kindFilter);

						if (filteredChildren.length > 0) {
							// Include this symbol with filtered children
							const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
							const sym: CodeSymbol = {
								name: symbol.name,
								kind: vscode.SymbolKind[symbol.kind],
								location: this.formatRange(combinedRange),
								children: filteredChildren,
							};
							result.push(sym);
						}
					} else if (!remainingQuery) {
						// No more query parts - this is the final match
						// Don't include children since query doesn't ask for them
						const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
						const sym: CodeSymbol = {
							name: symbol.name,
							kind: vscode.SymbolKind[symbol.kind],
							location: this.formatRange(combinedRange),
						};
						result.push(sym);
					}
					// else: query expects more depth but symbol has no children - no match
				} else if (symbol.children && symbol.children.length > 0) {
					// Symbol doesn't match - try children with full query (don't consume)
					const filteredChildren = this.filterSymbols(
						symbol.children,
						query, // Keep full query
						kindFilter
					);

					if (filteredChildren.length > 0) {
						// Include this symbol with filtered children
						const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
						const sym: CodeSymbol = {
							name: symbol.name,
							kind: vscode.SymbolKind[symbol.kind],
							location: this.formatRange(combinedRange),
							children: filteredChildren,
						};
						result.push(sym);
					}
				}
			} else {
				// Non-hierarchical query - match only on symbol name
				const symbolMatches = this.nameAndKindMatches(symbol.name, symbol.kind, query, kindFilter);

				if (symbolMatches) {
					// Symbol matches: include it WITHOUT children (query doesn't ask for them)
					const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
					const sym: CodeSymbol = {
						name: symbol.name,
						kind: vscode.SymbolKind[symbol.kind],
						location: this.formatRange(combinedRange),
						// Don't include children unless query explicitly asks for them
					};
					result.push(sym);
				} else if (symbol.children && symbol.children.length > 0) {
					// Symbol doesn't match: check if any descendants match
					const filteredChildren = this.filterSymbols(symbol.children, query, kindFilter);

					if (filteredChildren.length > 0) {
						// Include this symbol with filtered children
						const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
						const sym: CodeSymbol = {
							name: symbol.name,
							kind: vscode.SymbolKind[symbol.kind],
							location: this.formatRange(combinedRange),
							children: filteredChildren,
						};
						result.push(sym);
					}
				}
			}
		}

		return result;
	}

	private parseSymbolKinds(kindNames: SymbolKindName[]): vscode.SymbolKind[] {
		const kinds: vscode.SymbolKind[] = [];

		for (const kindName of kindNames) {
			switch (kindName.toLowerCase()) {
				case 'module':
					kinds.push(vscode.SymbolKind.Module);
					break;
				case 'namespace':
					kinds.push(vscode.SymbolKind.Namespace);
					break;
				case 'package':
					kinds.push(vscode.SymbolKind.Package);
					break;
				case 'class':
					kinds.push(vscode.SymbolKind.Class);
					break;
				case 'method':
					kinds.push(vscode.SymbolKind.Method);
					break;
				case 'property':
					kinds.push(vscode.SymbolKind.Property);
					break;
				case 'field':
					kinds.push(vscode.SymbolKind.Field);
					break;
				case 'constructor':
					kinds.push(vscode.SymbolKind.Constructor);
					break;
				case 'enum':
					kinds.push(vscode.SymbolKind.Enum);
					break;
				case 'interface':
					kinds.push(vscode.SymbolKind.Interface);
					break;
				case 'function':
					kinds.push(vscode.SymbolKind.Function);
					break;
				case 'variable':
					kinds.push(vscode.SymbolKind.Variable);
					break;
				case 'constant':
					kinds.push(vscode.SymbolKind.Constant);
					break;
				case 'string':
					kinds.push(vscode.SymbolKind.String);
					break;
				case 'null':
					kinds.push(vscode.SymbolKind.Null);
					break;
				case 'enummember':
					kinds.push(vscode.SymbolKind.EnumMember);
					break;
				case 'struct':
					kinds.push(vscode.SymbolKind.Struct);
					break;
				case 'operator':
					kinds.push(vscode.SymbolKind.Operator);
					break;
				case 'type':
					// Include common type-related symbol kinds
					kinds.push(
						vscode.SymbolKind.Class,
						vscode.SymbolKind.Interface,
						vscode.SymbolKind.Struct,
						vscode.SymbolKind.Enum
					);
					break;
			}
		}

		return kinds.length > 0
			? kinds
			: (Object.values(vscode.SymbolKind).filter((k) => typeof k === 'number') as vscode.SymbolKind[]);
	}
}
