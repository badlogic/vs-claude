# General webview panel infrastructure, making implementation of new panels that communicate with extension trivial

**Status:** In Progress
**Created:** 2025-07-07T03:52:53
**Agent PID:** 41300
**Started:** 2025-01-07T04:20:00

## Description

Create a reusable panel infrastructure for the VS Claude extension that enables easy creation of new panels with bidirectional communication between the extension and panels. Each panel will be self-contained in its own directory under src/panels/, use Lit elements with inline Tailwind CSS (no shadow DOM), and share a common compiled stylesheet. The infrastructure will support state persistence across VS Code restarts and include a sample VS Claude settings panel as the first implementation.

## Design

### Panel Structure
Each panel lives in `src/panels/<panel-name>/` with at minimum:
- `webview.ts` - Main Lit element that runs in the panel context (entry point for build)
- `messages.ts` - TypeScript message types shared between panel and extension
- `panel.ts` - Panel class that runs in the extension context

Additional TypeScript files can be added as needed for components, utilities, etc.

### Naming Convention
- Folder name: `settings`
- Main element tag: `<settings-webview>` (folder name + "-webview" suffix)
- Panel type identifier: `settings` (folder name)

### Base Webview Class
```typescript
// src/webview-base.ts
import { LitElement } from 'lit';

// VS Code API available in webview context
declare const vscode: any;

export abstract class WebviewBase<T> extends LitElement {
  private vscodeApi = vscode.acquireVsCodeApi();
  
  // Override to use light DOM (no shadow DOM) for Tailwind
  createRenderRoot() {
    return this;
  }
  
  connectedCallback() {
    super.connectedCallback();
    
    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      this.onMessage(event.data as T);
    });
  }
  
  protected sendMessage(message: T) {
    this.vscodeApi.postMessage(message);
  }
  
  protected abstract onMessage(message: T): void;
}
```

### Panel Implementation (Lit Component)
```typescript
// src/panels/settings/webview.ts
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { WebviewBase } from '../../webview-base';
import type { SettingsMessage } from './messages';

@customElement('settings-webview')
export class SettingsWebview extends WebviewBase<SettingsMessage> {
  @state() private message = 'Hello from VS Claude!';
  @state() private theme: 'light' | 'dark' = 'light';
  
  protected onMessage(message: SettingsMessage) {
    switch (message.type) {
      case 'updateTheme':
        this.theme = message.theme;
        break;
      case 'settingsSaved':
        this.message = message.success ? 'Settings saved!' : 'Error saving settings';
        break;
    }
  }
  
  render() {
    return html`
      <div class="flex flex-col items-center p-8">
        <img src="${(window as any).vsClaudeResources?.logoUri}" class="w-32 h-32 mb-4">
        <h1 class="text-2xl font-bold">${this.message}</h1>
        <button 
          @click=${() => this.sendMessage({ type: 'saveSettings', settings: { theme: this.theme } })}
          class="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Save Settings
        </button>
      </div>
    `;
  }
}
```

### Base Panel Class (Extension Side)
```typescript
// src/panel-base.ts
abstract class Panel<T> {
  protected panel?: vscode.WebviewPanel;
  
  abstract get type(): string;
  abstract get title(): string;
  abstract get elementName(): string;
  abstract onMessage(message: T): void;
  
  constructor(private manager: PanelManager) {}
  
  create(context: vscode.ExtensionContext): string {
    this.panel = vscode.window.createWebviewPanel(
      this.type,
      this.title,
      vscode.ViewColumn.One,
      { 
        enableScripts: true, 
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'build'),
          vscode.Uri.joinPath(context.extensionUri, '')
        ]
      }
    );
    
    const webview = this.panel.webview;
    
    // Get resource URIs
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'build', 'panels', this.type, `${this.type}.js`)
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'build', 'panels', 'panel-styles.css')
    );
    // Enumerate and inject all extension resources
    const resources = {
      logoUri: webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'logo.png')),
      // Add more resources here as needed
    };
    
    this.panel.webview.html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <${this.elementName}></${this.elementName}>
        <script>
          window.vsClaudeResources = ${JSON.stringify(resources)};
        </script>
        <script src="${scriptUri}"></script>
      </body>
      </html>`;
    
    // Set up message handling
    this.panel.webview.onDidReceiveMessage(msg => this.onMessage(msg));
    
    // Register with manager
    const id = this.manager.register(this);
    
    // Handle disposal
    this.panel.onDidDispose(() => {
      this.manager.unregister(id);
      this.dispose();
    });
    
    return id;
  }
  
  sendMessage(message: T): void {
    this.panel?.webview.postMessage(message);
  }
  
  dispose(): void {
    this.panel?.dispose();
  }
}
```

### Panel Manager
```typescript
// src/panel-manager.ts
import { SettingsPanel } from './panels/settings/panel';

class PanelManager {
  private instances = new Map<string, Panel<any>>();
  private nextId = 1;
  
