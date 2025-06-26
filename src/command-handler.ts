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
		// Log the incoming command
		logger.info('CommandHandler', `Received command: ${command.tool}`);
		logger.info('CommandHandler', 'Raw JSON input:', command);

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
