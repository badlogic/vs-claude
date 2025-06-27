import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LogEntry } from './log-entry';
import './log-entry';

@customElement('log-viewer')
export class LogViewerElement extends LitElement {
	@property({ type: Array })
	entries: LogEntry[] = [];

	private scrollContainer?: HTMLElement;
	private wasScrolledToBottom = true;

	createRenderRoot() {
		return this;
	}

	updated(changedProperties: Map<string, any>) {
		if (changedProperties.has('entries')) {
			// Auto-scroll to bottom if user was already at bottom
			if (this.scrollContainer && this.wasScrolledToBottom) {
				requestAnimationFrame(() => {
					if (this.scrollContainer) {
						this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
					}
				});
			}
		}
	}

	private handleScroll(e: Event) {
		if (!this.scrollContainer) return;

		// Check if scrolled to bottom (within 5px tolerance)
		const isAtBottom =
			this.scrollContainer.scrollHeight - this.scrollContainer.scrollTop - this.scrollContainer.clientHeight < 5;
		this.wasScrolledToBottom = isAtBottom;
	}

	firstUpdated() {
		this.scrollContainer = this.renderRoot.querySelector('.log-container') as HTMLElement;
		if (this.scrollContainer) {
			// Scroll to bottom initially
			this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
		}
	}

	render() {
		return html`
			<div style="display: flex; flex-direction: column; height: 100vh; font-family: var(--vscode-font-family); overflow: hidden;">
				<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); flex-shrink: 0;">
					<h3 style="margin: 0; font-size: 13px; font-weight: 500;">VS Claude Logs</h3>
					<span style="font-size: 11px; color: var(--vscode-descriptionForeground);">${this.entries.length} entries</span>
				</div>
				
				<div 
					class="log-container"
					style="flex: 1; overflow: auto; padding: 4px 0; min-height: 0;"
					@scroll=${this.handleScroll}
				>
					<div style="padding: 0 12px; min-width: max-content;">
						${
							this.entries.length === 0
								? html`
							<div style="text-align: center; color: var(--vscode-descriptionForeground); padding: 32px;">
								No log entries to display
							</div>
						`
								: this.entries.map(
										(entry) => html`
							<log-entry .entry=${entry}></log-entry>
						`
									)
						}
					</div>
				</div>
			</div>
		`;
	}
}
