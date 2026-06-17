# Decisions
> Append-only log. Newest entry first. One entry per major trade-off (architecture, framework, protocol, library, …).
> Status flow: proposed → accepted → (later) superseded by ADR-NNNN | deprecated.

<!-- ADR template — copy, fill, prepend:

## ADR-NNNN: <title>
**Date**: <YYYY-MM-DD>
**Status**: proposed | accepted

### Context
### Decision
### Consequences
### Alternatives considered
-->

## Entries
<!-- newest first -->

## ADR-0002: Capability discovery locations + relationship data model (v2 skill-manager)
**Date**: 2026-06-17
**Status**: accepted

### Context
The first management feature (v2 Capability x-ray panel) must discover Claude Code skills/rules on disk and surface how they relate. These conventions (where to look, what shape the parsed item is, how relationships are computed) will be reused by every later cut (subagents, toggle, Codex projection), so they are fixed here rather than re-decided per feature.

### Decision
- **Discovery locations (Claude Code only, this cut = Skills + Rules):**
  - Skills: `~/.claude/skills/*/SKILL.md` (global) + `<workspace>/.claude/skills/*/SKILL.md` (project)
  - Rules: `~/.claude/CLAUDE.md` (global) + `<workspace>/CLAUDE.md` (project)
  - Home dir via `os.homedir()` (POSIX honors `$HOME`). Subagents (`~/.claude/agents/`), plugins-sourced items, and Codex are explicitly out of this cut.
- **Data model:** `CapabilityItem { type:'skill'|'rule', name, description, path, source:'global'|'project', tools?, model?, body, refsOut, refsIn }`. Frontmatter parsed with `gray-matter`; rules typically lack frontmatter → name = filename + source layer, description = first meaningful body line.
- **Relationships = Level B:** forward `refsOut` from body scan (`/<skill>` slash-trigger, plain skill-name literals, `[[wiki-link]]`); inbound `refsIn` = reverse map. Scoped to scanned skill+rule. References to known-but-not-scanned subagent names are captured with `included:false` + `excludedReason`. **Self-references are excluded.** Level C (settings.json/hooks "used-by") deferred.
- **Backend/frontend split:** scan + parse + index run in a Theia **node** service, exposed to the browser via JSON-RPC (`RpcConnectionHandler` / `WebSocketConnectionProvider.createProxy`).

### Consequences
- Later cuts extend this model (add `type:'subagent'`, widen relationship scope, add Level C) without redesign.
- Name-literal matching can false-positive (R1 in plan); accepted for Level B, precision tuned later.
- Custom Theia extensions must `tsc`→`lib/` before the app build resolves `theiaExtensions` → root `build:browser` compiles packages first (`build:packages`). See `conventions.md`.

### Alternatives considered
- Frontend-only FileService scan (no backend RPC) — rejected: relationship index belongs server-side, reused by future non-UI consumers.
- Level A (forward only) — rejected: misses "used-by", the user's core ask. Level C (hooks/settings) — deferred: high parse cost, low payoff now.

## ADR-0001: Build on Eclipse Theia as a fresh project (not VSCode fork / extension / Vue port)
**Date**: 2026-06-15
**Status**: accepted

### Context
The product pivoted to a markdown-centric tool integrating Claude Code CLI + Codex to solve skill/subagent integration (see `docs/concept.md`). The prior Vue "Synlinea" (`cli-ide`) is editor-light and its UI doesn't fit; options weighed: continue Vue app, VSCode extension, fork VSCode, or Eclipse Theia.

### Decision
Start a **fresh Eclipse Theia project**. Theia gives Monaco + built-in terminal + extension model + full rebrandability, lighter than forking VSCode and without surrendering the app shell (which a VSCode extension would). The old Vue Synlinea is demoted to a reference implementation + a source of framework-agnostic domain logic (skill/subagent parsing, CLAUDE.md↔AGENTS.md sync).

### Consequences
- Vue UI is rebuilt as Theia widgets; only the domain logic carries over.
- Larger up-front cost than continuing the Vue app, but the right base if the product becomes a real IDE-grade tool.
- The `cli-ide` `desktop-native-ipc` plan is rejected (superseded by this direction).

### Alternatives considered
- Continue Vue app — rejected: editor-centric IDE capabilities would be reinvented.
- VSCode extension — rejected: cannot deeply rebrand / control the shell.
- Fork VSCode — rejected: heavy long-term upstream-rebase maintenance.
