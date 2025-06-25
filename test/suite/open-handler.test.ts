import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { OpenHandler } from '../../src/open-handler';

suite('OpenHandler Test Suite', () => {
    let outputChannel: vscode.OutputChannel;
    let openHandler: OpenHandler;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        // Create a mock output channel
        outputChannel = {
            name: 'Test',
            append: sandbox.stub(),
            appendLine: sandbox.stub(),
            clear: sandbox.stub(),
            dispose: sandbox.stub(),
            hide: sandbox.stub(),
            show: sandbox.stub(),
            replace: sandbox.stub()
        } as vscode.OutputChannel;
        
        openHandler = new OpenHandler(outputChannel);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should handle single file item', async () => {
        // Mock VS Code APIs
        const mockDoc = {
            lineAt: sandbox.stub().returns({ text: 'test line' })
        };
        const mockEditor = {
            selection: null,
            selections: [],
            revealRange: sandbox.stub()
        };
        
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDoc as any);
        sandbox.stub(vscode.window, 'showTextDocument').resolves(mockEditor as any);

        const result = await openHandler.execute({
            type: 'file',
            path: '/test/file.ts',
            startLine: 10,
            endLine: 20
        });

        assert.strictEqual(result.success, true);
        assert.ok(!result.error);
        
        // Verify the file was opened
        assert.ok((vscode.workspace.openTextDocument as sinon.SinonStub).calledOnce);
        assert.ok((vscode.window.showTextDocument as sinon.SinonStub).calledOnce);
    });

    test('Should group multiple file items by path', async () => {
        // Mock VS Code APIs
        const mockDoc = {
            lineAt: sandbox.stub().returns({ text: 'test line' })
        };
        const mockEditor = {
            selection: null,
            selections: [],
            revealRange: sandbox.stub()
        };
        
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDoc as any);
        sandbox.stub(vscode.window, 'showTextDocument').resolves(mockEditor as any);

        const result = await openHandler.execute([
            { type: 'file', path: '/test/same.ts', startLine: 10, endLine: 20 },
            { type: 'file', path: '/test/same.ts', startLine: 30, endLine: 40 },
            { type: 'file', path: '/test/different.ts', startLine: 1, endLine: 5 }
        ]);

        assert.strictEqual(result.success, true);
        
        // Should open same.ts once with multiple selections, and different.ts once
        assert.strictEqual((vscode.workspace.openTextDocument as sinon.SinonStub).callCount, 2);
        assert.strictEqual((vscode.window.showTextDocument as sinon.SinonStub).callCount, 2);
    });

    test('Should handle errors gracefully', async () => {
        // Make openTextDocument throw an error
        sandbox.stub(vscode.workspace, 'openTextDocument').rejects(new Error('File not found'));

        const result = await openHandler.execute({
            type: 'file',
            path: '/test/nonexistent.ts'
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
        assert.ok(result.error.includes('File not found'));
    });

    test('Should handle preview mode', async () => {
        // Mock VS Code APIs
        const mockDoc = {};
        const mockEditor = {
            selection: null,
            selections: [],
            revealRange: sandbox.stub()
        };
        
        const openTextDocStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDoc as any);
        const showTextDocStub = sandbox.stub(vscode.window, 'showTextDocument').resolves(mockEditor as any);

        await openHandler.execute({
            type: 'file',
            path: '/test/file.ts',
            preview: true
        });

        // Check that preview mode was passed correctly
        const showTextDocCall = showTextDocStub.getCall(0);
        assert.ok(showTextDocCall, 'showTextDocument should have been called');
        assert.strictEqual(showTextDocCall.args[1]?.preview, true);
        assert.strictEqual(showTextDocCall.args[1]?.preserveFocus, true);
    });
});