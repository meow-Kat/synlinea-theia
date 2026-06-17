---
status: approved
created: 2026-06-17
---

# v1 第一刀:可跑的 Eclipse Theia 桌面骨架

## 需求 / 目標
站起一個**能跑的 Eclipse Theia 應用骨架**,作為「管理 skill / subagent / rule 的 IDE」的外殼基礎。
本刀只證明「外殼跑得起來」,不做任何管理功能。完成定義(DoD):

1. `npm install` 能裝完依賴並 build 成功。
2. 應用能啟動(`npm run start:browser`),瀏覽器開得起 Theia 工作台。
3. 能用內建編輯器(Monaco)開啟 / 編輯一個 `.md` 檔。
4. 能開 markdown **預覽**。
5. 能開**內建終端**並在裡面跑指令(為日後跑 `claude` / `codex` 鋪路)。
6. build / run / test / lint 指令確立,並回填 `docs/architecture.md` 的 Environment + Structure。

> 對應 §10 拍板:Q1 = 管理 UI 這一刀;v1 管理範圍 = 瀏覽/搜尋 + 編輯/預覽 + 開關/啟用;目標 CLI = 先 Claude Code only。本計劃是這一切之前的**地基**。

## 範圍(含明確不做的事)
**做:**
- 用 Theia 官方 generator(npm 版,`@theia/generator-theia-extension` / 對應 npm-based generator)建立一個 **browser-target** Theia 應用(**npm workspaces + Lerna** monorepo 結構)。
- 納入最小必要的 `@theia/*` 套件:core / editor / monaco / markdown / terminal / filesystem / workspace / navigator / messages / preferences。
- `.nvmrc`(Node 22 LTS,落在官方支援區間 >=22 <=24)、root `package.json`(npm workspaces + Lerna)、browser-app `package.json`、`tsconfig`。
- 一個 `packages/` 佔位資料夾,留給日後自訂擴充(skill/subagent 管理 widget),v1 不放實作。
- 確立並寫下 build / start / lint 指令;最小 smoke 驗證(build 成功 + 能啟動)。
- 回填 `docs/architecture.md` 的 Environment 與 Structure 區塊(取代 TBD)。

**明確不做(留後續各自獨立計劃):**
- **不納入 Theia 原生 AI 框架**(`@theia/ai-core` / `ai-chat` / `ai-chat-ui` / `ai-mcp` 等)。本專案的 AI 一律走「內建終端跑 `claude` / `codex` CLI」,不要 IDE 內建的 chat/agent 面板。scaffold(尤其用官方 generator)時須確認這些套件**未被帶入** `package.json`。Theia AI 框架列為 v2 選配,非 v1。
- 任何 skill/subagent/rule 的**掃描 / 解析 / 列表 / 編輯 / toggle UI**(這是 v1 的下一刀,需另開 plan)。
- 自訂 Theia widget / 管理面板實作。
- **VSCode plugin 系統(Open VSX 執行時裝/移除)**——不納入 `@theia/plugin-ext` / `plugin-ext-vscode`。v1 骨架只證明外殼可跑;plugin 能力日後一個小 task 補上(僅加依賴,非架構決定)。注意 Open VSX ≠ 微軟官方 marketplace。
- **Electron 打包**(桌面安裝檔)——先用 browser target 快速站起來;Electron 另開計劃。
- 任何 **Codex** 相關(投影 / AGENTS.md / MCP)——v2。
- 跨工具部署 / 編譯器(L2/L3)。
- 從 `cli-ide` 移植領域邏輯(等管理刀才需要)。
- CI 流水線(可在骨架穩定後用 `/guardrails-bootstrap` 另接)。

## 影響的檔案 / 模組
全新檔案(greenfield,無既有程式碼受影響):
```
synlinea-theia/
├── .nvmrc                     # Node 22 (官方支援 >=22 <=24)
├── package.json               # root:private + npm workspaces
├── lerna.json                 # Lerna 管 monorepo(Theia 官方用法)
├── tsconfig.json              # root TS 基礎設定
├── .gitignore                 # node_modules / lib / .theia / gen-webpack / plugins 等
├── applications/
│   └── browser/
│       ├── package.json       # @theia/* 依賴 + theia app 設定 + build/start scripts
│       └── tsconfig.json
└── packages/                  # 佔位(.gitkeep),日後自訂擴充
```
文件更新:`docs/architecture.md`(Environment + Structure,Phase 2 執行時回填)。

