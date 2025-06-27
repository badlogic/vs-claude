import './components/log-viewer';
import { initializeTheme } from './webview-base';

// Initialize theme handling
initializeTheme();

// Mount the log viewer component
const logViewer = document.createElement('log-viewer');
document.body.appendChild(logViewer);

// Handle messages from the extension
window.addEventListener('message', (event) => {
	const message = event.data;
	switch (message.command) {
		case 'setLogs':
			logViewer.entries = message.logs;
			break;
		case 'addLog':
			logViewer.entries = [...logViewer.entries, message.log];
			break;
	}
});
