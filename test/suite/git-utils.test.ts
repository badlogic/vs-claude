import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { findGitRoot } from '../../src/git-utils';

suite('Git Utils Test Suite', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should find git root in current directory', () => {
        const testPath = '/test/project';
        const gitPath = path.join(testPath, '.git');
        
        sandbox.stub(fs, 'existsSync').callsFake((p) => {
            return p === gitPath;
        });

        const result = findGitRoot(testPath);
        assert.strictEqual(result, testPath);
    });

    test('Should find git root in parent directory', () => {
        const testPath = '/test/project/src/components';
        const projectRoot = '/test/project';
        const gitPath = path.join(projectRoot, '.git');
        
        sandbox.stub(fs, 'existsSync').callsFake((p) => {
            return p === gitPath;
        });

        const result = findGitRoot(testPath);
        assert.strictEqual(result, projectRoot);
    });

    test('Should return null when no git root found', () => {
        const testPath = '/test/project/src';
        
        sandbox.stub(fs, 'existsSync').returns(false);

        const result = findGitRoot(testPath);
        assert.strictEqual(result, null);
    });
});