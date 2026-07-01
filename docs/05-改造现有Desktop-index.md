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

## Phase 1 补充:轻盈化（换色不等于轻盈）

现象:Phase 1 换了颜色(HSBC 红六边形、红按钮),但**还是不轻盈**,只是"颜色换了一下"。

原因:轻盈 ≠ 颜色。Claude/Codex 的"轻"来自这四样,Phase 1 都还没做:
- **留白/间距大**(现在元素挤、密)
- **强调色用得少**(现在红用太满:实心红按钮 + 红框选中卡片 → 反而更重)
- **边框极淡 1px 低透明**(现在侧边卡片是粗红边框,很重)
- **背景中性、靠微妙明度分层**(现在偏暗蓝、闷)

核心口诀:**红色只点缀不涂满;留白撑开不塞满;边框要淡不要粗。少即是轻。**
强调色应覆盖 < 10% 的界面。

### 轻盈化补充步骤（纯 CSS,发这段）
```text
Phase 1 changed colors but the UI still feels heavy, not airy like Claude/Codex.
Do one more CSS-only pass focused on LIGHTNESS (no bridge/DOM/ID changes):

1. Use the accent SPARINGLY. The red is overused.
   - "New chat" / primary buttons: NOT solid saturated red. Use a subtle style
     (light accent-subtle background OR outline), red reserved for small accents.
   - The selected session card: remove the heavy red border. Use a soft
     accent-subtle background or a thin 2px left-border only, rounded off.
2. More whitespace: increase padding inside cards, list rows, sidebar, composer;
   bigger gaps between sections; line-height ~1.6.
3. Borders: make all borders 1px, low-opacity/subtle. Remove boxy heavy dividers;
   separate with spacing instead.
4. Background: neutral and calm; layer surfaces by SLIGHT brightness differences,
   not by strong colors or borders. Avoid the heavy dark-blue feel.
5. Reduce visual weight overall: lighter font weights for secondary text (use a
   muted grey), no heavy shadows.

Keep it minimal and restrained — accent color on <10% of the surface.
After the pass, launch and show me. Do not start Phase 2.
```

最见效的是第 1 条(少用红)+ 第 2 条(加留白)。

---

## 轻盈化后的评估（深/浅双模式已出）

进步明显,尤其浅色模式已接近 Claude/Codex 的通透感。剩余可改进(都不大):
1. 深色底色偏紫/藏蓝,可再调更中性的暖灰,深色也会更轻。
2. 会话卡片的红左边框+粉底是唯一还"响"的地方 → 建议只在**选中时**才显示高亮。
3. 最重要:**新配色下的 diff(绿红)还没验证过**。这是项目核心,先看它好不好看再继续。

优先级:**先触发一次真实改动看 diff 显示 → 满意就进 Phase 2**,不要陷在无限微调外观。
验证 diff 可发:`帮我在 frontend/README.md 末尾加一行 "test"，让我看看 diff 的显示效果`

## 修正 HSBC 标志（原菱形像别家银行）

原 `.brand-mark` 是红色菱形/四边形,像别家银行。换成 HSBC 标准的**六边形红白沙漏**。
只换 `.brand-mark` 内的图形,保留 class 和节点(不破坏 JS)。发这段:
```text
The current brand mark is a red diamond/quadrilateral that looks like another
bank's logo. Replace ONLY the graphic inside the existing .brand-mark node with
the proper HSBC hexagon (red/white hourglass). Keep the .brand-mark class and
node so JS/layout is unaffected. Use this SVG:

<svg viewBox="0 0 40 40" width="22" height="22" aria-label="HSBC">
  <polygon points="0,20 10,0 30,0 40,20 30,40 10,40" fill="#ffffff"/>
  <polygon points="10,0 30,0 20,20" fill="#db0011"/>
  <polygon points="10,40 30,40 20,20" fill="#db0011"/>
</svg>

In light mode, add a faint stroke to the white hexagon so it stays visible:
stroke="#e0ded7" stroke-width="0.6" on the first polygon.
CSS-only + this markup swap. Do not touch bridge, IDs, events, or payloads.
```
> 注意:HSBC 官方标志有版权。此 SVG 为忠实近似版,内部工具可用;对外发布请用内部品牌团队的官方 SVG 素材。

---

## 修正 HSBC 标志（正确版：六边形 + X 分割 + 红白沙漏）

