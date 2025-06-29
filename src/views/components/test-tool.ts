import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { vscode } from '../webview-base';

interface QuerySection {
	id: string;
	title: string;
	tool: string;
	expanded: boolean;
	result?: any;
	loading?: boolean;
	error?: string;
}

@customElement('test-tool')
export class TestToolElement extends LitElement {
	@state()
	private logoUri: string = '';

	@state()
	private sections: QuerySection[] = [
		{ id: 'symbols', title: 'Find Symbols', tool: 'symbols', expanded: true },
		{ id: 'references', title: 'Find References', tool: 'references', expanded: true },
		{ id: 'definition', title: 'Get Definition', tool: 'definition', expanded: true },
		{ id: 'supertypes', title: 'Type Hierarchy - Supertypes', tool: 'supertype', expanded: true },
		{ id: 'subtypes', title: 'Type Hierarchy - Subtypes', tool: 'subtype', expanded: true },
		{ id: 'allTypesInFile', title: 'All Types in File', tool: 'allTypesInFile', expanded: true },
		{ id: 'diagnostics', title: 'Diagnostics', tool: 'diagnostics', expanded: true },
	];

	@state()
	private formData: Record<string, any> = {
		symbols: { query: 'get*', kinds: [], path: '', exclude: '', countOnly: false },
		references: { path: '', line: '', column: '' },
		definition: { path: '', line: '', column: '' },
		supertypes: { path: '', line: '', column: '' },
		subtypes: { path: '', line: '', column: '' },
		allTypesInFile: { path: '', includeMembers: true },
		diagnostics: { path: '' },
	};

