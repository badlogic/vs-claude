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
			'$(package) VS Claude Test Tool',
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
							queryType: message.queryType,
						});
						break;
					}
					case 'getActiveFile': {
						const activeEditor = vscode.window.activeTextEditor;
						if (activeEditor) {
							const position = activeEditor.selection.active;
							const wordRange = activeEditor.document.getWordRangeAtPosition(position);
							const word = wordRange ? activeEditor.document.getText(wordRange) : '';
							this.panel?.webview.postMessage({
								command: 'activeFile',
								path: activeEditor.document.uri.fsPath,
								line: position.line + 1,
								column: position.character + 1,
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

		// Request active file info
		this.panel.webview.postMessage({ command: 'ready' });
	}

	private getWebviewContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VS Claude Test Tool</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 13px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            line-height: 1.5;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        h1 {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 24px;
            color: var(--vscode-foreground);
        }
        
        .logo {
            width: 28px;
            height: 28px;
        }

        .query-sections {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }

        .query-section {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            transition: border-color 0.2s;
        }

        .query-section:hover {
            border-color: var(--vscode-focusBorder);
        }

        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        h2 {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .field-group {
            margin-bottom: 12px;
        }

        label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: var(--vscode-foreground);
            margin-bottom: 4px;
        }

        input[type="text"],
        input[type="number"],
        select {
            width: 100%;
            padding: 6px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
            font-family: inherit;
        }

        input[type="text"]:focus,
        input[type="number"]:focus,
        select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }

        input[type="checkbox"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .multi-select {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
        }

        .kind-checkbox {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
        }

        .kind-checkbox:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .kind-checkbox input {
            width: 14px;
            height: 14px;
            margin: 0;
        }

        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 16px;
        }

        button {
            padding: 6px 14px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .result-container {
            margin-top: 12px;
            max-height: 400px;
            overflow-y: auto;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 12px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            display: none;
        }

        .result-container.visible {
            display: block;
        }

        .json-key {
            color: #9CDCFE;
        }

        .json-string {
            color: #CE9178;
        }

        .json-number {
            color: #B5CEA8;
        }

        .json-boolean {
            color: #569CD6;
        }

        .json-null {
            color: #569CD6;
            opacity: 0.7;
        }

        .json-punctuation {
            color: var(--vscode-editor-foreground);
            opacity: 0.6;
        }

        .error-result {
            color: var(--vscode-errorForeground);
        }

        .location-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
            cursor: pointer;
        }

        .location-link:hover {
            color: var(--vscode-textLink-activeForeground);
        }

        .help-text {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .active-context {
            background: var(--vscode-editor-selectionBackground);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 12px;
        }

        .context-item {
            display: flex;
            gap: 8px;
            margin-bottom: 4px;
        }

        .context-label {
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
        }

        /* Symbol tree styling */
        .symbol-tree {
            font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, monospace);
            font-size: 12px;
            line-height: 1.8;
        }

        .symbol-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 2px 4px;
            border-radius: 3px;
            cursor: default;
            transition: background-color 0.1s;
        }

        .symbol-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .symbol-icon {
            font-size: 14px;
            width: 16px;
            text-align: center;
            opacity: 0.8;
        }

        .symbol-name {
            font-weight: 500;
            color: var(--vscode-symbolIcon-textForeground);
        }

        .symbol-kind {
            font-size: 10px;
            padding: 1px 6px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 3px;
            text-transform: lowercase;
        }

        .symbol-location {
            margin-left: auto;
            font-size: 11px;
            opacity: 0.7;
        }

        /* Symbol kind colors */
        .symbol-kind-class .symbol-icon { color: var(--vscode-symbolIcon-classForeground); }
        .symbol-kind-interface .symbol-icon { color: var(--vscode-symbolIcon-interfaceForeground); }
        .symbol-kind-struct .symbol-icon { color: var(--vscode-symbolIcon-structForeground); }
        .symbol-kind-enum .symbol-icon { color: var(--vscode-symbolIcon-enumForeground); }
        .symbol-kind-method .symbol-icon { color: var(--vscode-symbolIcon-methodForeground); }
        .symbol-kind-function .symbol-icon { color: var(--vscode-symbolIcon-functionForeground); }
        .symbol-kind-constructor .symbol-icon { color: var(--vscode-symbolIcon-constructorForeground); }
        .symbol-kind-property .symbol-icon { color: var(--vscode-symbolIcon-propertyForeground); }
        .symbol-kind-field .symbol-icon { color: var(--vscode-symbolIcon-fieldForeground); }
        .symbol-kind-variable .symbol-icon { color: var(--vscode-symbolIcon-variableForeground); }
        .symbol-kind-constant .symbol-icon { color: var(--vscode-symbolIcon-constantForeground); }
        .symbol-kind-module .symbol-icon { color: var(--vscode-symbolIcon-moduleForeground); }
        .symbol-kind-namespace .symbol-icon { color: var(--vscode-symbolIcon-namespaceForeground); }
        .symbol-kind-package .symbol-icon { color: var(--vscode-symbolIcon-packageForeground); }
        .symbol-kind-enummember .symbol-icon { color: var(--vscode-symbolIcon-enumMemberForeground); }
        .symbol-kind-string .symbol-icon { color: var(--vscode-symbolIcon-stringForeground); }
        .symbol-kind-operator .symbol-icon { color: var(--vscode-symbolIcon-operatorForeground); }
        .symbol-kind-type .symbol-icon { color: var(--vscode-symbolIcon-typeParameterForeground); }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            <svg class="logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 22V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 7L12 12L2 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 17L12 12L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            VS Claude Test Tool
        </h1>
        
        <div class="active-context" id="activeContext" style="display: none;">
            <div class="context-item">
                <span class="context-label">Active File:</span>
                <span id="contextFile">-</span>
            </div>
            <div class="context-item">
                <span class="context-label">Position:</span>
                <span id="contextPosition">-</span>
            </div>
            <div class="context-item">
                <span class="context-label">Symbol:</span>
                <span id="contextSymbol">-</span>
            </div>
        </div>

        <div class="query-sections">
            <!-- Find Symbols -->
            <div class="query-section">
                <div class="section-header">
                    <h2>Find Symbols</h2>
                </div>
                
                <div class="field-group">
                    <label for="symbols-query">Query Pattern</label>
                    <input type="text" id="symbols-query" placeholder="e.g., Animation, get*, *.render">
                    <div class="help-text">Use * for wildcards, e.g., get*, Animation.*, or just *</div>
                </div>
                
                <div class="field-group">
                    <label for="symbols-path">Path (optional)</label>
                    <input type="text" id="symbols-path" placeholder="/path/to/file.ts or /path/to/folder">
                </div>
                
                <div class="field-group">
                    <label>Symbol Kinds (optional)</label>
                    <div class="multi-select">
                        <label class="kind-checkbox"><input type="checkbox" value="class"> Class</label>
                        <label class="kind-checkbox"><input type="checkbox" value="interface"> Interface</label>
                        <label class="kind-checkbox"><input type="checkbox" value="struct"> Struct</label>
                        <label class="kind-checkbox"><input type="checkbox" value="enum"> Enum</label>
                        <label class="kind-checkbox"><input type="checkbox" value="method"> Method</label>
                        <label class="kind-checkbox"><input type="checkbox" value="function"> Function</label>
                        <label class="kind-checkbox"><input type="checkbox" value="constructor"> Constructor</label>
                        <label class="kind-checkbox"><input type="checkbox" value="property"> Property</label>
                        <label class="kind-checkbox"><input type="checkbox" value="field"> Field</label>
                        <label class="kind-checkbox"><input type="checkbox" value="variable"> Variable</label>
                        <label class="kind-checkbox"><input type="checkbox" value="constant"> Constant</label>
                        <label class="kind-checkbox"><input type="checkbox" value="module"> Module</label>
                        <label class="kind-checkbox"><input type="checkbox" value="namespace"> Namespace</label>
                        <label class="kind-checkbox"><input type="checkbox" value="package"> Package</label>
                        <label class="kind-checkbox"><input type="checkbox" value="enummember"> Enum Member</label>
                        <label class="kind-checkbox"><input type="checkbox" value="string"> String</label>
                        <label class="kind-checkbox"><input type="checkbox" value="null"> Null</label>
                        <label class="kind-checkbox"><input type="checkbox" value="operator"> Operator</label>
                        <label class="kind-checkbox"><input type="checkbox" value="type"> Type</label>
                    </div>
                </div>
                
                <div class="field-group">
                    <label for="symbols-exclude">Exclude Patterns (optional)</label>
                    <input type="text" id="symbols-exclude" placeholder="**/node_modules/**, **/test/**">
                    <div class="help-text">Comma-separated glob patterns</div>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="symbols-countOnly">
                    <label for="symbols-countOnly">Count Only</label>
                </div>
                
                <div class="button-group">
                    <button onclick="runSymbolsQuery()">Run Query</button>
                    <button class="secondary" onclick="clearSymbols()">Clear</button>
                </div>
                
                <div id="symbols-result" class="result-container"></div>
            </div>

            <!-- Find References -->
            <div class="query-section">
                <div class="section-header">
                    <h2>Find References</h2>
                </div>
                
                <div class="field-group">
                    <label for="references-path">File Path</label>
                    <input type="text" id="references-path" placeholder="/path/to/file.ts" required>
                </div>
                
                <div class="field-group">
                    <label for="references-line">Line Number</label>
                    <input type="number" id="references-line" placeholder="42" min="1" required>
                </div>
                
                <div class="field-group">
                    <label for="references-column">Column Number</label>
                    <input type="number" id="references-column" placeholder="15" min="1" required>
                </div>
                
                <div class="button-group">
                    <button onclick="runReferencesQuery()">Run Query</button>
                    <button class="secondary" onclick="clearReferences()">Clear</button>
                    <button class="secondary" onclick="useActivePosition('references')">Use Active</button>
                </div>
                
                <div id="references-result" class="result-container"></div>
            </div>

            <!-- Get Definition -->
            <div class="query-section">
                <div class="section-header">
                    <h2>Get Definition</h2>
                </div>
                
                <div class="field-group">
                    <label for="definition-path">File Path</label>
                    <input type="text" id="definition-path" placeholder="/path/to/file.ts" required>
                </div>
                
                <div class="field-group">
                    <label for="definition-line">Line Number</label>
                    <input type="number" id="definition-line" placeholder="42" min="1" required>
                </div>
                
                <div class="field-group">
                    <label for="definition-column">Column Number</label>
                    <input type="number" id="definition-column" placeholder="15" min="1" required>
                </div>
                
                <div class="button-group">
                    <button onclick="runDefinitionQuery()">Run Query</button>
                    <button class="secondary" onclick="clearDefinition()">Clear</button>
                    <button class="secondary" onclick="useActivePosition('definition')">Use Active</button>
                </div>
                
                <div id="definition-result" class="result-container"></div>
            </div>

            <!-- Type Hierarchy -->
            <div class="query-section">
                <div class="section-header">
                    <h2>Type Hierarchy</h2>
                </div>
                
                <div class="field-group">
                    <label for="hierarchy-type">Hierarchy Type</label>
                    <select id="hierarchy-type">
                        <option value="supertype">Supertypes</option>
                        <option value="subtype">Subtypes</option>
                    </select>
                </div>
                
                <div class="field-group">
                    <label for="hierarchy-path">File Path</label>
                    <input type="text" id="hierarchy-path" placeholder="/path/to/file.ts" required>
                </div>
                
                <div class="field-group">
                    <label for="hierarchy-line">Line Number</label>
                    <input type="number" id="hierarchy-line" placeholder="42" min="1" required>
                </div>
                
                <div class="field-group">
                    <label for="hierarchy-column">Column Number</label>
                    <input type="number" id="hierarchy-column" placeholder="15" min="1" required>
                </div>
                
                <div class="button-group">
                    <button onclick="runHierarchyQuery()">Run Query</button>
                    <button class="secondary" onclick="clearHierarchy()">Clear</button>
                    <button class="secondary" onclick="useActivePosition('hierarchy')">Use Active</button>
                </div>
                
                <div id="hierarchy-result" class="result-container"></div>
            </div>

            <!-- File Outline -->
            <div class="query-section">
                <div class="section-header">
                    <h2>File Outline</h2>
                </div>
                
                <div class="field-group">
                    <label for="outline-path">File Path</label>
                    <input type="text" id="outline-path" placeholder="/path/to/file.ts" required>
                </div>
                
                <div class="field-group">
                    <label for="outline-symbol">Symbol Name (optional)</label>
                    <input type="text" id="outline-symbol" placeholder="ClassName">
                    <div class="help-text">Show outline for specific symbol only</div>
                </div>
                
                <div class="field-group">
                    <label for="outline-kind">Symbol Kind (optional)</label>
                    <select id="outline-kind">
                        <option value="">All</option>
                        <option value="class">Classes</option>
                        <option value="interface">Interfaces</option>
                        <option value="struct">Structs</option>
                        <option value="enum">Enums</option>
                        <option value="method">Methods</option>
                        <option value="function">Functions</option>
                        <option value="constructor">Constructors</option>
                        <option value="property">Properties</option>
                        <option value="field">Fields</option>
                        <option value="variable">Variables</option>
                        <option value="constant">Constants</option>
                        <option value="module">Modules</option>
                        <option value="namespace">Namespaces</option>
                        <option value="package">Packages</option>
                        <option value="enummember">Enum Members</option>
                        <option value="string">Strings</option>
                        <option value="null">Nulls</option>
                        <option value="operator">Operators</option>
                        <option value="type">Types</option>
                    </select>
                </div>
                
                <div class="button-group">
                    <button onclick="runOutlineQuery()">Run Query</button>
                    <button class="secondary" onclick="clearOutline()">Clear</button>
                    <button class="secondary" onclick="useActiveFile('outline')">Use Active</button>
                </div>
                
                <div id="outline-result" class="result-container"></div>
            </div>

            <!-- Diagnostics -->
            <div class="query-section">
                <div class="section-header">
                    <h2>Diagnostics</h2>
                </div>
                
                <div class="field-group">
                    <label for="diagnostics-path">File Path (optional)</label>
                    <input type="text" id="diagnostics-path" placeholder="/path/to/file.ts or leave empty for all">
                    <div class="help-text">Leave empty to get all workspace diagnostics</div>
                </div>
                
                <div class="button-group">
                    <button onclick="runDiagnosticsQuery()">Run Query</button>
                    <button class="secondary" onclick="clearDiagnostics()">Clear</button>
                    <button class="secondary" onclick="useActiveFile('diagnostics')">Use Active</button>
                </div>
                
                <div id="diagnostics-result" class="result-container"></div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let activeFile = { path: '', line: 1, column: 1, symbol: '' };

        // Initialize
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'ready':
                    vscode.postMessage({ command: 'getActiveFile' });
                    break;
                case 'activeFile':
                    activeFile = {
                        path: message.path,
                        line: message.line,
                        column: message.column,
                        symbol: message.symbol
                    };
                    updateActiveContext();
                    break;
                case 'queryResult':
                    handleQueryResult(message.result, message.queryType);
                    break;
            }
        });

        function updateActiveContext() {
            const contextEl = document.getElementById('activeContext');
            if (activeFile.path) {
                contextEl.style.display = 'block';
                document.getElementById('contextFile').textContent = activeFile.path.split('/').pop();
                document.getElementById('contextPosition').textContent = \`\${activeFile.line}:\${activeFile.column}\`;
                document.getElementById('contextSymbol').textContent = activeFile.symbol || '-';
            }
        }

        function formatJson(obj) {
            const json = JSON.stringify(obj, null, 2);
            return json
                .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
                .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
                .replace(/: (\\d+)/g, ': <span class="json-number">$1</span>')
                .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
                .replace(/: null/g, ': <span class="json-null">null</span>')
                .replace(/([{}\\[\\],])/g, '<span class="json-punctuation">$1</span>')
                // Make file paths clickable in location strings
                .replace(/\\"([^\\"]+\\.\\w+):(\\d+):(\\d+)\\"/g, '<span class="location-link" data-path="$1" data-line="$2" data-column="$3">"$1:$2:$3"</span>');
        }
        
        function formatSymbolTree(symbols, level = 0) {
            if (!Array.isArray(symbols)) return '';
            
            return symbols.map(symbol => {
                const indent = '  '.repeat(level);
                const location = symbol.location;
                // Extract path and position from location string
                const match = location.match(/^(.+?):(\\d+):(\\d+)/);
                const path = match ? match[1] : '';
                const line = match ? match[2] : '1';
                const column = match ? match[3] : '1';
                
                const kindClass = \`symbol-kind-\${symbol.kind.toLowerCase()}\`;
                const hasChildren = symbol.children && symbol.children.length > 0;
                
                let html = \`<div class="symbol-item" style="margin-left: \${level * 20}px;">
                    <span class="symbol-icon \${kindClass}">\${getSymbolIcon(symbol.kind)}</span>
                    <span class="symbol-name">\${symbol.name}</span>
                    <span class="symbol-kind">\${symbol.kind}</span>
                    <span class="symbol-location location-link" data-path="\${path}" data-line="\${line}" data-column="\${column}">\${location}</span>
                </div>\`;
                
                if (hasChildren) {
                    html += formatSymbolTree(symbol.children, level + 1);
                }
                
                return html;
            }).join('');
        }
        
        function getSymbolIcon(kind) {
            const icons = {
                'Class': '○',
                'Interface': '◇',
                'Struct': '□',
                'Enum': '∈',
                'Method': '→',
                'Function': 'ƒ',
                'Constructor': '⊕',
                'Property': '•',
                'Field': '▪',
                'Variable': '𝑥',
                'Constant': '𝐶',
                'Module': '▣',
                'Namespace': '◈',
                'Package': '📦',
                'EnumMember': '≡',
                'String': '"',
                'Null': '∅',
                'Operator': '±',
                'Type': '𝑇'
            };
            return icons[kind] || '•';
        }

        function handleQueryResult(result, queryType) {
            const resultEl = document.getElementById(\`\${queryType}-result\`);
            if (!resultEl) return;

            if (Array.isArray(result) && result.length > 0) {
                const response = result[0];
                if (response.error) {
                    resultEl.innerHTML = \`<div class="error-result">Error: \${response.error}</div>\`;
                } else if (response.result) {
                    // Special handling for symbols query
                    if (queryType === 'symbols' && Array.isArray(response.result)) {
                        resultEl.innerHTML = \`<div class="symbol-tree">\${formatSymbolTree(response.result)}</div>\`;
                    } else {
                        resultEl.innerHTML = formatJson(response.result);
                    }
                }
            } else {
                resultEl.innerHTML = '<div class="error-result">No results</div>';
            }
            
            resultEl.classList.add('visible');
        }

        // Query functions
        function runSymbolsQuery() {
            const query = document.getElementById('symbols-query').value || '*';
            const path = document.getElementById('symbols-path').value;
            const exclude = document.getElementById('symbols-exclude').value;
            const countOnly = document.getElementById('symbols-countOnly').checked;
            
            const kinds = [];
            document.querySelectorAll('.kind-checkbox input:checked').forEach(cb => {
                kinds.push(cb.value);
            });
            
            const request = { type: 'symbols', query };
            if (path) request.path = path;
            if (kinds.length > 0) request.kind = kinds.join(',');
            if (exclude) request.exclude = exclude.split(',').map(p => p.trim());
            if (countOnly) request.countOnly = true;
            
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'symbols' });
        }

        function runReferencesQuery() {
            const path = document.getElementById('references-path').value;
            const line = parseInt(document.getElementById('references-line').value);
            const column = parseInt(document.getElementById('references-column').value);
            
            if (!path || !line || !column) {
                alert('All fields are required');
                return;
            }
            
            const request = { type: 'references', path, line, column };
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'references' });
        }

        function runDefinitionQuery() {
            const path = document.getElementById('definition-path').value;
            const line = parseInt(document.getElementById('definition-line').value);
            const column = parseInt(document.getElementById('definition-column').value);
            
            if (!path || !line || !column) {
                alert('All fields are required');
                return;
            }
            
            const request = { type: 'definition', path, line, column };
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'definition' });
        }

        function runHierarchyQuery() {
            const type = document.getElementById('hierarchy-type').value;
            const path = document.getElementById('hierarchy-path').value;
            const line = parseInt(document.getElementById('hierarchy-line').value);
            const column = parseInt(document.getElementById('hierarchy-column').value);
            
            if (!path || !line || !column) {
                alert('All fields are required');
                return;
            }
            
            const request = { type, path, line, column };
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'hierarchy' });
        }

        function runOutlineQuery() {
            const path = document.getElementById('outline-path').value;
            const symbol = document.getElementById('outline-symbol').value;
            const kind = document.getElementById('outline-kind').value;
            
            if (!path) {
                alert('File path is required');
                return;
            }
            
            const request = { type: 'symbols', path };
            if (symbol) request.query = symbol;
            if (kind) request.kinds = [kind];
            
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'outline' });
        }

        function runDiagnosticsQuery() {
            const path = document.getElementById('diagnostics-path').value;
            
            const request = { type: 'diagnostics' };
            if (path) request.path = path;
            
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'diagnostics' });
        }

        // Clear functions
        function clearSymbols() {
            document.getElementById('symbols-query').value = '';
            document.getElementById('symbols-path').value = '';
            document.getElementById('symbols-exclude').value = '';
            document.getElementById('symbols-countOnly').checked = false;
            document.querySelectorAll('.kind-checkbox input').forEach(cb => cb.checked = false);
            document.getElementById('symbols-result').classList.remove('visible');
        }

        function clearReferences() {
            document.getElementById('references-path').value = '';
            document.getElementById('references-line').value = '';
            document.getElementById('references-column').value = '';
            document.getElementById('references-result').classList.remove('visible');
        }

        function clearDefinition() {
            document.getElementById('definition-path').value = '';
            document.getElementById('definition-line').value = '';
            document.getElementById('definition-column').value = '';
            document.getElementById('definition-result').classList.remove('visible');
        }

        function clearHierarchy() {
            document.getElementById('hierarchy-path').value = '';
            document.getElementById('hierarchy-line').value = '';
            document.getElementById('hierarchy-column').value = '';
            document.getElementById('hierarchy-result').classList.remove('visible');
        }

        function clearOutline() {
            document.getElementById('outline-path').value = '';
            document.getElementById('outline-symbol').value = '';
            document.getElementById('outline-kind').value = '';
            document.getElementById('outline-result').classList.remove('visible');
        }

        function clearDiagnostics() {
            document.getElementById('diagnostics-path').value = '';
            document.getElementById('diagnostics-result').classList.remove('visible');
        }

        // Use active position/file
        function useActivePosition(type) {
            if (!activeFile.path) {
                alert('No active file');
                return;
            }
            
            document.getElementById(\`\${type}-path\`).value = activeFile.path;
            if (type !== 'outline' && type !== 'diagnostics') {
                document.getElementById(\`\${type}-line\`).value = activeFile.line;
                document.getElementById(\`\${type}-column\`).value = activeFile.column;
            }
        }

        function useActiveFile(type) {
            if (!activeFile.path) {
                alert('No active file');
                return;
            }
            
            document.getElementById(\`\${type}-path\`).value = activeFile.path;
            if (type === 'outline' && activeFile.symbol) {
                document.getElementById('outline-symbol').value = activeFile.symbol;
            }
        }

        // Handle location clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('location-link')) {
                const path = e.target.dataset.path;
                const line = parseInt(e.target.dataset.line);
                const column = parseInt(e.target.dataset.column);
                
                // Auto-fill references/definition/hierarchy forms
                ['references', 'definition', 'hierarchy'].forEach(type => {
                    document.getElementById(\`\${type}-path\`).value = path;
                    document.getElementById(\`\${type}-line\`).value = line;
                    document.getElementById(\`\${type}-column\`).value = column;
                });
            } else if (e.target.classList.contains('symbol-location')) {
                // Handle clicks on symbol locations in the tree view
                const path = e.target.dataset.path;
                const line = parseInt(e.target.dataset.line);
                const column = parseInt(e.target.dataset.column);
                
                // Auto-fill references/definition/hierarchy forms
                ['references', 'definition', 'hierarchy'].forEach(type => {
                    document.getElementById(\`\${type}-path\`).value = path;
                    document.getElementById(\`\${type}-line\`).value = line;
                    document.getElementById(\`\${type}-column\`).value = column;
                });
                
                // Visual feedback
                e.target.style.textDecoration = 'underline double';
                setTimeout(() => {
                    e.target.style.textDecoration = '';
                }, 200);
            }
        });

        // Request active file on load
        vscode.postMessage({ command: 'getActiveFile' });
    </script>
</body>
</html>`;
	}
}
