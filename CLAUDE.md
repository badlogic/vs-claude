# CRITICAL
- Run `npm run check` to format and lint all code
- Run `npm run typecheck` to ensure TypeScript types are correct
- Only rebuild the Go binaries if you made changes to Go sources. Never rebuild TypeScript. It is built on demand.
- After completing code changes, run `npm run check` and `npm run typecheck` to ensure everything passes.
- Never commit and/or push before the user has signed off on changes.