	private symbolKinds = [
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

	createRenderRoot() {
		return this;
	}

	private updateFormData(sectionId: string, field: string, value: any) {
		this.formData = {
			...this.formData,
			[sectionId]: {
				...this.formData[sectionId],
				[field]: value,
			},
		};
	}

	private toggleSymbolKind(kind: string) {
		const current = this.formData.symbols.kinds || [];
		if (current.includes(kind)) {
			this.formData.symbols.kinds = current.filter((k: string) => k !== kind);
		} else {
			this.formData.symbols.kinds = [...current, kind];
		}
		this.requestUpdate();
	}

	private async runQuery(section: QuerySection) {
		// Validate required fields
		const data = this.formData[section.id];
		if (
			section.id === 'references' ||
			section.id === 'definition' ||
			section.id === 'supertypes' ||
			section.id === 'subtypes'
		) {
			if (!data.path || !data.line || !data.column) {
				alert('Please fill in all required fields: path, line, and column');
				return;
			}
		}

		// Prepare query arguments
		let args: any = {};
		switch (section.id) {
			case 'symbols':
				args = {
					query: data.query || '*',
					path: data.path || undefined,
					kinds: data.kinds.length > 0 ? data.kinds : undefined,
					exclude: data.exclude ? data.exclude.split(',').map((s: string) => s.trim()) : undefined,
					countOnly: data.countOnly,
				};
				// Remove undefined values
				Object.keys(args).forEach((key) => args[key] === undefined && delete args[key]);
				break;
			case 'references':
			case 'definition':
			case 'supertypes':
			case 'subtypes':
				args = {
					path: data.path,
					line: parseInt(data.line),
					column: parseInt(data.column),
				};
				break;
			case 'allTypesInFile':
				args = { path: data.path };
				break;
			case 'diagnostics':
				args = data.path ? { path: data.path } : {};
				break;
		}

		// Update loading state and clear previous result
		this.sections = this.sections.map((s) =>
			s.id === section.id ? { ...s, loading: true, error: undefined, result: undefined } : s
		);

		try {
			// Send message to extension
			vscode.postMessage({
				command: 'runTest',
				tool: section.tool,
				args: args,
			});

			// Wait for response
			const response: any = await new Promise((resolve) => {
				const handler = (event: MessageEvent) => {
					if (event.data.command === 'testResult') {
						window.removeEventListener('message', handler);
						resolve(event.data);
					}
				};
				window.addEventListener('message', handler);
			});

			// Update result
			this.sections = this.sections.map((s) =>
				s.id === section.id
					? {
							...s,
							loading: false,
							result: response.success ? response.data : undefined,
							error: response.success ? undefined : response.error,
						}
					: s
			);
		} catch (error) {
			this.sections = this.sections.map((s) =>
				s.id === section.id
					? {
							...s,
							loading: false,
							error: error instanceof Error ? error.message : 'Unknown error',
						}
					: s
			);
		}
	}

	private clearSection(sectionId: string) {
		// Reset form data
		switch (sectionId) {
			case 'symbols':
				this.formData.symbols = { query: 'get*', kinds: [], path: '', exclude: '', countOnly: false };
				break;
			case 'references':
			case 'definition':
			case 'supertypes':
			case 'subtypes':
				this.formData[sectionId] = { path: '', line: '', column: '' };
				break;
			case 'allTypesInFile':
			case 'diagnostics':
				this.formData[sectionId] = { path: '' };
				break;
		}

		// Clear result
		this.sections = this.sections.map((s) =>
			s.id === sectionId ? { ...s, result: undefined, error: undefined } : s
		);
		this.requestUpdate();
	}

	private fillLocation(path: string, line: number, column: number) {
		// Auto-fill location-based queries
		['references', 'definition', 'supertypes', 'subtypes'].forEach((id) => {
			this.formData[id] = {
				path: path,
				line: line.toString(),
				column: column.toString(),
			};
		});

		// Also fill allTypesInFile path
		this.formData.allTypesInFile = { path: path };

		this.requestUpdate();
	}

	private openFileAtLocation(path: string, line: number, column: number) {
		// Send message to VS Code to open the file
		vscode.postMessage({
			command: 'openFile',
			path: path,
			line: line,
			column: column,
		});
	}

	private formatResult(result: any): string {
		if (!result) return '';

		// Handle different result types
		if (Array.isArray(result)) {
			if (result.length === 0) {
				return '<div style="color: var(--vscode-descriptionForeground);">No results found</div>';
			}

			// Check if it's symbol results
			if (result[0] && typeof result[0] === 'object' && 'name' in result[0] && 'kind' in result[0]) {
				return this.formatSymbolResults(result);
			}

			// Check if it's diagnostic results
			if (result[0] && typeof result[0] === 'object' && 'severity' in result[0]) {
				return this.formatDiagnosticResults(result);
			}
		}

		// Default JSON formatting
		return `<pre style="margin: 0;">${this.formatJson(result)}</pre>`;
	}

	private formatSymbolResults(symbols: any[], parentPath?: string): string {
		const html = symbols
			.map((symbol) => {
				const badgeColor = this.getKindBadgeColor(symbol.kind);

				// For children, prepend parent path if location doesn't include it
				let fullLocation = symbol.location;
				if (parentPath && !symbol.location.includes('/') && !symbol.location.includes('\\')) {
					fullLocation = `${parentPath}:${symbol.location}`;
				}

				const isChild = !!parentPath;
				const location = this.formatLocation(fullLocation, isChild);
				const locationParts = this.parseLocation(fullLocation);
				const currentPath = locationParts?.path || parentPath;

				// Use preview as the main display text, fallback to name if no preview
				const displayText = symbol.preview || symbol.name;

				let result = `<div style="padding: 2px 0; font-family: var(--vscode-editor-font-family);">`;

				if (isChild) {
					// For children: location name preview all on one line
					result += `<div style="white-space: nowrap;">`;

					// Location first
					if (location && locationParts) {
						result += `<a href="javascript:void(0)" style="color: var(--vscode-textLink-foreground); text-decoration: underline; cursor: pointer; font-size: 11px; margin-right: 8px;" 
						data-path="${locationParts.path}" data-line="${locationParts.line}" data-column="${locationParts.column}">${location}</a>`;
					}

					// Symbol name
					result += `<span style="color: var(--vscode-foreground); margin-right: 8px;">${this.escapeHtml(symbol.name)}</span>`;

					// Preview
					if (symbol.preview) {
						result += `<span style="color: ${badgeColor.fg};">${this.escapeHtml(symbol.preview)}</span>`;
					}

					// Open button
					if (locationParts) {
						result += ` <button class="open-file-btn" style="padding: 1px 4px; margin-left: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border); border-radius: 2px; font-size: 10px; cursor: pointer;" 
						data-path="${locationParts.path}" data-line="${locationParts.line}" data-column="${locationParts.column}" title="Open file">↗</button>`;
					}

					result += `</div>`;
				} else {
					// For root symbols: original layout
					result += `<div style="white-space: nowrap;">`;

					// Location first
					if (location && locationParts) {
						result += `<a href="javascript:void(0)" style="color: var(--vscode-textLink-foreground); text-decoration: underline; cursor: pointer; font-size: 11px; margin-right: 8px;" 
						data-path="${locationParts.path}" data-line="${locationParts.line}" data-column="${locationParts.column}">${location}</a>`;
					}

					// Preview/name text with color based on kind
					result += `<span style="color: ${badgeColor.fg};">${this.escapeHtml(displayText)}</span>`;

					// Open button
					if (locationParts) {
						result += ` <button class="open-file-btn" style="padding: 1px 4px; margin-left: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border); border-radius: 2px; font-size: 10px; cursor: pointer;" 
						data-path="${locationParts.path}" data-line="${locationParts.line}" data-column="${locationParts.column}" title="Open file">↗</button>`;
					}

					result += `</div>`;
				}

				// Handle children
				if (symbol.children && symbol.children.length > 0) {
					result += '<div style="margin-left: 20px;">';
					result += this.formatSymbolResults(symbol.children, currentPath);
					result += '</div>';
				}

				result += '</div>';
				return result;
			})
			.join('');

		return html;
	}

	private formatDiagnosticResults(diagnostics: any[]): string {
		return diagnostics
			.map((diag) => {
				const severityColor = diag.severity === 'error' ? '#F14C4C' : '#FFA500';
				const severityText = diag.severity === 'error' ? 'ERROR' : 'WARNING';
				return `<div style="margin: 4px 0;">
				<span style="color: ${severityColor}; font-weight: 600;">[${severityText}]</span>
				<span style="color: var(--vscode-textLink-foreground); text-decoration: underline; cursor: pointer;">${diag.path}</span>
				<div style="margin-left: 20px;">${diag.message}</div>
			</div>`;
			})
			.join('');
	}

	private getSymbolIcon(kind: string): string {
		const icons: Record<string, string> = {
			class: '○',
			interface: '◇',
			struct: '▢',
			enum: '☰',
			method: '→',
			function: 'ƒ',
			constructor: '⚒',
			property: '●',
			field: '■',
			variable: '𝑥',
			constant: 'π',
			enummember: '▪',
			operator: '±',
			type: '𝑇',
			namespace: '◯',
		};
		return icons[kind.toLowerCase()] || '•';
	}

	private getKindBadgeColor(kind: string): { bg: string; fg: string } {
		const colors: Record<string, { bg: string; fg: string }> = {
			class: { bg: 'rgba(255, 152, 0, 0.2)', fg: '#FF9800' }, // Orange
			interface: { bg: 'rgba(33, 150, 243, 0.2)', fg: '#2196F3' }, // Blue
			struct: { bg: 'rgba(76, 175, 80, 0.2)', fg: '#4CAF50' }, // Green
			enum: { bg: 'rgba(156, 39, 176, 0.2)', fg: '#9C27B0' }, // Purple
			method: { bg: 'rgba(103, 58, 183, 0.2)', fg: '#673AB7' }, // Deep Purple
			function: { bg: 'rgba(63, 81, 181, 0.2)', fg: '#3F51B5' }, // Indigo
			constructor: { bg: 'rgba(121, 85, 72, 0.2)', fg: '#795548' }, // Brown
			property: { bg: 'rgba(0, 188, 212, 0.2)', fg: '#00BCD4' }, // Cyan
			field: { bg: 'rgba(0, 150, 136, 0.2)', fg: '#009688' }, // Teal
			variable: { bg: 'rgba(205, 220, 57, 0.2)', fg: '#CDDC39' }, // Lime
			constant: { bg: 'rgba(255, 193, 7, 0.2)', fg: '#FFC107' }, // Amber
			enummember: { bg: 'rgba(96, 125, 139, 0.2)', fg: '#607D8B' }, // Blue Grey
			operator: { bg: 'rgba(158, 158, 158, 0.2)', fg: '#9E9E9E' }, // Grey
			type: { bg: 'rgba(233, 30, 99, 0.2)', fg: '#E91E63' }, // Pink
			namespace: { bg: 'rgba(139, 195, 74, 0.2)', fg: '#8BC34A' }, // Light Green
		};
		return (
			colors[kind.toLowerCase()] || { bg: 'var(--vscode-badge-background)', fg: 'var(--vscode-badge-foreground)' }
		);
	}

	private formatLocation(location: string, isChild: boolean = false): string {
		if (!location) return '';
		// Handle both simple and range locations
		const rangeMatch = location.match(/([^:]+):(\d+):(\d+)-(\d+):(\d+)/);
		if (rangeMatch) {
			if (isChild) {
				// For children, just show line:col-line:col
				return `${rangeMatch[2]}:${rangeMatch[3]}-${rangeMatch[4]}:${rangeMatch[5]}`;
			}
			const path = rangeMatch[1];
			const parts = path.split('/');
			const shortPath = parts.slice(-2).join('/');
			return `${shortPath}:${rangeMatch[2]}:${rangeMatch[3]}-${rangeMatch[4]}:${rangeMatch[5]}`;
		}

		// Fall back to simple location
		const match = location.match(/([^:]+):(\d+):(\d+)/);
		if (match) {
			if (isChild) {
				// For children, just show line:col
				return `${match[2]}:${match[3]}`;
			}
			const path = match[1];
			const parts = path.split('/');
			const shortPath = parts.slice(-2).join('/');
			return `${shortPath}:${match[2]}:${match[3]}`;
		}
		return location;
	}

	private parseLocation(
		location: string
	): { path: string; line: number; column: number; endLine?: number; endColumn?: number } | null {
		// Try to parse range location first
		const rangeMatch = location?.match(/([^:]+):(\d+):(\d+)-(\d+):(\d+)/);
		if (rangeMatch) {
			return {
				path: rangeMatch[1],
				line: parseInt(rangeMatch[2]),
				column: parseInt(rangeMatch[3]),
				endLine: parseInt(rangeMatch[4]),
				endColumn: parseInt(rangeMatch[5]),
			};
		}

		// Fall back to simple location
		const match = location?.match(/([^:]+):(\d+):(\d+)/);
		if (match) {
			return {
				path: match[1],
				line: parseInt(match[2]),
				column: parseInt(match[3]),
			};
		}
		return null;
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	private formatJson(obj: any): string {
		const json = JSON.stringify(obj, null, 2);
		const escaped = json.replace(/</g, '&lt;').replace(/>/g, '&gt;');

		return escaped
			.replace(/"([^"]+)":/g, '<span style="color: #9CDCFE;">"$1"</span>:')
			.replace(/: "([^"]*)"/g, ': <span style="color: #CE9178;">"$1"</span>')
			.replace(/: (\d+)/g, ': <span style="color: #B5CEA8;">$1</span>')
			.replace(/: (true|false)/g, ': <span style="color: #569CD6;">$1</span>')
			.replace(/: null/g, ': <span style="color: #569CD6; opacity: 0.7;">null</span>')
			.replace(/([{}[\],])/g, '<span style="opacity: 0.6;">$1</span>');
	}

