import { minimatch } from 'minimatch';
import * as vscode from 'vscode';
import { logger } from './logger';

// Request types for each query
type SymbolKindName =
	| 'module'
	| 'namespace'
	| 'package'
	| 'class'
	| 'method'
	| 'property'
	| 'field'
	| 'constructor'
	| 'enum'
	| 'interface'
	| 'function'
	| 'variable'
	| 'constant'
	| 'string'
	| 'null'
	| 'enummember'
	| 'struct'
	| 'operator'
	| 'type';

interface SymbolsRequest {
	type: 'symbols';
	query?: string; // Optional: pattern to match (default: "*")
	path?: string; // Optional: file or folder path (default: workspace)
	kinds?: SymbolKindName[]; // Optional: filter by symbol types
	exclude?: string[]; // Optional: glob patterns to exclude files/folders
	countOnly?: boolean; // Optional: return only the count of results
}

interface DiagnosticsRequest {
	type: 'diagnostics';
	path?: string;
}

interface ReferencesRequest {
	type: 'references';
	path: string; // Required: file containing the symbol
	line: number; // Required: line number of the symbol (1-based)
	column?: number; // Optional: column position in the line (1-based)
}

interface DefinitionRequest {
	type: 'definition';
	path: string; // Required: file containing the symbol
	line: number; // Required: line number of the symbol (1-based)
	column?: number; // Optional: column position in the line (1-based)
}

interface TypeHierarchyRequest {
	type: 'supertype' | 'subtype';
	path: string; // Required: file containing the type
	line: number; // Required: line number of the type (1-based)
	column?: number; // Optional: column position in the line (1-based)
}

export type QueryRequest =
	| SymbolsRequest
	| DiagnosticsRequest
	| ReferencesRequest
	| DefinitionRequest
	| TypeHierarchyRequest;

// Response types for each query
interface Symbol {
	name: string;
	kind: string;
	location: string;
	children?: Symbol[];
}

interface Diagnostic {
	path: string;
	severity: string;
	message: string;
	source?: string;
}

interface Reference {
	path: string;
	preview: string;
}

interface Definition {
	path: string;
	range: string; // Line:col range of the definition
	preview: string;
	kind?: string; // Symbol kind at definition
}

interface TypeHierarchyItem {
	name: string;
	kind: string;
	path: string;
	range: string;
	preview: string;
}

interface CountResult {
	count: number;
}

type Result = Symbol[] | Diagnostic[] | Reference[] | Definition[] | TypeHierarchyItem[] | CountResult;

// For batch queries, each element can be either results or an error
export type QueryResponse = { result: Result } | { error: string };

// Symbol type is defined above

export class QueryHandler {
	async execute(request: QueryRequest | QueryRequest[]): Promise<QueryResponse[]> {
		// Handle batch queries
		if (Array.isArray(request)) {
			return await this.executeBatch(request);
		}

		// Handle single query
		return [await this.executeSingle(request)];
	}

	private async executeBatch(queries: QueryRequest[]): Promise<QueryResponse[]> {
		logger.info('QueryHandler', `Batch query (${queries.length} queries)`);
		return await Promise.all(queries.map((query) => this.executeSingle(query)));
	}

	private async executeSingle(request: QueryRequest): Promise<QueryResponse> {
		// Log the query type
		logger.info('QueryHandler', `Executing ${request.type} query`);

		try {
			switch (request.type) {
				case 'symbols':
					return await this.symbols(request);
				case 'references':
					return await this.findReferences(request);
				case 'diagnostics':
					return await this.getDiagnostics(request);
				case 'definition':
					return await this.findDefinition(request);
				case 'supertype':
				case 'subtype':
					return await this.findTypeHierarchy(request);
				default: {
					const exhaustiveCheck: never = request;
					return { error: `Unknown query type: ${(exhaustiveCheck as QueryRequest).type}` };
				}
			}
		} catch (error) {
			logger.error('QueryHandler', `Query execution error: ${error}`);
			return { error: String(error) };
		}
	}

