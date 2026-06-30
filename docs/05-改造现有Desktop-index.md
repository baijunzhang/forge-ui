# 改造 HSBC AI Studio Desktop 的 frontend/index.html

> 目标:把现有 Qt 桌面 app 的前端(`frontend/index.html`)做成 Codex/Claude 风格——
> 更清新好看 + HSBC 品牌 + 绿/红逐行 diff + 每处 Accept/Decline + 选择后 Commit,
> 同时**完全保留**现有的 QWebChannel bridge、邮箱/BBG/看板等本地能力。

---

## 关键背景(给执行者的事实)

- app 是 **PyQt/PySide + QtWebEngine**(Chromium 内核),前端是单文件 `frontend/index.html`(约 2884 行)。
- 前端通过 **QWebChannel bridge** 和 Python 通信:`window.qt.webChannelTransport`、
  `bridge = channel.objects.bridge`、`bridge.getInitialState(...)`、`window.desktopInit(...)`。
- 文件读写、连接 Outlook 邮件、BBG、Board collections **都走这个 bridge**,不是浏览器 API。
- 现在已有:文件级改动列表(如 `frontend/app.css (+341/-0)`)、`Roll back changes`、
  权限(accept-all)、Feature Connections。
- **缺**的是:Codex 那样的逐行绿红 diff + 每处 Accept/Decline + 选择后 Commit,以及更精致的整体外观。
- 因为是 QtWebEngine = Chromium,现代 CSS / 原生 JS 都能用(flex/grid/clip-path/CSS 变量等)。

---

## 直接喂给 HSBC AI Studio 的 Prompt

```text
You are a senior frontend engineer working inside this repo (ai-markets-studio-desktop).
The app is PyQt/PySide + QtWebEngine; the UI is a single file: frontend/index.html.
The frontend talks to Python through a QWebChannel bridge.

GOAL: redesign frontend/index.html to feel like Codex / Claude Code — cleaner, fresher,
lightweight — and add a proper code-edit review UI: line-by-line green/red diffs with
per-change Accept / Decline, and a Commit action for selected changes. Apply HSBC branding.

=== PHASE 0 — INVESTIGATE FIRST. DO NOT EDIT YET. ===
Read frontend/index.html and the Python side, and report back to me:
1. How the frontend calls the bridge (list the bridge methods used, e.g. getInitialState,
   and any methods related to file changes, diffs, commit, rollback, sessions, email/BBG/boards).
2. How file changes are currently obtained and displayed (the "+N/-N" list + Roll back).
3. CRITICAL: whether the backend/bridge can provide the ACTUAL diff content for a changed
   file — i.e. old vs new file content, or a unified `git diff` text. Search the Python code
   for git/diff/patch. State clearly: "diff content IS available via <method>" OR
   "only +N/-N summary is available; backend change needed".
4. How theming works today (data-theme="dark-blue") and where colors are defined.
Stop after this report and wait for my confirmation before editing.

=== HARD CONSTRAINTS (never violate) ===
- DO NOT break the QWebChannel bridge wiring (window.qt.webChannelTransport,
  channel.objects.bridge, bridge.getInitialState, window.desktopInit, etc.).
- DO NOT use browser File System Access API (showDirectoryPicker) — all file ops go via the bridge.
- Keep ALL existing features working: sessions list, new chat, refresh, folder/permissions,
  Feature Connections (BBG, Outlook mail+Calendar, Board collections), Roll back changes.
- Pure HTML/CSS/JS edits to index.html only. No new build step, no npm, no frameworks.
- Work INCREMENTALLY: one section per step, keep the app launching after each step,
  and after each step list exactly what you changed and any risk.

=== DESIGN ===
- HSBC branding: accent = HSBC red (#db0011; in dark mode brighten to #ed3b45). Logo mark =
  red hexagon. Two-tone only: HSBC red as the single accent, everything else neutral grey.
- Clean, airy, lightweight: separate panels with 1px borders + whitespace (not heavy shadows);
  consistent 8px spacing; subtle 120-260ms animations (opacity/transform only); rounded corners.
- Support BOTH dark and light themes; keep the existing data-theme mechanism, just refine colors.
- Typography: system sans for UI, monospace for code/diff. Font sizes: 13-15px UI, 13px code.

=== DIFF / ACCEPT-DECLINE / COMMIT (the core feature) ===
IF diff content is available from the bridge:
- For each changed file, render a git-style diff: added lines on green background with "+",
  deleted lines on red background with "-", context lines normal. Show "path  +N -M" header.
- Per-hunk (or per-file) Accept and Decline buttons; plus Accept all / Decline all.
- A checkbox selection model + a Commit button that commits the SELECTED accepted changes
  (call the existing bridge commit method; if none exists, report what's needed — do not fake it).
- Keep "Roll back changes" available.
- Add an inline / side-by-side toggle for the diff.
IF only +N/-N is available:
- Do the visual redesign now, build the diff UI against a clearly-marked mock data shape,
  and tell me exactly what bridge method the backend must add to return real diff content
  (suggested signature: bridge.getDiff(path) -> unified diff text or {old, new}).

=== DELIVERABLES PER STEP ===
After each step: what changed, how to verify in the running app, and any follow-up needed.
Start with PHASE 0 (the investigation report) only.
```