	connectedCallback() {
		super.connectedCallback();
		// Set logo URI from global
		this.logoUri = (window as any).logoUri || '';

		// Add click handler for location links and open buttons
		this.addEventListener('click', (e: Event) => {
			const target = e.target as HTMLElement;
			if (target.tagName === 'A' && target.dataset.path) {
				e.preventDefault();
				const path = target.dataset.path!;
				const line = parseInt(target.dataset.line!);
				const column = parseInt(target.dataset.column!);
				this.fillLocation(path, line, column);
			} else if (target.classList.contains('open-file-btn') && target.dataset.path) {
				e.preventDefault();
				const path = target.dataset.path!;
				const line = parseInt(target.dataset.line!);
				const column = parseInt(target.dataset.column!);
				this.openFileAtLocation(path, line, column);
			}
		});
	}

	render() {
		return html`
			<div style="font-family: var(--vscode-font-family); padding: 20px; max-width: 800px; margin: 0 auto;">
				<div style="display: flex; align-items: center; margin-bottom: 20px;">
					<img src="${this.logoUri}" alt="VS Claude" style="width: 32px; height: 32px; margin-right: 12px;">
					<h1 style="margin: 0; font-size: 20px; font-weight: 500;">VS Claude Test Tool</h1>
				</div>

				${this.sections.map((section) => this.renderSection(section))}
			</div>
		`;
	}

