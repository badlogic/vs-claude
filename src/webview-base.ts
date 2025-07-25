import { LitElement } from 'lit';

// VS Code API available in webview context
interface VsCodeApi {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

declare global {
	interface Window {
		vsClaudeResources?: Record<string, string>;
	}
}

export abstract class WebviewBase<T> extends LitElement {
	private vscodeApi = acquireVsCodeApi();

	// Override to use light DOM (no shadow DOM) for Tailwind
	createRenderRoot() {
		return this;
	}

	protected resource(fileName: string): string {
		return window.vsClaudeResources?.[fileName] ?? '';
	}

	connectedCallback() {
		super.connectedCallback();

		// Listen for messages from extension
		window.addEventListener('message', (event: MessageEvent) => {
			this.onMessage(event.data as T);
		});
	}

	protected sendMessage(message: T) {
		this.vscodeApi.postMessage(message);
	}

	protected abstract onMessage(message: T): void;
}
