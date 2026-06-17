---
status: approved
created: 2026-06-17
---

# v2 第二刀:Capability 透視面板(兩層導覽 + 套件說明頁式 x-ray;Skills + Rules,Claude Code only)

> 前一刀(v1 Theia 骨架)已 commit(bcd8f33)。本刀是第一個**自訂 Theia 擴充**,長在 `packages/` 下。
> 設計經功能討論定案(2026-06-17):
> - 左側**兩層**導覽(Global / 專案)。
> - 右側透視 = **「延伸套件說明頁」式**(header + 渲染 readme + details);因 skill 規格一致,可比照套件 marketplace 頁呈現。
> - 關聯做到 **Level B**(forward + 反向索引;不含 hooks/settings)。
> - **本刀只做 Skills + Rules;Subagents 延後到下一刀。**

## 需求 / 目標
做出第一個管理面板:左側兩層(Global / 專案)導覽 Claude Code 的 **skill / rule**,點一個項目 → 右側像看延伸套件說明頁一樣**透視**它(渲染 readme + metadata + 關聯)。完成定義(DoD):

1. 左側面板**兩層**:`GLOBAL (~/.claude)` 與 `PROJECT (<workspace>)`,各分組 **Skills / Rules**(+ 計數)。
2. 點任一 skill/rule → **右側套件說明頁式透視**:
   - **Header**:name + 類型 badge(Skill/Rule)+ 來源 badge(Global/Project)+(skill)觸發 `/<name>`。
   - **Readme（核心）**:**預設即顯示渲染後的 markdown 預覽效果**(標題/清單/程式碼塊…),透視當下立即可見、**不需額外點「預覽」**。因這些是餵 AI 的指令稿,渲染呈現才看得懂其結構。可選一個 **Rendered / Raw 切換**(預設 Rendered;Raw 顯示原始 md)。
   - **Details**:能力(skill 的 tools/model 等 frontmatter)、path、**關聯**(引用 → / 被用 ←)。
3. 關聯 **Level B**:forward(它引用誰)+ inbound(誰用到它),範圍 = 所有掃到的 **skill + rule** 互參。
4. 搜尋/過濾框;手動 **Refresh** 重掃。
5. **[開檔編輯]**(在 Monaco 開原始檔)。

## 介面樣子(定案)
```
┌─ Capabilities ──────┐┌─ Inspector(延伸套件說明頁式) ───────────────┐
│ 🔍 search…          ││  ⬡ agent-memory-scaffold                       │
│ ▾ GLOBAL (~/.claude)││     Skill · GLOBAL · 觸發 /agent-memory-scaffo… │
│   ▾ Skills (7)      ││  ──────────────────────────────────────────────│
│      agent-memory ◀ ││  「Readme」渲染 SKILL.md ───────────────────── │
│      agy-dispatch   ││   # Agent Memory Scaffold                       │
│      guardrails-…   ││   Use when entering a project to set up…        │
│   ▾ Rules           ││   ## What it does …(rendered markdown)…         │
│      CLAUDE.md (G)  ││                                                 │
│ ▾ PROJECT (synlin…) ││  「Details」──────────────────────────────────  │
│   ▾ Skills (0)      ││   Tools: —    Path: ~/.claude/skills/…/SKILL.md │
│   ▾ Rules           ││   引用 →  /guardrails-bootstrap                 │
│      CLAUDE.md (P)  ││   被用 ←  CLAUDE.md (global)                    │
│                     ││  [開檔編輯]                                     │
└─────────────────────┘└─────────────────────────────────────────────────┘
```

## 範圍(含明確不做的事)
**做:**
- 新增第一個自訂擴充 `packages/skill-manager/`(common / node / browser 三層,Theia DI 貢獻)。
- **掃描位置(Skills + Rules,Claude Code only)**:
  - Skills:`~/.claude/skills/*/SKILL.md` + `<ws>/.claude/skills/*/SKILL.md`
  - Rules:`~/.claude/CLAUDE.md` + 專案根 `<ws>/CLAUDE.md`
- frontmatter 解析(skill: name/description/可有的 tools/model…);rule 無 frontmatter → fallback 檔名 + 來源層級當標題,摘要取前幾行。
- **右側套件說明頁式 Inspector**:header + 渲染 readme(markdown → HTML)+ details(metadata + 關聯)。
- **關聯索引(Level B,範圍 skill+rule)**:forward = 掃 body 抓 `/指令`、已知 skill 名、`[[link]]`;inbound = 反轉建 reverse map。
- 左側兩層 tree、搜尋、Refresh、`[開檔編輯]`。

**明確不做(各留後續獨立計劃):**
- **Subagents** —— 本刀不掃 `~/.claude/agents/` / 專案 agents;下一刀加(屆時 tree 多一組、關聯範圍擴及 agent)。註:skill/rule body 若引用到 subagent 名(如 coder),forward 顯示其名但**標「subagent,本刀未納入」**、無導覽目標。
- **關聯 Level C**:不解析 `settings.json` hooks 算「被誰用」。
- **跨層覆蓋狀態**(global 是否被同名 project 覆蓋)—— 非本刀重點;便宜可附帶,否則延後。
- **Toggle 啟用/停用**、**新建 / frontmatter 表單編輯** —— 各自成刀;編輯先靠「Monaco 開原始 md」。
- **plugins 來源**(`~/.claude/plugins/…`)、**Codex / 跨工具部署**、**file watcher** —— 延後。

