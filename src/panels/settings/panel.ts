import { Panel } from '../../panel-base';
import type { SettingsMessage } from './messages';

export class SettingsPanel extends Panel<SettingsMessage> {
	get type() {
		return 'settings';
	}
	get title() {
		return 'VS Claude Settings';
	}
	get elementName() {
		return 'settings-webview';
	}

	onMessage(message: SettingsMessage) {
		switch (message.type) {
			case 'saveSettings':
				// Save settings logic
				console.log('Saving settings:', message.settings);
				// TODO: Implement actual settings persistence
				this.sendMessage({ type: 'settingsSaved', success: true });
				break;
		}
	}
}