	private async symbols(request: SymbolsRequest): Promise<{ result: Symbol[] | CountResult } | { error: string }> {
		try {
			const query = request.query || '*';

			// Check for overly broad queries
			// Only * and ** are considered too broad - *.* naturally limits to 2 levels
			const isBroadQuery = query === '*' || query === '**';
			const hasNoKindFilter = !request.kinds || request.kinds.length === 0;
			const isWorkspaceScope = !request.path;

			if (isBroadQuery && hasNoKindFilter && isWorkspaceScope && !request.countOnly) {
				return {
					error: "Query too broad: searching for '*' without any filters in workspace scope would return too many results. Please add 'kinds' filter, specify a 'path', use a more specific query pattern, or use 'countOnly' to check the size first.",
				};
			}

			// Determine scope from path
			let result: { result: Symbol[] } | { error: string };
			if (request.path) {
				// Check if path is a file or folder
				const uri = vscode.Uri.file(request.path);
				try {
					const stat = await vscode.workspace.fs.stat(uri);
					if (stat.type === vscode.FileType.File) {
						// File scope - use document symbols directly
						result = await this.symbolsInFile(uri, query, request.kinds);
					} else {
						// Folder scope - search within folder
						result = await this.symbolsInFolder(request.path, query, request.kinds, request.exclude);
					}
				} catch {
					// Path doesn't exist or isn't accessible
					return { error: `Path not found or not accessible: ${request.path}` };
				}
			} else {
				// Workspace scope
				result = await this.symbolsInWorkspace(query, request.kinds, request.exclude);
			}

			// Handle countOnly
			if (request.countOnly && 'result' in result) {
				const count = result.result.length;
				logger.info('QueryHandler', `Symbol count: ${count}`);
				return { result: { count } };
			}

			if ('result' in result) {
				logger.info('QueryHandler', `Found ${result.result.length} symbols`);
			}

			return result;
		} catch (error) {
			logger.error('QueryHandler', `Failed to find symbols: ${error}`);
			return { error: `Failed to find symbols: ${error}` };
		}
	}

	private async symbolsInFile(
		uri: vscode.Uri,
		query: string,
		kindFilter?: SymbolKindName[]
	): Promise<{ result: Symbol[] } | { error: string }> {
		const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
			'vscode.executeDocumentSymbolProvider',
			uri
		);

		if (!documentSymbols) {
			logger.debug(
				'QueryHandler',
				`No symbol provider available for ${uri.fsPath} - language server may not be active yet`
			);
			return { result: [] };
		}

		if (documentSymbols.length === 0) {
			return { result: [] };
		}

