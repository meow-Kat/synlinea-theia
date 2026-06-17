# Progress
> Hot tier. Live handoff + terse done log. Outcome summaries, NOT a copy of tasks.md checkmarks.
> Per-task detail lives in the commit + the approved plan (`docs/plans/`) + ADRs (`decisions.md`).

## Handoff (current) — v1 Theia browser shell runs; verifier passed; uncommitted

- 2026-06-17: **v1 scaffold DONE and verified green (T1–T10).** Theia 1.72.3 browser-target monorepo (npm + Lerna) builds and boots.
  - **Build (T6)**: `npm install` exit 0 (node-pty compiled) → `npm run build:browser` frontend+backend, **0 errors**.
  - **Start (T7)**: `npm run start:browser` → backend on `127.0.0.1:3000`, HTTP **200**, app title **"Synlinea"**.
  - **Terminal/preview (T8)**: contributions bundled into `lib/frontend`; node-pty `darwin-arm64/pty.node` prebuilt present. ⚠️ verified by bundle inspection, **not** by real browser click-through (see residual).
  - **Lint (T9)**: `npm run lint` exit 0. **Exclusions (T5)**: zero `@theia/ai-*` / `plugin-ext`; npm-only (no yarn.lock); electron deferred.
  - **Docs (T10)**: `architecture.md` Environment+Structure backfilled. verifier verdict = **pass (with residuals)**.
- **NEXT**: (1) optional human click-through of open-md / md-preview / terminal in browser to fully close T8 DoD; (2) **commit** the scaffold on branch `v1-theia-scaffold` (awaiting user — not yet committed); (3) then next cut = first management widget plan (browse/search + edit/preview + toggle, Claude-only) per concept §10.

## Done log (newest first — one line; detail in commit / plan / ADR)
- **v1 Theia browser shell** — scaffold T1–T10 done + verified (build/start/lint green, port 3000 / HTTP 200). npm+Lerna, @theia/*@1.72.3 minimal set, no ai-*/plugin-ext/electron. 2026-06-17.
- **Bootstrap** — memory scaffold (docs/ tiers, CLAUDE.md Lean, ADR-0001 Theia, glossary seeded from concept.md). 2026-06-15.

## History (resolved, terse)
- Predecessor `cli-ide` (Vue Synlinea, T1–T10) demoted to reference / domain-logic source per ADR-0001.
