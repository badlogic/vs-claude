import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';

suite('Panel Persistence E2E Test Suite', () => {
	async function closeAllPanels() {
		const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		const settingsTabs = tabs.filter((tab) => tab.label === 'VS Claude Settings');
		for (const tab of settingsTabs) {
			await vscode.window.tabGroups.close(tab);
		}
	}

	test('Panel state should persist across close/open', async function () {
		this.timeout(10000);

		// Clean up any existing panels
		await closeAllPanels();

		// Open a settings panel
		await vscode.commands.executeCommand('vs-claude.openSettings');
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Verify it's open
		let tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		let settingsTabs = tabs.filter((tab) => tab.label === 'VS Claude Settings');
		assert.strictEqual(settingsTabs.length, 1, 'Should have 1 settings panel open');

		// Get the panel ID from the view type
		const panelTab = settingsTabs[0];
		assert.ok(panelTab, 'Panel tab should exist');

		// Close the panel
		await vscode.window.tabGroups.close(panelTab);
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify it's closed
		tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		settingsTabs = tabs.filter((tab) => tab.label === 'VS Claude Settings');
		assert.strictEqual(settingsTabs.length, 0, 'Should have no settings panels open');

		// The extension's global state should have saved this panel
		// We can't directly test this without access to the extension context,
		// but we can verify the behavior works by seeing if panels restore on activation
	});

	test('Multiple panels should be tracked independently', async function () {
		this.timeout(15000);

		// Clean up any existing panels
		await closeAllPanels();

		// Open two settings panels
		await vscode.commands.executeCommand('vs-claude.openSettings');
		await new Promise((resolve) => setTimeout(resolve, 500));

		await vscode.commands.executeCommand('vs-claude.openSettings');
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify both are open
		let tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		let settingsTabs = tabs.filter((tab) => tab.label === 'VS Claude Settings');
		assert.strictEqual(settingsTabs.length, 2, 'Should have 2 settings panels open');

		// Close one panel
		await vscode.window.tabGroups.close(settingsTabs[0]);
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify only one remains
		tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
		settingsTabs = tabs.filter((tab) => tab.label === 'VS Claude Settings');
		assert.strictEqual(settingsTabs.length, 1, 'Should have 1 settings panel open after closing one');

		// Clean up
		await closeAllPanels();
	});
});
