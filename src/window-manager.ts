import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { type Command, CommandHandler, type CommandResponse } from './command-handler';
import { logger } from './logger';

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
	private responseStream: fs.WriteStream | undefined;
	private heartbeatInterval: NodeJS.Timeout | undefined;
	private vsClaudeDir: string;
	private commandHandler: CommandHandler;

	constructor() {
		this.vsClaudeDir = path.join(os.homedir(), '.vs-claude');
		this.windowId = this.generateWindowId();
		this.commandFile = path.join(this.vsClaudeDir, `${this.windowId}.in`);
		this.metadataFile = path.join(this.vsClaudeDir, `${this.windowId}.meta.json`);
		this.responseFile = path.join(this.vsClaudeDir, `${this.windowId}.out`);
		this.commandHandler = new CommandHandler();
	}

	async initialize(): Promise<void> {
		if (!fs.existsSync(this.vsClaudeDir)) {
			fs.mkdirSync(this.vsClaudeDir, { recursive: true });
		}

		logger.info('WindowManager', `Initialized with window ID: ${this.windowId}`);

		await this.updateWindowMetadata();

		this.heartbeatInterval = setInterval(() => {
			const now = new Date();
			fs.utimesSync(this.metadataFile, now, now);
		}, 1000);

		this.startCommandWatcher();
	}

	dispose(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}

		if (this.fileWatcher) {
			this.fileWatcher.close();
		}

		if (this.responseStream) {
			this.responseStream.end();
		}

		try {
			if (fs.existsSync(this.commandFile)) {
				fs.unlinkSync(this.commandFile);
			}
			if (fs.existsSync(this.metadataFile)) {
				fs.unlinkSync(this.metadataFile);
			}
			if (fs.existsSync(this.responseFile)) {
				fs.unlinkSync(this.responseFile);
			}
		} catch (error) {
			logger.error('WindowManager', `Cleanup error: ${error}`);
		}
	}

	private generateWindowId(): string {
		const randomBytes = crypto.randomBytes(16).toString('hex');
		const timestamp = Date.now().toString(36);
		return `${timestamp}-${randomBytes.substring(0, 16)}`;
	}

	private async writeResponse(response: CommandResponse): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.responseStream) {
				reject(new Error('Response stream not initialized'));
				return;
			}
			const responseData = `${JSON.stringify(response)}\n`;
			this.responseStream.write(responseData, (error) => {
				if (error) {
					logger.error('WindowManager', `Failed to write response: ${error}`);
					reject(error);
					return;
				}

				// Force flush to ensure data is written immediately
				// This is critical for the MCP server to read the response without delay
				// Use cork/uncork pattern which internally flushes
				if (this.responseStream) {
					this.responseStream.uncork();
				}
				// Only log errors and important responses
				if (!response.success) {
					logger.debug('WindowManager', `Response sent (error): ${response.error}`);
				}
				resolve();
			});
		});
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
		if (!fs.existsSync(this.commandFile)) {
			fs.writeFileSync(this.commandFile, '');
		}

		if (!fs.existsSync(this.responseFile)) {
			fs.writeFileSync(this.responseFile, '');
		}

		this.responseStream = fs.createWriteStream(this.responseFile, {
			flags: 'a',
			encoding: 'utf8',
			autoClose: false, // Keep stream open for multiple writes
		});

		this.responseStream.on('error', (error) => {
			logger.error('WindowManager', `Response stream error: ${error}`);
		});

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
								logger.command(command.tool);

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
								logger.error('WindowManager', `Failed to parse/execute command: ${error}`);

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
					logger.error('WindowManager', `Error watching command file: ${error}`);
				}
			}
		});
	}
}
