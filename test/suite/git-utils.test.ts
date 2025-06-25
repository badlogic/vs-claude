import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { findGitRoot } from '../../src/git-utils';

suite('Git Utils Test Suite', () => {
    // Test with real directories that we know exist
    test('Should find git root in VS Claude project', function() {
        // This test runs in the VS Claude project which has a .git directory
        const projectRoot = path.resolve(__dirname, '..', '..', '..');
        const testPath = path.join(projectRoot, 'src', 'test');
        
        const result = findGitRoot(testPath);
        
        // Should find the project root
        assert.strictEqual(result, projectRoot);
    });

    test('Should return null when starting from system root', () => {
        // Start from a path that definitely has no git root
        const systemRoot = process.platform === 'win32' ? 'C:\\' : '/';
        
        const result = findGitRoot(systemRoot);
        
        assert.strictEqual(result, null);
    });

    test('Should handle non-existent paths gracefully', () => {
        // Test with a path that doesn't exist
        const nonExistentPath = path.join(os.tmpdir(), 'definitely-does-not-exist-' + Date.now());
        
        const result = findGitRoot(nonExistentPath);
        
        // Should return null without throwing
        assert.strictEqual(result, null);
    });

    test('Path traversal should stop at root', () => {
        // Create a deep path that doesn't exist
        const deepPath = process.platform === 'win32' 
            ? 'C:\\fake\\deep\\path\\that\\does\\not\\exist'
            : '/fake/deep/path/that/does/not/exist';
        
        // Should not throw and should return null
        const result = findGitRoot(deepPath);
        assert.strictEqual(result, null);
    });

    test('Should handle paths with special characters', () => {
        // Test with paths that have spaces and special characters
        const specialPath = path.join(os.tmpdir(), 'path with spaces', 'and-dashes', 'sub_folder');
        
        // Should handle gracefully
        const result = findGitRoot(specialPath);
        assert.strictEqual(result, null);
    });
});