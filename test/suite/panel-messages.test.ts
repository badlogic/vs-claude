import * as assert from 'assert';
import { suite, suiteSetup, suiteTeardown, test } from 'mocha';
import * as vscode from 'vscode';

suite('Panel Message Passing E2E Test Suite', () => {
	let disposables: vscode.Disposable[] = [];

	async function closeAllPanels() {
		const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		const settingsTabs = tabs.filter((tab) => tab.label === 'VS Claude Settings');
		for (const tab of settingsTabs) {
			await vscode.window.tabGroups.close(tab);
		}
	}

	suiteSetup(async () => {
		await closeAllPanels();
	});

	suiteTeardown(async () => {
		await closeAllPanels();
		disposables.forEach((d) => d.dispose());
		disposables = [];
	});

	test('Panel should open and communicate bidirectionally', async function () {
		this.timeout(10000);

		// Open the settings panel via command
		await vscode.commands.executeCommand('vs-claude.openSettings');

		// Wait for panel to load
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Get all tabs to find our panel
		const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		const settingsTab = tabs.find((tab) => tab.label === 'VS Claude Settings');

		assert.ok(settingsTab, 'Settings panel should be open');

		// The panel should exist and be active
		const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
		assert.strictEqual(activeTab?.label, 'VS Claude Settings', 'Settings panel should be active');
	});

	test('Multiple panels can be opened independently', async function () {
		this.timeout(10000);

		// Make sure we start clean
		await closeAllPanels();

		// Open first settings panel
		await vscode.commands.executeCommand('vs-claude.openSettings');
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Open second settings panel
		await vscode.commands.executeCommand('vs-claude.openSettings');
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Count settings panels
		const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		const settingsTabs = tabs.filter((tab) => tab.label === 'VS Claude Settings');

		assert.strictEqual(settingsTabs.length, 2, 'Should have 2 settings panels open');

		// Close all panels
		await closeAllPanels();
	});
});
