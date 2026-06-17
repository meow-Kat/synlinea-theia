# Tasks
> Hot tier. Approved execution list (rolling). Read on session start. Update as tasks move.
> Completed work is one terse line under "Done"; full detail lives in the commit + the per-task plan in docs/plans/ + ADRs in decisions.md.

## Active — v2 Capability x-ray panel (plan: docs/plans/v2-capability-xray-panel.md, approved 2026-06-17)
> First custom Theia extension. Two-layer nav (Global/Project) × Skills+Rules; right-side extension-page-style inspector (default rendered readme); relationships Level B. Subagents deferred.
- [x] VT1 Extension skeleton `packages/skill-manager/` (common/node/browser, package.json, tsconfig, DI modules) + wire `@synlinea/skill-manager` into applications/browser; build still green (empty contribution)
- [x] VT2 De-risk EARLY (R3): confirm markdown→rendered-HTML pipeline works inside a custom widget (Theia md render / @theia/preview, else markdown-it fallback) — used Theia's built-in MarkdownRenderer
- [x] VT3 backend scan service (node): glob skills (`~/.claude/skills/*/SKILL.md` + project) + rules (`~/.claude/CLAUDE.md` + project CLAUDE.md); frontmatter parse w/ fallback for no-frontmatter rules
- [x] VT4 backend relationship index (Level B): forward refsOut (`/cmd`, known skill names, `[[link]]`) + inbound refsIn (reverse map); mark refs to not-yet-included subagents
- [x] VT5 common: `CapabilityItem` types + JSON-RPC interface; expose service to frontend
- [x] VT6 frontend: two-layer tree (Global/Project × Skills/Rules) + search/filter + Refresh command (toolbar)
- [x] VT7 frontend: Inspector ReactWidget — header (name + type/source badge + skill trigger) + DEFAULT rendered readme + Rendered/Raw toggle + details (tools/model/path/relationships) + [Open in editor]
- [x] VT8 build + lint green incl. new extension (fixed build order: root build:browser now compiles packages first via build:packages). frontend+backend 0 errors; lint exit 0; start smoke HTTP 200, no backend DI errors. (UI click-through still residual — browser only)
- [x] VT9 unit tests GREEN: `test/capability-scanner.spec.ts`, **13 passing**. framework mocha+chai+ts-node; `npm test --workspace=@synlinea/skill-manager`. Fixes during run (main agent, trivial): stub via `$HOME` not os.homedir reassignment (ESM getter); source self-ref filter in indexer; removed dead helper.
- [x] VT10 backfilled `docs/architecture.md` (skill-manager structure + Mocha test cmd + build:packages order); ADR-0002 (discovery locations + relationship data model); promoted 3 conventions (build-order, ADR-0002 reuse, no native AI)

## Done (newest first — one line; detail in commit / plan / ADR)
- v1 Theia browser shell scaffolded + verified (build/start/lint green, :3000) — npm+Lerna, @theia/*@1.72.3 minimal set, no ai-*/plugin-ext/electron. commit bcd8f33, plan v1-theia-scaffold.md. 2026-06-17.
- Memory scaffold initialized (agent-memory-scaffold) — docs/ tiers + CLAUDE.md (Lean) + ADR-0001 (Theia). 2026-06-15.