## 做法概述
1. **前置**:建立 `.nvmrc=22`。本機現為 Node v24.14.1,**已落在官方支援區間(>=22 <=24)**,可直接用;釘 .nvmrc 只為可重現。npm 隨 Node 內建,無額外安裝。
2. **scaffold**:用 Theia 官方 npm-based generator(generator 版本需夠新、產出 npm + Lerna 結構)產生 monorepo,再**裁剪**到最小套件集;或手寫 root(npm workspaces + Lerna)+ `applications/browser`。
3. **挑套件**:browser-app `package.json` 列入上述最小 `@theia/*`(版本對齊 1.72.3),含 `build:browser` / `start:browser` scripts。
4. **build + 起站**:`npm install` → `npm run build:browser` → `npm run start:browser`,確認工作台、開 md、md 預覽、開終端四項 DoD。
5. **lint**:接 ESLint + Prettier(TS 基本規則;Theia 官方 eslint 設定可選)。
6. **回填文件**:把確立的 Node 版本 / npm / build / start / lint / test 指令與最終 Structure 寫進 `docs/architecture.md`,取代 TBD。

## 取捨與替代方案
- **套件管理器:npm(+ Lerna)**:Theia 自 **1.58.0 起官方 build 由 yarn 改為 npm**,當前 1.72 文件全程 npm。選 npm = 走官方主路徑、踩雷最少、且符合使用者偏好。yarn 已是過時路徑,不採。
- **Node 22(.nvmrc)vs. 本機 Node 24**:官方支援 **>=22 <=24**,兩者皆可。釘 22 LTS 取其穩定與可重現;若想免切版本,本機 Node 24 也在區間內可直接用。早先「降到 Node 20」的考量已作廢(基於舊版資訊)。
- **browser target 先行 vs. 直接 Electron**:選 browser。起站快、CI 友善、`start:browser` 即可驗證 DoD;Electron 桌面打包成本(原生簽章 / 平台差異)留到外殼穩定後。產品最終仍走 Electron(concept §9),這只是把它排成下一刀。
- **官方 generator 後裁剪 vs. 全手寫骨架**:傾向 generator 產生後**裁剪**到最小套件集,兼顧正確性與精簡;若 generator 帶入過多預設(尤其 `@theia/ai-*`、`plugin-ext`)就移除。
- **Theia 版本**:釘 1.72.3(目前 npm 最新穩定),避免日後 `latest` 漂移。

## 測試計畫
- **build smoke**:`npm install && npm run build:browser` 成功、無錯。
- **start smoke**:`npm run start:browser` 能起站、工作台載入(手動或 headless 確認 port 起得來)。
- **功能手測**(DoD 3–5):開 `.md`、md 預覽、開內建終端跑一行指令。
- **lint**:`npm run lint` 通過。
- v1 骨架**不寫單元測試**(無領域邏輯可測);測試框架等管理刀帶領域邏輯時再接,並補進 `architecture.md`。

## 風險 / 未決問題
- **R1 generator 帶入不要的套件**:Theia generator 預設可能含 `@theia/ai-*` / `plugin-ext` / 過多範例 → scaffold 後須對照「明確不做」清單裁剪,並對齊版本到 1.72.3。
- **R2 Node 原生模組**:`node-pty`(終端)需編譯;Node 在官方區間(22–24)內應正常,若 macOS/arm64 有編譯問題需記錄(備案:切 22 LTS)。
- **R3 build 體積 / 時間**:Theia 首次 build 較慢、產物大 → 確認 `.gitignore` 正確,避免誤提交 `lib/`、`gen-webpack`、`plugins/`。
- **Q(待確認)**:browser target 先行是否符合你預期?還是 v1 骨架就要 Electron 桌面視窗?(預設取 browser,Electron 下一刀)
