export type SymbolKindName =
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

export interface CodeSymbol {
	name: string;
	kind: string;
	location: string;
	children?: CodeSymbol[];
}

export interface Diagnostic {
	path: string;
	severity: string;
	message: string;
	source?: string;
}

export interface Reference {
	location: string;
	preview: string;
}

export interface Definition {
	location: string;
	preview: string;
	kind?: string;
}

export interface TypeHierarchyItem {
	name: string;
	kind: string;
	location: string;
	preview: string;
}

export interface CountResult {
	count: number;
}

// Single request types
export interface SymbolsRequest {
	type: 'symbols';
	query?: string;
	path?: string;
	kinds?: SymbolKindName[];
	exclude?: string[];
	countOnly?: boolean;
}

export interface DiagnosticsRequest {
	type: 'diagnostics';
	path?: string;
}

export interface ReferenceRequest {
	type: 'references';
	path: string;
	line: number;
	column: number;
}

export interface DefinitionRequest {
	type: 'definition';
	path: string;
	line: number;
	column: number;
}

export interface TypeHierarchyRequest {
	type: 'supertype' | 'subtype';
	path: string;
	line: number;
	column: number;
}

export interface FileTypesRequest {
	type: 'fileTypes';
	path: string;
}

export interface OpenFileRequest {
	type: 'file';
	path: string;
	startLine?: number;
	endLine?: number;
	preview?: boolean;
}

export interface OpenDiffRequest {
	type: 'diff';
	left: string;
	right: string;
	title?: string;
}

export interface OpenGitDiffRequest {
	type: 'gitDiff';
	path: string;
	from: string;
	to: string;
	context?: number;
}

export type OpenRequest = OpenFileRequest | OpenDiffRequest | OpenGitDiffRequest;

// Response type for tools
export type ToolResponse<T> = { success: true; data: T } | { success: false; error: string };
