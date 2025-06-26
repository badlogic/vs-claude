import { minimatch } from 'minimatch';
import * as vscode from 'vscode';

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
	depth?: number; // Optional: limit tree depth
	exclude?: string[]; // Optional: glob patterns to exclude files/folders
	includeDetails?: boolean; // Optional: include type signatures and documentation
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
	character?: number; // Optional: character position in the line (1-based)
}

interface DefinitionRequest {
	type: 'definition';
	path: string; // Required: file containing the symbol
	line: number; // Required: line number of the symbol (1-based)
	character?: number; // Optional: character position in the line (1-based)
}

export type QueryRequest = SymbolsRequest | DiagnosticsRequest | ReferencesRequest | DefinitionRequest;

// Response types for each query
interface Symbol {
	name: string;
	detail?: string;
	kind: string;
	location: string;
	children?: Symbol[];
	// Additional details when includeDetails is true
	documentation?: string;
	type?: string; // Type signature for functions/methods/properties
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

interface CountResult {
	count: number;
}

type Result = Symbol[] | Diagnostic[] | Reference[] | Definition[] | CountResult;

// For batch queries, each element can be either results or an error
export type QueryResponse = { result: Result } | { error: string };

// Symbol type is defined above

export class QueryHandler {
	private readonly QUERY_TIMEOUT_MS = 15000; // 15 seconds

	constructor(private outputChannel: vscode.OutputChannel) {}

	async execute(request: QueryRequest | QueryRequest[]): Promise<QueryResponse[]> {
		// Handle batch queries
		if (Array.isArray(request)) {
			return await this.executeBatch(request);
		}

		// Handle single query
		return [await this.executeSingle(request)];
	}

