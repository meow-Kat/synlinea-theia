# Synlinea (Theia)

A markdown-centric desktop tool built on **Eclipse Theia**, integrating **Claude Code** and **Codex** — for authoring / managing / inspecting skills, subagents, rules, and usage across the two CLIs.

See `docs/concept.md` for the product concept, `docs/architecture.md` for the stack, and `docs/gotchas.md` for known pitfalls.

## Prerequisites

- **Node.js** `>=22 <=24` (repo pins `24` via `.nvmrc`; local dev verified on v24)
- **npm** (the package manager — Theia uses npm + Lerna; do **not** use yarn)
- macOS for the Claude usage feature (reads the OAuth token from Keychain)

```bash
nvm use            # picks up .nvmrc (Node 24)
```

## Install

```bash
npm install
```
First install is large (downloads Theia + compiles `node-pty`); allow a few minutes.

## Build

```bash
npm run build:browser      # compiles workspace packages first, then the browser app
```
> `build:browser` runs `build:packages` (tsc each `packages/*`) before the Theia app build — custom extensions must emit `lib/` first.

## Run / open the app

```bash
npm run start:browser
```
Then open **http://localhost:3000**. Wait for the log line:
```
Theia app listening on http://127.0.0.1:3000
```

One-liner (rebuild + start, e.g. after code changes):
```bash
npm run build:browser && npm run start:browser
```

## Stop / close the app

Press **`Ctrl+C`** in the terminal running the server, or free the port:

```bash
lsof -ti tcp:3000 | xargs kill -9
```

Check whether the app is running:
```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

## Lint & test

```bash
npm run lint                                   # ESLint + Prettier (max-warnings 0)
npm test --workspace=@synlinea/skill-manager   # capability x-ray unit tests
npm test --workspace=@synlinea/usage-monitor   # usage parser unit tests
```

## Features (current)

- **Capability x-ray** (`@synlinea/skill-manager`) — two-layer (Global / Project) browser of Claude Code Skills + Rules, with an extension-page-style inspector (rendered readme + relationships).
- **Usage quota** (`@synlinea/usage-monitor`) — press **`Cmd/Ctrl+Alt+U`** (or click the **`⚡ Usage`** item in the bottom status bar) → pick **Claude** or **Codex** → opens a terminal running that CLI and shows its current-session + weekly quota. Claude data via `api/oauth/usage`; Codex via local session files.

## Troubleshooting

- **`EADDRINUSE: address already in use 127.0.0.1:3000`** — a previous server is still holding the port. Free it: `lsof -ti tcp:3000 | xargs kill -9`, then start again.
- **Code changes not showing** — rebuild (`npm run build:browser`) and refresh the browser; the browser app serves the built bundle.
- **Blank/stuck terminal, missing weekly limit, etc.** — see `docs/gotchas.md`.
