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

## 你可能要回答 AI 的问题

它做完 PHASE 0 排查后,可能会问你:
- "找不到 commit/diff 的 bridge 方法,要不要我让后端加?" → 通常回答:**先报告需要加什么,我去确认**。
- "现有 data-theme 是 dark-blue,要不要保留这个名字?" → 可以保留机制,只精修配色。
- 邮箱报错 `win32com not available`(截图里有)→ 那是 Outlook 集成的环境问题,**和这次 UI 改造无关**,让它别动。