---

## 为什么这样写(给你自己看)

- **先排查再动手**:让它先报告 bridge 方法和"diff 数据到底有没有",避免它在 2884 行大文件里瞎改、或用假数据糊弄。
- **硬约束锁死 bridge**:你们的本地能力全靠 QWebChannel,这是最不能碰的地方。
- **diff 数据两种情况都覆盖**:拿得到就做真逐行 diff;拿不到就先做外观+占位,并明确告诉你后端要补哪个方法(建议 `bridge.getDiff(path)`)。
- **增量推进**:一次一个 section、每步能跑、每步自述改了啥——和我们一路用的方法一致,降低出 bug 概率。

---

## PHASE 0 排查结果（AI 已返回）

- ✅ bridge wiring 简单、不需改动。
- ✅ 要保留的现有功能很多:sessions、new chat/refresh、folder/permissions、
  Feature Connections（BBG / Outlook / Board collections）、Outlook drawer、
  Studio feature API drawer、HTML board preview、rollback changes。
- ✅ **真实 diff 数据存在于后端 `ChangeSession.diffs`,但前端目前拿不到。**
- ❌ **没有 commit 的 bridge 方法。**
- 主题:现有 `data-theme="dark-blue"`,有蓝/绿 radial 渐变和 green/red 变量。

### 架构差异（关键）
你们的 AI **已经把改动写进文件**（所以有 Roll back changes）。所以:
- **Decline** = 回滚该文件　**Accept** = 保留　**Commit** = git 提交接受的文件
- 绿红 diff 只是可视化"已改了什么",Accept/Decline/Commit 作用于**已应用的改动**。

---

## 两阶段决策（确认后发给 AI 的回复）

> PHASE 1 纯前端、零风险,先做;PHASE 2 要加后端两个方法,后做。

```text
Confirmed. Proceed, but in this order and scope:

PHASE 1 — Frontend visual redesign only (no backend dependency, do first):
- Apply the HSBC look: HSBC red (#db0011 light / #ed3b45 dark) as the SINGLE accent,
  red hexagon brand mark, remove blue/green gradients, neutral greys elsewhere.
- Keep data-theme="dark-blue" and data-theme="light" mechanisms intact.
- Clean/airy/lightweight: 1px borders + whitespace over shadows, 8px spacing,
  subtle 120-260ms animations. Improve existing diff rendering where detail_html exists.
- Do NOT touch the bridge wiring or any existing feature. Keep rollback as-is.
Report what changed and verify the app still launches.

PHASE 2 — Real green/red diff + Accept/Decline/Commit (needs backend; do after Phase 1):
First report the exact shape of ChangeSession.diffs and the current rollback method
signature. Then propose these additions for my approval BEFORE writing them:
  - bridge.getChangeSessionDiffs(session_id) -> the diffs (old/new or unified per file),
    so the frontend can render line-by-line green(+)/red(-) diffs.
  - bridge.commitChanges(session_id, paths[]) -> git-commit the selected accepted files.
  - per-file rollback (if rollback is currently all-or-nothing), so "Decline" can revert one file.
UI model: each changed file = a card with its green/red line diff, an Accept and a Decline
button (Decline = rollback that file), a selection checkbox, and a Commit button for the
selected accepted files. Add inline / side-by-side toggle. Build against the real bridge
data once the methods exist — do not fake data.

Keep everything incremental: one step, keep app running, report changes after each.
```

### 为什么分两阶段
- PHASE 1 不依赖后端,外观马上变好看,零风险。
- PHASE 2 需加 `getChangeSessionDiffs` + `commitChanges` 两个 bridge 方法;
  让 AI **先报告 `ChangeSession.diffs` 结构再动手**,结构对了前端绿红 diff 才渲染得对。

---

## PHASE 1 计划（AI 已出 + 已批准）

> AI 触发了 repo 的 plan-mode 保护（复杂改动需先出计划再执行），返回了一份 Phase 1 计划。
> 评估：完全符合"纯前端、不碰 bridge"的要求,**已批准**。

AI 的 Phase 1 计划（全部 CSS-only，加红六边形 brand-mark 的标记/CSS）:
- Step 1 — 主题令牌:HSBC 红(dark `#ed3b45` / light `#db0011`)、去蓝绿渐变、中性灰、
  保留 `data-theme="dark-blue"` 与 `"light"` 机制、diff 状态保留绿/红。
- Step 2 — 品牌+外壳:`.brand-mark` 改 HSBC 红六边形、减重阴影、1px 边框,**DOM/ID 不动**。
- Step 3 — 卡片/按钮/抽屉打磨,**保留所有 JS 用的 ID/class、事件监听、bridge 调用**。
- Step 4 — 现有 diff 渲染打磨(`.diff-line.add/.del/.hunk/.file`、`.diff-stat` 等),
  纯 CSS,不造假数据,Phase 1 不做 commit/accept/decline。
