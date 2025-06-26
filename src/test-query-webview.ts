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
    </style>
</head>
<body>
    <h1>VS Claude Query Tool Tester</h1>
    
    <!-- Quick Examples -->
    <div style="margin-bottom: 20px; padding: 15px; background-color: var(--vscode-textBlockQuote-background); border-radius: 4px;">
        <h3 style="margin-top: 0;">Quick Examples to Try:</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Find all classes:</strong> findSymbols query="*" kind="class"</li>
            <li><strong>Find getters in a file:</strong> outline path="/your/file.ts" symbol="get*" kind="method"</li>
            <li><strong>Find all test methods:</strong> findSymbols query="*test*" kind="method"</li>
            <li><strong>Get class structure:</strong> outline path="/your/file.ts" symbol="YourClass"</li>
            <li><strong>Find references:</strong> Use line number from findSymbols result</li>
        </ul>
    </div>

    <!-- Find Symbols -->
    <div class="query-section" id="findSymbols-section">
        <div class="query-header" onclick="toggleSection('findSymbols')">
            <h2>1. Find Symbols</h2>
            <span class="collapse-icon">▼</span>
        </div>
        <div class="query-content">
            <div class="input-group">
                <label for="findSymbols-query">Query (supports wildcards like "handle*"):</label>
                <input type="text" id="findSymbols-query" value="handle*" />
            </div>
            <div class="input-group">
                <label for="findSymbols-path">Path (optional - if provided, searches only in this file):</label>
                <input type="text" id="findSymbols-path" placeholder="/path/to/file.ts" />
            </div>
            <div class="input-group">
                <label for="findSymbols-kind">Kind (optional - filter by symbol type):</label>
                <input type="text" id="findSymbols-kind" placeholder="class,interface" />
                <small style="display: block; margin-top: 4px; color: var(--vscode-descriptionForeground);">
                    Available: module, namespace, package, class, method, property, field, constructor,
                    enum, interface, function, variable, constant, string, null, enummember, struct, operator,
                    or use "type" for all type-like symbols (class,interface,struct,enum)
                </small>
            </div>
            <div class="input-group">
                <label for="findSymbols-exact">
                    <input type="checkbox" id="findSymbols-exact" />
                    Exact match (default is contains match)
                </label>
            </div>
            <button onclick="runFindSymbols()">Run Find Symbols</button>
            <button onclick="clearResult('findSymbols')">Clear</button>
            <div id="findSymbols-result" class="result"></div>
        </div>
    </div>

    <!-- File Outline -->
    <div class="query-section" id="outline-section">
        <div class="query-header" onclick="toggleSection('outline')">
            <h2>2. Get File Outline</h2>
            <span class="collapse-icon">▼</span>
        </div>
        <div class="query-content">
            <div class="input-group">
                <label for="outline-path">File Path:</label>
                <input type="text" id="outline-path" placeholder="/path/to/file.ts" />
            </div>
            <div class="input-group">
                <label for="outline-symbol">Symbol (optional - supports wildcards like "get*", "set*"):</label>
                <input type="text" id="outline-symbol" placeholder="ClassName or get*" />
                <small style="display: block; margin-top: 4px; color: var(--vscode-descriptionForeground);">
                    Examples: "MyClass" (exact), "get*" (all getters), "*Test" (all test classes), "handle*" (all handlers)
                </small>
            </div>
            <div class="input-group">
                <label for="outline-kind">Kind (optional - filter by symbol type):</label>
                <input type="text" id="outline-kind" placeholder="method,property" />
                <small style="display: block; margin-top: 4px; color: var(--vscode-descriptionForeground);">
                    Same kinds as findSymbols. Combine with symbol for powerful filtering, e.g., symbol="get*" kind="method"
                </small>
            </div>
            <button onclick="runFileOutline()">Get File Outline</button>
            <button onclick="clearResult('outline')">Clear</button>
            <div id="outline-result" class="result"></div>
        </div>
    </div>

    <!-- Diagnostics -->
    <div class="query-section" id="diagnostics-section">
        <div class="query-header" onclick="toggleSection('diagnostics')">
            <h2>3. Get Diagnostics</h2>
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
            <h2>4. Find References</h2>
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
                    Tip: Use findSymbols first to locate a symbol, then use the line number from the result
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

        function toggleSection(sectionId) {
            const section = document.getElementById(sectionId + '-section');
            section.classList.toggle('collapsed');
        }

        function clearResult(queryType) {
            const resultDiv = document.getElementById(queryType + '-result');
            resultDiv.textContent = '';
            resultDiv.classList.remove('visible', 'success', 'error');
        }

        function runFindSymbols() {
            const query = document.getElementById('findSymbols-query').value;
            const path = document.getElementById('findSymbols-path').value;
            const kind = document.getElementById('findSymbols-kind').value;
            const exact = document.getElementById('findSymbols-exact').checked;

            const request = {
                type: 'findSymbols',
                query: query
            };

            if (path) {
                request.path = path;
            }
            if (kind) {
                request.kind = kind;
            }
            if (exact) {
                request.exact = true;
            }

            runQuery(request, 'findSymbols');
        }

        function runFileOutline() {
            const path = document.getElementById('outline-path').value;
            const symbol = document.getElementById('outline-symbol').value;
            const kind = document.getElementById('outline-kind').value;

            if (!path) {
                showError('Path is required for file outline', 'outline');
                return;
            }

            const request = {
                type: 'outline',
                path: path
            };

            if (symbol) {
                request.symbol = symbol;
            }
            if (kind) {
                request.kind = kind;
            }

            runQuery(request, 'outline');
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
                request.character = parseInt(character, 10) - 1; // Convert to 0-based
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
