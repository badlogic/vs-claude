import * as vscode from 'vscode';
import { logger } from './logger';
import { OpenHandler } from './open-handler';
import { QueryHandler } from './query-handler';

export class TestToolWebviewProvider {
	private panel: vscode.WebviewPanel | undefined;
	private queryHandler: QueryHandler;
	private openHandler: OpenHandler;
	private workspaceRoot: string | undefined;

	constructor(private context: vscode.ExtensionContext) {
		this.queryHandler = new QueryHandler();
		this.openHandler = new OpenHandler();
		this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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
				localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, '')],
			}
		);

		// Set the icon
		this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'logo.png');

		this.panel.webview.html = this.getWebviewContent(this.panel.webview);

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
							workspaceRoot: this.workspaceRoot,
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

	private getWebviewContent(webview: vscode.Webview): string {
		const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png'));

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
            display: flex;
            flex-direction: column;
            gap: 20px;
            max-width: 800px;
            margin: 0 auto;
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
            gap: 4px;
            margin-top: 8px;
        }

        .kind-toggle {
            padding: 3px 10px;
            background: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.2s;
            user-select: none;
        }

        .kind-toggle:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .kind-toggle.selected {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-button-background);
        }

        .kind-toggle.selected:hover {
            background: var(--vscode-button-hoverBackground);
            border-color: var(--vscode-button-hoverBackground);
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

        button:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        button.loading::after {
            content: "";
            width: 12px;
            height: 12px;
            margin-left: 8px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            display: inline-block;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover:not(:disabled) {
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


        /* Symbol tree styling */
        .symbol-tree {
            font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, monospace);
            font-size: 12px;
            line-height: 1.8;
            overflow-x: auto;
        }

        .symbol-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 2px 4px;
            border-radius: 3px;
            cursor: default;
            transition: background-color 0.1s;
            white-space: nowrap;
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
            <img class="logo" src="${logoUri}" alt="VS Claude">
            VS Claude Test Tool
        </h1>

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
                    <div class="multi-select" id="symbols-kinds">
                        <div class="kind-toggle" data-kind="class">Class</div>
                        <div class="kind-toggle" data-kind="interface">Interface</div>
                        <div class="kind-toggle" data-kind="struct">Struct</div>
                        <div class="kind-toggle" data-kind="enum">Enum</div>
                        <div class="kind-toggle" data-kind="method">Method</div>
                        <div class="kind-toggle" data-kind="function">Function</div>
                        <div class="kind-toggle" data-kind="constructor">Constructor</div>
                        <div class="kind-toggle" data-kind="property">Property</div>
                        <div class="kind-toggle" data-kind="field">Field</div>
                        <div class="kind-toggle" data-kind="variable">Variable</div>
                        <div class="kind-toggle" data-kind="constant">Constant</div>
                        <div class="kind-toggle" data-kind="enummember">Enum Member</div>
                        <div class="kind-toggle" data-kind="operator">Operator</div>
                        <div class="kind-toggle" data-kind="type">Type</div>
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
                        <option value="enummember">Enum Members</option>
                        <option value="operator">Operators</option>
                        <option value="type">Types</option>
                    </select>
                </div>
                
                <div class="button-group">
                    <button onclick="runOutlineQuery()">Run Query</button>
                    <button class="secondary" onclick="clearOutline()">Clear</button>
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
                </div>
                
                <div id="diagnostics-result" class="result-container"></div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let workspaceRoot = '';

        // Initialize
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'queryResult':
                    workspaceRoot = message.workspaceRoot || '';
                    handleQueryResult(message.result, message.queryType);
                    break;
            }
        });

        function makeRelativePath(absolutePath) {
            if (!workspaceRoot || !absolutePath) return absolutePath;
            if (absolutePath.startsWith(workspaceRoot)) {
                return absolutePath.substring(workspaceRoot.length + 1);
            }
            return absolutePath;
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
        
        function formatSymbolTree(symbols, level = 0, rootPath = null) {
            if (!Array.isArray(symbols)) return '';
            
            return symbols.map(symbol => {
                const indent = '  '.repeat(level);
                const location = symbol.location;
                
                // Parse location - can be either "path:line:col-endLine:endCol" or "line:col-endLine:endCol"
                let path, line, column, displayLocation;
                
                // Try to match full path format first
                let match = location.match(/^(.+?):(\d+):(\d+)-\d+:\d+$/);
                if (match) {
                    // Has full path
                    path = match[1];
                    line = match[2];
                    column = match[3];
                    displayLocation = location;
                } else {
                    // Try range-only format (no path)
                    match = location.match(/^(\d+):(\d+)-\d+:\d+$/);
                    if (match) {
                        path = rootPath || '';
                        line = match[1];
                        column = match[2];
                        displayLocation = location;
                    } else {
                        // Fallback
                        path = rootPath || '';
                        line = '1';
                        column = '1';
                        displayLocation = location;
                    }
                }
                
                // Set rootPath for children if this is root level
                const currentRootPath = level === 0 ? path : rootPath;
                
                const kindClass = \`symbol-kind-\${symbol.kind.toLowerCase()}\`;
                const hasChildren = symbol.children && symbol.children.length > 0;
                
                // Make display location relative for root level paths
                if (level === 0 && path) {
                    const relativePath = makeRelativePath(path);
                    displayLocation = displayLocation.replace(path, relativePath);
                }
                
                let html = \`<div class="symbol-item" style="margin-left: \${level * 20}px;">
                    <span class="symbol-icon \${kindClass}">\${getSymbolIcon(symbol.kind)}</span>
                    <span class="symbol-name">\${symbol.name}</span>
                    <span class="symbol-kind">\${symbol.kind}</span>
                    <span class="symbol-location location-link" data-path="\${path}" data-line="\${line}" data-column="\${column}">\${displayLocation}</span>
                </div>\`;
                
                if (hasChildren) {
                    html += formatSymbolTree(symbol.children, level + 1, currentRootPath);
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

            // Clear loading state from button
            const section = resultEl.closest('.query-section');
            const button = section.querySelector('button.loading');
            if (button) {
                setButtonLoading(button, false);
            }

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
        function setButtonLoading(button, loading) {
            if (loading) {
                button.disabled = true;
                button.classList.add('loading');
                // Disable all buttons in the same section
                const section = button.closest('.query-section');
                section.querySelectorAll('button').forEach(btn => btn.disabled = true);
            } else {
                button.disabled = false;
                button.classList.remove('loading');
                // Re-enable all buttons in the same section
                const section = button.closest('.query-section');
                section.querySelectorAll('button').forEach(btn => btn.disabled = false);
            }
        }

        function runSymbolsQuery() {
            const button = event.target;
            setButtonLoading(button, true);
            
            const query = document.getElementById('symbols-query').value || '*';
            const path = document.getElementById('symbols-path').value;
            const exclude = document.getElementById('symbols-exclude').value;
            const countOnly = document.getElementById('symbols-countOnly').checked;
            
            const kinds = [];
            document.querySelectorAll('.kind-toggle.selected').forEach(toggle => {
                kinds.push(toggle.dataset.kind);
            });
            
            const request = { type: 'symbols', query };
            if (path) request.path = path;
            if (kinds.length > 0) request.kind = kinds.join(',');
            if (exclude) request.exclude = exclude.split(',').map(p => p.trim());
            if (countOnly) request.countOnly = true;
            
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'symbols' });
        }

        function runReferencesQuery() {
            const button = event.target;
            const path = document.getElementById('references-path').value;
            const line = parseInt(document.getElementById('references-line').value);
            const column = parseInt(document.getElementById('references-column').value);
            
            if (!path || !line || !column) {
                alert('All fields are required');
                return;
            }
            
            setButtonLoading(button, true);
            const request = { type: 'references', path, line, column };
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'references' });
        }

        function runDefinitionQuery() {
            const button = event.target;
            const path = document.getElementById('definition-path').value;
            const line = parseInt(document.getElementById('definition-line').value);
            const column = parseInt(document.getElementById('definition-column').value);
            
            if (!path || !line || !column) {
                alert('All fields are required');
                return;
            }
            
            setButtonLoading(button, true);
            const request = { type: 'definition', path, line, column };
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'definition' });
        }

        function runHierarchyQuery() {
            const button = event.target;
            const type = document.getElementById('hierarchy-type').value;
            const path = document.getElementById('hierarchy-path').value;
            const line = parseInt(document.getElementById('hierarchy-line').value);
            const column = parseInt(document.getElementById('hierarchy-column').value);
            
            if (!path || !line || !column) {
                alert('All fields are required');
                return;
            }
            
            setButtonLoading(button, true);
            const request = { type, path, line, column };
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'hierarchy' });
        }

        function runOutlineQuery() {
            const button = event.target;
            const path = document.getElementById('outline-path').value;
            const symbol = document.getElementById('outline-symbol').value;
            const kind = document.getElementById('outline-kind').value;
            
            if (!path) {
                alert('File path is required');
                return;
            }
            
            setButtonLoading(button, true);
            const request = { type: 'symbols', path };
            if (symbol) request.query = symbol;
            if (kind) request.kinds = [kind];
            
            vscode.postMessage({ command: 'runQuery', query: request, queryType: 'outline' });
        }

        function runDiagnosticsQuery() {
            const button = event.target;
            const path = document.getElementById('diagnostics-path').value;
            
            setButtonLoading(button, true);
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
            document.querySelectorAll('.kind-toggle').forEach(toggle => toggle.classList.remove('selected'));
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


        // Handle clicks
        document.addEventListener('click', (e) => {
            // Handle location clicks
            if (e.target.classList.contains('location-link')) {
                const path = e.target.dataset.path;
                const line = parseInt(e.target.dataset.line) || 0;
                const column = parseInt(e.target.dataset.column) || 0;
                
                console.log('Location clicked:', { path, line, column });
                
                if (path && line > 0 && column > 0) {
                    // Auto-fill references/definition/hierarchy forms
                    ['references', 'definition', 'hierarchy'].forEach(type => {
                        const pathInput = document.getElementById(\`\${type}-path\`);
                        const lineInput = document.getElementById(\`\${type}-line\`);
                        const columnInput = document.getElementById(\`\${type}-column\`);
                        
                        if (pathInput) pathInput.value = path;
                        if (lineInput) lineInput.value = line;
                        if (columnInput) columnInput.value = column;
                    });
                    
                    // Visual feedback for symbol locations
                    if (e.target.classList.contains('symbol-location')) {
                        e.target.style.textDecoration = 'underline double';
                        setTimeout(() => {
                            e.target.style.textDecoration = '';
                        }, 200);
                    }
                } else {
                    console.error('Invalid location data:', { path, line, column });
                }
            }
            // Handle kind toggle clicks
            else if (e.target.classList.contains('kind-toggle')) {
                e.target.classList.toggle('selected');
            }
        });
    </script>
</body>
</html>`;
	}
}
