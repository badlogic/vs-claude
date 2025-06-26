import * as vscode from 'vscode';

const chalk = require('chalk');

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	levelStr: string;
	component: string;
	message: string;
	args?: unknown[];
}

class Logger {
	private outputChannel: vscode.OutputChannel;
	private logLevel: LogLevel = LogLevel.INFO;
	private logs: LogEntry[] = [];
	private logListeners: Array<(log: LogEntry) => void> = [];
	private maxLogs = 1000;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('VS Claude');
	}

	private formatTimestamp(): string {
		const now = new Date();
		return `[${now.toISOString().slice(11, 23)}]`;
	}

	private formatLevel(level: LogLevel): string {
		switch (level) {
			case LogLevel.DEBUG:
				return chalk.gray('DEBUG');
			case LogLevel.INFO:
				return chalk.blue('INFO ');
			case LogLevel.WARN:
				return chalk.yellow('WARN ');
			case LogLevel.ERROR:
				return chalk.red('ERROR');
			default:
				return 'UNKNOWN';
		}
	}

	private formatMessage(level: LogLevel, component: string, message: string, ...args: unknown[]): string {
		const timestamp = chalk.gray(this.formatTimestamp());
		const levelStr = this.formatLevel(level);
		const componentStr = chalk.cyan(`[${component}]`);

		// Apply message formatting based on level
		let formattedMessage = message;
		if (level === LogLevel.ERROR) {
			formattedMessage = chalk.bold(message);
		} else if (level === LogLevel.WARN) {
			formattedMessage = message;
		} else if (level === LogLevel.DEBUG) {
			formattedMessage = chalk.gray(message);
		}

		let fullMessage = formattedMessage;
		if (args.length > 0) {
			// Format additional arguments
			const formattedArgs = args
				.map((arg) => {
					if (typeof arg === 'object') {
						try {
							const json = JSON.stringify(arg, null, 2);
							return `\n${chalk.gray(
								json
									.split('\n')
									.map((line) => `  ${line}`)
									.join('\n')
							)}`;
						} catch {
							return chalk.gray(String(arg));
						}
					}
					return chalk.gray(String(arg));
				})
				.join(' ');
			fullMessage = `${formattedMessage}${formattedArgs}`;
		}

		return `${timestamp} ${levelStr} ${componentStr} ${fullMessage}`;
	}

	private log(level: LogLevel, component: string, message: string, ...args: unknown[]): void {
		if (level < this.logLevel) {
			return;
		}

		// Create log entry
		const logEntry: LogEntry = {
			timestamp: this.formatTimestamp(),
			level,
			levelStr: this.formatLevel(level).trim(),
			component,
			message,
			args: args.length > 0 ? args : undefined,
		};

		// Store in memory (with limit)
		this.logs.push(logEntry);
		if (this.logs.length > this.maxLogs) {
			this.logs.shift();
		}

		// Notify listeners
		this.logListeners.forEach((listener) => listener(logEntry));

		// Output to channel (plain text)
		const formattedMessage = this.formatMessage(level, component, message, ...args);
		this.outputChannel.appendLine(this.stripAnsi(formattedMessage));

		// Also log to console in development
		if (process.env.NODE_ENV === 'development' || level === LogLevel.ERROR) {
			console.log(formattedMessage);
		}
	}

	debug(component: string, message: string, ...args: unknown[]): void {
		this.log(LogLevel.DEBUG, component, message, ...args);
	}

	info(component: string, message: string, ...args: unknown[]): void {
		this.log(LogLevel.INFO, component, message, ...args);
	}

	warn(component: string, message: string, ...args: unknown[]): void {
		this.log(LogLevel.WARN, component, message, ...args);
	}

	error(component: string, message: string, ...args: unknown[]): void {
		this.log(LogLevel.ERROR, component, message, ...args);
	}

	show(): void {
		this.outputChannel.show();
	}

	hide(): void {
		this.outputChannel.hide();
	}

	dispose(): void {
		this.outputChannel.dispose();
	}

	setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	// Special formatted logging for commands
	command(tool: string, success?: boolean): void {
		if (success === undefined) {
			// Command received
			const arrow = chalk.cyan('→');
			this.info('Command', `${arrow} ${chalk.bold(tool)}`);
		} else {
			// Command result
			const icon = success ? chalk.green('✓') : chalk.red('✗');
			this.info('Command', `${icon} ${tool}`);
		}
	}

	// Log file operations
	file(action: string, path: string): void {
		const formattedPath = chalk.yellow(path);
		this.info('File', `${action} ${formattedPath}`);
	}

	// Log query operations
	query(type: string, details?: string): void {
		const formattedType = chalk.magenta(type);
		const detailStr = details ? chalk.gray(` - ${details}`) : '';
		this.info('Query', `${formattedType}${detailStr}`);
	}

	// Get stored logs
	getLogs(): LogEntry[] {
		return [...this.logs];
	}

	// Clear stored logs
	clearLogs(): void {
		this.logs = [];
		this.outputChannel.clear();
	}

	// Subscribe to log events
	onDidLog(listener: (log: LogEntry) => void): vscode.Disposable {
		this.logListeners.push(listener);
		return {
			dispose: () => {
				const index = this.logListeners.indexOf(listener);
				if (index > -1) {
					this.logListeners.splice(index, 1);
				}
			},
		};
	}

	// Strip ANSI color codes for output channel
	private stripAnsi(str: string): string {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes are control characters
		return str.replace(/\x1b\[[0-9;]*m/g, '');
	}
}

// Export singleton instance
export const logger = new Logger();

// Helper functions for common logging patterns
export function logCommand(action: string, args?: unknown): void {
	const argsStr = args ? ` with args` : '';
	logger.info('Command', `${chalk.green(action)}${chalk.gray(argsStr)}`);
	if (args) {
		logger.debug('Command', 'Args:', args);
	}
}

export function logResult(action: string, success: boolean, details?: string): void {
	const status = success ? chalk.green('✓') : chalk.red('✗');
	const detailsStr = details ? chalk.gray(` - ${details}`) : '';
	logger.info('Result', `${status} ${action}${detailsStr}`);
}

export function logFile(action: string, path: string): void {
	logger.info('File', `${action} ${chalk.yellow(path)}`);
}

export function logQuery(query: string, resultCount?: number): void {
	const countStr = resultCount !== undefined ? chalk.gray(` → ${resultCount} results`) : '';
	logger.info('Query', `${chalk.magenta(query)}${countStr}`);
}
