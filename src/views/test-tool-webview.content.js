// VS Claude Test Tool Webview JavaScript

const vscode = acquireVsCodeApi();
const selectedKinds = new Set();
const _availableKinds = [
	'class',
	'interface',
	'struct',
	'enum',
	'method',
	'function',
	'constructor',
	'property',
	'field',
	'variable',
	'constant',
	'enummember',
	'operator',
	'type',
];

// Make functions global for HTML onclick handlers
window.runSymbolsQuery = runSymbolsQuery;
window.runReferencesQuery = runReferencesQuery;
window.runDefinitionQuery = runDefinitionQuery;
window.runHierarchyQuery = runHierarchyQuery;
window.runDiagnosticsQuery = runDiagnosticsQuery;
window.runFileTypesQuery = runFileTypesQuery;
window.clearSymbols = clearSymbols;
window.clearReferences = clearReferences;
window.clearDefinition = clearDefinition;
window.clearHierarchy = clearHierarchy;
window.clearDiagnostics = clearDiagnostics;
window.clearFileTypes = clearFileTypes;

// Toggle kind selection
document.querySelectorAll('.kind-toggle').forEach((toggle) => {
	toggle.addEventListener('click', () => {
		const kind = toggle.dataset.kind;
		if (selectedKinds.has(kind)) {
			selectedKinds.delete(kind);
			toggle.classList.remove('selected');
		} else {
			selectedKinds.add(kind);
			toggle.classList.add('selected');
		}
	});
});

function getWorkspaceRelativePath(path, workspaceRoot) {
	if (!workspaceRoot || !path) return path;
	if (path.startsWith(workspaceRoot)) {
		return path.slice(workspaceRoot.length + 1);
	}
	return path;
}

function runSymbolsQuery() {
	const query = document.getElementById('symbols-query').value;
	const path = document.getElementById('symbols-path').value;
	const exclude = document.getElementById('symbols-exclude').value;
	const countOnly = document.getElementById('symbols-countOnly').checked;

	const queryObj = { type: 'symbols', query };
	if (path) queryObj.path = path;
	if (selectedKinds.size > 0) queryObj.kinds = Array.from(selectedKinds);
	if (exclude) queryObj.exclude = exclude.split(',').map((s) => s.trim());
	if (countOnly) queryObj.countOnly = true;

	const buttons = document.querySelectorAll('button');
	buttons.forEach((btn) => {
		btn.disabled = true;
		if (btn.textContent === 'Run Query') {
			btn.classList.add('loading');
		}
	});

	vscode.postMessage({
		command: 'runQuery',
		query: queryObj,
		queryType: 'symbols',
	});
}

function runReferencesQuery() {
	const path = document.getElementById('references-path').value;
	const line = parseInt(document.getElementById('references-line').value);
	const column = parseInt(document.getElementById('references-column').value);

	if (!path || !line || !column) {
		alert('Path, line, and column are required');
		return;
	}

	const buttons = document.querySelectorAll('button');
	buttons.forEach((btn) => {
		btn.disabled = true;
		if (btn.textContent === 'Run Query') {
			btn.classList.add('loading');
		}
	});

	vscode.postMessage({
		command: 'runQuery',
		query: { type: 'references', path, line, column },
		queryType: 'references',
	});
}

function runDefinitionQuery() {
	const path = document.getElementById('definition-path').value;
	const line = parseInt(document.getElementById('definition-line').value);
	const column = parseInt(document.getElementById('definition-column').value);

	if (!path || !line || !column) {
		alert('Path, line, and column are required');
		return;
	}

	const buttons = document.querySelectorAll('button');
	buttons.forEach((btn) => {
		btn.disabled = true;
		if (btn.textContent === 'Run Query') {
			btn.classList.add('loading');
		}
	});

	vscode.postMessage({
		command: 'runQuery',
		query: { type: 'definition', path, line, column },
		queryType: 'definition',
	});
}

function runHierarchyQuery() {
	const type = document.getElementById('hierarchy-type').value;
	const path = document.getElementById('hierarchy-path').value;
	const line = parseInt(document.getElementById('hierarchy-line').value);
	const column = parseInt(document.getElementById('hierarchy-column').value);

	if (!path || !line || !column) {
		alert('Path, line, and column are required');
		return;
	}

	const buttons = document.querySelectorAll('button');
	buttons.forEach((btn) => {
		btn.disabled = true;
		if (btn.textContent === 'Run Query') {
			btn.classList.add('loading');
		}
	});

	vscode.postMessage({
		command: 'runQuery',
		query: { type, path, line, column },
		queryType: 'hierarchy',
	});
}

function runDiagnosticsQuery() {
	const path = document.getElementById('diagnostics-path').value;

	const queryObj = { type: 'diagnostics' };
	if (path) queryObj.path = path;

	const buttons = document.querySelectorAll('button');
	buttons.forEach((btn) => {
		btn.disabled = true;
		if (btn.textContent === 'Run Query') {
			btn.classList.add('loading');
		}
	});

	vscode.postMessage({
		command: 'runQuery',
		query: queryObj,
		queryType: 'diagnostics',
	});
}

