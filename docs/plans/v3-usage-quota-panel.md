---
status: approved
created: 2026-06-17
revised: 2026-06-17
---

# v3 第三刀:Usage 配額(快捷鍵驅動,開終端 + 示配額;Claude + Codex)

> 第二個自訂 Theia 擴充 `packages/usage-monitor/`。資料源已用探針實證。
> **設計經多輪討論收斂(2026-06-17,取代初版「終端上方常駐 strip + 啟動自動開終端 + 同時示兩工具」)**:
> 改為**快捷鍵驅動**——一鍵 → quick-pick 選 claude/codex → 開一個終端跑該 CLI + 顯示**該工具**配額。

## 需求 / 目標
讓使用者按一個快捷鍵就能「開工具終端 + 看該工具配額」。完成定義(DoD):

1. 註冊一個 **command + keybinding**(預設 `Cmd+Alt+U` / `Ctrl+Alt+U`,可改);按下 → 跳 **quick-pick** 選 **Claude** 或 **Codex**。
2. 選定後:**開一個新終端並執行對應 CLI**(`claude` / `codex`),**同時顯示該工具配額**。
3. **配額內容(精簡:兩個數)**:current session + weekly 的 utilization%(Claude=five_hour + seven_day;Codex=secondary + primary)+ 重置時間;**有才顯示**,拿不到 → 標 N/A。
4. **刷新**:配額顯示後 **60s 自動刷新**;再按快捷鍵 = 手動刷新 / 重開。
5. 配額顯示**貼著該終端**或 **status bar**(實作擇一,見 R5);只顯示**當前選定工具**的兩個數。

## 介面樣子(定案)
```
   按 Cmd+Alt+U
        ↓
   ┌ 選擇工具 ──────┐
   │ ▸ Claude        │   ← quick-pick
   │   Codex         │
   └─────────────────┘
        ↓ (選 Claude)
   開新終端跑 `claude`,並顯示:
   ┌──────────────────────────────────────┐
   │ Claude   session 28%   weekly 81% ⚠   │ ← 該工具配額(兩個數)
   ├──────────────────────────────────────┤
   │ $ claude                               │ ← 終端
   │ > _                                    │
   └──────────────────────────────────────┘
```

## 範圍(含明確不做的事)
**做:**
- **重用**已實作且 build 綠的資料層:`ClaudeUsageProvider`(keychain + `/api/oauth/usage` + 60s 快取 + 429 退避)、`CodexUsageProvider`(讀最新 session 檔)、`UsageService`(RPC)、共同型別。
- 前端:**command + keybinding + quick-pick(Claude/Codex)** → 用 `TerminalService` 開新終端、`sendText("claude"/"codex")` 跑該 CLI → 顯示**該工具**配額(兩個數,% + 重置)。
- 顯示時 60s 自動刷新;條件顯示(不可用標 N/A)。

**明確不做(改自初版 / 留後續):**
- ~~全域常駐 strip 同時示兩工具~~、~~啟動自動開終端~~ → **改成快捷鍵驅動、單工具**。
- **終端前景程序偵測**(自動判斷終端在跑啥)→ 用 quick-pick 由使用者選,**不做程序偵測**。
- **每日趨勢**、**歷史 token/成本聚合**、**非 macOS token**、**自動高頻/自適應輪詢** → 後續。
- **plan_type / token 明細 / secondary 等額外欄位** → v1 只留 current session + weekly 兩個數。

## 影響的檔案 / 模組
```
packages/usage-monitor/
├── src/common/   # UsageWindow / ToolUsage 型別 + RPC 介面（已完成,可能精簡欄位）
├── src/node/     # Claude/Codex providers + UsageService + backend DI（已完成,重用）
└── src/browser/  # ★改寫:command + keybinding + quick-pick + 開終端跑 CLI + 該工具配額顯示 + DI
```
修改:`applications/browser/package.json`(已加依賴);`docs/architecture.md`(擴充 + 快捷鍵互動);ADR-0003(usage 資料源 + schema + endpoint)。

## 做法概述
1. **重用** UT3–UT5(providers + UsageService + RPC),前端 proxy 已可呼 `getUsage()`(回 `ToolUsage[]`,含 Claude/Codex 各自 windows)。
2. **Command**(browser)`usageMonitor.openToolTerminal`:用 `QuickInputService` 跳「Claude / Codex」選單。
3. 選定後:`TerminalService.newTerminal({...})` + `open()` + `sendText("claude\n" / "codex\n")` 開終端跑 CLI。
4. **配額顯示**:取 `getUsage()` 裡該工具的 `ToolUsage`,render **session + weekly 兩個數**(% + 重置;不可用 N/A)。顯示載體:status bar item 或貼終端的小 inline(R5 擇一)。
5. **keybinding**:`KeybindingContribution` 綁 `Cmd+Alt+U`(可改)到該 command。
6. 顯示後 60s timer 重抓(dispose 清除)。
7. 驗證:按鍵 → 選 Claude → 開 claude 終端 + 顯示 Claude session/weekly(本機 weekly ~81%);選 Codex 同理;斷 Codex 資料 → 標 N/A。
8. 回填 architecture(快捷鍵互動);ADR-0003。

## 取捨與替代方案
- **快捷鍵驅動(非常駐 strip)**:使用者最終要的是「按鍵 → 開工具終端 + 看該工具配額」,比常駐全域列更貼其工作流;也避開「終端上方疊非分頁細條」的侵入式佈局(初版 R5 痛點)。
- **quick-pick 選工具(非程序偵測)**:偵測終端在跑 claude/codex 需 `ps` pty 子程序、跨平台脆;quick-pick 由人選,零偵測成本、明確。
- **顯示只兩個數**:使用者明示「整體不需個別」→ 砍掉 plan_type/token/secondary 細節,只留 current session + weekly。
- **資料層全重用**:providers/RPC 已 build 綠,本次只改前端互動。

## 測試計畫
- **單元(node)**:Claude 回應解析器(探針 JSON fixture → session/weekly %)、Codex 解析器(rollout fixture)、正規化;**不打真端點**。(資料層測試,與前端互動無關,照舊。)
- **build smoke** + **lint** 綠。
- **手測**:快捷鍵 → quick-pick → 開對應 CLI 終端 + 顯示該工具兩個數;斷 Codex → N/A。

## 風險 / 未決問題
- **R1 端點限流 / 未公開**:`/api/oauth/usage` 會狂 429、未公開 → 快取 + 退避 + graceful degrade(已實作於 provider)。
- **R2 Keychain 取用**:backend `security` 讀 Keychain,打包後可能需授權;失敗即降級。
- **R3 token 過期**:401 → 降級不可用,不自行 refresh。
- **R4 隱私/ToS**:token 僅記憶體用、不落地、不入 log。
- **R5 配額顯示載體**:既然 per-tool on-demand,傾向 **status bar item**(常駐、零侵入)顯示當前選定工具兩個數;或貼終端的小 inline。實作早期定;status bar 為穩妥預設。
- **R6 開終端 + sendText 時序**:新終端要等 shell ready 才 `sendText` CLI,否則指令丟失 → 需在 terminal open/ready 後再送。