之前给的菱形/半白版都不对。正确的 HSBC 标志是六边形被 X 分成四块:上下红三角、
左右白三角、左右两个红尖角。发这段(只换 `.brand-mark` 内图形,保留 class/节点):
```text
Replace ONLY the graphic inside the existing .brand-mark node with the correct
HSBC hexagon. Keep the .brand-mark class/node. Use exactly this SVG:

<svg viewBox="0 0 40 40" width="22" height="22" aria-label="HSBC">
  <polygon points="0,20 10,0 10,40" fill="#db0011"/>
  <polygon points="40,20 30,0 30,40" fill="#db0011"/>
  <polygon points="10,0 30,0 20,20" fill="#db0011"/>
  <polygon points="10,40 30,40 20,20" fill="#db0011"/>
  <polygon points="10,0 10,40 20,20" fill="#ffffff"/>
  <polygon points="30,0 30,40 20,20" fill="#ffffff"/>
</svg>

CSS/markup swap only. Do not touch bridge, IDs, events, or payloads.
```
> HSBC 标志为注册商标;此为几何还原版,内部工具用;对外发布请用品牌团队官方素材。

## Codex 风格功能清单（用户从 Codex 截图指出的）

**A. 运行中 session 的状态小圆点 + 多会话并行**
- 前端:每个 session 加状态点(运行=亮/呼吸,空闲=灰)。
- ⚠️ 真正"多个同时运行"是**后端并发能力**,需 Python 端支持并行 session;前端只能显示。
  这条单独评估,先不混进本轮 UI。

**B. 侧边栏 folder 分组**
- 现在是平铺 session 列表 → 改成可折叠的 folder 分组(如 Codex/ChatGPT/… 那样),更清晰。

**C. Codex 风格 diff（= Phase 2 的目标形态）**
```
2 files changed  +9 −6            ← 顶部汇总
┌ src/hero.tsx  +8 −5     ✓  ✕    ← 每文件卡片 + Accept/Decline
│ 红行(左侧红槽 −) / 绿行(左侧绿槽 +)
右上角:Open ▾   Commit ▾          ← 提交入口
```
干净、留白足、绿红清楚。Phase 2 接 `ChangeSession.diffs` 时按这个形态做。

### 建议顺序
1. 现在:发修正 logo。
2. 然后 Phase 2:Codex 式 diff(每文件卡片 + ✓/✕ + Commit)+ session 小圆点 + folder 分组。
3. 多窗口并行:需后端评估,单独立项。

---

## PHASE 2 启动:排查 diff 数据结构（先查后改）

Phase 1(外观 + 正确 HSBC logo)已完成。Phase 2 = Codex 式 diff + Accept/Decline + Commit,
要碰后端。第一步让 AI 先排查数据结构,不急着改。发这段:
```text
Phase 1 look is done. Now start Phase 2 — the Codex-style diff + Accept/Decline + Commit.

FIRST, investigate and report back (do NOT edit yet):
1. The exact shape of ChangeSession.diffs — for each changed file, what fields exist?
   Is it a unified diff string, or old/new content, or per-line records? Show a sample.
2. The current rollback method signature — is it all-or-nothing, or per-file?
3. Whether any git commit capability exists anywhere in the Python code.

Then propose (for my approval, before writing):
- bridge.getChangeSessionDiffs(session_id) to expose the diffs to the frontend.
- bridge.commitChanges(session_id, paths[]) to git-commit selected files.
- per-file rollback for "Decline" if rollback is currently all-or-nothing.

Wait for my approval after the report.
```
它报告回来后,把 `ChangeSession.diffs` 的样例结构贴出来确认:前端渲染方式 + 后端两个方法签名。
session 小圆点 / folder 分组(纯前端)等 diff 主体完成后再加。

---

## 方向调整:转中性 Codex/Claude 风（红不铺满，只留 logo）

洞察:Codex/Claude Code 的舒服感**不是颜色,是中性 + 留白 + 克制**。之前把红铺满反而更远。
新方向:全局黑白灰,主按钮黑/白(非彩色),HSBC 红只保留在左上角 logo。

配方:
| 要素 | 做法 |
|------|------|
| 配色 | 中性:深色=中性炭灰(非蓝),浅色=暖白;全局黑白灰 |
| 强调色 | 极少;主按钮黑/白,彩色只用于小状态点 |
| 留白 | 大量,靠空间分隔 |
| 边框 | 1px ~8% 透明度,甚至无 |
| 图标 | 单色描边 |
| 无 | 无渐变、无重阴影 |
| diff | 绿/红只留给增删行 |

