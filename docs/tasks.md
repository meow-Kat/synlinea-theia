# Tasks
> Hot tier. Approved execution list (rolling). Read on session start. Update as tasks move.
> Completed work is one terse line under "Done"; full detail lives in the commit + the per-task plan in docs/plans/ + ADRs in decisions.md.

## Active — v3 Usage quota strip (plan: docs/plans/v3-usage-quota-panel.md, approved 2026-06-17)
> Usage strip pinned above the terminal; auto-open terminal on startup. Claude (/api/oauth/usage) + Codex (latest session rate_limits), shown separately, conditional. Refresh: auto 60s + manual. Defaults: independent extension `usage-monitor`; Claude session=five_hour / Codex session=secondary / weekly aligned.
- [x] UT1 Extension skeleton `packages/usage-monitor/` (common/node/browser, package.json, tsconfig, DI) + wire into applications/browser; build green (empty contribution)
- [x] UT2 common: `UsageWindow` / `ToolUsage` types + JSON-RPC service interface
- [x] UT3 backend ClaudeUsageProvider: read Keychain `Claude Code-credentials` → `.claudeAiOauth.accessToken` → GET `/api/oauth/usage` (headers: Bearer / anthropic-beta oauth-2025-04-20 / anthropic-version 2023-06-01) → parse five_hour/seven_day/limits/severity; 60s cache + 429 backoff (stale fallback); available:false on fail; token NEVER logged
- [x] UT4 backend CodexUsageProvider: find latest `~/.codex/sessions/**/rollout-*.jsonl` (+archived) → last `rate_limits` (primary/secondary/plan_type) + `total_token_usage`; available:false if none
- [x] UT5 backend UsageService aggregates both providers; expose via RPC
> REVISED 2026-06-17: interaction changed to hotkey-driven (one key → quick-pick claude/codex → open terminal running that CLI + show THAT tool's session+weekly). UT3–UT5 data layer reused as-is; UT6/UT7 reworked below. Drop: global always-on strip, startup auto-open terminal, showing both tools.
- [x] UT6 frontend command `usageMonitor.openToolTerminal` + keybinding (default Cmd/Ctrl+Alt+U): QuickInput pick Claude/Codex → TerminalService.newTerminal + open + sendText `claude`/`codex` (after shell ready, R6)
- [x] UT7 frontend quota display for the selected tool: current session + weekly (2 numbers: %, reset; Claude=five_hour+seven_day / Codex=secondary+primary), conditional N/A, 60s auto-refresh; surface = status-bar item (R5 default) or inline near terminal
- [x] UT8 build + lint green (frontend+backend 0 errors; lint exit 0; start smoke HTTP 200, no DI errors). Fixes during build (main agent, trivial, reported): codex comment `**/` closing JSDoc; 2 unused imports; quick-pick API `pick`→`showQuickPick`. UI hotkey/quota click-through still residual (browser only).
- [x] UT9 unit tests GREEN: claude-usage-provider.spec.ts + codex-usage-provider.spec.ts, **26 passing** (`npm test --workspace=@synlinea/usage-monitor`). No fixes needed.
- [x] UT10 backfilled `docs/architecture.md` (usage-monitor extension + hotkey interaction + usage data sources); ADR-0003 (asymmetric data sources + normalized schema + oauth/usage endpoint + hotkey design); promoted 2 conventions (external-data degrade / secret I/O in backend)

## Done (newest first — one line; detail in commit / plan / ADR)
- v2 Capability x-ray panel — `@synlinea/skill-manager` (two-layer Global/Project × Skills+Rules, extension-page inspector w/ rendered readme, Level-B relationships); build/lint/start green, 13 unit tests; ADR-0002. commit afa1189. 2026-06-17.
- v1 Theia browser shell scaffolded + verified (build/start/lint green, :3000) — npm+Lerna, @theia/*@1.72.3 minimal set, no ai-*/plugin-ext/electron. commit bcd8f33. 2026-06-17.
- Memory scaffold initialized (agent-memory-scaffold) — docs/ tiers + CLAUDE.md (Lean) + ADR-0001 (Theia). 2026-06-15.
