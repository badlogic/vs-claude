import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { type Command, CommandHandler } from './command-handler';

export interface WindowInfo {
    workspace: string;
    windowTitle: string;
    timestamp: string;
}

export class WindowManager {
    private windowId: string;
    private commandFile: string;
    private metadataFile: string;
    private fileWatcher: fs.FSWatcher | undefined;
    private heartbeatInterval: NodeJS.Timeout | undefined;
    private vsClaudeDir: string;
    private commandHandler: CommandHandler;

    constructor(private outputChannel: vscode.OutputChannel) {
        this.vsClaudeDir = path.join(os.homedir(), '.vs-claude');
        this.windowId = this.generateWindowId();
        this.commandFile = path.join(this.vsClaudeDir, `${this.windowId}.cmd.jsonl`);
        this.metadataFile = path.join(this.vsClaudeDir, `${this.windowId}.json`);
        this.commandHandler = new CommandHandler(outputChannel);
    }

    async initialize(): Promise<void> {
        // Ensure .vsclaude directory exists
        if (!fs.existsSync(this.vsClaudeDir)) {
            fs.mkdirSync(this.vsClaudeDir, { recursive: true });
        }

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

        // Remove command and metadata files
        try {
            if (fs.existsSync(this.commandFile)) {
                fs.unlinkSync(this.commandFile);
                this.outputChannel.appendLine(`Removed command file: ${this.commandFile}`);
            }
            if (fs.existsSync(this.metadataFile)) {
                fs.unlinkSync(this.metadataFile);
                this.outputChannel.appendLine(`Removed metadata file: ${this.metadataFile}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Cleanup error: ${error}`);
        }
    }

    private generateWindowId(): string {
        return crypto.randomBytes(4).toString('hex');
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
        }

        let lastSize = fs.statSync(this.commandFile).size;

        this.fileWatcher = fs.watch(this.commandFile, async (eventType) => {
            if (eventType === 'change') {
                const currentSize = fs.statSync(this.commandFile).size;
                if (currentSize > lastSize) {
                    // Read new commands
                    const content = fs.readFileSync(this.commandFile, 'utf8');
                    const lines = content.split('\n').filter((line) => line.trim());
                    const newLines = lines.slice(-1); // Get last line (newest command)

                    for (const line of newLines) {
                        try {
                            const command: Command = JSON.parse(line);
                            await this.commandHandler.executeCommand(command);
                        } catch (error) {
                            this.outputChannel.appendLine(`Failed to parse command: ${error}`);
                        }
                    }

                    lastSize = currentSize;
                }
            }
        });
    }
}