一句话:**中性打底,黑白做按钮,留白撑空间,颜色只留给 diff。**

### 发这段（纯 CSS，转中性风）
```text
New direction: make the UI neutral like Codex / Claude Code. The look comes from
neutrality + whitespace + restraint, NOT color. CSS-only, no bridge/DOM/ID changes.

1. Palette → neutral. Dark mode: neutral charcoal greys (NOT blue), e.g.
   bg #1a1a1a, surface #222, text #e8e8e8 / secondary #a0a0a0 / muted #6e6e6e.
   Light mode: warm white bg #fafafa, surface #fff, text #1a1a1a / secondary #666.
   Borders: 1px at ~8% opacity (rgba(255,255,255,.08) dark / rgba(0,0,0,.08) light).
2. Accent → almost none. Primary buttons ("New chat", Send) become monochrome:
   dark bg + light text in light mode, light bg + dark text in dark mode. NOT red.
   Keep the HSBC hexagon logo (small, top-left) as the only brand color.
3. Whitespace → generous padding in sidebar, list rows, composer; roomy gaps.
4. Remove any remaining gradients and heavy shadows. Subtle only.
5. Keep semantic green/red ONLY for diff add/remove.
6. Icons monochrome. Selected session = soft neutral grey background, no colored border.

Keep it minimal and calm. After the pass, launch and show me both themes.
```

---

## PHASE 2 计划（AI 已出 + 已批准）

AI 排查后给出方案,签名与安全均正确,**已批准**。

后端三方法:
- `getChangeSessionDiffs(session_id)` — 把 diff 给前端
- `commitChanges(session_id, { paths, message })` — 提交选中文件
- `rollbackChangeFile(session_id, path)` — 按文件回滚(Decline 用)

安全:拒绝可疑路径 / 空选择;`subprocess.run([...], shell=False, cwd=<repo>)`;不用 `--no-verify`。

前端:每文件一卡(路径 + `+N/−N` + 勾选框 + Accept + Decline + 行内/并排切换);
Accept 标记接受并允许勾选提交;Decline 调 `rollbackChangeFile`;Commit 调 `commitChanges`;
保留原 "Roll back changes" 作全局兜底。

### 批准回复（发这段）
```text
Approved. The three methods and signatures are correct, and the security approach
(list-form subprocess, shell=False, cwd=repo, no --no-verify, reject suspicious/empty
paths) is good. Proceed INCREMENTALLY:

1. Backend first: add getChangeSessionDiffs, commitChanges, rollbackChangeFile.
   After adding, show me a SAMPLE of what getChangeSessionDiffs returns, so the
   frontend renders correctly.
2. Then frontend: per-file diff cards in the NEUTRAL Codex/Claude style — green/red
   ONLY for added/removed lines, everything else monochrome; generous whitespace;
   Accept / Decline / checkbox / Commit / inline-vs-side-by-side toggle. Keep the
   existing Roll back as a global fallback.
3. Keep all bridge wiring and IDs intact. One step at a time; report after each.

If the planning guard blocks an edit, proceed without formal plan-mode (Option 2) —
those tools aren't available in this session.
```

提醒:先后端(加完给样例数据)→ 再前端;diff 配色接中性 Codex 风(绿红只给增删行)。

---

## 中性风执行后的修正:深色底去蓝紫

执行中性指令后:按钮已中性(白/灰)、logo 正确、浅色干净 ✅。
但深色底仍带蓝紫调,需转纯中性炭灰。发这段(纯 CSS):
```text
The dark theme background still has a blue/purple tint. Make it truly NEUTRAL
charcoal like Codex/Claude. Check the dark-theme background/surface CSS variables
and remove any blue/purple hue — use neutral greys, e.g.:
  bg #1a1a1a, surface #202020, elevated #262626, border rgba(255,255,255,.08).
Report the old vs new hex values. CSS-only, no other changes.
```
注:空状态看不出真效果,真正验收要看有内容/diff 时 → 尽快推进 Phase 2。

---

## 结论:颜色达标，别在空屏上继续调