## 影響的檔案 / 模組
```
packages/skill-manager/
├── package.json              # @synlinea/skill-manager
├── tsconfig.json
└── src/
    ├── common/               # 型別(CapabilityItem: type(skill|rule)/name/desc/path/source/tools/refsOut/refsIn) + RPC 介面
    ├── node/                 # backend:掃描 + frontmatter 解析 + 關聯索引 + DI module
    └── browser/              # frontend:兩層 tree + 右側 Inspector(套件說明頁式)+ view contribution + DI module
```
修改:`applications/browser/package.json`(加 `@synlinea/skill-manager` 依賴);`docs/architecture.md`(Structure 加新擴充、列分層,執行時更新);**可能新增 ADR**(發現位置 + 關聯資料模型 = 後續刀重用的通用約定 → 視情況進 `decisions.md` + promote 一行到 `conventions.md`)。

## 做法概述
1. **擴充骨架**:`packages/skill-manager/` 三層,Theia DI(`ContainerModule` / `bindContribution`)。
2. **backend 掃描 + 解析**(node):FileService/fs glob skills + rules → 解析 frontmatter → `CapabilityItem`,經 JSON-RPC proxy 暴露。
3. **關聯索引(Level B,skill+rule)**:forward 比對(a)`/<known-skill>`、(b)已知 skill 名字面、(c)`[[link]]` → `refsOut`;inbound 反轉 → `refsIn`。引用到未納入的 subagent 名 → 標記但不建立導覽。
4. **frontend**:
   - 左側兩層 tree(Global / Project × Skills/Rules);搜尋框過濾;Refresh command(toolbar)。
   - 右側 Inspector(ReactWidget):選取項 → header + **渲染 readme**(markdown→HTML,沿用 Theia 既有 markdown 渲染 / `@theia/preview` 能力)+ details(tools/model/path/關聯);`[開檔編輯]` 呼 `EditorManager.open(uri)`。
5. **驗證**:build + start,左側列出真實 skills(agent-memory-scaffold…)+ global/project CLAUDE.md;點 agent-memory-scaffold → readme 渲染、details 顯示其引用、被 global CLAUDE.md 用到。
6. **回填**:更新 `architecture.md`;關聯/位置約定成形則進 ADR + conventions。

## 取捨與替代方案
- **套件說明頁式 Inspector(非欄位卡片)**:skill 規格一致 → 比照 VSCode extension detail 頁,渲染 readme 當主體最直覺,且「讀懂 + 預覽」一次到位;rule(CLAUDE.md)同樣 markdown,渲染即可。
- **先做 Skills + Rules、Subagents 延後**:使用者指定;skill/rule 規格與呈現相近(markdown readme),先把擴充骨架 + 兩層 + 透視 + 關聯立穩,subagent 下一刀低成本接上。
- **關聯 Level B**:回答「引用/被誰用」且成本中等(reverse map);Level C(settings/hooks)延後。
- **ReactWidget 右側 + Theia Tree 左側**:Tree 取現成分組/展開;Inspector 卡片排版用 React 彈性大。執行時定。
- **手動 Refresh vs watcher**:先手動,避 watcher 複雜度;後加。

## 測試計畫
- **單元測試(node)** —— **本專案第一個單元測試**,一併確立測試框架(傾向 Theia 慣用 **Mocha + chai**;執行時定並寫進 architecture.md):
  - ① frontmatter 解析器:容錯(壞 frontmatter、缺 description、無 frontmatter 的 rule → fallback)。
  - ② 關聯索引器:給 fixture 目錄(模擬 ~/.claude:幾個互相引用的 skill + CLAUDE.md),斷言 `refsOut` / `refsIn` 正確、無漏無重、未納入 subagent 名被正確標記。
- **build smoke**:`npm run build:browser` 含新擴充仍 0 errors。
- **手測**:兩層列出真實 skill/rule;搜尋;點項目 → header/readme/details 正確、關聯雙向;開檔。
- **lint**:`npm run lint` 綠。

## 風險 / 未決問題
- **R1 關聯誤判**:純名字比對 false positive → 比對加界定(`/前綴`、`[[ ]]` 優先;純字面標低信心或可關)。Level B 接受少量噪音,精度後調。
- **R2 第一個擴充 = Theia DI 樣板多**:backend RPC + frontend widget wiring 是學習曲線;卡住則先「frontend 經 FileService 直讀」簡版,關聯索引仍放 backend。
- **R3 readme 渲染管道(核心要件,非選配)**:透視預設即渲染 markdown,故此管道是本刀必成項。優先用 Theia 內既有 markdown 渲染(`@theia/preview` / monaco markdown)在自訂 widget 內渲染 body;若整合不便,fallback 輕量 md→HTML 函式庫(如 markdown-it)。需在做法早期先驗證此管道可行,再往下做。
- **R4 佈局不完整**:skills 也可能來自 plugins、專案層命名差異 → v2 只保證 user/project 的 `skills/` 與 `CLAUDE.md`,其餘標已知不涵蓋。