function clearSymbols() {
	document.getElementById('symbols-query').value = '';
	document.getElementById('symbols-path').value = '';
	document.getElementById('symbols-exclude').value = '';
	document.getElementById('symbols-countOnly').checked = false;
	selectedKinds.clear();
	document.querySelectorAll('.kind-toggle').forEach((toggle) => {
		toggle.classList.remove('selected');
	});
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

function runFileTypesQuery() {
	const path = document.getElementById('filetypes-path').value;

	if (!path) {
		alert('Path is required');
		return;
	}

	const buttons = document.querySelectorAll('button');
	buttons.forEach((btn) => {
		btn.disabled = true;
		if (btn.textContent === 'Run Query') {
			btn.classList.add('loading');
		}
	});

	vscode.postMessage({
		command: 'runQuery',
		query: { type: 'fileTypes', path },
		queryType: 'filetypes',
	});
}

function clearFileTypes() {
	document.getElementById('filetypes-path').value = '';
	document.getElementById('filetypes-result').classList.remove('visible');
}

function clearDiagnostics() {
	document.getElementById('diagnostics-path').value = '';
	document.getElementById('diagnostics-result').classList.remove('visible');
}

function formatJson(obj) {
	const json = JSON.stringify(obj, null, 2);
	return json
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
		.replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
		.replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
		.replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
		.replace(/: null/g, ': <span class="json-null">null</span>')
		.replace(/([{}[\],])/g, '<span class="json-punctuation">$1</span>');
}

function getSymbolIcon(kind) {
	const icons = {
		class: '○',
		interface: '◊',
		struct: '□',
		enum: '∪',
		method: 'ƒ',
		function: 'ƒ',
		constructor: '⚡',
		property: '◆',
		field: '◈',
		variable: '𝑥',
		constant: 'π',
		module: '▢',
		namespace: '◉',
		package: '📦',
		enummember: '∙',
		string: '"',
		operator: '±',
		type: 'T',
	};
	return icons[kind.toLowerCase()] || '•';
}

function parseLocation(location, parentPath) {
	if (!location) return null;

	// Find the last dash
	const lastDashIndex = location.lastIndexOf('-');
	if (lastDashIndex === -1) return null;

	// Split at the last dash
	const leftPart = location.substring(0, lastDashIndex);
	// const rightPart = location.substring(lastDashIndex + 1); // end position not used

	// Parse left part (either path:line:col or line:col)
	const leftParts = leftPart.split(':');
	let path, line, column;

	if (leftParts.length >= 3) {
		// path:line:col - join all but last 2 parts for path (handles paths with colons)
		path = leftParts.slice(0, -2).join(':');
		line = parseInt(leftParts[leftParts.length - 2]);
		column = parseInt(leftParts[leftParts.length - 1]);
	} else if (leftParts.length === 2 && parentPath) {
		// line:col
		path = parentPath;
		line = parseInt(leftParts[0]);
		column = parseInt(leftParts[1]);
	} else {
		return null;
	}

	return {
		path,
		line,
		column,
	};
}

function renderSymbolTree(symbols, parentPath = null, workspaceRoot = null) {
	return symbols
		.map((symbol) => {
			if (!symbol || !symbol.kind) {
				console.error('Symbol missing or missing kind:', symbol);
				return '';
			}

			const kind = symbol.kind.toLowerCase();
			const location = parseLocation(symbol.location, parentPath);
			const currentPath = location?.path || parentPath;
			const relativePath = getWorkspaceRelativePath(currentPath, workspaceRoot);

			let html = `<div class="symbol-item symbol-kind-${kind}">`;

			// Indentation for nested items
			if (parentPath) {
				html += `<span style="margin-left: 20px;"></span>`;
			}

			html += `<span class="symbol-icon">${getSymbolIcon(kind)}</span>`;
			html += `<span class="symbol-name">${symbol.name}</span>`;
			html += `<span class="symbol-kind">${kind}</span>`;

			if (location) {
				const locationText = parentPath
					? `${location.line}:${location.column}`
					: `${relativePath}:${location.line}:${location.column}`;
				html += `<span class="symbol-location location-link" data-path="${location.path}" data-line="${location.line}" data-column="${location.column}">${locationText}</span>`;
			}

			html += `</div>`;

			// Render children recursively
			if (symbol.children && symbol.children.length > 0) {
				html += renderSymbolTree(symbol.children, currentPath, workspaceRoot);
			}

			return html;
		})
		.join('');
}

// Handle query results
window.addEventListener('message', (event) => {
	const message = event.data;
	switch (message.command) {
		case 'queryResult': {
			const buttons = document.querySelectorAll('button');
			buttons.forEach((btn) => {
				btn.disabled = false;
				btn.classList.remove('loading');
			});

			const resultContainer = document.getElementById(`${message.queryType}-result`);
			if (!resultContainer) {
				console.error('Result container not found for:', message.queryType);
				return;
			}

			resultContainer.classList.add('visible');

			if (
				(message.queryType === 'symbols' || message.queryType === 'filetypes') &&
				Array.isArray(message.result.data)
			) {
				resultContainer.innerHTML = `<div class="symbol-tree">${renderSymbolTree(message.result.data[0].result, null, message.workspaceRoot)}</div>`;
			} else {
				resultContainer.innerHTML = `<pre>${formatJson(message.result)}</pre>`;
			}
			break;
		}
	}
});

// Handle location clicks
document.addEventListener('click', (e) => {
	if (e.target.classList.contains('location-link')) {
		const path = e.target.dataset.path;
		const line = e.target.dataset.line;
		const column = e.target.dataset.column;

		if (path && line && column) {
			// Fill in other query forms
			['references', 'definition', 'hierarchy'].forEach((prefix) => {
				const pathInput = document.getElementById(`${prefix}-path`);
				const lineInput = document.getElementById(`${prefix}-line`);
				const columnInput = document.getElementById(`${prefix}-column`);

				if (pathInput) pathInput.value = path;
				if (lineInput) lineInput.value = line;
				if (columnInput) columnInput.value = column;
			});

			// For file types, only set path
			const filetypesPathInput = document.getElementById('filetypes-path');
			if (filetypesPathInput) filetypesPathInput.value = path;
		}
	}
});
