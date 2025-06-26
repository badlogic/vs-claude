import { logger } from './logger';
import { OpenHandler } from './open-handler';
import { QueryHandler } from './query-handler';

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
	private queryHandler: QueryHandler;

	constructor() {
		this.openHandler = new OpenHandler();
		this.queryHandler = new QueryHandler();
	}

	async executeCommand(command: Command): Promise<{ success: boolean; data?: unknown; error?: string }> {
		try {
			let result: { success: boolean; data?: unknown; error?: string };

			switch (command.tool) {
				case 'open':
					result = await this.openHandler.execute(
						command.args as Parameters<typeof this.openHandler.execute>[0]
					);
					break;

				case 'query': {
					const queryResult = await this.queryHandler.execute(
						command.args as Parameters<typeof this.queryHandler.execute>[0]
					);
					// Convert QueryResponse[] to CommandResponse format
					result = { success: true, data: queryResult };
					break;
				}

				default: {
					const error = `Unknown command: ${command.tool}`;
					logger.warn('CommandHandler', error);
					result = { success: false, error };
				}
			}

			// Log command result
			logger.command(command.tool, result.success);
			return result;
		} catch (error) {
			const errorMessage = `Command execution error: ${error}`;
			logger.error('CommandHandler', errorMessage);
			return { success: false, error: String(error) };
		}
	}
}
