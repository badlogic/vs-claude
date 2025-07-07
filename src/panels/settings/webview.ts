import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WebviewBase } from '../../webview-base';
import type { SettingsMessage } from './messages';

declare global {
	interface Window {
		vsClaudeResources?: {
			logoUri?: string;
		};
	}
}

@customElement('settings-webview')
export class SettingsWebview extends WebviewBase<SettingsMessage> {
	@state()
	private message = 'Hello from VS Claude!';

	@state()
	private theme: 'light' | 'dark' = 'light';

	protected onMessage(message: SettingsMessage) {
		switch (message.type) {
			case 'updateTheme':
				this.theme = message.theme;
				break;
			case 'settingsSaved':
				this.message = message.success ? 'Settings saved!' : 'Error saving settings';
				break;
		}
	}

	render() {
		return html`
      <div class="flex flex-col items-center p-8">
        <img src="${window.vsClaudeResources?.logoUri}" class="w-32 h-32 mb-4">
        <h1 class="text-2xl font-bold">${this.message}</h1>
        <button 
          @click=${() => this.sendMessage({ type: 'saveSettings', settings: { theme: this.theme } })}
          class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Save Settings
        </button>
      </div>
    `;
	}
}
