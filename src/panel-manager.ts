import type * as vscode from 'vscode';
import type { Panel } from './panel-base';
import { SettingsPanel } from './panels/settings/panel';

export class PanelManager {
	private instances = new Map<string, Panel<any>>();
	private nextId = 1;

	// Registry of panel types for restoration
	private panelTypes: Record<string, new (manager: PanelManager) => Panel<any>> = {
		settings: SettingsPanel,
		// Add more panel types here as they're created
	};

	constructor(private context: vscode.ExtensionContext) {}

	register(panel: Panel<any>): string {
		const id = `${panel.type}-${this.nextId++}`;
		this.instances.set(id, panel);
		this.saveOpenPanels();
		return id;
	}

	unregister(id: string): void {
		this.instances.delete(id);
		this.saveOpenPanels();
	}

	async create<T>(PanelClass: new (manager: PanelManager) => Panel<T>): Promise<Panel<T>> {
		const panel = new PanelClass(this);
		await panel.create(this.context);
		return panel;
	}

	private async saveOpenPanels() {
		const openPanels = Array.from(this.instances.values()).map((panel) => ({
			type: panel.type,
		}));
		await this.context.globalState.update('openPanels', openPanels);
	}

	async restorePanels() {
		const saved = this.context.globalState.get<{ type: string }[]>('openPanels', []);

		for (const { type } of saved) {
			const PanelClass = this.panelTypes[type];
			if (PanelClass) {
				await this.create(PanelClass);
			}
		}
	}
}