偏紫经确认是显示器/拍照色差,实际接近纯黑。颜色基本收工。
唯一可选微调:纯黑 `#000` 略硬,可柔化为中性炭灰(Claude/Codex 不用纯黑)。
主题名 `dark-blue` 实为黑,只是命名,可选择性改为 `dark`(优先级低)。
```text
If the dark background is pure #000, soften it slightly to a neutral charcoal
(#1a1a1a bg, #202020 surface) — Claude/Codex avoid pure black for a calmer feel.
Also optional: the theme is labelled "dark-blue" but renders black; you may rename
it to "dark" for clarity (update the attribute value everywhere consistently).
CSS/attribute only, no logic changes.
```
核心建议:**别在空屏继续调色**,推进 Phase 2——有真实 diff 出来才是验收时刻。

---

## 排版优化：去"机器感"（字体/行距/字号）

Claude/Codex 舒服的关键在排版,不只在颜色。机器感常见来源:行距太紧、字号偏小、
字重全一样、默认 Segoe UI、大写标签太硬。

配方:
| 项 | 做法 |
|----|------|
| 字体 | 人文无衬线 Inter(比 Segoe UI 圆润);代码 JetBrains Mono |
| 行距 | 正文 line-height **1.6**(最关键) |
| 字号 | 对话 15px / UI 14px / 标签 12px |
| 字重 | 只用 400 + 500,不用 700 |
| 大写标签 | 小、灰、letter-spacing .04em |

最见效:**行距 1.6 + 换 Inter**。

### 发这段（纯 CSS）
```text
The typography feels robotic. Make it comfortable like Claude/Codex. CSS-only.

1. Font family: use a humanist sans. Add Inter as primary with fallbacks:
   font-family: "Inter", -apple-system, "Segoe UI", Roboto, sans-serif;
   Load Inter from Google Fonts if the app has internet; otherwise the fallback
   is fine. Code/diff font: "JetBrains Mono", Consolas, monospace.
2. Line-height: body/chat text to 1.6 (this matters most). UI rows ~1.4.
3. Sizes: chat/message text 15px, general UI 14px, small labels 12px.
4. Weights: use ONLY 400 and 500. Remove any 600/700 bold; use 500 for emphasis.
5. All-caps labels (SESSIONS, STUDIO): keep small, muted grey, letter-spacing .04em.
6. Slightly more vertical spacing between messages and list rows.

No DOM/ID/bridge changes. Report what you changed. Show both themes after.
```
注:本地 file:// + QtWebEngine,Inter 需联网从 Google Fonts 加载;内网不通会回退 Segoe UI
(行距/字号改善仍有效)。要稳可把 Inter 字体文件打包进 app 本地引用。

---

## 设计原则参考（为何 Codex/Claude Code 舒服）

本质:不是"字好看",而是**代码审阅 + 任务代理的工作流 UI**——让用户始终知道
AI 在想什么、改了哪、下一步做什么、能不能撤回。核心是**降低 cognitive load**。

流程模型(而非普通聊天):
`读文件 → 解释计划 → 修改代码 → 展示 diff → 请求批准 → 跑测试 → 总结`

信息分层(眼睛不用猜哪是解释/代码/改动):
- 自然语言解释:短段落
- 代码块:等宽 + 高亮
- diff:红删绿增(变化作为核心展示单位,不是"回答")
- 状态:searching / editing / running tests / waiting for approval
- 操作按钮:Accept / Reject / Apply / Rewind(语义明确)

安心感来源:用户知道自己有**刹车、撤销、审批权**(sandbox / approval / checkpoint / rewind)。

### 已覆盖 vs 待补
- 已在做:diff-first、Accept/Reject/Commit、Rollback、Plan mode、中性低噪布局、权限。
- 待补(新)——建议列入 Phase 3:
  1. **Task Timeline**:Read → Plan → Edit → Test → Summary 的进度时间线(最有价值)。
  2. **Status Chips**:Reading file / Running tests / Needs approval 实时状态条(消除黑箱)。
  3. **Checkpoint / Rewind**:每次关键改动前自动存档,可逐步回退(比全局 rollback 更细)。
  4. **Context Panel**:文件 / 规则 / terminal / memory 集中(可由右侧 Inspector 演进)。

### 优先级
Phase 2 先把 diff + Accept/Decline/Commit 做扎实(地基)→
Phase 3 做 Task Timeline + Status Chips → 之后 Checkpoint、Context Panel。

