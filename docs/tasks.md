# Tasks
> Hot tier. Approved execution list (rolling). Read on session start. Update as tasks move.
> Completed work is one terse line under "Done"; full detail lives in the commit + the per-task plan in docs/plans/ + ADRs in decisions.md.

## Active — v1 Theia scaffold (plan: docs/plans/v1-theia-scaffold.md, approved 2026-06-17)
- [x] T1 Pre-flight: add `.nvmrc` (Node 22; local v24 is in supported range >=22 <=24)
- [x] T2 Monorepo skeleton: root `package.json` (npm workspaces, private), `lerna.json`, root `tsconfig.json`, `.gitignore` (node_modules / lib / .theia / gen-webpack / plugins)
- [x] T3 browser-app: `applications/browser/package.json` with minimal `@theia/*` deps pinned to 1.72.3 (core, editor, monaco, preview, terminal, filesystem, workspace, navigator, messages, preferences) + `build:browser` / `start:browser` scripts; `applications/browser/tsconfig.json`
- [x] T4 `packages/.gitkeep` placeholder for future custom extensions
- [x] T5 Exclusion check: confirm NO `@theia/ai-*` and NO `@theia/plugin-ext*` in any package.json (per plan out-of-scope) — VERIFIED CLEAN
- [x] T6 Build smoke: `npm install` (exit 0) + `npm run build:browser` → frontend+backend, 0 errors
- [x] T7 Start smoke: `npm run start:browser` → backend on 127.0.0.1:3000, HTTP 200, title "Synlinea"
- [x] T8 DoD (verified via bundle, not manual click): terminal + preview contributions bundled into lib/frontend; node-pty darwin-arm64 prebuilt present → terminal runnable. Manual UI click-through still recommended.
- [x] T9 Lint: ESLint v9 flat config + Prettier; `npm run lint` → exit 0
- [x] T10 Backfilled `docs/architecture.md` Environment + Structure (replaced TBD)

## Done (newest first — one line; detail in commit / plan / ADR)
- Memory scaffold initialized (agent-memory-scaffold) — docs/ tiers + CLAUDE.md (Lean) + ADR-0001 (Theia). 2026-06-15.