  // Registry of panel types for restoration
  private panelTypes: Record<string, new(manager: PanelManager) => Panel<any>> = {
    'settings': SettingsPanel,
    // Add more panel types here as they're created
  };
  
  constructor(private context: vscode.ExtensionContext) {}
  
  register(panel: Panel<any>): string {
    const id = `${panel.type}-${this.nextId++}`;
    this.instances.set(id, panel);
    this.saveOpenPanels();
    return id;
  }
  
  unregister(id: string): void {
    this.instances.delete(id);
    this.saveOpenPanels();
  }
  
  create<T>(PanelClass: new(manager: PanelManager) => Panel<T>): Panel<T> {
    const panel = new PanelClass(this);
    panel.create(this.context);
    return panel;
  }
  
  private async saveOpenPanels() {
    const openPanels = Array.from(this.instances.values()).map(panel => ({
      type: panel.type
    }));
    await this.context.globalState.update('openPanels', openPanels);
  }
  
  async restorePanels() {
    const saved = this.context.globalState.get<{type: string}[]>('openPanels', []);
    
    for (const { type } of saved) {
      const PanelClass = this.panelTypes[type];
      if (PanelClass) {
        this.create(PanelClass);
      }
    }
  }
}
```

### Build Process
The build script (`scripts/build-panels.js`) will:
1. Scan `src/panels/*` directories
2. For each panel directory:
   - Bundle `webview.ts` and dependencies with esbuild
   - Output to `build/panels/<panel-name>/<panel-name>.js`
3. Run PostCSS with Tailwind on a main CSS file that includes Tailwind directives:
   - Input: `src/panels/styles.css` with `@tailwind` directives
   - Tailwind scans all `src/**/*.ts` files for class names
   - Output: `build/panels/panel-styles.css` with only used styles

### Message Passing
Bidirectional, typed communication:
```typescript
// src/panels/settings/messages.ts
export type SettingsMessage = 
  | { type: 'updateTheme'; theme: 'light' | 'dark' }
  | { type: 'saveSettings'; settings: UserSettings }
  | { type: 'settingsSaved'; success: boolean };
```

Both panel and extension import and use these types for type-safe messaging.

### Panel Implementation (Extension Side)
```typescript
// src/panels/settings/panel.ts
import { Panel } from '../../panel-base';
import type { SettingsMessage } from './messages';

export class SettingsPanel extends Panel<SettingsMessage> {
  get type() { return 'settings'; }
  get title() { return 'VS Claude Settings'; }
  get elementName() { return 'settings-webview'; }
  
  constructor(manager: PanelManager) {
    super(manager);
  }
  
  onMessage(message: SettingsMessage) {
    switch (message.type) {
      case 'saveSettings':
        // Save settings logic
        this.sendMessage({ type: 'settingsSaved', success: true });
        break;
    }
  }
}
```

## Implementation Plan

### Panel Infrastructure
- [ ] Create base WebviewBase class for Lit components (src/webview-base.ts:1-40)
- [ ] Create base Panel class with common functionality (src/panel-base.ts:1-80)
- [ ] Create PanelManager for lifecycle and persistence (src/panel-manager.ts:1-100)
- [ ] Create main panel styles CSS file with Tailwind directives (src/panels/styles.css:1-5)
- [ ] Create panel build script (scripts/build-panels.js:1-120)
- [ ] Configure Tailwind to scan panel TypeScript files (tailwind.config.js:1-15)
- [ ] Configure PostCSS for Tailwind processing (postcss.config.js:1-10)
- [ ] Update package.json with panel build scripts (package.json:62)

### Settings Panel Implementation
- [ ] Create settings panel directory structure (src/panels/settings/)
- [ ] Implement settings panel Lit component (src/panels/settings/webview.ts:1-80)
- [ ] Define settings message types (src/panels/settings/messages.ts:1-20)
- [ ] Implement SettingsPanel class (src/panels/settings/panel.ts:1-50)

### Extension Integration
- [ ] Initialize PanelManager in extension.ts (src/extension.ts:14)
- [ ] Register VS Claude settings command (src/extension.ts:24, package.json:56)
  ```typescript
  vscode.commands.registerCommand('vs-claude.openSettings', () => {
    panelManager.create(SettingsPanel);
  });
  ```
- [ ] Implement panel restoration on activation (src/extension.ts:15-20)

### Testing
- [ ] Automated test: Panel build process (test/suite/panel-build.test.ts:1-80)
- [ ] Automated test: Message passing between panel and extension (test/suite/panel-messages.test.ts:1-100)
- [ ] Automated test: Panel persistence and restoration (test/suite/panel-persistence.test.ts:1-80)
- [ ] User test: Open settings panel via command palette
- [ ] User test: Verify logo and Tailwind styling loads correctly
- [ ] User test: Test message exchange between panel and extension
- [ ] User test: Close VS Code and reopen, verify settings panel restores

### Documentation
- [ ] Update project-description.md with panel infrastructure (docs/project-description.md:86-120)

## Notes