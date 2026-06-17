# Progress
> Hot tier. Live handoff + terse done log. Outcome summaries, NOT a copy of tasks.md checkmarks.
> Per-task detail lives in the commit + the approved plan (`docs/plans/`) + ADRs (`decisions.md`).

## Handoff (current) — v2 Capability x-ray panel DONE & green (VT1–VT10); verifier running; uncommitted

- 2026-06-17: **v2 complete, all checks green.** `npm run build:browser` 0 errors (root build:browser compiles packages first), `npm run lint` exit 0, `npm test --workspace=@synlinea/skill-manager` **13 passing**, start smoke HTTP 200 (no backend DI errors). docs backfilled (architecture Structure + ADR-0002 + 3 conventions). **Not committed** (awaiting user). Residuals: UI click-through browser-only (not done); relationship name-match precision (R1); subagents/toggle/plugins/Codex deferred to later cuts.
- Detail of what was built (coder dispatch, VT1–VT7):
  - **VT1** Package skeleton: `packages/skill-manager/` with `package.json`, `tsconfig.json`, common/node/browser source tree. Added `@synlinea/skill-manager: "*"` to `applications/browser/package.json`.
  - **VT2 (de-risk R3)**: Markdown render pipeline uses **Theia's built-in `MarkdownRenderer`** (`@theia/core/lib/browser/markdown-rendering/markdown-renderer`, markdown-it based). `MarkdownBodyView` React component injects the rendered `HTMLElement` via a ref callback. No extra library added.
  - **VT3** Backend scan service (`CapabilityScannerServiceImpl`): globs `~/.claude/skills/*/SKILL.md` + `<workspace>/.claude/skills/*/SKILL.md`; reads `~/.claude/CLAUDE.md` + `<workspace>/CLAUDE.md`. Parses frontmatter with `gray-matter`. Rule fallback: filename + source layer as name, first body line as description.
  - **VT4** Relationship index (Level B): forward refs via `/slash-trigger`, known skill name literals, `[[link]]`; inbound reverse map. Known subagent names captured and flagged `subagent/not-included`.
  - **VT5** Common types (`CapabilityItem`, `CapabilityRef`) + JSON-RPC interface (`CapabilityScannerService`). Backend exposed via `RpcConnectionHandler`; frontend proxy via `WebSocketConnectionProvider.createProxy`.
  - **VT6** `CapabilityTreeWidget` (ReactWidget): two-layer tree (GLOBAL/PROJECT × Skills/Rules + counts), search/filter, item selection fires `onDidSelectItem` Emitter.
  - **VT7** `CapabilityInspectorWidget` (ReactWidget): opens in main area on selection; header (name + type/source badge + trigger), default rendered readme (VT2 pipeline), Rendered/Raw toggle, details (tools/model/path/relationships), [Open in editor] calls `EditorManager.open(URI.fromFilePath(...))`.
  - **R2 choice**: backend RPC wiring done in full (not fallback frontend FileService). `CapabilityViewContribution` fetches workspace root via `WorkspaceService.roots` and calls `scannerService.scan(workspaceRoot)`.
  - **New deps** added to `packages/skill-manager/package.json`: `gray-matter@^4.0.3`, `glob@^10.3.16`, `tslib@^2.8.1`; devDeps: `@types/node@^20.0.0`, `@types/react@^18.3.0`.
  - **BUILD VERIFIED GREEN (2026-06-17)**: tsc exit 0, `lib/browser/*.js` produced, `applications/browser/lib/frontend/bundle.js` present. Root `package.json` already had `build:packages` script added. Clean rebuild (rm -rf lib/) also passed.
  - **Previously uncertain compile points — all resolved by build**:
    1. CSS import in `skill-manager-frontend-module.ts` — uses `../../src/browser/style/capability-panel.css` (Theia pattern); `declare module '*.css'` in `src/browser/style/css-modules.d.ts` satisfies TS but webpack must also resolve it.
    2. `gray-matter` has no published `@types/` — using custom decl at `src/node/types/gray-matter.d.ts`; if `import matter = require('gray-matter')` causes issues, may need `noImplicitAny: false` (already set in root tsconfig).
    3. `CapabilityViewContribution` — `onStart` signature (no `app` param); TypeScript allows narrowing, but confirm no strict error.
    4. `MarkdownRenderer` injection in `CapabilityInspectorWidget` — bound by `@theia/core`'s frontend module already; no re-binding needed; confirm no "no injection target" error at runtime.
    5. `TabBarToolbarContribution` binding — verify `bindRootContributionProvider` registration picks up our contribution at `TabBarToolbarContribution` symbol (from `@theia/core/lib/browser/shell/tab-bar-toolbar/tab-bar-toolbar-registry`).
  - **VT9 tests GREEN (2026-06-17)**: `test/capability-scanner.spec.ts` (13 passing), mocha@10.8.2 + chai@4.5.0 + ts-node@10.9.2. Fixes during the run (main agent, trivial — reported to user): test stub uses `$HOME` instead of reassigning getter-only `os.homedir` (ESM); source self-ref filter added to relationship indexer; removed one unused test helper.
  - **VT10 docs (2026-06-17)**: architecture.md (skill-manager structure + Mocha cmd + build:packages order), ADR-0002 (discovery locations + relationship data model), conventions.md (build-order, ADR-0002 reuse, no native AI).

