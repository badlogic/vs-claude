import * as vscode from 'vscode';
import { QueryHandler } from './query-handler';

export class TestQueryWebviewProvider {
	private panel: vscode.WebviewPanel | undefined;
	private queryHandler: QueryHandler;

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel
	) {
		this.queryHandler = new QueryHandler(outputChannel);
	}

	public show() {
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'vsClaudeTestQuery',
			'VS Claude Query Tester',
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
						this.outputChannel.appendLine(JSON.stringify(result, null, 2));
						this.panel?.webview.postMessage({
							command: 'queryResult',
							result,
						});
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
    <title>VS Claude Query Tester</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        h1 {
            color: var(--vscode-foreground);
            font-size: 24px;
            margin-bottom: 20px;
        }
        .query-section {
            margin-bottom: 20px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            overflow: hidden;
        }
        .query-header {
            padding: 15px;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .query-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .query-header h2 {
            font-size: 18px;
            margin: 0;
        }
        .collapse-icon {
            transition: transform 0.2s;
        }
        .collapsed .collapse-icon {
            transform: rotate(-90deg);
        }
        .query-content {
            padding: 0 15px 15px 15px;
            display: block;
        }
        .collapsed .query-content {
            display: none;
        }
        .input-group {
            margin-bottom: 10px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"], select {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
        }
        input[type="checkbox"] {
            margin-right: 8px;
            vertical-align: middle;
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            margin-right: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .result {
            margin-top: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-x: auto;
            display: none;
        }
        .result.visible {
            display: block;
        }
        .success {
            color: var(--vscode-testing-iconPassed);
        }
        .error {
            color: var(--vscode-testing-iconFailed);
        }
        .tag-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
        }
        .kind-tag {
            display: inline-block;
            padding: 4px 8px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 3px;
            font-size: 12px;
            cursor: pointer;
        }
        .kind-tag.selected {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
    </style>
</head>
<body>
    <h1>VS Claude Query Tool Tester</h1>
    
    <!-- Quick Examples -->
    <div style="margin-bottom: 20px; padding: 15px; background-color: var(--vscode-textBlockQuote-background); border-radius: 4px;">
        <h3 style="margin-top: 0;">Quick Examples to Try:</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>All symbols in workspace:</strong> symbols (no parameters)</li>
            <li><strong>Find all classes:</strong> symbols query="*" kinds=["class"]</li>
            <li><strong>Find getters in a specific class:</strong> symbols query="Animation.get*"</li>
            <li><strong>Get file structure:</strong> symbols path="/your/file.ts"</li>
            <li><strong>Find test classes:</strong> symbols query="*Test" kinds=["class"]</li>
            <li><strong>Find getters and setters:</strong> symbols query="{get,set}*" kinds=["method"]</li>
            <li><strong>List only top-level types:</strong> symbols path="/your/file.ts" depth=1</li>
            <li><strong>Find services in folder:</strong> symbols path="/src" query="*Service"</li>
        </ul>
    </div>

    <!-- Symbols -->
    <div class="query-section" id="symbols-section">
        <div class="query-header" onclick="toggleSection('symbols')">
            <h2>1. Symbols (Unified Search)</h2>
            <span class="collapse-icon">▼</span>
        </div>
        <div class="query-content">
            <div class="input-group">
                <label for="symbols-query">Query (optional - supports glob patterns and hierarchical queries):</label>
                <input type="text" id="symbols-query" placeholder="* or get* or Animation.get*" />
                <small style="display: block; margin-top: 4px; color: var(--vscode-descriptionForeground);">
                    Patterns: * (any), ? (one char), [abc] (any of), {get,set}* (alternatives)<br>
                    Hierarchical: Animation.get* (getters in Animation), *.toString (toString in any class)
                </small>
            </div>
            <div class="input-group">
                <label for="symbols-path">Path (optional - file or folder path):</label>
                <input type="text" id="symbols-path" placeholder="/path/to/file.ts or /path/to/folder" />
                <small style="display: block; margin-top: 4px; color: var(--vscode-descriptionForeground);">
                    Leave empty for workspace search, provide file path for file structure, or folder path to limit search
                </small>
            </div>
            <div class="input-group">
                <label for="symbols-kinds">Kinds (optional - select symbol types to filter):</label>
                <div class="tag-list" id="symbols-kinds-tags">
                    <span class="kind-tag" data-kind="module">module</span>
                    <span class="kind-tag" data-kind="namespace">namespace</span>
                    <span class="kind-tag" data-kind="package">package</span>
                    <span class="kind-tag" data-kind="class">class</span>
                    <span class="kind-tag" data-kind="method">method</span>
                    <span class="kind-tag" data-kind="property">property</span>
                    <span class="kind-tag" data-kind="field">field</span>
                    <span class="kind-tag" data-kind="constructor">constructor</span>
                    <span class="kind-tag" data-kind="enum">enum</span>
                    <span class="kind-tag" data-kind="interface">interface</span>
                    <span class="kind-tag" data-kind="function">function</span>
                    <span class="kind-tag" data-kind="variable">variable</span>
                    <span class="kind-tag" data-kind="constant">constant</span>
                    <span class="kind-tag" data-kind="struct">struct</span>
                    <span class="kind-tag" data-kind="type">type</span>
                </div>
                <input type="hidden" id="symbols-kinds" />
            </div>
            <div class="input-group">
                <label for="symbols-depth">Depth (optional - limit tree depth):</label>
                <input type="text" id="symbols-depth" placeholder="1 for top-level only" />
            </div>
            <button onclick="runSymbols()">Search Symbols</button>
            <button onclick="clearResult('symbols')">Clear</button>
            <div id="symbols-result" class="result"></div>
        </div>
    </div>

    <!-- Diagnostics -->
    <div class="query-section" id="diagnostics-section">
        <div class="query-header" onclick="toggleSection('diagnostics')">
            <h2>2. Get Diagnostics</h2>
            <span class="collapse-icon">▼</span>
        </div>
        <div class="query-content">
            <div class="input-group">
                <label for="diagnostics-path">Path (optional - if provided, shows only diagnostics for this file):</label>
                <input type="text" id="diagnostics-path" placeholder="/path/to/file.ts" />
            </div>
            <button onclick="runDiagnostics()">Get Diagnostics</button>
            <button onclick="clearResult('diagnostics')">Clear</button>
            <div id="diagnostics-result" class="result"></div>
        </div>
    </div>

    <!-- Find References -->
    <div class="query-section" id="references-section">
        <div class="query-header" onclick="toggleSection('references')">
            <h2>3. Find References</h2>
            <span class="collapse-icon">▼</span>
        </div>
        <div class="query-content">
            <div class="input-group">
                <label for="references-path">File Path:</label>
                <input type="text" id="references-path" placeholder="/path/to/file.ts" />
            </div>
            <div class="input-group">
                <label for="references-line">Line Number (1-based):</label>
                <input type="text" id="references-line" placeholder="42" />
            </div>
            <div class="input-group">
                <label for="references-character">Character Position (optional, 1-based):</label>
                <input type="text" id="references-character" placeholder="15" />
                <small style="display: block; margin-top: 4px; color: var(--vscode-descriptionForeground);">
                    Tip: Use symbols search first to locate a symbol, then use the line number from the result
                </small>
            </div>
            <button onclick="runReferences()">Find References</button>
            <button onclick="clearResult('references')">Clear</button>
            <div id="references-result" class="result"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentQueryType = null;
        let selectedKinds = [];

        // Initialize kind tag selection
        document.querySelectorAll('.kind-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const kind = tag.getAttribute('data-kind');
                if (tag.classList.contains('selected')) {
                    tag.classList.remove('selected');
                    selectedKinds = selectedKinds.filter(k => k !== kind);
                } else {
                    tag.classList.add('selected');
                    selectedKinds.push(kind);
                }
                document.getElementById('symbols-kinds').value = selectedKinds.join(',');
            });
        });

        function toggleSection(sectionId) {
            const section = document.getElementById(sectionId + '-section');
            section.classList.toggle('collapsed');
        }

        function clearResult(queryType) {
            const resultDiv = document.getElementById(queryType + '-result');
            resultDiv.textContent = '';
            resultDiv.classList.remove('visible', 'success', 'error');
        }

        function runSymbols() {
            const query = document.getElementById('symbols-query').value;
            const path = document.getElementById('symbols-path').value;
            const depth = document.getElementById('symbols-depth').value;

            const request = {
                type: 'symbols'
            };

            if (query) {
                request.query = query;
            }
            if (path) {
                request.path = path;
            }
            if (selectedKinds.length > 0) {
                request.kinds = selectedKinds;
            }
            if (depth) {
                request.depth = parseInt(depth, 10);
            }

            runQuery(request, 'symbols');
        }

        function runDiagnostics() {
            const path = document.getElementById('diagnostics-path').value;

            const request = {
                type: 'diagnostics'
            };

            if (path) {
                request.path = path;
            }

            runQuery(request, 'diagnostics');
        }

        function runReferences() {
            const path = document.getElementById('references-path').value;
            const line = document.getElementById('references-line').value;
            const character = document.getElementById('references-character').value;

            if (!path) {
                showError('Path is required', 'references');
                return;
            }
            if (!line) {
                showError('Line number is required', 'references');
                return;
            }

            const request = {
                type: 'references',
                path: path,
                line: parseInt(line, 10)
            };

            if (character) {
                request.character = parseInt(character, 10);
            }

            runQuery(request, 'references');
        }

        function runQuery(query, queryType) {
            currentQueryType = queryType;
            const resultDiv = document.getElementById(queryType + '-result');
            resultDiv.textContent = 'Running query...';
            resultDiv.className = 'result visible';
            vscode.postMessage({
                command: 'runQuery',
                query: query
            });
        }

        function showError(message, queryType) {
            const resultDiv = document.getElementById(queryType + '-result');
            resultDiv.className = 'result visible error';
            resultDiv.textContent = 'Error: ' + message;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'queryResult':
                    if (currentQueryType) {
                        const resultDiv = document.getElementById(currentQueryType + '-result');
                        // The result is now an array of QueryResponse objects
                        const responses = message.result;
                        if (Array.isArray(responses) && responses.length > 0) {
                            const response = responses[0]; // We only send single queries from the test UI
                            if (response.error) {
                                resultDiv.className = 'result visible error';
                                resultDiv.textContent = 'Error: ' + response.error;
                            } else if (response.result) {
                                resultDiv.className = 'result visible success';
                                // Pretty print JSON data
                                resultDiv.textContent = JSON.stringify(response.result, null, 2);
                            } else {
                                resultDiv.className = 'result visible error';
                                resultDiv.textContent = 'Error: Invalid response format';
                            }
                        } else {
                            resultDiv.className = 'result visible error';
                            resultDiv.textContent = 'Error: No response received';
                        }
                    }
                    break;
            }
        });

        // Pre-fill with current file if available
        window.addEventListener('load', () => {
            vscode.postMessage({ command: 'getActiveFile' });
        });
    </script>
</body>
</html>`;
	}
}
