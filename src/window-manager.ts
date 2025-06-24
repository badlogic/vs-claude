import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { type Command, CommandHandler, type CommandResponse } from './command-handler';

export interface WindowInfo {
    workspace: string;
    windowTitle: string;
    timestamp: string;
}

export class WindowManager {
    private windowId: string;
    private commandFile: string;
    private metadataFile: string;
    private responseFile: string;
    private fileWatcher: fs.FSWatcher | undefined;
    private heartbeatInterval: NodeJS.Timeout | undefined;
    private vsClaudeDir: string;
    private commandHandler: CommandHandler;

    constructor(private outputChannel: vscode.OutputChannel) {
        this.vsClaudeDir = path.join(os.homedir(), '.vs-claude');
        this.windowId = this.generateWindowId();
        this.commandFile = path.join(this.vsClaudeDir, `${this.windowId}.in`);
        this.metadataFile = path.join(this.vsClaudeDir, `${this.windowId}.meta.json`);
        this.responseFile = path.join(this.vsClaudeDir, `${this.windowId}.out`);
        this.commandHandler = new CommandHandler(outputChannel);
    }

    async initialize(): Promise<void> {
        // Ensure .vsclaude directory exists
        if (!fs.existsSync(this.vsClaudeDir)) {
            fs.mkdirSync(this.vsClaudeDir, { recursive: true });
        }

        // Log file paths
        this.outputChannel.appendLine(`VS Claude Window Manager initialized with window ID: ${this.windowId}`);
        this.outputChannel.appendLine(`Directory: ${this.vsClaudeDir}`);
        this.outputChannel.appendLine(`Metadata file: ${this.metadataFile}`);
        this.outputChannel.appendLine(`Command file: ${this.commandFile}`);
        this.outputChannel.appendLine(`Response file: ${this.responseFile}`);

        // Write initial window metadata
        await this.updateWindowMetadata();

        // Start heartbeat to touch the file every second
        this.heartbeatInterval = setInterval(() => {
            // Just touch the file to update its modification time
            const now = new Date();
            fs.utimesSync(this.metadataFile, now, now);
        }, 1000); // Every second

        // Start watching for commands
        this.startCommandWatcher();
    }

    dispose(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.fileWatcher) {
            this.fileWatcher.close();
        }

        // Remove command, metadata, and response files
        try {
            if (fs.existsSync(this.commandFile)) {
                fs.unlinkSync(this.commandFile);
                this.outputChannel.appendLine(`Removed command file: ${this.commandFile}`);
            }
            if (fs.existsSync(this.metadataFile)) {
                fs.unlinkSync(this.metadataFile);
                this.outputChannel.appendLine(`Removed metadata file: ${this.metadataFile}`);
            }
            if (fs.existsSync(this.responseFile)) {
                fs.unlinkSync(this.responseFile);
                this.outputChannel.appendLine(`Removed response file: ${this.responseFile}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Cleanup error: ${error}`);
        }
    }

    private generateWindowId(): string {
        return crypto.randomBytes(4).toString('hex');
    }

    private async writeResponse(response: CommandResponse): Promise<void> {
        try {
            const responseData = `${JSON.stringify(response)}\n`;

            // Use appendFileSync which is atomic for small writes
            // Since our JSON lines are small, this will be atomic
            fs.appendFileSync(this.responseFile, responseData, { flag: 'a' });

            this.outputChannel.appendLine(`[RESPONSE SENT] ${JSON.stringify(response)}`);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to write response: ${error}`);
        }
    }

    private async updateWindowMetadata(): Promise<void> {
        const workspace = vscode.workspace.workspaceFolders?.[0]?.name || 'No Workspace';
        const windowTitle = vscode.workspace.name || workspace;

        const metadata: WindowInfo = {
            workspace,
            windowTitle,
            timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    }

    private startCommandWatcher(): void {
        // Create empty command file if it doesn't exist
        if (!fs.existsSync(this.commandFile)) {
            fs.writeFileSync(this.commandFile, '');
            this.outputChannel.appendLine(`Created command file: ${this.commandFile}`);
        }

        // Create empty response file if it doesn't exist
        if (!fs.existsSync(this.responseFile)) {
            fs.writeFileSync(this.responseFile, '');
            this.outputChannel.appendLine(`Created response file: ${this.responseFile}`);
        }

        let lastPosition = 0;

        this.fileWatcher = fs.watch(this.commandFile, async (eventType) => {
            if (eventType === 'change') {
                try {
                    const stats = fs.statSync(this.commandFile);
                    if (stats.size > lastPosition) {
                        // Read only new data
                        const fd = fs.openSync(this.commandFile, 'r');
                        const newDataSize = stats.size - lastPosition;
                        const buffer = Buffer.alloc(newDataSize);
                        fs.readSync(fd, buffer, 0, newDataSize, lastPosition);
                        fs.closeSync(fd);

                        // Update last position
                        lastPosition = stats.size;

                        // Process new commands
                        const newData = buffer.toString('utf8');
                        let lines = newData.split('\n');

                        // Check if last line is complete (ends with newline)
                        if (lines.length > 0 && !newData.endsWith('\n')) {
                            // Last line is incomplete, adjust position to re-read it next time
                            const incompleteLine = lines[lines.length - 1];
                            lastPosition -= Buffer.byteLength(incompleteLine, 'utf8');
                            lines = lines.slice(0, -1);
                            // The file watcher will fire again when the rest of the line is written
                        }

                        // Process complete lines
                        const completeLines = lines.filter((line) => line.trim());

                        for (const line of completeLines) {
                            try {
                                const command: Command = JSON.parse(line);
                                this.outputChannel.appendLine(`[COMMAND RECEIVED] ${JSON.stringify(command)}`);

                                // Execute the command
                                const result = await this.commandHandler.executeCommand(command);

                                // Always write response for better reliability
                                const response: CommandResponse = {
                                    id: command.id,
                                    success: result.success,
                                    data: result.data,
                                    error: result.error,
                                };
                                await this.writeResponse(response);
                            } catch (error) {
                                this.outputChannel.appendLine(`Failed to parse/execute command: ${error}`);

                                // Always send error response for better reliability
                                try {
                                    const command: Command = JSON.parse(line);
                                    await this.writeResponse({
                                        id: command.id,
                                        success: false,
                                        error: String(error),
                                    });
                                } catch (_parseError) {
                                    // Can't even parse to get ID, skip response
                                }
                            }
                        }
                    }
                } catch (error) {
                    this.outputChannel.appendLine(`Error watching command file: ${error}`);
                }
            }
        });
    }
}
