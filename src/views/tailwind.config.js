/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.{ts,html}', './out/views/**/*.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Map VS Code theme variables
        'vscode': {
          'bg': 'var(--vscode-editor-background)',
          'fg': 'var(--vscode-editor-foreground)',
          'border': 'var(--vscode-panel-border)',
          'hover': 'var(--vscode-list-hoverBackground)',
          'selection': 'var(--vscode-list-activeSelectionBackground)',
          'input-bg': 'var(--vscode-input-background)',
          'input-fg': 'var(--vscode-input-foreground)',
          'input-border': 'var(--vscode-input-border)',
          'button-bg': 'var(--vscode-button-background)',
          'button-fg': 'var(--vscode-button-foreground)',
          'button-hover': 'var(--vscode-button-hoverBackground)',
        }
      },
      fontFamily: {
        'mono': ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}