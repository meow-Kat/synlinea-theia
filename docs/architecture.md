# Architecture
> Stable tier, read-only background. Update only on real structural change.

## Environment
> Scaffolded 2026-06-17 (v1 Theia browser shell — plan: `docs/plans/v1-theia-scaffold.md`).

- Language / version: **TypeScript ~5.5 / Node.js** — Eclipse Theia **1.72.3**
- Env manager: **nvm / `.nvmrc` = 24** (matches local v24.14.1, which built+ran the scaffold); supported range Node **>=22 <=24**
- Package manager: **npm** + **Lerna** (Theia switched yarn→npm at 1.58.0; npm workspaces)
- Test framework: **none** yet (v1 shell has no domain logic to unit-test; framework added when the first managed logic lands — see `docs/plans/`)
- Lint / Format: **ESLint v9** (flat config, `@typescript-eslint`) + **Prettier** — `npm run lint` / `npm run format`
- Run / start command: `npm run start:browser` (Theia dev server → http://localhost:3000)
- Build / CI command: `npm run build:browser` (`theia build --mode development`); no CI pipeline yet

## Structure
> Greenfield v1 shell. browser-target only (electron deferred). No custom extensions yet.

```
synlinea-theia/
├── .nvmrc                      # Node 22
├── package.json                # root: private, npm workspaces (applications/*, packages/*), lint/build/start scripts
├── lerna.json                  # Lerna monorepo (independent versions, npmClient npm)
├── tsconfig.json               # root TS base (ES2020, decorators, skipLibCheck)
├── eslint.config.js            # ESLint v9 flat config
├── .prettierrc.json / .prettierignore
├── applications/
│   └── browser/                # the Theia app (@synlinea/browser-app)
│       ├── package.json        # @theia/* @ 1.72.3 + @theia/cli (dev); build:browser / start:browser; theia.target=browser, applicationName=Synlinea
│       ├── tsconfig.json
│       └── lib/                # build output (gitignored): frontend/ backend/ prebuilds/
└── packages/                   # placeholder for future custom Theia extensions (.gitkeep)
```

**Bundled `@theia/*` (1.72.3, minimal set):** core, editor, monaco, **preview** (markdown/HTML preview — NB: `@theia/markdown` does not exist at 1.72.3), terminal (node-pty prebuilt; darwin-arm64 verified), filesystem, workspace, navigator, messages, preferences.

**Deliberately excluded (per plan; each is a later additive task, no architecture change):** `@theia/ai-*` (native AI framework — AI runs via `claude`/`codex` in the built-in terminal instead), `@theia/plugin-ext*` (Open VSX runtime plugins), electron packaging.

> Planned next shapes (from `docs/concept.md`, not yet built): custom Theia widgets (skill/subagent manager + compile diff) under `packages/`, backend services (parse / compile / sync / degrade), built-in terminal driving `claude` / `codex`.

## External dependencies
- Services / APIs: **Claude Code CLI** + **Codex CLI** (the two integration targets — driven from the built-in terminal); **MCP** as the common cross-tool extension substrate.
- Required env vars: TBD
- Other: reference implementation + reusable domain logic source = `/Users/a020121/projects/cli-ide` (Vue Synlinea, T1–T10). See `docs/concept.md`.