### 更正:Phase 3 是否碰后端(此前"纯前端为主"说法不准确)
| Phase 3 项 | 显示 | 真实数据 | 是否碰后端 |
|-----------|------|----------|-----------|
| Task Timeline | 前端 | 需后端发步骤事件 | 若后端已发活动事件→纯前端,否则要后端 |
| Status Chips | 前端 | 需后端报告状态 | 同上 |
| Checkpoint/Rewind | 前端 | 后端做文件/git 快照 | ❌ 一定碰后端 |
| Context Panel | 前端 | 数据来自 bridge | 显示前端,取数靠后端 |

判断:现有已有工具卡片/System 消息 → 后端很可能已发事件,则 Timeline/Status 有机会纯前端。
Phase 3 开始时**先排查后端发了哪些事件**再决定(同样"先查后改")。
若要严格只动前端:只做能用现有数据的部分,Checkpoint/新数据的 Context Panel 推后。

设计关键词一句话:**Chat + Code review UI + Task progress timeline + Safe approval system。**

---

## PHASE 2 后端完成 → 先要样例数据再做前端

后端已完成(只加不改):`change_session.py` + `desktop.py`(147+/2−),py_compile 通过。
- `getChangeSessionDiffs(session_id)` = `@Slot(str, result=str)` 返回 str(应为 JSON 字符串)
- commit 逻辑(`session.status="committed"`)
- 全局 `rollbackChangeSession` 保留不动
- 前端 diff UI 未开始(正确)

关键:前端渲染完全取决于 `getChangeSessionDiffs` 返回的字符串结构。**做前端前必须先拿样例**。
发这段:
```text
Backend looks good. BEFORE building the frontend, I need to see the real data shape.

1. Run getChangeSessionDiffs on a session that has changes, and paste the RAW return
   value (the actual JSON/string), so I can design the frontend rendering exactly.
2. Confirm the final signatures of ALL new methods:
   - getChangeSessionDiffs(session_id) -> ? (what fields per file? per-line records,
     or unified diff text?)
   - commitChanges(session_id, {paths, message}) -> ?
   - rollbackChangeFile(session_id, path) -> ?  (per-file Decline — was this added?)
3. Confirm rollbackChangeSession (global) is unchanged.

Do NOT start the frontend yet — just show me the sample output and signatures.
```
拿到样例后据此定前端渲染(每文件卡 + 逐行绿红 + Accept/Decline/Commit),一次做对。

---

## 安全规则:碰后端可以，但别碰坏现有功能

碰后端 OK,核心底线是**不破坏已有重要功能**(邮箱/BBG/看板/session/rollback)。
坚持三条:
1. **只加不改**:新增方法,不改现有方法的签名/行为。
2. **每次回归验证**(py_compile 通过 ≠ 功能没坏)。碰完后端固定发这段:
```text
After any backend change, verify existing features still work — do NOT just rely on
py_compile. Confirm these are unaffected and report how you checked:
- session load / save / new chat / refresh
- Feature Connections (BBG, Outlook mail, Board collections)
- global rollback (rollbackChangeSession)
- the QWebChannel bridge (getInitialState, desktopInit, existing slots)
List any existing method you modified (vs newly added). If you changed an existing
method's signature or behavior, stop and tell me first.
```
3. **及时 git commit 建还原点**:每完成一个稳定阶段就 commit,坏了可 `git checkout`/`git reset` 回退。

---

## PHASE 2 数据结构确认 + 前端 diff UI 指令

安全确认(第5段):**无现有方法被改**——session/邮箱/BBG/看板/全局 rollback 原样,
仅新增方法 + 几行 import。纯新增零破坏。

`getChangeSessionDiffs(session_id)` → JSON 字符串:
```
{ ok, session_id, status, files: [
  { path, filename, added, removed,
    diff: "unified diff 文本",   ← 关键:统一 diff 字符串,不是逐行记录
    before, after, before_exists, after_exists, before_truncated, after_truncated } ] }
```
`commitChanges(session_id, {paths, message})` → `{ok, commit, paths, relative_paths}` /
失败 `{ok:false, error}`;`rollbackChangeFile(session_id, path)`;全局 `rollbackChangeSession` 保留。

