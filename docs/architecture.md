# Architecture
> Stable tier, read-only background. Update only on real structural change.

## Environment
> Scaffolded 2026-06-17 (v1 Theia browser shell — plan: `docs/plans/v1-theia-scaffold.md`).

- Language / version: **TypeScript ~5.5 / Node.js** — Eclipse Theia **1.72.3**
- Env manager: **nvm / `.nvmrc` = 24** (matches local v24.14.1, which built+ran the scaffold); supported range Node **>=22 <=24**
- Package manager: **npm** + **Lerna** (Theia switched yarn→npm at 1.58.0; npm workspaces)
- Test framework: **Mocha + chai** via **ts-node** (added in v2). Run per package: `npm test --workspace=@synlinea/skill-manager` (specs: `packages/*/test/**/*.spec.ts`). No root aggregate `test` script yet.
- Lint / Format: **ESLint v9** (flat config, `@typescript-eslint`) + **Prettier** — `npm run lint` / `npm run format`
- Run / start command: `npm run start:browser` (Theia dev server → http://localhost:3000)
- Build / CI command: `npm run build:browser` — **compiles workspace packages first** (`build:packages` = `npm run build --workspaces --if-present`, i.e. `tsc` each `packages/*`) then `theia build --mode development`. Custom extensions MUST emit `lib/` before the app build resolves their `theiaExtensions`. No CI pipeline yet.

## Structure
> browser-target only (electron deferred). First custom extension landed in v2 (`skill-manager`).

```
synlinea-theia/
├── .nvmrc                      # Node 24
├── package.json                # root: private, npm workspaces; build:packages→build:browser, lint, test-per-workspace
├── lerna.json                  # Lerna monorepo (independent versions, npmClient npm)
├── tsconfig.json               # root TS base (ES2020, decorators, skipLibCheck)
├── eslint.config.js            # ESLint v9 flat config
├── .prettierrc.json / .prettierignore
├── applications/
│   └── browser/                # the Theia app (@synlinea/browser-app); depends on @synlinea/skill-manager
│       ├── package.json        # @theia/* @ 1.72.3 + @theia/cli (dev); theia.target=browser, applicationName=Synlinea
│       ├── tsconfig.json
│       └── lib/                # build output (gitignored)
└── packages/
    └── skill-manager/          # @synlinea/skill-manager — first custom Theia extension (Capability x-ray, v2)
        ├── package.json        # theiaExtensions → lib/{browser,node}/...; deps: @theia/core/editor/workspace, gray-matter, glob
        ├── tsconfig.json       # emits lib/ (rootDir src, outDir lib)
        ├── src/
        │   ├── common/         # CapabilityItem/CapabilityRef types + JSON-RPC service interface
        │   ├── node/           # CapabilityScannerServiceImpl (scan ~/.claude + workspace, frontmatter parse, Level-B relationship index) + backend DI module
        │   └── browser/        # CapabilityTreeWidget (two-layer nav) + CapabilityInspectorWidget (extension-page-style, rendered readme via @theia/core MarkdownRenderer) + view contribution + frontend DI module
        ├── test/               # Mocha specs (capability-scanner.spec.ts) + ts-node tsconfig
        └── lib/                # tsc output (gitignored) — must exist before app build
```

**v2 extension `skill-manager` (Capability x-ray, Claude Code only):** scans Skills (`~/.claude/skills/*/SKILL.md` + project `.claude/skills/`) and Rules (`~/.claude/CLAUDE.md` + project `CLAUDE.md`); two-layer (Global/Project) tree + right-side inspector with default-rendered readme + relationships (Level B: forward refsOut + inbound refsIn, scoped to skill+rule; subagent refs flagged not-included). Backend logic exposed to frontend via Theia JSON-RPC. **Subagents, toggle, plugins-source, Codex deferred.**

**Bundled `@theia/*` (1.72.3, minimal set):** core, editor, monaco, **preview** (markdown/HTML preview — NB: `@theia/markdown` does not exist at 1.72.3), terminal (node-pty prebuilt; darwin-arm64 verified), filesystem, workspace, navigator, messages, preferences.

**Deliberately excluded (per plan; each is a later additive task, no architecture change):** `@theia/ai-*` (native AI framework — AI runs via `claude`/`codex` in the built-in terminal instead), `@theia/plugin-ext*` (Open VSX runtime plugins), electron packaging.

> Planned next shapes (from `docs/concept.md`, not yet built): custom Theia widgets (skill/subagent manager + compile diff) under `packages/`, backend services (parse / compile / sync / degrade), built-in terminal driving `claude` / `codex`.

## External dependencies
- Services / APIs: **Claude Code CLI** + **Codex CLI** (the two integration targets — driven from the built-in terminal); **MCP** as the common cross-tool extension substrate.
- Required env vars: TBD
- Other: reference implementation + reusable domain logic source = `/Users/a020121/projects/cli-ide` (Vue Synlinea, T1–T10). See `docs/concept.md`.
