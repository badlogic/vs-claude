import * as vscode from 'vscode';

// Request types for each query
interface FindSymbolsRequest {
	type: 'findSymbols';
	query: string;
	path?: string; // Optional: filter results to this file only
	kind?: string;
	exact?: boolean;
}

interface OutlineRequest {
	type: 'outline';
	path: string;
	symbol?: string; // Filter to specific symbol or use wildcards like "get*"
	kind?: string;
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

export type QueryRequest = FindSymbolsRequest | OutlineRequest | DiagnosticsRequest | ReferencesRequest;

// Response types for each query
interface Symbol {
	name: string;
	kind: string;
	path: string;
	containedIn?: string;
	detail?: string; // Hover info - could be signature, type, or other details
}

interface OutlineSymbol {
	name: string;
	detail?: string;
	kind: string;
	location: string;
	children?: OutlineSymbol[];
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

type Result = Symbol[] | OutlineSymbol[] | Diagnostic[] | Reference[];

// For batch queries, each element can be either results or an error
export type QueryResponse = { result: Result } | { error: string };

// OutlineResult is now replaced by OutlineResult above

export class QueryHandler {
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

	private async executeSingle(request: QueryRequest): Promise<QueryResponse> {
		this.outputChannel.appendLine(`Executing query: ${request.type}`);

		try {
			switch (request.type) {
				case 'findSymbols':
					return await this.findSymbols(request);
				case 'outline':
					return await this.outline(request);
				case 'references':
					return await this.findReferences(request);
				case 'diagnostics':
					return await this.getDiagnostics(request);
				default: {
					const exhaustiveCheck: never = request;
					return { error: `Unknown query type: ${(exhaustiveCheck as QueryRequest).type}` };
				}
			}
		} catch (error) {
			const errorMessage = `Query execution error: ${error}`;
			this.outputChannel.appendLine(errorMessage);
			return { error: String(error) };
		}
	}

	private async findSymbols(request: FindSymbolsRequest): Promise<{ result: Symbol[] } | { error: string }> {
		if (!request.query) {
			return { error: 'Query parameter is required for findSymbols' };
		}

		try {
			// Always search workspace
			const workspaceSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
				'vscode.executeWorkspaceSymbolProvider',
				request.query
			);

			if (!workspaceSymbols || workspaceSymbols.length === 0) {
				return { error: `No symbols matching '${request.query}' found in workspace` };
			}

			// Filter results
			let filteredSymbols = await this.filterSymbols(
				workspaceSymbols,
				request.query,
				request.exact,
				request.kind
			);

			// If path is specified, filter to only that file
			if (request.path) {
				const normalizedPath = vscode.Uri.file(request.path).fsPath;
				filteredSymbols = filteredSymbols.filter((sym) => {
					const symPath = sym.path.split(':')[0];
					return symPath === normalizedPath;
				});
			}

			return filteredSymbols.length > 0
				? { result: filteredSymbols }
				: { error: `No symbols found matching criteria` };
		} catch (error) {
			return { error: `Failed to find symbols: ${error}` };
		}
	}

