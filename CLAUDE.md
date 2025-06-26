# CRITICAL
- The build command automatically formats and lints all code
- Only rebuild the Go binaries if you made changes to Go sources. Never rebuild TypeScript. It is built on demand.
- After completing code changes, run `npm run build` to ensure everything passes.
- Never commit and/or push before the user has signed off on changes.