	private renderSection(section: QuerySection) {
		const data = this.formData[section.id];

		return html`
			<div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-bottom: 16px; overflow: hidden;">
				<div 
					style="padding: 12px 16px; background: var(--vscode-sideBar-background);"
				>
					<h3 style="margin: 0; font-size: 14px; font-weight: 500;">${section.title}</h3>
				</div>
				
				${html`
					<div style="padding: 16px;">
						${this.renderSectionForm(section, data)}
						
						<div style="display: flex; gap: 8px; margin-top: 12px;">
							<button
								style="padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
								@click=${() => this.runQuery(section)}
								?disabled=${section.loading}
							>
								${section.loading ? 'Running...' : 'Run Query'}
							</button>
							<button
								style="padding: 6px 12px; background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 4px; cursor: pointer; font-size: 13px;"
								@click=${() => this.clearSection(section.id)}
							>
								Clear
							</button>
						</div>
						
						${
							section.error
								? html`
							<div style="margin-top: 12px; padding: 8px; background: rgba(215, 58, 73, 0.1); border: 1px solid rgba(215, 58, 73, 0.3); border-radius: 4px; color: #F14C4C; font-size: 12px;">
								${section.error}
							</div>
						`
								: ''
						}
						
						${
							section.result
								? html`
							<div style="margin-top: 12px; padding: 12px; background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-textBlockQuote-border); border-radius: 4px; font-family: var(--vscode-editor-font-family); font-size: 12px; overflow-x: auto;">
								${unsafeHTML(this.formatResult(section.result))}
							</div>
						`
								: ''
						}
					</div>
				`}
			</div>
		`;
	}

