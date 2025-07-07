import * as assert from 'assert';
import * as fs from 'fs';
import { suite, test } from 'mocha';
import * as path from 'path';

suite('Panel Build Test Suite', () => {
	const buildDir = path.join(__dirname, '../../../panels');

	test('Panel build output directory should exist', () => {
		assert.ok(fs.existsSync(buildDir), 'Build panels directory should exist');
	});

	test('Shared panel styles should be built', () => {
		const stylesPath = path.join(buildDir, 'panel-styles.css');
		assert.ok(fs.existsSync(stylesPath), 'panel-styles.css should exist');

		const content = fs.readFileSync(stylesPath, 'utf8');
		// Check for Tailwind reset styles
		assert.ok(content.includes('*, ::before, ::after'), 'Should contain Tailwind reset styles');
		// Check for some Tailwind utility classes
		assert.ok(content.includes('.flex'), 'Should contain flex utility class');
		assert.ok(content.includes('.text-2xl'), 'Should contain text sizing classes');
	});

	test('Settings panel should be built', () => {
		const settingsDir = path.join(buildDir, 'settings');
		assert.ok(fs.existsSync(settingsDir), 'Settings panel directory should exist');

		const jsPath = path.join(settingsDir, 'settings.js');
		assert.ok(fs.existsSync(jsPath), 'settings.js should exist');

		const mapPath = path.join(settingsDir, 'settings.js.map');
		assert.ok(fs.existsSync(mapPath), 'settings.js.map should exist');

		const content = fs.readFileSync(jsPath, 'utf8');
		// Check for key components
		assert.ok(content.includes('settings-webview'), 'Should contain settings-webview custom element');
		assert.ok(content.includes('WebviewBase'), 'Should contain WebviewBase class');
		assert.ok(content.includes('LitElement'), 'Should contain LitElement');
	});

	test('Panel JavaScript should be properly bundled', () => {
		const jsPath = path.join(buildDir, 'settings/settings.js');
		const content = fs.readFileSync(jsPath, 'utf8');

		// Should be an IIFE (check for the IIFE pattern after "use strict")
		assert.ok(content.includes('(() => {'), 'Should be wrapped as IIFE');
		assert.ok(content.includes('function') || content.includes('=>'), 'Should contain function definitions');

		// Should not have import/export statements (bundled)
		assert.ok(
			!content.includes('import ') || content.includes('// import'),
			'Should not contain import statements'
		);
		assert.ok(
			!content.includes('export ') || content.includes('// export'),
			'Should not contain export statements'
		);
	});
});
