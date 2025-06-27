// Shared utilities for webviews

// VS Code API type declaration
declare global {
	interface Window {
		acquireVsCodeApi: () => {
			postMessage: (message: any) => void;
			getState: () => any;
			setState: (state: any) => void;
		};
	}
}

export const vscode = window.acquireVsCodeApi();

// Add dark mode class based on VS Code theme
export function initializeTheme() {
	const isDark =
		document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

	if (isDark) {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}

	// Watch for theme changes
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.attributeName === 'class') {
				const isDark =
					document.body.classList.contains('vscode-dark') ||
					document.body.classList.contains('vscode-high-contrast');
				if (isDark) {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
			}
		});
	});

	observer.observe(document.body, { attributes: true });
}

// Format JSON with syntax highlighting
export function formatJson(obj: any): string {
	const json = JSON.stringify(obj, null, 2);
	const escaped = json.replace(/</g, '&lt;').replace(/>/g, '&gt;');

	return escaped
		.replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
		.replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
		.replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
		.replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
		.replace(/: null/g, ': <span class="json-null">null</span>')
		.replace(/([{}[\],])/g, '<span class="json-punctuation">$1</span>');
}

// Format timestamp to time only
export function formatTimestamp(timestamp: string): string {
	const match = timestamp.match(/\d{2}:\d{2}:\d{2}\.\d{3}/);
	return match ? match[0] : timestamp;
}