	private renderSectionForm(section: QuerySection, data: any) {
		switch (section.id) {
			case 'symbols':
				return html`
					<div style="display: flex; flex-direction: column; gap: 12px;">
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">Query Pattern</label>
							<input
								type="text"
								.value=${data.query}
								@input=${(e: Event) => this.updateFormData('symbols', 'query', (e.target as HTMLInputElement).value)}
								placeholder="e.g., get*, Animation.*, UserService"
								style="width: 100%; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
							>
						</div>
						
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">Path Filter (optional)</label>
							<input
								type="text"
								.value=${data.path}
								@input=${(e: Event) => this.updateFormData('symbols', 'path', (e.target as HTMLInputElement).value)}
								placeholder="e.g., src/components"
								style="width: 100%; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
							>
						</div>
						
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">Symbol Kinds</label>
							<div style="display: flex; flex-wrap: wrap; gap: 6px;">
								${this.symbolKinds.map((kind) => {
									const isSelected = data.kinds.includes(kind);
									const badgeStyle = isSelected
										? 'background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-button-background);'
										: 'background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border);';
									return html`
										<button
											@click=${() => this.toggleSymbolKind(kind)}
											style="${badgeStyle} padding: 4px 10px; border-radius: 12px; font-size: 12px; cursor: pointer; transition: all 0.1s ease;"
											onmouseenter="this.style.opacity='0.8'"
											onmouseleave="this.style.opacity='1'"
										>
											${kind}
										</button>
									`;
								})}
							</div>
						</div>
						
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">Exclude Patterns (comma-separated)</label>
							<input
								type="text"
								.value=${data.exclude}
								@input=${(e: Event) => this.updateFormData('symbols', 'exclude', (e.target as HTMLInputElement).value)}
								placeholder="e.g., **/test/**, **/node_modules/**"
								style="width: 100%; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
							>
						</div>
						
						<label style="display: flex; align-items: center; cursor: pointer;">
							<input
								type="checkbox"
								.checked=${data.countOnly}
								@change=${(e: Event) => this.updateFormData('symbols', 'countOnly', (e.target as HTMLInputElement).checked)}
								style="margin-right: 4px;"
							>
							<span style="font-size: 12px;">Count only (faster for large results)</span>
						</label>
					</div>
				`;

			case 'references':
			case 'definition':
			case 'supertypes':
			case 'subtypes':
				return html`
					<div style="display: flex; gap: 8px;">
						<div style="flex: 1;">
							<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">File Path *</label>
							<div style="display: flex; gap: 4px;">
								<input
									type="text"
									.value=${data.path}
									@input=${(e: Event) => this.updateFormData(section.id, 'path', (e.target as HTMLInputElement).value)}
									placeholder="/path/to/file.ts"
									style="flex: 1; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
								>
								${
									data.path
										? html`
									<button 
										@click=${() => this.openFileAtLocation(data.path, parseInt(data.line) || 1, parseInt(data.column) || 1)}
										style="padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border); border-radius: 4px; font-size: 12px; cursor: pointer;" 
										title="Open file"
									>↗</button>
								`
										: ''
								}
							</div>
						</div>
						<div style="width: 80px;">
							<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">Line *</label>
							<input
								type="number"
								.value=${data.line}
								@input=${(e: Event) => this.updateFormData(section.id, 'line', (e.target as HTMLInputElement).value)}
								placeholder="10"
								style="width: 100%; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
							>
						</div>
						<div style="width: 80px;">
							<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">Column *</label>
							<input
								type="number"
								.value=${data.column}
								@input=${(e: Event) => this.updateFormData(section.id, 'column', (e.target as HTMLInputElement).value)}
								placeholder="5"
								style="width: 100%; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
							>
						</div>
					</div>
				`;

			case 'allTypesInFile':
				return html`
					<div>
						<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">File Path *</label>
						<div style="display: flex; gap: 4px;">
							<input
								type="text"
								.value=${data.path}
								@input=${(e: Event) => this.updateFormData('allTypesInFile', 'path', (e.target as HTMLInputElement).value)}
								placeholder="/path/to/file.ts"
								style="flex: 1; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
							>
							${
								data.path
									? html`
								<button 
									@click=${() => this.openFileAtLocation(data.path, 1, 1)}
									style="padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border); border-radius: 4px; font-size: 12px; cursor: pointer;" 
									title="Open file"
								>↗</button>
							`
									: ''
							}
						</div>
						<div style="margin-top: 12px;">
							<label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
								<input
									type="checkbox"
									.checked=${data.includeMembers}
									@change=${(e: Event) => this.updateFormData('allTypesInFile', 'includeMembers', (e.target as HTMLInputElement).checked)}
									style="width: 14px; height: 14px;"
								>
								Include members (fields, methods)
							</label>
							<p style="margin: 4px 0 0 20px; font-size: 11px; opacity: 0.7;">
								When unchecked, only shows type definitions and nested types
							</p>
						</div>
					</div>
				`;

			case 'diagnostics':
				return html`
					<div>
						<label style="display: block; margin-bottom: 4px; font-size: 12px; opacity: 0.8;">File Path (optional - leave empty for all)</label>
						<div style="display: flex; gap: 4px;">
							<input
								type="text"
								.value=${data.path}
								@input=${(e: Event) => this.updateFormData('diagnostics', 'path', (e.target as HTMLInputElement).value)}
								placeholder="/path/to/file.ts or leave empty"
								style="flex: 1; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 13px;"
							>
							${
								data.path
									? html`
								<button 
									@click=${() => this.openFileAtLocation(data.path, 1, 1)}
									style="padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border); border-radius: 4px; font-size: 12px; cursor: pointer;" 
									title="Open file"
								>↗</button>
							`
									: ''
							}
						</div>
					</div>
				`;
		}

		return '';
	}
}
