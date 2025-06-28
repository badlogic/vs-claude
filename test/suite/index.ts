import * as path from 'path';

const glob = require('glob');
const Mocha = require('mocha');


export function run(): Promise<void> {
	
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((c, e) => {
		glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
			if (err) {
				return e(err);
			}

			if (files.length === 0) {
				e(new Error('No test files found'));
				return;
			}
			
			// Add files to the test suite
			files.forEach((f: string) => {
				const fullPath = path.resolve(testsRoot, f);
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
