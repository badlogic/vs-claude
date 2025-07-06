import * as path from 'path';

const glob = require('glob');
const Mocha = require('mocha');

export function run(): Promise<void> {
	// Get test filters from environment variables
	const testFile = process.env.TEST_FILE;
	const testPattern = process.env.TEST_PATTERN;

	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		grep: testPattern, // Use grep to filter tests by pattern
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((c, e) => {
		// If a specific file is requested, use it; otherwise glob all test files
		// Support both with and without directory prefix
		let pattern = testFile || '**/**.test.js';
		if (testFile && !testFile.includes('/') && !testFile.includes('*')) {
			// Convert .ts to .js extension
			const jsFile = testFile.replace(/\.ts$/, '.js');
			// If just a filename is provided, search for it in subdirectories
			pattern = `**/${jsFile}`;
		}

		glob(pattern, { cwd: testsRoot }, (err: Error | null, files: string[]) => {
			if (err) {
				return e(err);
			}

			if (files.length === 0) {
				e(new Error(`No test files found${testFile ? ` matching: ${testFile}` : ''}`));
				return;
			}

			console.log(`Found ${files.length} test file(s)${testFile ? ` matching: ${testFile}` : ''}`);
			if (testPattern) {
				console.log(`Filtering tests with pattern: ${testPattern}`);
			}

			// Add files to the test suite
			files.forEach((f: string) => {
				const fullPath = path.resolve(testsRoot, f);
				console.log(`Adding test file: ${f}`);
				mocha.addFile(fullPath);
			});

			try {
				// Run the mocha test
				mocha.run((failures: number) => {
					if (failures > 0) {
						e(new Error(`${failures} tests failed.`));
					} else {
						c();
					}
				});
			} catch (err) {
				console.error(err);
				e(err);
			}
		});
	});
}
