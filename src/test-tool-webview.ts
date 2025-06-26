import * as vscode from 'vscode';
import { logger } from './logger';
import { OpenHandler } from './open-handler';
import { QueryHandler } from './query-handler';

export class TestToolWebviewProvider {
	private panel: vscode.WebviewPanel | undefined;
	private queryHandler: QueryHandler;
	private openHandler: OpenHandler;

	constructor(private context: vscode.ExtensionContext) {
		this.queryHandler = new QueryHandler();
		this.openHandler = new OpenHandler();
	}

	public show() {
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'vsClaudeTestTool',
			'VS Claude Test Tool',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		this.panel.webview.html = this.getWebviewContent();

		this.panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'runQuery': {
						const result = await this.queryHandler.execute(message.query);
						logger.debug('TestToolWebview', 'Query result', result);
						this.panel?.webview.postMessage({
							command: 'queryResult',
							result,
						});
						break;
					}
					case 'runOpen': {
						const result = await this.openHandler.execute(message.args);
						logger.debug('TestToolWebview', 'Open result', result);
						this.panel?.webview.postMessage({
							command: 'openResult',
							result,
						});
						break;
					}
					case 'getActiveFile': {
						const activeEditor = vscode.window.activeTextEditor;
						if (activeEditor) {
							const position = activeEditor.selection.active;
							this.panel?.webview.postMessage({
								command: 'activeFile',
								path: activeEditor.document.uri.fsPath,
								line: position.line + 1,
								column: position.character + 1,
							});
						}
						break;
					}
					case 'getWorkspaceFiles': {
						const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 20);
						const filePaths = files.map((f) => f.fsPath).sort();
						this.panel?.webview.postMessage({
							command: 'workspaceFiles',
							files: filePaths,
						});
						break;
					}
					case 'getSymbolsAtPosition': {
						const activeEditor = vscode.window.activeTextEditor;
						if (activeEditor) {
							const position = activeEditor.selection.active;
							const wordRange = activeEditor.document.getWordRangeAtPosition(position);
							const word = wordRange ? activeEditor.document.getText(wordRange) : '';
							this.panel?.webview.postMessage({
								command: 'symbolAtPosition',
								symbol: word,
							});
						}
						break;
					}
				}
			},
			undefined,
			this.context.subscriptions
		);

		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	private getWebviewContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VS Claude Test Tool</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        h1 {
            color: var(--vscode-foreground);
            font-size: 28px;
            margin: 0;
            font-weight: 600;
        }
        
        .tool-selector {
            display: flex;
            align-items: center;
            gap: 10px;
            background-color: var(--vscode-input-background);
            padding: 10px 15px;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
        }
        
        .tool-selector label {
            font-weight: 600;
            margin: 0;
        }
        
        select {
            padding: 8px 12px;
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: 14px;
            cursor: pointer;
        }
        
        .main-content {
            display: grid;
            grid-template-columns: 1fr 350px;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .editor-section {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 20px;
        }
        
        .sidebar {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .sidebar-section {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
        }
        
        .sidebar-section h3 {
            margin: 0 0 12px 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .template-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .template-button {
            padding: 8px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            text-align: left;
            transition: background-color 0.1s;
        }
        
        .template-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .template-button.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .template-button.primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .editor-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }
        
        .editor-actions {
            display: flex;
            gap: 8px;
        }
        
        .icon-button {
            padding: 6px;
            background-color: transparent;
            color: var(--vscode-foreground);
            border: 1px solid transparent;
            border-radius: 3px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            transition: background-color 0.1s;
        }
        
        .icon-button:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
            border-color: var(--vscode-toolbar-hoverBorder);
        }
        
        .json-editor {
            width: 100%;
            min-height: 300px;
            padding: 12px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            resize: vertical;
            tab-size: 2;
        }
        
        .json-editor:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .action-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.1s;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .result-section {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            display: none;
        }
        
        .result-section.visible {
            display: block;
        }
        
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .result-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }
        
        .result-content {
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-x: auto;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .success {
            color: var(--vscode-testing-iconPassed);
        }
        
        .error {
            color: var(--vscode-testing-iconFailed);
        }
        
        .history-item {
            padding: 8px 12px;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .history-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .history-item-type {
            font-weight: 600;
            color: var(--vscode-symbolIcon-variableForeground);
        }
        
        .tooltip {
            position: relative;
            display: inline-block;
        }
        
        .tooltip .tooltiptext {
            visibility: hidden;
            width: 250px;
            background-color: var(--vscode-editorHoverWidget-background);
            color: var(--vscode-editorHoverWidget-foreground);
            border: 1px solid var(--vscode-editorHoverWidget-border);
            text-align: left;
            border-radius: 4px;
            padding: 8px 12px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -125px;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
        }
        
        .tooltip:hover .tooltiptext {
            visibility: visible;
        }
        
        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 6px;
        }
        
        .divider {
            height: 1px;
            background-color: var(--vscode-panel-border);
            margin: 12px 0;
        }
        
        .active-file-info {
            background-color: var(--vscode-editor-selectionBackground);
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.5;
        }
        
        @media (max-width: 900px) {
            .main-content {
                grid-template-columns: 1fr;
            }
            
            .sidebar {
                order: -1;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>VS Claude Test Tool</h1>
        <div class="tool-selector">
            <label for="toolSelect">Tool:</label>
            <select id="toolSelect" onchange="switchTool()">
                <option value="open">Open</option>
                <option value="query">Query</option>
            </select>
        </div>
        <button class="icon-button tooltip" onclick="loadFromClipboard()" style="margin-left: auto;">
            <span>Clipboard</span>
            <span class="tooltiptext">Load JSON from clipboard</span>
        </button>
    </div>
    
    <div class="main-content">
        <div class="editor-section">
            <div class="editor-header">
                <h2 class="editor-title" id="editorTitle">Open Tool Arguments</h2>
                <div class="editor-actions">
                    <button class="icon-button tooltip" onclick="formatJSON()">
                        <span>{ }</span>
                        <span class="tooltiptext">Format JSON (Ctrl+Shift+F)</span>
                    </button>
                    <button class="icon-button tooltip" onclick="clearEditor()">
                        <span>✕</span>
                        <span class="tooltiptext">Clear editor</span>
                    </button>
                </div>
            </div>
            
            <textarea id="jsonEditor" class="json-editor" placeholder="Enter tool arguments as JSON..." spellcheck="false"></textarea>
            
            <p class="help-text" id="helpText">
                Enter a single item object or an array of items. Use the templates on the right for quick examples.
            </p>
            
            <div class="action-buttons">
                <button onclick="runTool()">Run Tool</button>
                <button class="secondary" onclick="validateJSON()">Validate JSON</button>
            </div>
        </div>
        
        <div class="sidebar">
            <!-- Active File Section -->
            <div class="sidebar-section">
                <h3>Context</h3>
                <div id="activeFileIndicator" class="help-text">
                    <p>No active file</p>
                </div>
            </div>
            
            <!-- Templates Section -->
            <div class="sidebar-section" id="templatesSection">
                <h3>Templates</h3>
                <div class="template-list" id="openTemplates">
                    <button class="template-button" onclick="insertTemplate('openSingleFile')">Single File</button>
                    <button class="template-button" onclick="insertTemplate('openFileWithLines')">File with Line Range</button>
                    <button class="template-button" onclick="insertTemplate('openMultipleFiles')">Multiple Files</button>
                    <button class="template-button" onclick="insertTemplate('openDiff')">Compare Files</button>
                    <button class="template-button" onclick="insertTemplate('openGitDiffWorking')">Git Diff (Working)</button>
                    <button class="template-button" onclick="insertTemplate('openGitDiffStaged')">Git Diff (Staged)</button>
                    <button class="template-button" onclick="insertTemplate('openGitDiffCommits')">Git Diff (Commits)</button>
                    <button class="template-button" onclick="insertTemplate('openSymbol')">Open Symbol</button>
                    <button class="template-button primary" onclick="insertTemplate('openCurrentFile')">Use Current File</button>
                </div>
                
                <div class="template-list" id="queryTemplates" style="display: none;">
                    <button class="template-button" onclick="insertTemplate('queryAllSymbols')">All Symbols</button>
                    <button class="template-button" onclick="insertTemplate('queryFindClass')">Find Classes</button>
                    <button class="template-button" onclick="insertTemplate('queryFindMethods')">Find Methods</button>
                    <button class="template-button" onclick="insertTemplate('queryFileOutline')">File Outline</button>
                    <button class="template-button" onclick="insertTemplate('queryDiagnostics')">Get Diagnostics</button>
                    <button class="template-button" onclick="insertTemplate('queryReferences')">Find References</button>
                    <button class="template-button" onclick="insertTemplate('queryMultiple')">Multiple Queries</button>
                    <button class="template-button" onclick="insertTemplate('queryCurrentSymbol')">Current Symbol Refs</button>
                    <button class="template-button primary" onclick="insertTemplate('queryCurrentFile')">Use Current File</button>
                </div>
            </div>
            
            <!-- Quick Insert Section -->
            <div class="sidebar-section">
                <h3>Quick Insert</h3>
                <div id="quickInsertOpen" class="template-list">
                    <button class="template-button" onclick="insertSnippet('fileItem')">File Item</button>
                    <button class="template-button" onclick="insertSnippet('diffItem')">Diff Item</button>
                    <button class="template-button" onclick="insertSnippet('gitDiffItem')">Git Diff Item</button>
                </div>
                
                <div id="quickInsertQuery" class="template-list" style="display: none;">
                    <button class="template-button" onclick="insertSnippet('symbolsQuery')">Symbols Query</button>
                    <button class="template-button" onclick="insertSnippet('fileOutlineQuery')">File Outline</button>
                    <button class="template-button" onclick="insertSnippet('referencesQuery')">References Query</button>
                    <button class="template-button" onclick="insertSnippet('diagnosticsQuery')">Diagnostics Query</button>
                </div>
            </div>
            
            <!-- History Section -->
            <div class="sidebar-section">
                <h3>Recent Commands</h3>
                <div id="historyList" class="template-list">
                    <p class="help-text">No recent commands</p>
                </div>
            </div>
        </div>
    </div>
    
    <div class="result-section" id="resultSection">
        <div class="result-header">
            <h2 class="result-title">Result</h2>
            <div class="editor-actions">
                <button class="icon-button tooltip" onclick="copyResult()">
                    <span>📋</span>
                    <span class="tooltiptext">Copy result</span>
                </button>
                <button class="icon-button tooltip" onclick="clearResult()">
                    <span>✕</span>
                    <span class="tooltiptext">Clear result</span>
                </button>
            </div>
        </div>
        <pre class="result-content" id="resultContent"></pre>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentTool = 'open';
        let currentFilePath = '';
        let currentLine = 1;
        let currentColumn = 1;
        let currentSymbol = '';
        let workspaceFiles = [];
        let commandHistory = [];
        
        // Initialize
        window.addEventListener('load', () => {
            loadHistory();
            vscode.postMessage({ command: 'getActiveFile' });
            vscode.postMessage({ command: 'getWorkspaceFiles' });
            vscode.postMessage({ command: 'getSymbolsAtPosition' });
            
            // Add keyboard shortcuts
            document.getElementById('jsonEditor').addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                    e.preventDefault();
                    formatJSON();
                }
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    runTool();
                }
            });
            
            // Auto-save to localStorage
            document.getElementById('jsonEditor').addEventListener('input', () => {
                localStorage.setItem('vsClaudeTestToolLastContent', document.getElementById('jsonEditor').value);
            });
            
            // Restore last content
            const lastContent = localStorage.getItem('vsClaudeTestToolLastContent');
            if (lastContent) {
                document.getElementById('jsonEditor').value = lastContent;
            }
        });
        
        // Tool switching
        function switchTool() {
            currentTool = document.getElementById('toolSelect').value;
            document.getElementById('editorTitle').textContent = currentTool === 'open' ? 'Open Tool Arguments' : 'Query Tool Arguments';
            
            // Toggle templates
            document.getElementById('openTemplates').style.display = currentTool === 'open' ? 'flex' : 'none';
            document.getElementById('queryTemplates').style.display = currentTool === 'query' ? 'flex' : 'none';
            
            // Toggle quick insert
            document.getElementById('quickInsertOpen').style.display = currentTool === 'open' ? 'flex' : 'none';
            document.getElementById('quickInsertQuery').style.display = currentTool === 'query' ? 'flex' : 'none';
            
            // Update help text
            const helpText = currentTool === 'open' 
                ? 'Enter a single item object or an array of items. Use the templates on the right for quick examples.'
                : 'Enter a single query object or an array of query objects. Use the templates for common patterns.';
            document.getElementById('helpText').textContent = helpText;
        }
        
        // Templates
        const templates = {
            // Open templates
            openSingleFile: {
                type: 'file',
                path: '/path/to/file.ts'
            },
            openFileWithLines: {
                type: 'file',
                path: '/path/to/file.ts',
                startLine: 10,
                endLine: 20
            },
            openMultipleFiles: [
                { type: 'file', path: '/path/to/file1.ts' },
                { type: 'file', path: '/path/to/file2.ts', startLine: 42 }
            ],
            openDiff: {
                type: 'diff',
                left: '/path/to/old.ts',
                right: '/path/to/new.ts',
                title: 'Compare Changes'
            },
            openGitDiffWorking: {
                type: 'gitDiff',
                path: '/path/to/file.ts',
                from: 'HEAD',
                to: 'working'
            },
            openGitDiffStaged: {
                type: 'gitDiff',
                path: '/path/to/file.ts',
                from: 'HEAD',
                to: 'staged'
            },
            openGitDiffCommits: {
                type: 'gitDiff',
                path: '/path/to/file.ts',
                from: 'HEAD~1',
                to: 'HEAD'
            },
            openCurrentFile: {
                type: 'file',
                path: ''
            },
            openSymbol: {
                type: 'symbol',
                query: ''
            },
            
            // Query templates
            queryAllSymbols: {
                type: 'findSymbols',
                query: '*'
            },
            queryFindClass: {
                type: 'findSymbols',
                query: 'MyClass',
                kind: 'class'
            },
            queryFindMethods: {
                type: 'findSymbols',
                query: 'get*',
                kind: 'method'
            },
            queryFileOutline: {
                type: 'fileOutline',
                path: '/path/to/file.ts'
            },
            queryDiagnostics: {
                type: 'diagnostics'
            },
            queryReferences: {
                type: 'references',
                symbol: 'myFunction'
            },
            queryMultiple: [
                { type: 'findSymbols', query: 'Animation', kind: 'class' },
                { type: 'fileOutline', path: '/path/to/file.ts', symbol: 'Animation' },
                { type: 'diagnostics' }
            ],
            queryCurrentFile: {
                type: 'fileOutline',
                path: ''
            },
            queryCurrentSymbol: {
                type: 'references',
                symbol: ''
            }
        };
        
        // Snippets
        const snippets = {
            fileItem: {
                type: 'file',
                path: '/path/to/file.ts',
                startLine: 1,
                endLine: 10
            },
            diffItem: {
                type: 'diff',
                left: '/path/to/old.ts',
                right: '/path/to/new.ts'
            },
            gitDiffItem: {
                type: 'gitDiff',
                path: '/path/to/file.ts',
                from: 'HEAD',
                to: 'working'
            },
            symbolsQuery: {
                type: 'findSymbols',
                query: '*',
                kind: 'class'
            },
            fileOutlineQuery: {
                type: 'fileOutline',
                path: '/path/to/file.ts'
            },
            referencesQuery: {
                type: 'references',
                symbol: 'mySymbol'
            },
            diagnosticsQuery: {
                type: 'diagnostics',
                path: '/path/to/file.ts'
            }
        };
        
        function insertTemplate(templateName) {
            let template = templates[templateName];
            
            // Handle current file templates
            if (templateName === 'openCurrentFile' && currentFilePath) {
                template = { ...template, path: currentFilePath };
            }
            if (templateName === 'queryCurrentFile' && currentFilePath) {
                template = { ...template, path: currentFilePath };
            }
            if (templateName === 'openSymbol' && currentSymbol) {
                template = { ...template, query: currentSymbol };
            }
            if (templateName === 'queryCurrentSymbol' && currentSymbol) {
                template = { ...template, symbol: currentSymbol };
            }
            
            const editor = document.getElementById('jsonEditor');
            editor.value = JSON.stringify(template, null, 2);
            formatJSON();
        }
        
        function insertSnippet(snippetName) {
            const snippet = snippets[snippetName];
            const editor = document.getElementById('jsonEditor');
            
            let currentValue = editor.value.trim();
            if (!currentValue) {
                editor.value = JSON.stringify(snippet, null, 2);
            } else {
                try {
                    const current = JSON.parse(currentValue);
                    if (Array.isArray(current)) {
                        current.push(snippet);
                        editor.value = JSON.stringify(current, null, 2);
                    } else {
                        editor.value = JSON.stringify([current, snippet], null, 2);
                    }
                } catch (e) {
                    // If current value is invalid JSON, replace it
                    editor.value = JSON.stringify(snippet, null, 2);
                }
            }
            formatJSON();
        }
        
        function formatJSON() {
            const editor = document.getElementById('jsonEditor');
            try {
                const json = JSON.parse(editor.value);
                editor.value = JSON.stringify(json, null, 2);
                editor.style.borderColor = '';
            } catch (e) {
                editor.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
            }
        }
        
        function validateJSON() {
            const editor = document.getElementById('jsonEditor');
            try {
                JSON.parse(editor.value);
                showResult('Valid JSON!', 'success');
            } catch (e) {
                showResult('Invalid JSON: ' + e.message, 'error');
            }
        }
        
        function clearEditor() {
            document.getElementById('jsonEditor').value = '';
            document.getElementById('jsonEditor').style.borderColor = '';
        }
        
        function runTool() {
            const editor = document.getElementById('jsonEditor');
            let args;
            
            try {
                args = JSON.parse(editor.value);
            } catch (e) {
                showResult('Invalid JSON: ' + e.message, 'error');
                return;
            }
            
            // Save to history
            addToHistory(currentTool, args);
            
            // Show loading
            showResult('Running ' + currentTool + ' tool...', '');
            
            // Send message
            if (currentTool === 'open') {
                vscode.postMessage({
                    command: 'runOpen',
                    args: args
                });
            } else {
                vscode.postMessage({
                    command: 'runQuery',
                    query: args
                });
            }
        }
        
        function showResult(content, className) {
            const resultSection = document.getElementById('resultSection');
            const resultContent = document.getElementById('resultContent');
            
            resultSection.classList.add('visible');
            resultContent.textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            resultContent.className = 'result-content ' + className;
        }
        
        function clearResult() {
            document.getElementById('resultSection').classList.remove('visible');
        }
        
        function copyResult() {
            const content = document.getElementById('resultContent').textContent;
            navigator.clipboard.writeText(content).then(() => {
                // Show feedback
                const button = event.target.closest('.icon-button');
                const originalText = button.querySelector('span').textContent;
                button.querySelector('span').textContent = '✓';
                setTimeout(() => {
                    button.querySelector('span').textContent = originalText;
                }, 1000);
            });
        }
        
        // History management
        function addToHistory(tool, args) {
            const item = {
                tool: tool,
                args: args,
                timestamp: Date.now()
            };
            
            commandHistory.unshift(item);
            if (commandHistory.length > 10) {
                commandHistory = commandHistory.slice(0, 10);
            }
            
            saveHistory();
            updateHistoryUI();
        }
        
        function saveHistory() {
            localStorage.setItem('vsClaudeTestToolHistory', JSON.stringify(commandHistory));
        }
        
        function loadHistory() {
            const saved = localStorage.getItem('vsClaudeTestToolHistory');
            if (saved) {
                try {
                    commandHistory = JSON.parse(saved);
                    updateHistoryUI();
                } catch (e) {
                    commandHistory = [];
                }
            }
        }
        
        function updateHistoryUI() {
            const historyList = document.getElementById('historyList');
            if (commandHistory.length === 0) {
                historyList.innerHTML = '<p class="help-text">No recent commands</p>';
                return;
            }
            
            historyList.innerHTML = commandHistory.map((item, index) => {
                const preview = JSON.stringify(item.args).substring(0, 50) + '...';
                return \`<div class="history-item" onclick="loadFromHistory(\${index})">
                    <span class="history-item-type">\${item.tool}</span> - \${preview}
                </div>\`;
            }).join('');
        }
        
        function loadFromHistory(index) {
            const item = commandHistory[index];
            document.getElementById('toolSelect').value = item.tool;
            switchTool();
            document.getElementById('jsonEditor').value = JSON.stringify(item.args, null, 2);
        }
        
        // Message handling
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'queryResult':
                    handleQueryResult(message.result);
                    break;
                case 'openResult':
                    handleOpenResult(message.result);
                    break;
                case 'activeFile':
                    currentFilePath = message.path;
                    currentLine = message.line || 1;
                    currentColumn = message.column || 1;
                    updateActiveFileIndicator();
                    break;
                case 'workspaceFiles':
                    workspaceFiles = message.files;
                    break;
                case 'symbolAtPosition':
                    currentSymbol = message.symbol;
                    updateActiveFileIndicator();
                    break;
            }
        });
        
        function handleQueryResult(result) {
            if (Array.isArray(result) && result.length > 0) {
                const response = result[0];
                if (response.error) {
                    showResult('Error: ' + response.error, 'error');
                } else if (response.result) {
                    showResult(response.result, 'success');
                } else {
                    showResult('Error: Invalid response format', 'error');
                }
            } else {
                showResult('Error: No response received', 'error');
            }
        }
        
        function handleOpenResult(result) {
            if (result.success) {
                showResult('Successfully opened items!', 'success');
            } else {
                showResult('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        }
        
        function updateActiveFileIndicator() {
            const indicator = document.getElementById('activeFileIndicator');
            if (!indicator) return;
            
            if (currentFilePath) {
                const fileName = currentFilePath.split('/').pop();
                indicator.innerHTML = \`
                    <div class="active-file-info">
                        <strong>Active:</strong> \${fileName} (\${currentLine}:\${currentColumn})
                        \${currentSymbol ? \`<br><strong>Symbol:</strong> \${currentSymbol}\` : ''}
                    </div>
                \`;
            }
        }
        
        function loadFromClipboard() {
            navigator.clipboard.readText().then(text => {
                try {
                    const json = JSON.parse(text);
                    document.getElementById('jsonEditor').value = JSON.stringify(json, null, 2);
                    formatJSON();
                } catch (e) {
                    showResult('Invalid JSON in clipboard: ' + e.message, 'error');
                }
            }).catch(err => {
                showResult('Failed to read clipboard: ' + err.message, 'error');
            });
        }
    </script>
</body>
</html>`;
	}
}