- Step 5 — 验证启动 + QWebChannel 接线仍在
  (`qrc:///qtwebchannel/qwebchannel.js`、`window.qt.webChannelTransport`、
  `channel.objects.bridge`、`bridge.getInitialState`、`window.desktopInit`)。
- 风险:低到中,纯 CSS + brand-mark 调整,不碰 bridge/事件/payload/后端。

> 重要发现:前端已存在 `.diff-line.add/.del/.hunk/.file` 一套 diff 行渲染——
> Phase 1 只是把它配色打磨好;Phase 2 再把 `ChangeSession.diffs` 接进来做完整逐行 diff。

### 批准回复（已发给 AI）
```text
Approved. Proceed with Phase 1 (Steps 1–5) exactly as planned: CSS-only plus the
brand-mark markup/CSS change for the red hexagon.

Reminders while editing:
- Do NOT change any IDs/classes used by JS, event listeners, bridge calls, or payload shapes.
- Keep data-theme="dark-blue" and data-theme="light" mechanisms intact.
- Keep semantic green/red for diff status.
- Work incrementally; after each step, report exactly what changed.
- After Step 5, confirm the app launches and the QWebChannel wiring is intact.

Do not start Phase 2 yet — after Phase 1 I will review the look, then we plan the
ChangeSession.diffs + commit work together.
```

### 下一步
1. AI 执行 Phase 1 → 看外观（应变 HSBC 红 + 清新轻盈,蓝绿渐变消失）。
2. 确认无误后,进入 PHASE 2:加 `getChangeSessionDiffs(session_id)` + `commitChanges` +
   按文件 rollback（Decline），并把前端绿红 diff 接到真实 `ChangeSession.diffs`。

---

## 遇到 "[Planning required]" 被拦怎么办

现象:AI 的编辑被拒,提示
`Denied: [Planning required] This looks like a complex coding task. Enter plan mode...`

原因:repo 开了 plan-mode 守卫,**复杂改动必须正式走"进入 plan mode → 出结构化计划 → 退出 plan mode"流程**才能改文件。
只在聊天里写计划不算数,守卫仍会拦。AI 想改的内容本身是对的(把写死的 diff 颜色换成
`var(--green)` / `var(--red)` / `var(--amber)` 令牌),只是流程没走对。

解决:让它正式走一遍 plan mode 流程(发这段)。
```text
You're blocked by the planning guard because you wrote the plan in chat but
didn't go through the formal plan-mode flow. Please:
1. Enter plan mode.
2. Inspect frontend/index.html and produce the structured plan (the Phase 1
   Steps 1–5 we already agreed: CSS-only + red hexagon brand-mark, no bridge
   changes, keep IDs/classes/events/payloads, keep data-theme mechanisms,
   keep semantic green/red).
3. Exit plan mode to get approval.
4. Then make the incremental Phase 1 edits.
```

或:界面里若有"批准计划 / 退出 plan mode"按钮或权限模式切换(底部盾牌图标 / accept-all 旁),点批准也能放行。

---

## 死结:守卫要 plan mode,但 session 没有 plan-mode 工具

AI 反馈:它**被矛盾卡死**——守卫要求走 `EnterPlanMode` / `ExitPlanMode`,
但当前 session **没有暴露这两个工具**,它只有 `Read / Write / Edit / Bash`。
等也等不来。另外它提到:在收到"走正式流程"指令前,**已经通过 shell/file 改了一部分**
`frontend/index.html`(可能已有部分 CSS 改动)。

Configure 面板里也**没有**关闭该守卫的开关(只有 FOLDER、PERMISSIONS=accept-all、
FEATURE CONNECTIONS)。说明守卫是写死在 app 里的,界面关不掉。

### 解法:授权跳过正式 plan mode（Option 2,发这段）
```text
Option 2: proceed WITHOUT formal plan-mode. The EnterPlanMode/ExitPlanMode tools
aren't available in this session, so that guard can't be satisfied anyway, and
there is no toggle for it in Configure.

Steps:
1. First run `git diff --stat` and show me which Phase 1 edits you already made.
2. Then continue Phase 1 with normal Edit/Bash tools, ONE step at a time, and
   report exactly what changed after each edit.

Constraints unchanged: CSS-only + red hexagon brand-mark, no bridge changes, keep all
IDs/classes/event listeners/bridge calls/payload shapes, keep data-theme mechanisms,
keep semantic green/red. Do not start Phase 2.
```

### 如果连 Option 2 都被 "[Planning required]" 拦
说明守卫是硬性的、accept-all 也压不住。改用绕过方案:
- 让 AI 把改好的**完整 index.html 内容输出到对话里**,你手动保存覆盖文件,绕开它的 Edit 守卫。

---

## 你可能要回答 AI 的问题

它做完 PHASE 0 排查后,可能会问你:
- "找不到 commit/diff 的 bridge 方法,要不要我让后端加?" → 通常回答:**先报告需要加什么,我去确认**。
- "现有 data-theme 是 dark-blue,要不要保留这个名字?" → 可以保留机制,只精修配色。
- 邮箱报错 `win32com not available`(截图里有)→ 那是 Outlook 集成的环境问题,**和这次 UI 改造无关**,让它别动。
