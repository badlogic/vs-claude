import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

export interface LogEntry {
	timestamp: string;
	level: number;
	levelStr: string;
	component: string;
	message: string;
	args?: any[];
}

@customElement('log-entry')
export class LogEntryElement extends LitElement {
	@property({ type: Object })
	entry!: LogEntry;

	createRenderRoot() {
		return this;
	}

	private getComponentColor(component: string): { bg: string; fg: string } {
		// Define a set of nice colors for components
		const colors = [
			{ bg: 'rgba(92, 107, 192, 0.2)', fg: '#5C6BC0' }, // Indigo
			{ bg: 'rgba(66, 165, 245, 0.2)', fg: '#42A5F5' }, // Blue
			{ bg: 'rgba(38, 166, 154, 0.2)', fg: '#26A69A' }, // Teal
			{ bg: 'rgba(102, 187, 106, 0.2)', fg: '#66BB6A' }, // Green
			{ bg: 'rgba(171, 71, 188, 0.2)', fg: '#AB47BC' }, // Purple
			{ bg: 'rgba(239, 83, 80, 0.2)', fg: '#EF5350' }, // Red
			{ bg: 'rgba(255, 167, 38, 0.2)', fg: '#FFA726' }, // Orange
			{ bg: 'rgba(141, 110, 99, 0.2)', fg: '#8D6E63' }, // Brown
			{ bg: 'rgba(120, 144, 156, 0.2)', fg: '#78909C' }, // Blue Grey
			{ bg: 'rgba(236, 64, 122, 0.2)', fg: '#EC407A' }, // Pink
		];

		// Use a simple hash function to consistently map components to colors
		let hash = 0;
		for (let i = 0; i < component.length; i++) {
			hash = (hash << 5) - hash + component.charCodeAt(i);
			hash = hash & hash; // Convert to 32bit integer
		}
		const index = Math.abs(hash) % colors.length;
		return colors[index];
	}

	private formatMessage(message: string): string {
		// Apply special formatting for known patterns
		return (
			message
				// Command arrows
				.replace(/→/g, '<span style="color: #4EC9B0;">→</span>')
				// Success/error icons
				.replace(/✓/g, '<span style="color: #4EC9B0;">✓</span>')
				.replace(/✗/g, '<span style="color: #F14C4C;">✗</span>')
				// Bold text between **
				.replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight: bold; color: #DCDCAA;">$1</span>')
				// File paths (simple heuristic)
				.replace(
					/(\S+\.(ts|js|json|go|py|java|cs|cpp|c|h|hpp|tsx|jsx))/g,
					'<span style="color: #9CDCFE; text-decoration: underline; cursor: pointer;">$1</span>'
				)
		);
	}

	private formatJson(obj: any): string {
		const json = JSON.stringify(obj, null, 2);
		const escaped = json.replace(/</g, '&lt;').replace(/>/g, '&gt;');

		return escaped
			.replace(/"([^"]+)":/g, '<span style="color: #9CDCFE;">"$1"</span>:')
			.replace(/: "([^"]*)"/g, ': <span style="color: #CE9178;">"$1"</span>')
			.replace(/: (\d+)/g, ': <span style="color: #B5CEA8;">$1</span>')
			.replace(/: (true|false)/g, ': <span style="color: #569CD6;">$1</span>')
			.replace(/: null/g, ': <span style="color: #569CD6; opacity: 0.7;">null</span>')
			.replace(/([{}[\],])/g, '<span style="opacity: 0.6;">$1</span>');
	}

	render() {
		const levelStyles =
			{
				DEBUG: 'background: rgba(150, 150, 150, 0.2); color: #999;',
				INFO: 'background: rgba(0, 122, 204, 0.2); color: #007ACC;',
				WARN: 'background: rgba(255, 165, 0, 0.2); color: #FFA500;',
				ERROR: 'background: rgba(215, 58, 73, 0.2); color: #D73A49;',
			}[this.entry.levelStr.trim()] || 'background: rgba(150, 150, 150, 0.2); color: #999;';

		// Format timestamp to show only time
		const timeMatch = this.entry.timestamp.match(/\d{2}:\d{2}:\d{2}\.\d{3}/);
		const displayTime = timeMatch ? timeMatch[0] : this.entry.timestamp;

		// Get component color
		const componentColor = this.getComponentColor(this.entry.component);

		// Calculate fixed widths for consistent alignment
		const timestampWidth = '90px';
		const levelWidth = '60px';
		const componentWidth = '120px';
		const totalFixedWidth = 90 + 60 + 120 + 24; // widths + gaps

		return html`
			<div style="display: flex; align-items: flex-start; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; font-size: 12px; line-height: 1.5; padding: 2px 0;">
				<span style="flex: 0 0 ${timestampWidth}; color: var(--vscode-descriptionForeground); opacity: 0.7; font-size: 11px; overflow: hidden; text-overflow: ellipsis;">${displayTime}</span>
				<span style="flex: 0 0 ${levelWidth}; text-align: center; font-weight: 600; font-size: 10px; padding: 2px 6px; border-radius: 3px; text-transform: uppercase; margin: 0 4px; display: inline-block; ${levelStyles}">${this.entry.levelStr.trim()}</span>
				<span style="flex: 0 0 ${componentWidth}; text-align: center; font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 3px; margin: 0 4px; background: ${componentColor.bg}; color: ${componentColor.fg}; overflow: hidden; text-overflow: ellipsis; display: inline-block;">${this.entry.component}</span>
				<span style="flex: 0 0 auto; color: var(--vscode-editor-foreground); white-space: nowrap; padding-left: 4px;">${unsafeHTML(this.formatMessage(this.entry.message))}</span>
			</div>
			${
				this.entry.args && this.entry.args.length > 0
					? html`
				<div style="margin-left: ${totalFixedWidth}px; margin-top: 2px; margin-bottom: 4px;">
					${this.entry.args.map(
						(arg) => html`
						<pre style="background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-textBlockQuote-border); padding: 8px; margin: 4px 0; border-radius: 4px; font-size: 11px; overflow-x: auto; white-space: pre;">${unsafeHTML(
							typeof arg === 'object' ? this.formatJson(arg) : String(arg)
						)}</pre>
					`
					)}
				</div>
			`
					: ''
			}
		`;
	}
}
