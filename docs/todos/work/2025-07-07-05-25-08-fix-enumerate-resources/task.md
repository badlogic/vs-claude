# Fix enumerateResources to use original file names

**Status:** In Progress
**Created:** 2025-07-07-05-25-08
**Agent PID:** 64434
**Started:** 2025-07-07T05:26:16Z

## Description
The `enumerateResources` function in `panel-base.ts` currently transforms file names into camelCase keys with a "Uri" suffix (e.g., "logo.png" becomes "logoUri", "dark-theme-icon.svg" becomes "dark_theme_iconUri"). This transformation makes it difficult for webviews to look up resources by their original file names, requiring them to guess what transformation was applied. The function should be simplified to use the original file names as keys in the resources map (e.g., "logo.png" → uri), making resource lookup more intuitive and predictable.

## Implementation Plan
- [ ] Update key generation in enumerateResources to use original file names (src/panel-base.ts:47)
- [ ] Add vsClaudeResources type as Record<string, string> in panel-base.ts
- [ ] Add resource(fileName: string) method to WebviewBase class (src/webview-base.ts)
- [ ] Remove duplicate global declaration from settings webview (src/panels/settings/webview.ts:7-11)
- [ ] Update logo reference in settings panel to use this.resource("logo.png") (src/panels/settings/webview.ts:36)
- [ ] Update project-description.md to document the new resource access pattern
- [ ] Automated test: Run existing panel tests to ensure panels still load correctly
- [ ] Automated test: Run panel persistence tests to ensure state management still works
- [ ] User test: Open the settings panel and verify the logo displays correctly
- [ ] User test: Check browser console for any resource loading errors