# Gotchas — 實戰踩雷紀錄

> 開發 v1→v3 一路遇到的困難 + 解法。補 conventions(forward-binding 規則)與 decisions(ADR)之間的縫:這裡是「當時卡在哪、怎麼解」的具體紀錄,給未來的自己/協作者省時間。
> 通則性的規則已 promote 到 `conventions.md`;這份留具體情境與一次性坑。

## Theia / 建置

- **自訂擴充沒先編成 `lib/` → app build 失敗**。`theia build` 從每個 package 的 `lib/...` 解析 `theiaExtensions`;package 沒先 `tsc` 就會 `Could not resolve @synlinea/...`。解:root `build:browser` 先跑 `build:packages`(`npm run build --workspaces --if-present`)再 build app。→ `conventions.md` / ADR-0002。
- **`@theia/markdown` 在 1.72.3 不存在**。markdown 預覽的正確套件是 **`@theia/preview`**;widget 內渲染 md 用 `@theia/core` 的 `MarkdownRenderer`(markdown-it based,已綁定,直接注入)。
- **Theia 用 npm 不是 yarn**(1.58.0 起改);Node 支援 **>=22 <=24**(本機 24 可直接用,不必降 20)。`node-pty` 走 **prebuilds**(`prebuilds/darwin-arm64/pty.node`),沒有 `build/Release/*.node` 是正常的。
- **底部面板是 tab dock,無法直接「在終端上方疊一條非分頁細列」**。要那樣得動 `DockPanel`/`SplitPanel` 內部,侵入且脆。v3 因此從「終端上方 strip」退到 **status bar item**(常駐、零侵入)。→ ADR-0003 R5。
- **開新終端必須 `await terminal.start()`,否則終端全空白**。`TerminalService.newTerminal()` 只建 widget,**不會 spawn 後端 PTY**;沒先 `await terminal.start()` 就 `open()`/`sendText()` → 終端沒有 shell、沒有輸出(畫面只剩一個未聚焦游標方框),`sendText` 全丟。正確順序:`newTerminal()` → **`await terminal.start()`** → `open()` → 等 prompt → `sendText()`。(v3 claude「卡住空白」的真因;node-pty 後端其實正常。)
- **送指令前再等 shell prompt**:`start()` 後等 `TerminalWidget.onData` 第一筆(prompt 出現)再 `sendText`,加 timeout fallback,避免送太早。
- **`QuickInputService` 用 `showQuickPick(items, opts)`**(回單一 item `T|undefined`),不要用 `.pick(...)`(overload 型別會把結果當陣列,`.id` 報錯)。`QuickPickItem` 無 `id` 欄位 → 用 `label` 推值。

## 測試

- **`os.homedir()` 不能在 ESM 下重新賦值**。ts-node 把 spec 當 ES module 載入時,`os` namespace 是 getter-only,`os.homedir = ...` 會 `Cannot set property homedir ... which has only a getter`。解:**stub `process.env.HOME`**(POSIX 的 `os.homedir()` 讀 `$HOME`),別碰 `os.homedir`。
- **測試框架** = Mocha + chai + ts-node(per-package `test` script,specs 在 `packages/*/test/`)。deps hoist 後跨 package 共用,不必每包重裝。
- **`--max-warnings=0`**:未用的 import / dead helper 會讓 `npm run lint` 直接失敗(當 error 處理),不是只警告。
- **關聯索引器會把自我參照算進去**(v2 bug,測試抓到):forward refs 要 `.filter(ref => ref.name !== item.name)` 排除自己。

## Claude / Codex usage 整合(v3)

- **Claude 週限額不在本機、也不在 `claude -p` 輸出**。試過:本機檔案(無)、`claude usage`/`status` 子命令(無)、`claude -p --output-format json`(只有 per-call token+cost,**沒有** rate-limit)。唯一來源 = 未公開的 **`GET /api/oauth/usage`**(Claude Code 自己 `/usage`/statusline 用的同一個)。
- **`/api/oauth/usage` 不耗 token 配額**(只是讀狀態),但**狂 429** → 必須快取(60s)+ 退避(serve stale)。回 `five_hour`/`seven_day` utilization% + `limits[]`(percent/severity/resets_at)。
- **vs. `claude -p` 探針會扣錢**(真的對話,一次約 $0.08)——別拿它當「查配額」的手段。
- **Claude OAuth token 在 macOS Keychain**,service = `Claude Code-credentials`,JSON `.claudeAiOauth.accessToken`(無明文 cred 檔、無 `ANTHROPIC_API_KEY` env)。headers 要 `anthropic-beta: oauth-2025-04-20` + `anthropic-version: 2023-06-01`。**token 只在記憶體用,絕不 log/落地**。→ ADR-0003 / `conventions.md`。
- **Codex 的配額有落地**:`~/.codex/sessions/**/rollout-*.jsonl`(+ archived)的 `rate_limits`(`primary.window_minutes=10080`=週、`secondary`=session、`plan_type`)。取最新 session 最後一筆即當前狀態。

## 環境 / shell(macOS + 此 harness)

- **`timeout` 在 macOS 沒有**(GNU coreutils 才有 `gtimeout`)。背景指令用工具自帶 timeout,別包 `timeout`。
- **Bash 在沙箱裡 → `kill` / `security`(Keychain)打不到外部程序**。清埠(EADDRINUSE :3000)或讀 Keychain 需 `dangerouslyDisableSandbox`。清埠一行:`lsof -ti tcp:3000 | xargs kill -9`。
- **背景指令的 exit code 會被 pipe 蓋掉**:`npm run build | tail` 的退出碼是 `tail` 的(0),即使 build 失敗也看似成功。要看真 exit 就 **別 pipe**(`cmd > log 2>&1; echo $?`)再 grep log 找 `error TS`/`Finished with`。
- **zsh 細節**:`for f in ...`(漏 `in` 會 parse error);glob `--include="*.ts"` 要引號;`tr` 對 UTF-8 會 `Illegal byte sequence` → `export LC_ALL=C`。

## 工作流 / 角色分工

- **role agents(coder/tester)跑不了 `npm install`/build/test**(權限/hook 擋 mutating bash);**也沒有 SendMessage 續傳同一 agent**(重派=冷啟動)。→ 實務:coder 寫 source、tester 寫 test,**主 agent 跑 build/test 迴圈並補 trivial 編譯錯**(JSDoc `**/`、API 用法、unused import 等),且**先回報使用者**再補。見記憶 [[report-before-self-patching-role-work]]。
- **`src-gen/` 是 theia build 產物但被追蹤**(v1 起)。每次接線變更會 churn;目前照舊一起 commit(改成 gitignore 是未決 housekeeping)。
