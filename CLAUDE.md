<!-- harness:shared:start -->
## Autoload
@docs/architecture.md
@docs/conventions.md
@docs/glossary.md

## Refer to
- Work loop, roles, memory tiers, guards: see global CLAUDE.md / AGENTS.md.
- **Before any task, READ docs/ memory** — stable tier (architecture / conventions / flow / glossary) + hot tier (tasks.md / progress.md on session start) + check plans/ for in-flight work. docs/ is the only shared handoff channel; sub-agents fly blind without it.
- **Founding doc**: `docs/concept.md` — product concept + the open decisions (§10) that gate the first Phase-1 plan. Read it before proposing v1 scope.
- **Gotchas**: `docs/gotchas.md` — concrete pitfalls hit in v1–v3 (Theia build order, os.homedir/ESM tests, Claude `/api/oauth/usage`, sandbox/shell, role-agent build loop). Skim before touching build, tests, or Claude/Codex usage integration.
- Project-specific overrides go below — keep this file lean (~80 lines).
<!-- harness:shared:end -->

<!-- harness:claude:start -->
<!-- Claude Code-specific notes; delete if unused -->
<!-- harness:claude:end -->

<!-- harness:codex:start -->
<!-- Codex-specific notes; delete if unused.
     This project ships cross-tool (Claude Code + Codex). Generate AGENTS.md from the
     shared region above via /agents-md-sync once you start driving this repo with Codex. -->
<!-- harness:codex:end -->
