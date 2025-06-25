import type * as vscode from 'vscode';
import { OpenHandler } from './open-handler';

export interface Command {
    id: string;
    tool: string;
    args: unknown; // Raw JSON args passed through from MCP
    expectsReply?: boolean;
}

export interface CommandResponse {
    id: string;
    success: boolean;
    data?: unknown;
    error?: string;
}

export class CommandHandler {
    private openHandler: OpenHandler;

    constructor(private outputChannel: vscode.OutputChannel) {
        this.openHandler = new OpenHandler(outputChannel);
    }

    async executeCommand(command: Command): Promise<{ success: boolean; data?: unknown; error?: string }> {
        this.outputChannel.appendLine(`Executing command: ${command.tool}`);

        try {
            switch (command.tool) {
                case 'open':
                    return await this.openHandler.execute(
                        command.args as Parameters<typeof this.openHandler.execute>[0]
                    );

                default: {
                    const error = `Unknown command: ${command.tool}`;
                    this.outputChannel.appendLine(error);
                    return { success: false, error };
                }
            }
        } catch (error) {
            const errorMessage = `Command execution error: ${error}`;
            this.outputChannel.appendLine(errorMessage);
            return { success: false, error: String(error) };
        }
    }
}