	private async outline(request: OutlineRequest): Promise<{ result: OutlineSymbol[] } | { error: string }> {
		if (!request.path) {
			return { error: 'Path parameter is required for outline' };
		}

		try {
			const uri = vscode.Uri.file(request.path);
			const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
				'vscode.executeDocumentSymbolProvider',
				uri
			);

			if (!documentSymbols || documentSymbols.length === 0) {
				return { error: 'No symbols found in file' };
			}

			// Apply filtering if requested
			let symbolData: OutlineSymbol[];

			if (request.symbol || request.kind) {
				// Use filterOutlineSymbols which handles both name and kind filtering
				symbolData = this.filterOutlineSymbols(
					documentSymbols,
					request.symbol || '*', // If no symbol specified, match all
					false, // Always use pattern matching for outline
					request.kind
				);

				if (symbolData.length === 0) {
					const filterDesc = request.symbol
						? `Symbols matching '${request.symbol}'${request.kind ? ` of type ${request.kind}` : ''}`
						: `Symbols of type ${request.kind}`;
					return { error: `${filterDesc} not found in file` };
				}
			} else {
				// No filtering - return all symbols
				symbolData = documentSymbols.map((s) => this.convertDocumentSymbol(s));
			}

			return { result: symbolData };
		} catch (error) {
			return { error: `Failed to get file outline: ${error}` };
		}
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
			return { error: `Failed to find references: ${error}` };
		}
	}

	private matchesQuery(name: string, query: string): boolean {
		const pattern = query.replace(/\*/g, '.*');
		const regex = new RegExp(`^${pattern}`, 'i');
		return regex.test(name);
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
		exact?: boolean,
		kindFilter?: string
	): boolean {
		const matches = exact ? name === query : this.matchesQuery(name, query);
		const matchesKind = !kindFilter || this.parseSymbolKinds(kindFilter).includes(kind);
		return matches && matchesKind;
	}

	private async filterSymbols(
		symbols: vscode.SymbolInformation[],
		query: string,
		exact?: boolean,
		kindFilter?: string
	): Promise<Symbol[]> {
		const result: Symbol[] = [];

		for (const symbol of symbols) {
			if (this.nameAndKindMatches(symbol.name, symbol.kind, query, exact, kindFilter)) {
				result.push(await this.convertSymbolInformation(symbol));
			}
		}
		return result;
	}

	private async convertSymbolInformation(symbol: vscode.SymbolInformation): Promise<Symbol> {
		// TODO: Optimize by batching hover requests or caching results
		// Currently makes one hover request per symbol which can be slow for large result sets
		let detail: string = '';
		try {
			const hoverInfos = await vscode.commands.executeCommand<vscode.Hover[]>(
				'vscode.executeHoverProvider',
				symbol.location.uri,
				symbol.location.range.start
			);

			if (hoverInfos && hoverInfos.length > 0) {
				// Extract signature from hover content
				for (const hover of hoverInfos) {
					const contents = hover.contents;
					for (const content of contents) {
						if (typeof content === 'string') {
							detail = (detail || '') + content.trim();
						} else if ('value' in content) {
							// Code block - often contains the signature, type info, etc.
							detail = (detail || '') + content.value.trim();
						}
					}
				}
			}
		} catch {
			// Hover might not be available, that's OK
		}

		return {
			name: symbol.name,
			kind: vscode.SymbolKind[symbol.kind],
			path: `${symbol.location.uri.fsPath}:${this.formatRange(symbol.location.range)}`,
			containedIn: symbol.containerName || undefined,
			detail: detail || undefined, // Convert empty string to undefined
		};
	}

	private filterOutlineSymbols(
		symbols: vscode.DocumentSymbol[],
		query: string,
		exact?: boolean,
		kindFilter?: string
	): OutlineSymbol[] {
		const result: OutlineSymbol[] = [];

		for (const symbol of symbols) {
			// Check if this symbol matches our criteria
			const symbolMatches = this.nameAndKindMatches(symbol.name, symbol.kind, query, exact, kindFilter);

			if (symbolMatches) {
				// Symbol matches: include it with ALL its children (unfiltered)
				const outline = this.convertDocumentSymbol(symbol);
				result.push(outline);
			} else if (symbol.children && symbol.children.length > 0) {
				// Symbol doesn't match: check if any descendants match
				const filteredChildren = this.filterOutlineSymbols(symbol.children, query, exact, kindFilter);

				if (filteredChildren.length > 0) {
					// Has matching descendants: include this symbol as context with only the filtered children
					const outline: OutlineSymbol = {
						name: symbol.name,
						detail: symbol.detail,
						kind: vscode.SymbolKind[symbol.kind],
						location: this.formatRange(symbol.range),
						children: filteredChildren,
					};
					result.push(outline);
				}
			}
			// else: symbol doesn't match and has no matching descendants - exclude it
		}

		return result;
	}

	private convertDocumentSymbol(symbol: vscode.DocumentSymbol): OutlineSymbol {
		return {
			name: symbol.name,
			detail: symbol.detail,
			kind: vscode.SymbolKind[symbol.kind],
			location: this.formatRange(symbol.range),
			children:
				symbol.children && symbol.children.length > 0
					? symbol.children.map((s) => this.convertDocumentSymbol(s))
					: undefined,
		};
	}

	private convertDiagnostics(path: string, diagnostics: vscode.Diagnostic[]) {
		return diagnostics.map((diag) => ({
			path: `${path}:${diag.range.start.line + 1}:${diag.range.start.character + 1}`,
			severity: vscode.DiagnosticSeverity[diag.severity || 0].toLowerCase(),
			message: diag.message,
			source: diag.source,
		}));
	}

	private parseSymbolKinds(kindString: string): vscode.SymbolKind[] {
		const kinds: vscode.SymbolKind[] = [];
		const kindNames = kindString
			.toLowerCase()
			.split(',')
			.map((k) => k.trim());

		for (const kindName of kindNames) {
			switch (kindName) {
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
