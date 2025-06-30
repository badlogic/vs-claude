import { logger } from './logger';
import { OpenHandler } from './tools/open-tool';
import type { OpenRequest } from './tools/types';

// Discriminated union for typed commands
export type TypedCommand = { id: string; tool: 'open'; args: OpenRequest[] };

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

	constructor() {
		this.openHandler = new OpenHandler();
	}

	/**
	 * Type guard to check if a command is properly typed
	 */
	private isTypedCommand(command: Command): command is TypedCommand {
		return command.tool === 'open';
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
