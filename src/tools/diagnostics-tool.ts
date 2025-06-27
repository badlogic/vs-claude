import * as vscode from 'vscode';
import { logger } from '../logger';
import type { Diagnostic, DiagnosticsRequest, ToolResponse } from './types';

/**
 * This tool is used to get the diagnostics for a given path.
 */
export class DiagnosticsTool {
	public async execute(request: DiagnosticsRequest): Promise<ToolResponse<Diagnostic[]>> {
		try {
			const diagnostics: Diagnostic[] = [];

			if (request.path) {
				const uri = vscode.Uri.file(request.path);
				const fileDiagnostics = vscode.languages.getDiagnostics(uri);
				diagnostics.push(...this.convertDiagnostics(uri.fsPath, fileDiagnostics));
			} else {
				const allDiagnostics = vscode.languages.getDiagnostics();
				for (const [uri, fileDiagnostics] of allDiagnostics) {
					diagnostics.push(...this.convertDiagnostics(uri.fsPath, fileDiagnostics));
				}
			}

			logger.info('DiagnosticsTool', `Found ${diagnostics.length} diagnostics`);
			return { success: true, data: diagnostics };
		} catch (error) {
			logger.error('DiagnosticsTool', `Failed to get diagnostics: ${error}`);
			return { success: false, error: `Failed to get diagnostics: ${error}` };
		}
	}

	private convertDiagnostics(path: string, diagnostics: vscode.Diagnostic[]): Diagnostic[] {
		return diagnostics.map((diag) => ({
			path: `${path}:${diag.range.start.line + 1}:${diag.range.start.character + 1}`,
			severity: vscode.DiagnosticSeverity[diag.severity || 0].toLowerCase(),
			message: diag.message,
			source: diag.source,
		}));
	}
}
