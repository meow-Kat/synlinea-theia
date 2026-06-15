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