## Handoff (previous) — v1 Theia browser shell runs; verifier passed; uncommitted

- 2026-06-17: **v1 scaffold DONE and verified green (T1–T10).** Theia 1.72.3 browser-target monorepo (npm + Lerna) builds and boots.
  - **Build (T6)**: `npm install` exit 0 (node-pty compiled) → `npm run build:browser` frontend+backend, **0 errors**.
  - **Start (T7)**: `npm run start:browser` → backend on `127.0.0.1:3000`, HTTP **200**, app title **"Synlinea"**.
  - **Terminal/preview (T8)**: contributions bundled into `lib/frontend`; node-pty `darwin-arm64/pty.node` prebuilt present. ⚠️ verified by bundle inspection, **not** by real browser click-through (see residual).
  - **Lint (T9)**: `npm run lint` exit 0. **Exclusions (T5)**: zero `@theia/ai-*` / `plugin-ext`; npm-only (no yarn.lock); electron deferred.
  - **Docs (T10)**: `architecture.md` Environment+Structure backfilled. verifier verdict = **pass (with residuals)**.
- **NEXT**: (1) optional human click-through of open-md / md-preview / terminal in browser to fully close T8 DoD; (2) **commit** the scaffold on branch `v1-theia-scaffold` (awaiting user — not yet committed); (3) then next cut = first management widget plan (browse/search + edit/preview + toggle, Claude-only) per concept §10.

## Done log (newest first — one line; detail in commit / plan / ADR)
- **v2 Capability x-ray panel** — first custom Theia extension `@synlinea/skill-manager` (two-layer Global/Project nav × Skills+Rules, extension-page inspector w/ rendered readme, Level-B relationships). build/lint/start green, 13 unit tests. ADR-0002. plan v2-capability-xray-panel.md. 2026-06-17.
- **v1 Theia browser shell** — scaffold T1–T10 done + verified (build/start/lint green, port 3000 / HTTP 200). npm+Lerna, @theia/*@1.72.3 minimal set, no ai-*/plugin-ext/electron. 2026-06-17.
- **Bootstrap** — memory scaffold (docs/ tiers, CLAUDE.md Lean, ADR-0001 Theia, glossary seeded from concept.md). 2026-06-15.

## History (resolved, terse)
- Predecessor `cli-ide` (Vue Synlinea, T1–T10) demoted to reference / domain-logic source per ADR-0001.
