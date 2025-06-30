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