		const filtered = this.filterSymbols(documentSymbols, query, kindFilter, '');
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
	): Promise<{ result: Symbol[] } | { error: string }> {
		// Extract root query for workspace search
		const rootQuery = query.split('.')[0];

		// Strip glob characters from the root query for VS Code's workspace symbol provider
		// VS Code doesn't support glob patterns and treats them as literal characters
		// We'll apply our own pattern matching on the results instead
		const cleanedRootQuery = rootQuery.replace(/[*?[\]{}]/g, '');

		// Search workspace with cleaned query
		const workspaceSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
			'vscode.executeWorkspaceSymbolProvider',
			cleanedRootQuery
		);

		if (workspaceSymbols && workspaceSymbols.length > 50) {
			logger.debug('QueryHandler', `Workspace search returned ${workspaceSymbols.length} symbols`);
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
		const results: Symbol[] = [];
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
				logger.debug('QueryHandler', `Failed to get symbols for file ${filePath}: ${fileError}`);
			}
		}

		return { result: results };
	}

	private async symbolsInFolder(
		folderPath: string,
		query: string,
		kindFilter?: SymbolKindName[],
		exclude?: string[]
	): Promise<{ result: Symbol[] } | { error: string }> {
		// Instead of searching workspace and filtering, enumerate files in folder
		const folderUri = vscode.Uri.file(folderPath);
		const results: Symbol[] = [];

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
				logger.debug('QueryHandler', `Failed to read directory ${uri.fsPath}: ${error}`);
			}
			return files;
		};

		const files = await findFiles(folderUri);
		if (files.length > 20) {
			logger.debug('QueryHandler', `Searching ${files.length} files in ${folderPath}`);
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
				logger.debug('QueryHandler', `Failed to get symbols for file ${fileUri.fsPath}: ${fileError}`);
			}
		}

		return { result: results };
	}

	private async getDiagnostics(request: DiagnosticsRequest): Promise<{ result: Diagnostic[] } | { error: string }> {
		try {
			const diagnostics: Array<{
				path: string;
				severity: string;
				message: string;
				source?: string;
			}> = [];

			if (request.path) {
				// Get diagnostics for specific file
				const uri = vscode.Uri.file(request.path);
				const fileDiagnostics = vscode.languages.getDiagnostics(uri);

				diagnostics.push(...this.convertDiagnostics(uri.fsPath, fileDiagnostics));
			} else {
				// Get all workspace diagnostics
				const allDiagnostics = vscode.languages.getDiagnostics();

				for (const [uri, fileDiagnostics] of allDiagnostics) {
					diagnostics.push(...this.convertDiagnostics(uri.fsPath, fileDiagnostics));
				}
			}

			logger.info('QueryHandler', `Found ${diagnostics.length} diagnostics`);
			return { result: diagnostics };
		} catch (error) {
			logger.error('QueryHandler', `Failed to get diagnostics: ${error}`);
			return { error: `Failed to get diagnostics: ${error}` };
		}
	}

	private async findReferences(request: ReferencesRequest): Promise<{ result: Reference[] } | { error: string }> {
		try {
			const uri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.column ? request.column - 1 : 0
			);

			// Find references at this position
			const references = await vscode.commands.executeCommand<vscode.Location[]>(
				'vscode.executeReferenceProvider',
				uri,
				position
			);

			if (!references || references.length === 0) {
				return { result: [] };
			}

			// Get preview text for each reference
			const referencesWithPreview = await Promise.all(
				references.map(async (ref) => {
					const document = await vscode.workspace.openTextDocument(ref.uri);
					const line = document.lineAt(ref.range.start.line);

					return {
						path: `${ref.uri.fsPath}:${ref.range.start.line + 1}:${ref.range.start.character + 1}`,
						preview: line.text.trim(),
					};
				})
			);

			logger.info('QueryHandler', `Found ${referencesWithPreview.length} references`);
			return { result: referencesWithPreview };
		} catch (error) {
			logger.error('QueryHandler', `Failed to find references: ${error}`);
			return { error: `Failed to find references: ${error}` };
		}
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
		kindFilter?: SymbolKindName[],
		parentPath: string = ''
	): Symbol[] {
		const result: Symbol[] = [];

		// Check if this is a hierarchical query (e.g., "Animation.get*")
		const queryParts = query.split('.');
		const isHierarchicalQuery = queryParts.length > 1;

		for (const symbol of symbols) {
			if (isHierarchicalQuery) {
				// Build the full hierarchical path for this symbol
				const fullPath = parentPath ? `${parentPath}.${symbol.name}` : symbol.name;
				// For hierarchical queries like "Animation.get*" or "spine.Animation.get*"
				const firstPart = queryParts[0];
				const remainingQuery = queryParts.slice(1).join('.');

				// Check if this symbol matches the first part of the query, no kind matching, we only do that for leafs
				if (this.nameAndKindMatches(symbol.name, symbol.kind, firstPart)) {
					// Symbol matches first part - consume it and continue with remaining query
					if (remainingQuery && symbol.children && symbol.children.length > 0) {
						const filteredChildren = this.filterSymbols(
							symbol.children,
							remainingQuery,
							kindFilter,
							fullPath
						);

						if (filteredChildren.length > 0) {
							// Include this symbol with filtered children
							const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
							const sym: Symbol = {
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
						const sym: Symbol = {
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
						kindFilter,
						fullPath
					);

					if (filteredChildren.length > 0) {
						// Include this symbol with filtered children
						const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
						const sym: Symbol = {
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
					const sym: Symbol = {
						name: symbol.name,
						kind: vscode.SymbolKind[symbol.kind],
						location: this.formatRange(combinedRange),
						// Don't include children unless query explicitly asks for them
					};
					result.push(sym);
				} else if (symbol.children && symbol.children.length > 0) {
					// Symbol doesn't match: check if any descendants match
					const filteredChildren = this.filterSymbols(
						symbol.children,
						query,
						kindFilter,
						parentPath ? `${parentPath}.${symbol.name}` : symbol.name
					);

					if (filteredChildren.length > 0) {
						// Include this symbol with filtered children
						const combinedRange = new vscode.Range(symbol.selectionRange.start, symbol.range.end);
						const sym: Symbol = {
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

	private convertDiagnostics(path: string, diagnostics: vscode.Diagnostic[]) {
		return diagnostics.map((diag) => ({
			path: `${path}:${diag.range.start.line + 1}:${diag.range.start.character + 1}`,
			severity: vscode.DiagnosticSeverity[diag.severity || 0].toLowerCase(),
			message: diag.message,
			source: diag.source,
		}));
	}

	private async findDefinition(request: DefinitionRequest): Promise<{ result: Definition[] } | { error: string }> {
		try {
			const uri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.column ? request.column - 1 : 0
			);

			// Find definition at this position
			const definitions = await vscode.commands.executeCommand<vscode.Location | vscode.Location[]>(
				'vscode.executeDefinitionProvider',
				uri,
				position
			);

			if (!definitions) {
				return { result: [] };
			}

			// Normalize to array
			const definitionArray = Array.isArray(definitions) ? definitions : [definitions];

			// Convert to our format
			const results = await Promise.all(
				definitionArray.map(async (def) => {
					const document = await vscode.workspace.openTextDocument(def.uri);
					const line = document.lineAt(def.range.start.line);

					// Try to get symbol information at the definition location
					const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
						'vscode.executeDocumentSymbolProvider',
						def.uri
					);

					let symbolKind: string | undefined;
					if (symbols) {
						// Find the symbol at this location
						const symbol = this.findSymbolAtPosition(symbols, def.range.start);
						if (symbol) {
							symbolKind = vscode.SymbolKind[symbol.kind];
						}
					}

					return {
						path: `${def.uri.fsPath}:${def.range.start.line + 1}:${def.range.start.character + 1}`,
						range: this.formatRange(def.range),
						preview: line.text.trim(),
						kind: symbolKind,
					};
				})
			);

			logger.info('QueryHandler', `Found ${results.length} definitions`);
			return { result: results };
		} catch (error) {
			logger.error('QueryHandler', `Failed to find definition: ${error}`);
			return { error: `Failed to find definition: ${error}` };
		}
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

	private async findTypeHierarchy(
		request: TypeHierarchyRequest
	): Promise<{ result: TypeHierarchyItem[] } | { error: string }> {
		try {
			const uri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.column ? request.column - 1 : 0
			);

			// Position already logged by the query

			// Prepare type hierarchy at position
			const typeHierarchyItems = await vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
				'vscode.prepareTypeHierarchy',
				uri,
				position
			);

			// Item count logged in result

			if (!typeHierarchyItems || typeHierarchyItems.length === 0) {
				return { result: [] };
			}

			// Get supertypes or subtypes
			const results: TypeHierarchyItem[] = [];

			for (const item of typeHierarchyItems) {
				const hierarchyItems = await vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
					request.type === 'supertype' ? 'vscode.provideSupertypes' : 'vscode.provideSubtypes',
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
							path: `${hierarchyItem.uri.fsPath}:${hierarchyItem.range.start.line + 1}:${
								hierarchyItem.range.start.character + 1
							}`,
							range: this.formatRange(hierarchyItem.range),
							preview,
						});
					}
				}
			}

			logger.info('QueryHandler', `Found ${results.length} type hierarchy items`);
			return { result: results };
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
						error: 'Type hierarchy not supported by the language server for this file type',
					};
				}
			}
			return { error: `Failed to find type hierarchy: ${error}` };
		}
	}
}
