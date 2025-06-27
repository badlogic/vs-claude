// VS Claude Log Viewer Webview JavaScript

const vscode = acquireVsCodeApi();
let logs = [];

function formatTimestamp(timestamp) {
	// Extract just the time portion
	const match = timestamp.match(/\d{2}:\d{2}:\d{2}\.\d{3}/);
	return match ? match[0] : timestamp;
}

function formatMessage(message, _level) {
	// Escape HTML first
	const escaped = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	// Handle special message patterns
	return escaped
		.replace(/→\s*([\w-]+)/g, '<span class="command-arrow">→</span> <span class="command-name">$1</span>')
		.replace(/✓\s*([\w-]+)/g, '<span class="success-icon">✓</span> $1')
		.replace(/✗\s*([\w-]+)/g, '<span class="error-icon">✗</span> $1')
		.replace(/(\/[^\s]+)/g, '<span class="file-path">$1</span>');
}

function formatJson(obj) {
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

function createLogEntry(log) {
	const levelClass = log.levelStr.toLowerCase().trim();
	const hasArgs = log.args && log.args.length > 0;

	let argsHtml = '';
	if (hasArgs) {
		// Check if this is a tool command with args
		const isCommand = log.component === 'Command' || log.component === 'CommandHandler';
		const isQuery = log.component === 'QueryHandler';

		if (isCommand || isQuery) {
			log.args.forEach((arg) => {
				if (typeof arg === 'object' && arg !== null) {
					const label = isCommand ? 'Arguments' : 'Data';
					argsHtml += `
                        <div class="tool-section">
                            <div class="tool-label">${label}:</div>
                            <div class="json-container"><pre>${formatJson(arg)}</pre></div>
                        </div>
                    `;
				}
			});
		} else {
			// Regular args display
			log.args.forEach((arg) => {
				if (typeof arg === 'object' && arg !== null) {
					argsHtml += `<div class="json-container"><pre>${formatJson(arg)}</pre></div>`;
				} else {
					argsHtml += `<div style="margin: 4px 0; opacity: 0.8;">${String(arg)}</div>`;
				}
			});
		}
	}

	const hasJsonArgs = argsHtml.length > 0;
	const rowClass = hasJsonArgs ? 'log-row has-json' : 'log-row';

	return `
        <div class="${rowClass}">
            <div class="log-main">
                <div class="log-cell timestamp-cell">${formatTimestamp(log.timestamp)}</div>
                <div class="log-cell level-cell"><span class="level ${levelClass}">${log.levelStr}</span></div>
                <div class="log-cell component-cell">${log.component}</div>
                <div class="log-cell message-cell">${formatMessage(log.message, log.level)}</div>
            </div>
            ${hasJsonArgs ? `<div class="log-json">${argsHtml}</div>` : ''}
        </div>
    `;
}

function renderLogs() {
	const container = document.getElementById('logContainer');

	if (logs.length === 0) {
		container.innerHTML = '<div class="empty-state">Waiting for logs...</div>';
		return;
	}

	container.innerHTML = `<div class="log-table">${logs.map((log) => createLogEntry(log)).join('')}</div>`;

	// Auto-scroll to bottom
	window.scrollTo(0, document.body.scrollHeight);
}

window.addEventListener('message', (event) => {
	const message = event.data;
	switch (message.command) {
		case 'setLogs':
			logs = message.logs;
			renderLogs();
			break;
		case 'addLog':
			logs.push(message.log);
			// Only keep last 500 logs for performance
			if (logs.length > 500) {
				logs = logs.slice(-500);
			}
			renderLogs();
			break;
	}
});

// Handle file path clicks
document.addEventListener('click', (e) => {
	if (e.target.classList.contains('file-path')) {
		const path = e.target.textContent;
		vscode.postMessage({
			command: 'openFile',
			path: path,
		});
	}
});
