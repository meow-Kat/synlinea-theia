# Glossary
> Stable tier, read-only background. Add a term only when it appears in code or docs.

## Terms

### Skill
A reusable, model-invocable capability. In Claude Code: a `SKILL.md` (YAML frontmatter + body), triggered by `/<name>`, optionally bundling scripts/resources. Codex has no native skill system → a cross-tool skill must be *projected* (embed into AGENTS.md / wrap as an MCP tool / prompt template). See `docs/concept.md` §4.

### Subagent
A scoped delegate agent. In Claude Code: `.claude/agents/*.md` (frontmatter: name/description/tools/model + system prompt), dispatched via the Task/Agent tool. Codex cannot spawn subagents → degrade or emulate via MCP / separate `codex` processes.

### MCP (Model Context Protocol)
The one extension surface both Claude Code and Codex support. The likely common substrate for "works on both": whatever a skill/subagent can be projected onto as an MCP tool becomes genuinely cross-tool.

### CLAUDE.md
Claude Code's project (and global `~/.claude/`) instruction/rules file; supports `@import`.

### AGENTS.md
Codex's project instruction file — the rough equivalent of `CLAUDE.md`. Kept aligned via `/agents-md-sync` (shared region markers).

### Eclipse Theia
The IDE platform this project is built on: Monaco editor + built-in terminal + extension model, fully rebrandable. → ADR-0001.

### Claude Code / Codex
The two coding-agent CLIs this tool integrates and drives (from the built-in terminal).