	private async executeBatch(queries: QueryRequest[]): Promise<QueryResponse[]> {
		this.outputChannel.appendLine(`Executing batch of ${queries.length} queries`);
		return await Promise.all(queries.map((query) => this.executeSingle(query)));
	}

	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Query timeout: ${operation} took longer than ${timeoutMs}ms`));
			}, timeoutMs);
		});

		return Promise.race([promise, timeoutPromise]);
	}

	private async executeSingle(request: QueryRequest): Promise<QueryResponse> {
		this.outputChannel.appendLine(`Executing query: ${request.type}`);
		this.outputChannel.appendLine(`Query args: ${JSON.stringify(request, null, 2)}`);

		try {
			// Wrap the query execution with timeout
			const executeQuery = async (): Promise<QueryResponse> => {
				switch (request.type) {
					case 'symbols':
						return await this.symbols(request);
					case 'references':
						return await this.findReferences(request);
					case 'diagnostics':
						return await this.getDiagnostics(request);
					case 'definition':
						return await this.findDefinition(request);
					default: {
						const exhaustiveCheck: never = request;
						return { error: `Unknown query type: ${(exhaustiveCheck as QueryRequest).type}` };
					}
				}
			};

			return await this.withTimeout(executeQuery(), this.QUERY_TIMEOUT_MS, `${request.type} query`);
		} catch (error) {
			const errorMessage = `Query execution error: ${error}`;
			this.outputChannel.appendLine(errorMessage);
			if (error instanceof Error && error.stack) {
				this.outputChannel.appendLine('Stack trace:');
				this.outputChannel.appendLine(error.stack);
			}
			return { error: String(error) };
		}
	}

	private async symbols(request: SymbolsRequest): Promise<{ result: Symbol[] | CountResult } | { error: string }> {
		try {
			const query = request.query || '*';

			// Determine scope from path
			let result: { result: Symbol[] } | { error: string };
			if (request.path) {
				// Check if path is a file or folder
				const uri = vscode.Uri.file(request.path);
				try {
					const stat = await vscode.workspace.fs.stat(uri);
					if (stat.type === vscode.FileType.File) {
						// File scope - use document symbols directly
						result = await this.symbolsInFile(
							uri,
							query,
							request.kinds,
							request.depth,
							request.includeDetails
						);
					} else {
						// Folder scope - require depth or countOnly to prevent excessive results
						if (!request.depth && !request.countOnly) {
							return {
								error: "Folder queries require either 'depth' or 'countOnly' to prevent excessive results. Use depth:1 for overview or countOnly:true to check size first.",
							};
						}
						// Folder scope - search within folder
						result = await this.symbolsInFolder(
							request.path,
							query,
							request.kinds,
							request.depth,
							request.includeDetails,
							request.exclude
						);
					}
				} catch {
					// Path doesn't exist or isn't accessible
					return { error: `Path not found or not accessible: ${request.path}` };
				}
			} else {
				// Workspace scope - require depth or countOnly to prevent excessive results
				if (!request.depth && !request.countOnly) {
					return {
						error: "Workspace queries require either 'depth' or 'countOnly' to prevent excessive results. Use depth:1 for overview or countOnly:true to check size first.",
					};
				}
				result = await this.symbolsInWorkspace(
					query,
					request.kinds,
					request.depth,
					request.includeDetails,
					request.exclude
				);
			}

			// Handle countOnly
			if (request.countOnly && 'result' in result) {
				return { result: { count: result.result.length } };
			}

			return result;
		} catch (error) {
			if (error instanceof Error && error.stack) {
				this.outputChannel.appendLine('Stack trace:');
				this.outputChannel.appendLine(error.stack);
			}
			return { error: `Failed to find symbols: ${error}` };
		}
	}

	private async symbolsInFile(
		uri: vscode.Uri,
		query: string,
		kindFilter?: SymbolKindName[],
		depth?: number,
		includeDetails?: boolean
	): Promise<{ result: Symbol[] } | { error: string }> {
		const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
			'vscode.executeDocumentSymbolProvider',
			uri
		);

		if (!documentSymbols || documentSymbols.length === 0) {
			return { result: [] };
		}

		// Apply filtering using our existing logic
		let filtered = this.filterSymbols(documentSymbols, query, kindFilter, '', includeDetails);

		if (depth) {
			filtered = this.limitDepth(filtered, depth);
		}

		return { result: filtered };
	}

	private async symbolsInWorkspace(
		query: string,
		kindFilter?: SymbolKindName[],
		depth?: number,
		includeDetails?: boolean,
		exclude?: string[]
	): Promise<{ result: Symbol[] } | { error: string }> {
		// Extract root query for workspace search
		const rootQuery = query.split('.')[0];

		// Search workspace with root query
		const workspaceSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
			'vscode.executeWorkspaceSymbolProvider',
			rootQuery
		);

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
				const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
					'vscode.executeDocumentSymbolProvider',
					uri
				);

				if (documentSymbols && documentSymbols.length > 0) {
					// Apply the full original query to the document symbols
					let filtered = this.filterSymbols(documentSymbols, query, kindFilter, '', includeDetails);

					if (depth) {
						filtered = this.limitDepth(filtered, depth);
					}

					results.push(...filtered);
				}
			} catch (fileError) {
				// Log the error but continue processing other files
				this.outputChannel.appendLine(`Warning: Failed to get symbols for file ${filePath}: ${fileError}`);
				if (fileError instanceof Error && fileError.stack) {
					this.outputChannel.appendLine('Stack trace:');
					this.outputChannel.appendLine(fileError.stack);
				}
				// Continue processing other files
			}
		}

		return { result: results };
	}

	private async symbolsInFolder(
		folderPath: string,
		query: string,
		kindFilter?: SymbolKindName[],
		depth?: number,
		includeDetails?: boolean,
		exclude?: string[]
	): Promise<{ result: Symbol[] } | { error: string }> {
		// Use same logic as workspace but filter results to folder
		const rootQuery = query.split('.')[0];

		const workspaceSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
			'vscode.executeWorkspaceSymbolProvider',
			rootQuery
		);

		if (!workspaceSymbols || workspaceSymbols.length === 0) {
			return { result: [] };
		}

		// Filter to only symbols in the specified folder
		const normalizedFolder = vscode.Uri.file(folderPath).fsPath;
		const filteredSymbols = workspaceSymbols.filter((symbol) =>
			symbol.location.uri.fsPath.startsWith(normalizedFolder)
		);

		// Group by file and process
		const fileMap = new Map<string, vscode.SymbolInformation[]>();
		for (const symbol of filteredSymbols) {
			const filePath = symbol.location.uri.fsPath;
			if (!fileMap.has(filePath)) {
				fileMap.set(filePath, []);
			}
			const symbols = fileMap.get(filePath);
			if (symbols) {
				symbols.push(symbol);
			}
		}

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
				const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
					'vscode.executeDocumentSymbolProvider',
					uri
				);

				if (documentSymbols && documentSymbols.length > 0) {
					let filtered = this.filterSymbols(documentSymbols, query, kindFilter, '', includeDetails);

					if (depth) {
						filtered = this.limitDepth(filtered, depth);
					}

					results.push(...filtered);
				}
			} catch (fileError) {
				// Log the error but continue processing other files
				this.outputChannel.appendLine(`Warning: Failed to get symbols for file ${filePath}: ${fileError}`);
				if (fileError instanceof Error && fileError.stack) {
					this.outputChannel.appendLine('Stack trace:');
					this.outputChannel.appendLine(fileError.stack);
				}
				// Continue processing other files
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

			return { result: diagnostics };
		} catch (error) {
			if (error instanceof Error && error.stack) {
				this.outputChannel.appendLine('Stack trace:');
				this.outputChannel.appendLine(error.stack);
			}
			return { error: `Failed to get diagnostics: ${error}` };
		}
	}

	private async findReferences(request: ReferencesRequest): Promise<{ result: Reference[] } | { error: string }> {
		try {
			const uri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.character || 0
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

			return { result: referencesWithPreview };
		} catch (error) {
			if (error instanceof Error && error.stack) {
				this.outputChannel.appendLine('Stack trace:');
				this.outputChannel.appendLine(error.stack);
			}
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
		parentPath: string = '',
		includeDetails?: boolean
	): Symbol[] {
		const result: Symbol[] = [];

		for (const symbol of symbols) {
			// Build the full hierarchical path for this symbol
			const fullPath = parentPath ? `${parentPath}.${symbol.name}` : symbol.name;

			// Check if this symbol matches our criteria using the full path
			const symbolMatches = this.nameAndKindMatches(fullPath, symbol.kind, query, kindFilter);

			if (symbolMatches) {
				// Symbol matches: include it with ALL its children (unfiltered)
				const sym = this.convertDocumentSymbol(symbol, includeDetails);
				result.push(sym);
			} else if (symbol.children && symbol.children.length > 0) {
				// Symbol doesn't match: check if any descendants match
				// Pass the current full path as parent path for children
				const filteredChildren = this.filterSymbols(
					symbol.children,
					query,
					kindFilter,
					fullPath,
					includeDetails
				);

				if (filteredChildren.length > 0) {
					// Has matching descendants: include this symbol as context with only the filtered children
					const sym: Symbol = {
						name: symbol.name,
						detail: symbol.detail,
						kind: vscode.SymbolKind[symbol.kind],
						location: this.formatRange(symbol.range),
						children: filteredChildren,
					};
					result.push(sym);
				}
			}
			// else: symbol doesn't match and has no matching descendants - exclude it
		}

		return result;
	}

	private convertDocumentSymbol(symbol: vscode.DocumentSymbol, includeDetails?: boolean): Symbol {
		const result: Symbol = {
			name: symbol.name,
			detail: symbol.detail,
			kind: vscode.SymbolKind[symbol.kind],
			location: this.formatRange(symbol.range),
			children:
				symbol.children && symbol.children.length > 0
					? symbol.children.map((s) => this.convertDocumentSymbol(s, includeDetails))
					: undefined,
		};

		// Add additional details if requested
		if (includeDetails) {
			// Note: VS Code's DocumentSymbol doesn't provide documentation or full type signatures
			// We include what's available in the detail field
			// For richer information, we'd need to use other language server features
			if (symbol.detail) {
				result.type = symbol.detail;
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

	private limitDepth(symbols: Symbol[], maxDepth: number, currentDepth: number = 1): Symbol[] {
		return symbols.map((symbol) => {
			if (currentDepth >= maxDepth) {
				// Remove children if we've reached max depth
				return { ...symbol, children: undefined };
			} else if (symbol.children) {
				// Recursively limit depth of children
				return {
					...symbol,
					children: this.limitDepth(symbol.children, maxDepth, currentDepth + 1),
				};
			}
			return symbol;
		});
	}

	private async findDefinition(request: DefinitionRequest): Promise<{ result: Definition[] } | { error: string }> {
		try {
			const uri = vscode.Uri.file(request.path);
			const position = new vscode.Position(
				request.line - 1, // Convert to 0-based
				request.character ? request.character - 1 : 0
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

			return { result: results };
		} catch (error) {
			if (error instanceof Error && error.stack) {
				this.outputChannel.appendLine('Stack trace:');
				this.outputChannel.appendLine(error.stack);
			}
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
}
