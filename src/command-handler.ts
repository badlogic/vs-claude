import { logger } from './logger';
import { AllTypesInFileTool } from './tools/all-types-in-file-tool';
import { DefinitionTool } from './tools/definition-tool';
import { DiagnosticsTool } from './tools/diagnostics-tool';
import { OpenHandler } from './tools/open-tool';
import { ReferencesTool } from './tools/references-tool';
import { SubAndSupertypeTool } from './tools/sub-and-super-type-tool';
import { SymbolsTool } from './tools/symbols-tool';
import type {
	AllTypesInFileRequest,
	DefinitionRequest,
	DiagnosticsRequest,
	OpenRequest,
	ReferenceRequest,
	SymbolsRequest,
	TypeHierarchyRequest,
} from './tools/types';

// Discriminated union for typed commands
export type TypedCommand =
	| { id: string; tool: 'open'; args: OpenRequest[] }
	| { id: string; tool: 'symbols'; args: SymbolsRequest[] }
	| { id: string; tool: 'diagnostics'; args: DiagnosticsRequest[] }
	| { id: string; tool: 'references'; args: ReferenceRequest[] }
	| { id: string; tool: 'definition'; args: DefinitionRequest[] }
	| { id: string; tool: 'supertype'; args: TypeHierarchyRequest[] }
	| { id: string; tool: 'subtype'; args: TypeHierarchyRequest[] }
	| { id: string; tool: 'allTypesInFile'; args: AllTypesInFileRequest[] };

// Raw command from MCP (before type validation)
export interface Command {
	id: string;
	tool: string;
	args: unknown; // Raw JSON args passed through from MCP
}

export interface CommandResponse {
	id: string;
	success: boolean;
	data?: unknown;
	error?: string;
}

export class CommandHandler {
	private openHandler: OpenHandler;
	private symbolsTool: SymbolsTool;
	private diagnosticsTool: DiagnosticsTool;
	private referencesTool: ReferencesTool;
	private definitionTool: DefinitionTool;
	private subAndSupertypeTool: SubAndSupertypeTool;
	private allTypesInFileTool: AllTypesInFileTool;

	constructor() {
		this.openHandler = new OpenHandler();
		this.symbolsTool = new SymbolsTool();
		this.diagnosticsTool = new DiagnosticsTool();
		this.referencesTool = new ReferencesTool();
		this.definitionTool = new DefinitionTool();
		this.subAndSupertypeTool = new SubAndSupertypeTool();
		this.allTypesInFileTool = new AllTypesInFileTool();
	}

	/**
	 * Type guard to check if a command is properly typed
	 */
	private isTypedCommand(command: Command): command is TypedCommand {
		return (
			command.tool === 'open' ||
			command.tool === 'symbols' ||
			command.tool === 'diagnostics' ||
			command.tool === 'references' ||
			command.tool === 'definition' ||
			command.tool === 'supertype' ||
			command.tool === 'subtype' ||
			command.tool === 'allTypesInFile'
		);
	}

	/**
	 * Helper to ensure args is an array
	 */
	private ensureArray<T>(args: unknown): T[] {
		if (Array.isArray(args)) {
			return args as T[];
		}
		// If it's a single item, wrap it in an array
		return [args as T];
	}

	async executeCommand(command: Command): Promise<{ success: boolean; data?: unknown; error?: string }> {
		// Log the incoming command
		logger.info('CommandHandler', `Received command: ${command.tool}`);
		logger.info('CommandHandler', 'Raw JSON input:', command);

		try {
			// Type-safe command handling
			if (!this.isTypedCommand(command)) {
				const error = `Unknown command: ${command.tool}`;
				logger.warn('CommandHandler', error);
				return { success: false, error };
			}

			// Cast to typed command and ensure args is an array
			const typedCommand: TypedCommand = {
				...command,
				args: this.ensureArray(command.args),
			} as TypedCommand;

			let result: { success: boolean; data?: unknown; error?: string };

			switch (typedCommand.tool) {
				case 'open': {
					// OpenHandler already accepts an array
					result = await this.openHandler.execute(typedCommand.args);
					break;
				}

				case 'symbols': {
					logger.info('CommandHandler', `Symbols args: ${JSON.stringify(typedCommand.args)}`);
					const results = await Promise.all(typedCommand.args.map((arg) => this.symbolsTool.execute(arg)));
					// If single request, return single result
					result = typedCommand.args.length === 1 ? results[0] : { success: true, data: results };
					break;
				}

				case 'diagnostics': {
					const results = await Promise.all(
						typedCommand.args.map((arg) => this.diagnosticsTool.execute(arg))
					);
					result = typedCommand.args.length === 1 ? results[0] : { success: true, data: results };
					break;
				}

				case 'references': {
					const results = await Promise.all(typedCommand.args.map((arg) => this.referencesTool.execute(arg)));
					result = typedCommand.args.length === 1 ? results[0] : { success: true, data: results };
					break;
				}

				case 'definition': {
					const results = await Promise.all(typedCommand.args.map((arg) => this.definitionTool.execute(arg)));
					result = typedCommand.args.length === 1 ? results[0] : { success: true, data: results };
					break;
				}

				case 'supertype': {
					typedCommand.args.forEach((arg) => {
						arg.type = 'supertype';
					});
					const results = await Promise.all(
						typedCommand.args.map((arg) => this.subAndSupertypeTool.execute(arg))
					);
					result = typedCommand.args.length === 1 ? results[0] : { success: true, data: results };
					break;
				}

				case 'subtype': {
					typedCommand.args.forEach((arg) => {
						arg.type = 'subtype';
					});
					const results = await Promise.all(
						typedCommand.args.map((arg) => this.subAndSupertypeTool.execute(arg))
					);
					result = typedCommand.args.length === 1 ? results[0] : { success: true, data: results };
					break;
				}

				case 'allTypesInFile': {
					const results = await Promise.all(
						typedCommand.args.map((arg) => this.allTypesInFileTool.execute(arg))
					);
					result = typedCommand.args.length === 1 ? results[0] : { success: true, data: results };
					break;
				}
			}

			// Log command result
			logger.command(command.tool, result.success);

			if (result.success) {
				logger.info('CommandHandler', `Command ${command.tool} completed successfully`);
				logger.info('CommandHandler', 'Raw JSON output:', result);
			} else {
				logger.error('CommandHandler', `Command ${command.tool} failed: ${result.error}`);
				logger.info('CommandHandler', 'Raw JSON output:', result);
			}

			return result;
		} catch (error) {
			const errorMessage = `Command execution error: ${error}`;
			logger.error('CommandHandler', errorMessage);
			const result = { success: false, error: String(error) };
			logger.info('CommandHandler', 'Raw JSON output:', result);
			return result;
		}
	}
}
