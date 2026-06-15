# Architecture
> Stable tier, read-only background. Update only on real structural change.

## Environment
> ⚠️ **Greenfield (2026-06-15)**: Eclipse Theia app not yet scaffolded. Intended stack below; specifics are TBD until the first scaffold task (Phase 2 fills). Detection (`detect-env.py`) found no manifest yet.

- Language / version: **TypeScript / Node.js** (intended — Eclipse Theia is TS/Node; exact versions TBD at scaffold)
- Env manager (conda / venv / pyenv / nvm / system): system Node (TBD — likely nvm/`.nvmrc` at scaffold)
- Package manager: TBD (Theia commonly uses **yarn**; confirm at scaffold)
- Test framework (or "none"): TBD — filled by Phase 2 (full runnable command incl. any container wrapper)
- Lint / Format (or "none"): TBD — filled by Phase 2
- Run / start command: TBD — Theia dev/electron run command, filled at scaffold
- Build / CI command (or "none"): TBD — filled by Phase 2

## Structure
TBD — filled by Phase 2 (execute) after the first task.

> Planned shape (from `docs/concept.md`, not yet built): Theia backend services (domain logic — skill/subagent parse / compile / sync / degrade), custom Theia widgets (skill/subagent manager + compile diff), built-in terminal (runs `claude` / `codex`), markdown editing/preview (Monaco; optional Milkdown webview).

## External dependencies
- Services / APIs: **Claude Code CLI** + **Codex CLI** (the two integration targets — driven from the built-in terminal); **MCP** as the common cross-tool extension substrate.
- Required env vars: TBD
- Other: reference implementation + reusable domain logic source = `/Users/a020121/projects/cli-ide` (Vue Synlinea, T1–T10). See `docs/concept.md`.
