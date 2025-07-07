export interface UserSettings {
	theme: 'light' | 'dark';
}

export type SettingsMessage =
	| { type: 'updateTheme'; theme: 'light' | 'dark' }
	| { type: 'saveSettings'; settings: UserSettings }
	| { type: 'settingsSaved'; success: boolean };
