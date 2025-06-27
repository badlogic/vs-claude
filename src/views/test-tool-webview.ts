import './components/test-tool';
import { initializeTheme } from './webview-base';

// Initialize theme handling
initializeTheme();

// Set logo URI from global
(window as any).logoUri = (window as any).logoUri || '';

// Mount the test tool component
document.body.innerHTML = '<test-tool></test-tool>';
