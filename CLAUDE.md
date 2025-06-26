# CRITICAL
- ALWAYS apply the linter and formatter when changing code
- Only rebuild the Go binaries if you made changes to Go sources. Never rebuild TypeScript. It is build on demand.
- After completing code changes, apply lint and format fixing, and typecheck.
- Never commit and/or push before the user has signed off on changes.