### 前端 diff UI 指令（纯前端，调用新 bridge 方法）
```text
Phase 2 backend confirmed safe (no existing method changed). Now build the FRONTEND
diff review UI in frontend/index.html. Frontend-only + calling the new bridge methods.
Do NOT modify backend, existing bridge wiring, IDs, or existing features.

Data: getChangeSessionDiffs(session_id) returns a JSON string with files[], each file:
{ path, filename, added, removed, diff (UNIFIED DIFF TEXT), before, after, ... }.
The per-file `diff` is a UNIFIED DIFF STRING — parse it to render lines.

Build INCREMENTALLY, one step at a time, report after each:

STEP A — Fetch & summary
- When a coding turn ends with changes, call getChangeSessionDiffs(currentSessionId),
  JSON.parse it. Render header: "<N> files changed  +<sumAdded> −<sumRemoved>".

STEP B — Per-file diff card (neutral Codex/Claude style)
- One card per file: filename + dim full path + "+added −removed".
- Parse the unified diff string:
  * line starts with '+' (not '+++') → added: green text, subtle green bg, "+" gutter
  * line starts with '-' (not '---') → removed: red text, subtle red bg, "−" gutter
  * '@@' → hunk header, muted monochrome
  * ' ' → context, muted
  * skip 'diff --git' / 'index' / '---' / '+++' lines
- Monospace; green/red ONLY on +/- lines; everything else neutral grey.
  Generous padding, 1px subtle borders, no heavy shadows.

STEP C — inline / side-by-side toggle (inline default).

STEP D — Accept / Decline per file
- Accept: mark accepted in frontend state; enable its commit checkbox.
- Decline: call rollbackChangeFile(session_id, path); on ok, remove/mark the card.

STEP E — Commit selected
- Commit button collects checked (accepted) paths + a message, calls
  commitChanges(session_id, JSON.stringify({paths, message})).
- {ok:true, commit}: success toast with hash, clear committed cards.
- {ok:false, error}: show error. Keep global "Roll back changes" as fallback.

Neutral styling. One step at a time; keep app launching; report after each.
```

---

## PHASE 2 前端 Step A 完成 → 去重 → Step B

Step A 完成:提取 session_id → 调 getChangeSessionDiffs → 解析 → 中性汇总条
`<N> files changed +X −Y`;加 `.diff-review-*` 样式;无后端改动;git diff --check 无错;
只动 frontend/index.html(271+/102−)。

AI 自查发现:在 `desktopUpdateActivity` 附近**重复插入了 `maybeRenderDiffReview`**,
不破坏功能但会渲染两次,需先清理。→ 批准先去重再进 Step B。

发这段:
```text
Good catch. Yes — first remove the duplicate maybeRenderDiffReview insertion so the
review summary runs EXACTLY ONCE per update path. Confirm there is only one call site
after cleanup, and app still launches.

Then proceed to STEP B: per-file diff cards in neutral Codex/Claude style — parse the
unified diff string (+ green, − red, @@ muted, skip ---/+++/diff --git/index lines),
green/red ONLY on +/− lines, monospace, generous whitespace, 1px subtle borders.
Frontend-only; keep bridge/IDs/backend untouched. Report after this step.
```

---

## 验证 diff 显示（Step B 之后做，用来检查绿红渲染）

进度:Step A = 只有汇总条(几个文件 +X −Y);Step B = 才有绿红逐行 diff 卡。
但"有卡片"还不够——**必须有真实代码改动,才有东西可显示**。所以 Step B 完成后,
让 AI 实际改一个小文件,再看 diff 卡片是否正确渲染绿红。发这段:
```text
Now let's verify the diff rendering with a REAL change. Make a tiny edit so a
ChangeSession is produced, e.g. append a line "diff UI test" to the end of
frontend/README.md (or any safe file). Then show me:
1. The end-of-turn review summary ("N files changed +X −Y").
2. The per-file diff card rendering the unified diff — confirm added lines are green,
   removed lines red, context muted, and the layout is the neutral Codex style.
Do NOT commit or roll back yet — I just want to see the diff display.
Report what rendered and paste a screenshot-worthy description.
```
检查点:①有汇总条 ②有每文件卡 ③绿增红删清楚 ④整体中性不花。
看着对 → 继续 Step C/D/E(行内/并排、Accept/Decline、Commit)。

---

## 你可能要回答 AI 的问题

它做完 PHASE 0 排查后,可能会问你:
- "找不到 commit/diff 的 bridge 方法,要不要我让后端加?" → 通常回答:**先报告需要加什么,我去确认**。
- "现有 data-theme 是 dark-blue,要不要保留这个名字?" → 可以保留机制,只精修配色。
- 邮箱报错 `win32com not available`(截图里有)→ 那是 Outlook 集成的环境问题,**和这次 UI 改造无关**,让它别动。
