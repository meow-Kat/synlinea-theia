---
status: concept
created: 2026-06-15
project: synlinea-theia
supersedes: cli-ide (Vue Synlinea) — 降為參考實作 / 領域邏輯來源
---

# Synlinea (Theia) — 概念與邏輯整理

> 本檔是新專案的奠基文件,整理「跨 CLI 的 skill/subagent 整合工具」的產品邏輯。
> 尚未寫任何 Theia 程式碼;核心(第一刀)未拍板 — 見 §10 未決。
> 前身:`/Users/a020121/projects/cli-ide`(Vue 版 Synlinea,T1–T10)→ 參考實作 + 可重用的領域邏輯來源。

## 1. 一句話定位
一個 **markdown 為核心、建於 Eclipse Theia** 的桌面工具,整合 **Claude Code CLI 與 Codex**,用來統一**編寫 / 管理 / 跨工具部署** skills、subagents、規則(`CLAUDE.md` / `AGENTS.md`),解決兩個 CLI 之間的**整合與漂移(drift)**問題。

## 2. 為什麼存在(問題)
- Claude Code 原語豐富(skill / subagent / hooks / plugins);Codex 偏**單一代理**(`AGENTS.md` + MCP)。
- 同一套工法要在兩邊用 → 得各維護一份 → **漂移、難治理、難重用**。
- 真正難點不是「同步兩份檔」,而是**把 Claude 較豐富的能力投影到 Codex 較簡單的模型**(含降級策略)。

## 3. 原語對照(整合難點的根源)
| 概念 | Claude Code | Codex |
|---|---|---|
| 專案規則 | `CLAUDE.md` + 全域 `~/.claude/CLAUDE.md` + `@import` | `AGENTS.md` ✅ 對等 |
| Skill | `SKILL.md` + frontmatter,`/<name>` 觸發,可帶 scripts/resources | ❌ 無原生 skill 系統 |
| Subagent | `.claude/agents/*.md`(name/description/tools/model + system prompt) | ❌ 無法 spawn 子代理 |
| Hooks / 權限 | `settings.json`(PreToolUse 等) | `~/.codex/config.toml`(形狀不同) |
| 工具擴充 | MCP + 內建工具 + plugins | **MCP** ✅(唯一真正共通的擴充面) |

> ⚠️ Codex 欄以**每天實際使用的現況**為準(整理者知識界 2026-01,Codex 變動快,可能落後)。

## 4. 三個整合層次與「兩邊都能用」的意義
- **L1 規則** `CLAUDE.md ↔ AGENTS.md`:近對等,shared-region 同步(`/agents-md-sync` 已驗證概念)。
- **L2 Skill**:Codex 無 skill → 投影成 (a) 內嵌進 `AGENTS.md`、(b) **包成 MCP tool〔最乾淨〕**、(c) prompt 模板。
- **L3 Subagent**:Codex 不能 spawn → **接受降級** 或 **MCP / 另起 codex 進程 wrapper** 模擬(`agy` 跨模型派發即在碰這塊)。

## 5. 共通底層 = MCP
MCP 是兩邊**唯一真正對等**的擴充面 → 很可能是「真的兩邊都能跑」的關鍵載體。skill/subagent 能投影成 MCP 的部分,就是可跨工具的部分;不能的,落到「Codex 降級」。

## 6. 三種產品核心切法
1. **編譯器 / 單一來源**(建議押這個):一份 `skill.md` / `agent.md` →(編譯)→ Claude `.claude/…` + Codex `AGENTS.md`/MCP,含降級策略。直接命中「Codex 沒有 skill/subagent」的真痛點。
2. **統一管理 UI**:把散在 `~/.claude/`、`.claude/`、Codex 各處的設定聚成一面板(看 / 編 / 開關 / 搜尋 / 預覽)。
3. **啟動 / 編排**:選好 skill + subagent + rules,一鍵帶對的 context 起 `claude` / `codex`,管理 session。

> 三者會疊起來;**建議第一刀切「1 編譯器 + MCP 當共通底層」**,管理 UI / launcher 是圍著它長出來的殼。

## 7. 已定決策
- **基底**:**Eclipse Theia** — 可完全 rebrand、Monaco + 內建終端 + extension 生態;比 fork VSCode 輕,比 VSCode extension 更能掌控外殼。
- **起點**:**全新專案** `synlinea-theia`(品牌沿用 Synlinea);舊 Vue 版降為參考。
- **不做**:fork VSCode(長期 rebase 太重);VSCode extension(放棄外殼掌控,與自有品牌衝突)。

## 8. 從舊 Synlinea(cli-ide)帶得過去 / 帶不過去
- **帶不過去**:Vue 元件 / 整個 UI(Theia 是 React + 自有 widget/DI 系統)→ 重做。
- **帶得過去(最值錢)**:**框架無關的領域邏輯** — skill/subagent 解析、`CLAUDE.md`↔`AGENTS.md` 同步、檔案掃描、markdown 處理;Milkdown(md WYSIWYG)可塞 Theia webview。

## 9. 技術骨架初探(Theia)
- **backend services**:領域邏輯(掃描 / 解析 / 編譯 / 同步 / 降級策略)。
- **自訂 widgets**:skill/subagent 管理面板、編譯結果 diff / 預覽。
- **內建終端**:跑 `claude` / `codex`。
- **markdown**:Monaco 編輯 + 預覽(可選 Milkdown WYSIWYG webview)。

## 10. 未決(要拍板,決定 v1 形狀)
- **Q1 第一刀**:痛點是 drift(→ 編譯器)、治理散亂(→ 管理 UI)、還是啟動麻煩(→ launcher)?
- **Q2「Codex 也能用」的期待**:(a) 內嵌 `AGENTS.md` /(b) 包 MCP tool /(c) 接受 Codex 降級?
- **v1 範圍**:先做哪一層(L1 / L2 / L3)、先支援哪些 skill/subagent 形態。

## 11. 下一步
1. 拍板 §10 的 Q1 / Q2 / v1 範圍。
2. 寫 Phase-1 計劃 `docs/plans/<v1-core>.md`(依本專案兩階段工法)。
3. (可選)先做 Theia 最小 spike(跑得起來、能開 md、能跑終端)量出工作量。
