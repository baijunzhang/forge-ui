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

## PHASE 2 前端 Step B 完成（已用真实改动验证）

用真实改动验证:在 README.md 加 `diff UI test`(未 commit/rollback)。解析正确:
汇总 `1 files changed +1 −0`;每文件卡(名+路径+`+1 −0`);unified diff 解析——
`@@` 灰、上下文灰、新增行绿字+淡绿底+`+` 槽,删除行逻辑为红(本次无删)。中性风对。

注意:AI 是**文字描述**渲染结果,还需在真实 app 里**眼见为实**。发这段:
```text
Good — the parsing looks correct. Two things:
1. Show the ACTUAL rendered diff review panel in the running app (not a text
   description). Trigger/display it for the README.md test change and describe
   exactly what is on screen so I can compare with a screenshot.
2. Minor: "1 files changed" should read "1 file changed" (singular when N==1).

Then continue: STEP D — per-file Accept / Decline buttons (Decline calls
rollbackChangeFile), and STEP E — Commit selected (commitChanges with {paths,message}),
keeping the global Roll back as fallback. Frontend-only; one step at a time; report after each.
```
顺序:先 D(Accept/Decline)+ E(Commit)拿到闭环,Step C(并排)最后做。

---

## 回归 bug:diff 改动后主题切换失效

现象:Step A/B 的 diff 改动后,打开 frontend/index.html,Light/Dark 切换按钮点了没反应。
原因:很可能新增的 ~271 行 JS 里有一个错误,导致脚本中断,后面绑定主题切换/其他
handler 的代码没跑。(主题切换是纯前端,与 bridge 无关。)

快速自查:浏览器按 F12 → Console → 看有没有红色报错。
让 AI 修,发这段:
```text
Regression: after the Phase 2 diff-review edits, the Light/Dark theme toggle stopped
working when opening frontend/index.html. This is likely a JavaScript error introduced
in the recent edits that halts script execution and breaks event handlers (including
the theme toggle).

1. Open the browser console / check for a JS error in index.html and find the exact line.
2. Fix it so the script runs cleanly again.
3. Verify: theme toggle works, AND the other existing handlers (New chat, Refresh,
   sessions, send) still work.
Frontend-only. Report the error you found and the fix.
```
修不好可用 git 退回上一个好版本(这正是每步验证+还原点的意义)。

---

## 确切错误:index.html:3007 SyntaxError

控制台确认:`Uncaught SyntaxError: Unexpected token '.'  index.html:3007`。
第 3007 行 JS 语法错误 → 整段脚本崩溃 → 主题切换等 handler 全失效。发这段:
```text
Found the exact error in the console:
  Uncaught SyntaxError: Unexpected token '.'   at index.html:3007

Go to line 3007 in frontend/index.html and fix that syntax error (likely a stray '.',
a malformed optional-chaining, or a typo from the recent diff-review edits). The error
halts the whole script, which is why the theme toggle and other handlers stopped working.

After fixing:
1. Confirm the console has no SyntaxError.
2. Verify theme toggle, New chat, Refresh, sessions, and send all work again.
Frontend-only. Show me the before/after of the fixed line.
```
另一条报错 `'file:' URLs are treated as unique security origins`(HTML 预览 iframe 的
file:// 安全限制)与本问题无关,通过真正 app / 本地服务器打开即无,优先级低,先忽略。

---

## 回归已修复 ✅ → 进 Step D/E

第 3007 行语法错误已修:主题切换恢复、聊天正常、所有 handler 重新接上、
git diff --check 无错(仅 CRLF 警告)、用 desktop.py 真实启动(Qt bridge 已连)。
Step B 本就已完成,回归只是插曲。

下一步:发上面"PHASE 2 前端 Step B 完成"节记录的那条指令(真实 app 看渲染 +
"1 file" 单复数 + 进 Step D Accept/Decline + Step E Commit)。
关键:现在是真实 app,让它触发真实改动,**亲眼在 app 里看绿红 diff 面板**并截图。

---

## PHASE 2 前端 Step D + E 完成（静态验证通过）

Accept/Decline/勾选框、Commit 消息框+按钮、"1 file" 单复数修复、Decline→rollbackChangeFile、
Commit→commitChanges、全局 Roll back 兜底保留。验证:node --check ✅、git diff --check ✅、
静态检查全 True、CSS 括号平衡、单一 maybeRenderDiffReview。中性风(绿增红删/hunk灰/1px/无重阴影)。
README 测试改动仍在工作区未提交。功能闭环基本完成,仅剩 Step C(并排)可选。

下一步:真实 app 端到端实测(此前均为静态+文字描述)。发这段:
```text
Steps D and E are built and statically verified. Now run a REAL end-to-end test in the
running app:

1. Open the app, view the diff review panel for the README.md "diff UI test" change.
   Confirm the card shows: checkbox, Accept, Decline, and Commit-selected control.
2. Test Decline first (clean, no junk commit): decline a throwaway change and confirm
   rollbackChangeFile actually reverts that one file (git status clean for it).
3. Test Commit: Accept the README change, tick it, set a message, click Commit selected.
   Confirm commitChanges returns a hash, success toast shows, and `git log -1` shows it.
   (If you don't want the test commit, undo after with: git reset --soft HEAD~1.)
4. Confirm existing features still work: New chat, Refresh, sessions, send, theme toggle,
   Feature Connections, global Roll back fallback.
Report results and paste `git log -1` for the commit test.
```
在 app 里实际操作时截图。实测通过 → Phase 2 完成 → 可选做 Step C(并排)/ 进 Phase 3。

---

## 如何触发绿红 diff 面板（测试用）

diff 面板只在 AI **真正修改/创建了项目文件**(产生 ChangeSession)时才出现。
"写段代码给我看" / "介绍你自己" 只是聊天,不改文件 → 无 diff。

要触发,在 app 输入框里给**明确改文件**的任务,例如:
- `在 frontend/README.md 文件末尾加一行 "hello world"`
- `创建一个新文件 test.py，内容是 print("hello from HSBC")`
- `修改 frontend/README.md，在开头加一个标题 "# AI Studio"`

改完回合结束 → 底部出现绿红 diff 审阅面板(Accept/Decline/Commit)。
| 说法 | 结果 |
|------|------|
| 写段代码 / 介绍自己 | 聊天显示代码,无 diff |
| 在 X 文件加一行 / 建个 X 文件 | 真改文件 → 出绿红 diff 面板 |

---

## Bug:Feature Connections 勾选框 ~2 秒后自动重置

现象:取消 BBG/Outlook/Board 勾选后约 2 秒又自动勾回默认(全选),无法关闭功能。
性质:纯前端状态被重置(面板定时重渲染,把勾选重置回默认)。**不破坏后端**,
但导致"关闭开关"失效(功能默认全开仍能跑)。可能是 Phase 2 diff hook(挂在
desktopUpdateActivity)引发重渲染,也可能是原有定时刷新。发这段查+修:
```text
Bug: the Feature Connections checkboxes (BBG, Outlook, Board collections) re-check
themselves about 2 seconds after I uncheck them, so I can't disable a feature.

1. Find what re-renders or resets these checkboxes (a periodic poll, a state refresh,
   getInitialState, or the recent Phase 2 diff-review hook in desktopUpdateActivity).
2. Tell me whether this is pre-existing or was introduced by the Phase 2 frontend edits.
3. Fix it so the user's checkbox choices PERSIST and are not overwritten by re-render,
   WITHOUT breaking the diff review or the feature-connection backend behavior.
Frontend-first; if a backend read is involved, explain before changing it. Report the cause.
```
先让它说清是否本次引入:是→修重置逻辑;否→老 bug,与本次无关。

---

## ✅ diff 面板验证成功（test.py 实测）

让它建 test.py 后,绿红 diff 审阅面板正确出现:绿色新增行 `+ print("hello from HSBC")`
(绿字+淡绿底+`+`槽)、hunk 头灰、每文件卡(名+路径+`+1 −0`+勾选框+Accept+Decline)、
汇总条 `1 file changed +1 −0`、Commit 消息框+Commit selected、全局 Roll back 兜底、中性风。
= 完整 Codex 式 diff 审阅面板,显示部分成功。

小瑕疵(可选修):hunk 头显示成 `@@ @@ -0,0 +1 @@`,多了一个 `@@`。
```text
Minor: the hunk header shows a doubled "@@ @@" — it should be "@@ -0,0 +1 @@".
Fix the unified-diff parser so the @@ marker isn't duplicated. Frontend-only.
```

下一步:真点按钮验证功能——Accept→勾选→填消息→Commit selected(看提示+git 真提交),
或 Decline(看文件被回滚)。功能也通 → Phase 2 彻底完成。

---

## 澄清:commit 信息框 + Decline 已验证

"Apply selected AI Studio changes" 不是标签,是 **commit message 输入框的默认文字**,
可编辑/替换(如 git commit 的默认信息)。删掉后显示占位 "Commit message"。正常行为,非 bug。

Decline 已验证成功:System 显示 `Rolled back file change: ...test.py` —— rollbackChangeFile 真回滚了。

可选 UX 改进(默认信息改成灰色占位,减少误解):
```text
Minor UX: in the commit message box, "Apply selected AI Studio changes" should be a
grey PLACEHOLDER (not pre-filled editable text). If the user leaves it empty, commit
with that default message. Frontend-only.
```
还差:点 Accept + Commit selected 填信息提交,看 git log 有真提交 → Commit 也验证完 → Phase 2 100%。

---

## 金融人友好化（去程序员黑话）

产品给金融人用,不能全是开发术语。`@@ -0,0 +1 @@`(hunk 头,git 行号标记)金融人不懂。
需去黑话:
| 黑话 | 友好版 |
|------|--------|
| `@@ -0,0 +1 @@` | "改动 1" / 细分隔线 / "第 17–20 行" |
| `Change session: <id>` | "待审阅的改动" |
| `Validation attempts: ... py -m py_compile ...` | 折叠成 "✓ 已检查" |
| `+1 −0` | 悬停 "新增 1 行,删除 0 行" |
| `Commit` | "保存改动" |
| `Roll back changes` | "撤销全部改动" |
Accept/Decline 保留,加提示("保留此改动"/"丢弃此改动")。

发这段:
```text
This tool is for FINANCE users, not developers. Make the diff review UI friendlier by
removing developer jargon. Frontend-only, keep all functionality:

1. Hide the raw hunk header "@@ -0,0 +1 @@". Replace with a plain label like
   "Change 1" (or a subtle divider). Do not show git @@ syntax to the user.
2. Hide the raw "Change session: <id>" technical id — show "Changes to review" instead.
3. Collapse the raw validation/shell commands (py -m py_compile, verifier subagent, cd...)
   into a simple "✓ Checked" line; keep details available on click if easy.
4. Rename: "Roll back changes" → "Undo all changes"; keep "Commit selected" but relabel
   to "Save changes". Keep Accept / Decline but add short tooltips ("Keep this change" /
   "Discard this change").
5. Show +N/-N with a plain hover: "N lines added, M removed".

Keep the neutral Codex/Claude look. Report what you changed.
```
优先级:①去 @@ + 折叠 shell 命令(最像"后台程序")②Commit/Roll back 改名 ③Accept/Decline 提示。

---

## 目标形态 = Codex/Claude Code 参考图（Step F 右侧 diff 面板）

参考图关键特征 vs 现状:
| 特征 | Codex 参考 | 现在 |
|------|-----------|------|
| diff 位置 | **右侧独立面板**(聊天左/diff 右并排) | 聊天下方 inline |
| @@ hunk 头 | 不显示 | 显示(去掉) |
| Accept/Reject | 文件头 ✓/✕ 图标 | 文字按钮 |
| Commit | 右上角 Commit ▾ | 底部按钮 |
| 侧边栏 | 文件夹分组 | 平铺 |
| 运行线程 | 蓝色小圆点 | 无 |
| 状态行 | ✓ Edited build.py | 无 |

最关键一步:diff 挪到**右侧并排面板**(让它一眼像 Codex)。

### Step F 指令（较大布局改动,先 git 存档,小步做）
```text
Target layout: match Codex/Claude Code — chat on the LEFT, the diff review in a
dedicated RIGHT-SIDE panel (split view), not inline below chat. Frontend-only, keep all
functionality and bridge calls. First `git add -A && git commit` a checkpoint, then:

1. Move the diff review panel into a resizable right-side pane next to the chat.
   Top of the pane: "N files changed  +X −Y" summary and a "Commit" button top-right.
2. Per-file header: filename + "+N −M", with Accept as a check (✓) icon and Decline as
   an (✕) icon on the right — replace the text buttons. Tooltips: "Keep" / "Discard".
3. Hide the raw "@@" hunk headers entirely (show a subtle divider between hunks instead).
4. Keep red/green lines, neutral Codex styling, generous spacing.
Do it incrementally, keep the app launching, report after each sub-step.
```
侧边栏文件夹分组 / 运行小圆点 / 状态行 = Phase 3,之后做。

---

## Step F 基本完成 → 收尾 top-actions CSS

确认:right pane node/css ✅、icon buttons(✓/✕)✅、hunk divider(@@ 已隐藏)✅、
bridge wiring ✅、node/git 检查通过。用户看不到 raw @@ 了。

AI 自查发现 `top actions css False`:JS 有 `diff-review-top-actions` 但缺 CSS。收尾发这段:
```text
Yes, finish those steps:
1. Add the .diff-review-top-actions CSS rule.
2. Move the Commit button to the review pane header / top-right (like the Codex reference).
3. Ensure each per-file header shows: filename + "+N −M" + the ✓ (accept) and ✕ (decline) icons.
4. Relaunch and verify (node --check, git diff --check, bridge wiring intact).
Then show me the final right-side diff panel so I can compare with the Codex reference.
Frontend-only; report after.
```
做完触发一次改动,截图右侧 diff 面板对比 Codex 参考图。

---

## Step F 完成（静态验证）→ 待真实截图

全部 True:right pane node/css、top actions css/js、icon buttons、accept tick、decline x、
hunk hidden、bridge wiring、style balance 0;node/git 检查通过;bridge 接线保留。
AI 的 ASCII 示意布局对上 Codex:聊天左/diff 右、Commit 右上、README.md +N−M ✓ ✕、
@@ 换成细分隔线、绿增行。

注意:AI 给的是 ASCII/文字描述,**非真实截图**。必须打开真实 app 眼见为实:
1. 打开 app → 输入 `创建一个文件 test2.py，内容 print("hi")`
2. 截图右侧 diff 面板,对比 Codex 参考图。
前面各步 AI 均为文字描述,实际渲染可能有细节出入,截图是唯一确认视觉到位的方式。

---

## 真实 app 发现两个功能 bug（静态检查没抓到）

布局对了(右侧面板/✓✕/Commit 右上/test2.py +1−0/绿增行),但真实点击暴露 2 个 bug:
- **Bug 1**:右侧 Review 面板常驻——开 New chat 后仍留着上个会话的 diff,分不清多会话。
  应:只有当前会话有待审改动才显示;换会话/新会话清空+隐藏。
- **Bug 2**:点 Commit / ✓ / ✕ **无反应**——按钮没真正接上功能(静态"True"只是代码存在)。

自查:点击时 F12 Console 看报错。发这段修:
```text
Two real bugs found by clicking in the actual app:

BUG 1 — Right "Review" panel visibility:
- The right diff panel must appear ONLY when the CURRENT session has changes to review.
- On "New chat" / switching sessions, CLEAR and HIDE the review panel and its state, so
  a previous session's diff never leaks into a new chat.

BUG 2 — Buttons do nothing:
- Clicking Commit, the ✓ (accept) icon, or the ✕ (decline) icon has NO effect.
- Check the console for errors when clicking. Verify the click handlers are actually
  attached to these elements (they may lose handlers after re-render) and that they call:
  ✓ → mark accepted + enable commit; ✕ → bridge.rollbackChangeFile; Commit → bridge.commitChanges({paths,message}).
- Fix so all three actually work end to end.

Verify by ACTUALLY clicking in the running app (not static checks): accept, decline, and
a real commit that shows in git log. Frontend-only; report the root cause of each bug.
```
教训:静态检查(代码存在)≠功能可用。必须真实点击验证。

---

## 两 bug 已修(静态)→ 必须真实点击验证

修法正确:
- Bug 2 → **事件委托**(document delegate):按钮重渲染后点击仍有效(之前死按钮的根因是重渲染丢了事件)。
- Bug 1 → hide default + show class add + clear on desktopClear:默认隐藏/有改动才显示/新会话清空。
- commitChanges/rollbackChangeFile 调用 + commit 错误保护 + bridge 接线;node/git 检查通过。

但仍是静态 True ≠ 真能用(上次教训)。必须真实点击:
1. 改文件 → 右面板出现;2. 点 ✓ 有反应;3. 点 ✕ 文件回滚;4. Commit 填信息 → git log 有提交;
5. New chat → 面板清空/隐藏;6. F12 看无报错。每步亲手点+截图。

小提醒:工作区有 untracked `test2.py`(测试遗留),回头 `git` 清理即可。

---

## 真实点击暴露 3 个联动 bug

- **A. Commit 报错**:弹 alert "Path is not in this change session: ...test2.py"——前端发的路径
  与后端 session.modified_files 不匹配(斜杠/大小写/或用了旧 session)。且用了丑的 JS alert。
- **B. New chat 不清右面板**:上次 Bug 1 没真修好——clear 只接了 desktopClear,没接 New chat 按钮。
- **C. Accept(✓)无反馈**:点了没变化,不知道成没成。
- 关键:A 和 B 可能同根——面板显示旧 session 的 diff,commit 发旧路径 → 后端说不在当前 session。

发这段(一次修 3 个):
```text
Real clicking revealed 3 linked bugs. Fix all, then verify by actually clicking:

BUG A — Commit fails with alert "Path is not in this change session":
- The path sent to commitChanges doesn't match the backend session's modified_files.
- Send the SAME session_id that getChangeSessionDiffs returned, and the EXACT path
  string from that payload (normalize slashes/case if needed).
- Replace the raw JavaScript alert() with an inline, finance-friendly message inside the
  review panel (e.g. red text line), not a browser popup.

BUG B — Right review panel does not clear on New chat:
- Wire the panel clear+hide to the "New chat" button AND session switching, not only
  desktopClear. After New chat, the panel must be empty/hidden.
- Ensure the panel always reflects ONLY the current session's changes.

BUG C — Accept (✓) gives no visible feedback:
- On Accept, clearly mark the file as accepted (filled check / dim or collapse the card)
  and enable it for commit. The user must see that it worked.

Check the console when clicking. Verify by ACTUALLY clicking accept, decline, commit, and
New chat in the running app. Report the root cause of each.
```
F12 抓 commit 报错更好定位。

---

## 三处调整:去 Commit + 主题改名 + 两层文件审阅

1. **去掉 Commit(git)**:金融人不用 git 且老报错。保留 Accept(保留/标记)、Decline(回滚该文件)、
   全局 Undo all changes。后端 commitChanges 留着不调用即可。
2. **"Dark blue" → "Dark"**:颜色实际不蓝,改显示文字。
3. **两层文件审阅(Codex 式)**:右面板先显示**文件列表**(文件名 + +N−M + ✓/✕),
   点某文件才展开它的绿红逐行 diff(默认折叠)。现在是一进来铺开,改成列表→点开详情。

发这段:
```text
Three frontend-only changes to the review panel. Keep bridge/backend intact.

CHANGE 1 — Remove the Commit (git) feature entirely:
- Remove the "Commit" button, the commit message box, and the commitChanges call.
- Finance users don't use git. Keep per-file Accept (mark kept / dismiss the card) and
  Decline (calls rollbackChangeFile to undo that file). Keep the global "Undo all changes".
- This also removes the commit error path.

CHANGE 2 — Rename theme label "Dark blue" to "Dark" (the color isn't blue). Label text
only; keep the theme mechanism working.

CHANGE 3 — Two-level file review, like Codex:
- The right panel first shows a FILE LIST: one row per changed file = filename + "+N −M"
  (and the ✓ keep / ✕ undo icons). Do NOT show the full diff yet.
- Clicking a file row expands/opens that file's red/green line-by-line diff below it
  (collapsible). Collapsed by default. Only one or multiple can expand — your call, keep simple.
- Keep neutral Codex styling; green/red only on +/− lines.

Verify by clicking in the running app. Report what changed.
```

---

## 你可能要回答 AI 的问题

它做完 PHASE 0 排查后,可能会问你:
- "找不到 commit/diff 的 bridge 方法,要不要我让后端加?" → 通常回答:**先报告需要加什么,我去确认**。
- "现有 data-theme 是 dark-blue,要不要保留这个名字?" → 可以保留机制,只精修配色。
- 邮箱报错 `win32com not available`(截图里有)→ 那是 Outlook 集成的环境问题,**和这次 UI 改造无关**,让它别动。

---

## 完整版:整体重设计成 Codex/Claude Code 风格的三栏 AI Workbench(一次性给完整规格,不再零敲碎打)

前面几条都是针对具体 bug 或局部调整(去 commit、改主题名、两层文件审阅)的小补丁。这条不一样,
是一份完整的、面向整个前端的重设计规格——把现在"聊天+工具日志"的基础界面,提升成专业级的
AI coding/金融 agent workbench,信息架构定为经典三栏:左侧 session 侧栏 + 中间对话/工作区
(限定可读宽度,约 880–1040px,不再让文字铺满整个显示器)+ 右侧可折叠的 workbench 面板
(Files/Changes/Diff/Terminal/Output/Artifacts,只显示真正有功能连接的 tab)。

**跟之前几条最大的不同:这次明确授权直接实现,不需要在 Plan Mode 里等批准**——除非改动会
牵涉到后端 API 变更或框架迁移,那种情况才需要停下来问。其余情况(纯前端的样式、组件结构、
交互行为)可以审计完代码库之后直接动手做。这跟本文档前面几条"先给方案、批准了再做"的节奏
不一样,值得注意,免得下次看这份文档时以为所有条目都要走批准流程。

规格覆盖的范围很全:设计令牌(颜色/间距/字体/圆角/阴影/动效时长)、侧栏信息层级、工具调用
从"原始日志"改成结构化执行时间线(队列中/运行中/已完成/等待批准/失败/取消,状态要能一眼
区分)、代码改动摘要 + diff viewer、终端输出组件、空状态精简、审批卡片、错误展示分类、
流式反馈的动效克制(120–200ms,尊重 prefers-reduced-motion)、键盘快捷键、响应式断点、
无障碍基本要求。明确要求分三个阶段做(Phase 1: 整体外壳/宽度/侧栏/composer/工具时间线/
空状态/设计令牌 → Phase 2: 文件改动摘要/diff/终端/右侧面板 → Phase 3: 快捷键/响应式/
无障碍/动效打磨),Phase 1 做完再开始 Phase 2,不允许为后面阶段先搭一堆没接上功能的占位组件。
明确禁止改动 Bloomberg 行为、后端 API、工具 schema、认证、agent 逻辑、connector 行为或现有
数据契约(除非极小的、绝对必要的前端兼容性调整),必须保留现有全部功能(sessions/pinned/
scheduled/tool calls/connectors/coding mode/accept-all/features/boards/Bloomberg 工具/
现有聊天记录/现有后端通信/现有路由和持久化)。

指令(发给 AI):
```text
After a brief audit, implement the frontend changes directly. Do not remain in
plan mode or wait for approval unless a backend API change or framework migration
would be required.

You are acting as a senior product designer, frontend architect, and staff-level
frontend engineer.

Your task is to redesign and implement the frontend of the existing
AI Markets Desktop so it feels like a polished modern AI coding workbench,
inspired by the interaction quality of products such as Codex and Claude Code.

Do not copy any proprietary branding, logos, exact visual assets, or product
identity. Reproduce the useful interaction patterns, information hierarchy,
density, responsiveness, and workflow quality while preserving the AI Markets
Desktop identity.

## Primary objective

Transform the current frontend from a basic chat-and-tool-log interface into a
professional AI coding and financial-agent workbench.

The resulting application should feel:

- calm
- precise
- fast
- information-dense without feeling crowded
- suitable for long technical sessions
- easy to scan
- trustworthy
- optimized for tool execution, code edits, Bloomberg workflows, and review

This is a frontend-focused task.

Do not modify Bloomberg behavior, backend APIs, tool schemas, authentication,
agent logic, connector behavior, or existing data contracts unless a tiny
frontend compatibility adjustment is absolutely necessary.

Preserve all existing features, including:

- sessions
- pinned sessions
- scheduled items
- tool calls
- connectors
- coding mode
- accept-all behavior
- features
- boards
- Bloomberg tools
- existing chat history
- existing backend communication
- current routing and persistence

## Current UI problems to address

Based on the existing implementation, improve the following:

1. The main content area is too wide and visually empty.
2. The transcript lacks a strong readable content column.
3. Tool calls appear like raw logs rather than a coherent execution timeline.
4. The composer is visually weak and its actions are not clearly organized.
5. The session sidebar has weak hierarchy, low information density, and unclear
   active/hover states.
6. Empty states consume too much space and provide little guidance.
7. There is no strong workspace for:
   - file changes
   - code diffs
   - terminal output
   - artifacts
   - generated visualizations
8. Running, waiting-for-approval, failed, cancelled, and completed states are not
   visually differentiated enough.
9. Long agent responses and technical output are difficult to scan.
10. The current UI does not feel sufficiently responsive or polished during
    streaming and tool execution.

## Important implementation constraints

- Inspect the current repository before making changes.
- Detect the actual framework, styling system, routing, component architecture,
  and state management.
- Adapt to the existing technology stack.
- Do not migrate frameworks.
- Do not perform unrelated refactoring.
- Avoid adding heavy dependencies.
- Reuse existing components where practical.
- Preserve existing backend request and response formats.
- Preserve all existing functionality.
- Keep the application desktop-first but responsive at narrower widths.
- Use semantic HTML and accessible interactions.
- Do not use mock data in production paths.
- Do not leave disconnected visual components.
- Do not implement decorative controls that do nothing.

After a short repository audit and implementation plan, implement directly.
Do not pause for approval unless a destructive framework migration or backend
contract change would be required.

# Target information architecture

Implement a three-region workbench layout:

┌──────────────────┬──────────────────────────────┬───────────────────────┐
│ Session sidebar  │ Main conversation/work area  │ Optional workbench    │
│                  │                              │ panel                 │
└──────────────────┴──────────────────────────────┴───────────────────────┘

The right workbench panel should be optional and collapsible. The main area
should expand naturally when the panel is closed.

## 1. Left session sidebar

Recommended desktop width:
- approximately 240–280px
- resizable or collapsible if compatible with the current architecture

Include:

- prominent New Session button
- session search
- Pinned section
- Today / Recent section
- Scheduled section where currently supported
- compact session rows
- clear selected state
- hover actions
- pin/unpin
- rename where already supported
- delete/archive where already supported
- timestamps shown subtly
- connection status near the bottom
- workspace/account controls near the bottom

Improve session row design:

- single-line or two-line compact layout
- title with ellipsis
- optional short status indicator
- subtle timestamp
- contextual actions shown on hover
- keyboard-accessible controls

Do not use excessive cards or large vertical gaps.

## 2. Main conversation area

Create a centered readable transcript column.

Recommended maximum content width:
- approximately 880–1040px
- fluid on narrower screens

The transcript should support:

- user messages
- assistant messages
- code blocks
- tool-call groups
- approvals
- errors
- generated tables
- charts
- file changes
- expandable details

Do not stretch message text across the full monitor width.

Use clear vertical rhythm and visual grouping.

Assistant responses should generally not be placed in oversized chat bubbles.
Prefer a document/workbench style for assistant output, with subtle separation
between turns.

User messages may use a restrained surface or alignment treatment, but avoid
large colorful bubbles.

## 3. Optional right workbench panel

Create a reusable collapsible panel for contextual work.

Possible tabs:

- Files
- Changes
- Diff
- Terminal
- Output
- Artifacts
- Visualizations

Only show tabs that have real connected functionality.

Recommended width:
- approximately 360–500px
- resizable if reasonable

When a file or diff is opened, the panel should become the main review surface
without disrupting the conversation transcript.

# Visual design system

Create or consolidate shared design tokens for:

- colors
- spacing
- typography
- borders
- radii
- shadows
- animation durations
- z-index layers

Use a restrained neutral palette.

Characteristics:

- soft neutral background
- clear but subtle surfaces
- low-contrast dividers
- high legibility
- one restrained accent color
- minimal shadows
- border radii generally around 8–12px
- avoid excessive pill shapes
- avoid excessive gradients
- avoid oversized empty areas
- avoid decorative visual noise

Typography:

- use a clean system-oriented sans-serif stack for UI and prose
- use a monospace stack only for code, commands, fields, tickers, and technical
  identifiers
- create a clear type hierarchy
- body text should remain comfortable during long sessions
- use compact labels for metadata and tool status

Support both light and dark appearances if the existing application already has
theme infrastructure. If not, structure tokens so dark mode can be added later
without rewriting components.

# Header and workspace context

Use a compact top header rather than a large empty bar.

Possible content:

- current workspace or project
- current session title
- execution state
- optional branch/project context
- workbench toggle
- connection state
- compact utility actions

Do not duplicate controls already clearly available elsewhere.

# Composer redesign

Make the composer a strong, persistent interaction surface.

It should be:

- sticky near the bottom of the main work area
- visually distinct from the transcript
- compact when empty
- able to expand for multiline input
- keyboard friendly

Recommended structure:

Top/context row, shown only when relevant:
- attached files
- selected context
- connector chips
- referenced tools
- current file/project context

Main input row:
- multiline textarea
- attachment control
- slash-command or command control where supported
- send button
- stop-generation button while running

Bottom control row:
- permission mode such as accept-all
- working mode such as Coding
- connectors
- features
- boards
- any existing environment selector

Improve the hierarchy of these controls. They should look like intentional
context controls rather than loose text at the bottom.

Composer behavior:

- Enter sends
- Shift+Enter adds a new line
- Escape may stop or close transient UI where appropriate
- preserve drafts per session if supported
- show clear disabled and loading states
- show Stop while the agent is running
- prevent accidental double submission

# Tool-call experience

Redesign tool calls as a structured execution timeline.

Each tool call should display:

- icon
- human-readable tool name
- current status
- elapsed time
- concise one-line summary
- expandable request/response details

Statuses should be visually distinct:

- queued
- running
- completed
- waiting for approval
- failed
- cancelled

Default behavior:

- completed low-level calls should usually be collapsed
- currently running calls should remain visible
- failed calls should expand or clearly surface the error
- nested or sequential calls should be grouped under a parent execution group
- repeated calls should not create excessive visual clutter

Example:

Use 5 tools                                      Completed · 13s
├─ Bloomberg Instructions                       Completed
├─ Bloomberg BQL                                Completed · 4.4s
├─ Bloomberg Security Search                    Completed · 1.2s
├─ Bloomberg Resume                             Completed
└─ Visualization                                Completed

Allow users to expand each row to inspect:

- input
- output
- error
- duration
- metadata

Do not expose raw JSON by default. Present a readable summary first, with raw
details available in an expandable technical section.

# Code and file-change experience

Build reusable components for code-edit workflows.

Required concepts:

## File change summary

Show:

- number of changed files
- additions
- deletions
- file names
- status per file

Example:

3 changed files                           +136  −5
tools/bloomberg.py
tools/core.py
tests/test_bloomberg_search_fallback.py

## Diff viewer

Support, where current data makes it possible:

- unified diff
- optional split diff
- line numbers
- syntax highlighting
- added/removed line styling
- file navigation
- collapse unchanged sections
- copy button
- accept/reject per file where backend behavior exists
- accept all where backend behavior exists

Do not invent accept/reject functionality if it is not supported by the current
backend. In that case, provide review-only UI.

## Terminal and command output

Present commands in a compact terminal-style component.

Include:

- command
- running status
- duration
- exit status
- stdout/stderr
- copy button
- collapse/expand

Long output should be constrained and scrollable rather than making the entire
conversation excessively tall.

# Empty state

Replace the oversized blank empty state with a useful but restrained starting
experience.

Include:

- concise headline
- one-line explanation
- 3–5 context-relevant starter actions

Examples:

- Inspect this repository
- Explain the current architecture
- Fix a failing test
- Review recent file changes
- Run a Bloomberg data workflow

Suggestions should appear as compact action rows or chips, not large marketing
cards.

The composer should remain the primary focus.

# Approval and interruption states

Create a clear approval component for actions that need user confirmation.

It should show:

- what action is proposed
- affected files or systems
- concise risk level if relevant
- Approve
- Reject
- Review changes

Do not bury approval requests inside long prose.

For waiting states, use a clear compact banner or inline card rather than making
the user search through the transcript.

# Error handling

Errors should be actionable and visually distinct without being alarming.

Show:

- concise error title
- readable explanation
- retry action when safe
- inspect details
- copy diagnostic information

Separate:

- tool error
- connection error
- permission error
- validation error
- user cancellation

Do not show raw stack traces by default.

# Streaming and execution feedback

Improve the perception of speed.

During execution:

- immediately acknowledge the request
- show the running tool group
- stream assistant text without layout shifting
- show elapsed duration
- expose a Stop action
- avoid full-page loading states
- avoid blank screens during transitions

Use subtle motion only:

- 120–200ms UI transitions
- restrained opacity/height animations
- respect prefers-reduced-motion

# Keyboard and productivity behavior

Add or preserve practical shortcuts where compatible:

- Ctrl/Cmd+K: session or command search
- Ctrl/Cmd+N: new session
- Ctrl/Cmd+Enter: send or run where appropriate
- Escape: close overlays or stop current transient state
- Ctrl/Cmd+B: toggle sidebar if safe
- Ctrl/Cmd+Shift+B or another documented shortcut: toggle workbench panel

Do not intercept browser-standard shortcuts unnecessarily.

Provide visible tooltips for icon-only controls.

# Responsive behavior

Desktop is the primary target.

At medium widths:

- right workbench panel should collapse
- sidebar may become narrower or collapsible
- transcript should retain readable margins

At narrow widths:

- use a single main column
- sidebar becomes a drawer
- workbench becomes a full-screen overlay or tab
- composer remains accessible

# Accessibility

Meet practical WCAG expectations:

- sufficient text contrast
- visible focus states
- keyboard navigation
- semantic buttons
- ARIA labels for icon-only controls
- status announcements for running/completed/failed tasks where reasonable
- no information conveyed by color alone
- minimum usable target sizes

# Recommended component structure

Adapt names to the current framework, but aim for components conceptually similar
to:

- AppShell
- WorkspaceHeader
- SessionSidebar
- SessionSearch
- SessionList
- SessionRow
- ConversationView
- MessageTurn
- AssistantResponse
- UserMessage
- ToolExecutionGroup
- ToolExecutionRow
- ToolDetails
- ApprovalCard
- ErrorCard
- FileChangeSummary
- DiffViewer
- TerminalOutput
- WorkbenchPanel
- EmptyState
- Composer
- ContextChips
- StatusIndicator

Avoid one giant page component.

Extract repeated styles and state behavior into reusable components.

# Data and state rules

Do not redesign backend contracts.

Create frontend view models or adapters when raw backend responses are difficult
to render.

Examples:

- normalize tool statuses for display
- group sequential tool calls
- convert raw file-change payloads into a display model
- preserve the original backend payload for expandable technical details

Do not mutate backend response objects in-place.

# Implementation process

1. Inspect the repository.
2. Identify:
   - entry point
   - main app shell
   - session sidebar implementation
   - conversation renderer
   - tool-call renderer
   - composer
   - CSS/theme system
   - state management
   - tests
3. Summarize the current frontend architecture in a few paragraphs.
4. Identify the smallest maintainable component and styling changes.
5. Implement the redesign directly.
6. Preserve existing behavior.
7. Run the existing frontend test suite.
8. Run linting and type checking.
9. Build the frontend.
10. Fix regressions caused by the changes.
11. Provide before/after screenshots or browser captures if the environment
    supports them.

# Scope control

Prioritize the following in this order:

Phase 1:
- app shell
- content width
- sidebar hierarchy
- composer hierarchy
- tool-call timeline
- empty state
- shared design tokens

Phase 2:
- file change summary
- diff viewer improvements
- terminal output
- right workbench panel

Phase 3:
- keyboard shortcuts
- responsive refinements
- accessibility refinements
- animation polish

Complete Phase 1 fully before starting Phase 2.

Do not create unfinished placeholder components for later phases.

# Acceptance criteria

The task is complete only when:

1. Existing sessions still load.
2. New sessions still work.
3. Existing messages render correctly.
4. Existing tool calls still execute.
5. Existing Bloomberg tools are unaffected.
6. Existing connector controls still work.
7. The composer can send and stop requests correctly.
8. Tool calls have clear running/completed/error states.
9. Long tool details can be collapsed.
10. The transcript has a readable maximum width.
11. The sidebar has clear hierarchy and selected states.
12. Empty state is useful and compact.
13. File changes are easier to review.
14. No backend contracts were broken.
15. Frontend tests, type checking, linting, and build pass.
16. No major console errors remain.
17. The UI works at common desktop sizes and narrower layouts.

# Final report

After implementation, report:

- frontend stack discovered
- files changed
- components created or refactored
- important visual and interaction changes
- tests/build commands run
- test/build results
- backend behavior deliberately left unchanged
- remaining optional improvements

Do not claim a feature is implemented unless it is connected and working.
Do not perform unrelated backend or Bloomberg changes.
```

## 收紧执行纪律:把上面的大规格拆成 checkpoint,每步真机验证再继续(跟 ChatGPT 讨论后采纳)

上一条"三栏 workbench 重设计"授权了"直接实现、不用停下来等批准"——这条明确**撤回那个
授权**。跟外部讨论后达成一致:这个项目从 docs/06 到 08 到 09 唯一被反复验证有效的做法是
"每一小步单独 commit → 真机验证 → 再下一步",从来不是大段无监督实现;这次规格改动面
(整体信息架构、单文件 `index.html`、QWebChannel 事件路由、streaming 状态、一堆已经跑通
不能回归的功能)风险特征跟历史上失败率最高的尝试很像,不该破例。

**内容不变,只改执行方式**——上面已经给出的详细视觉/交互规格(尺寸、颜色 token、组件行为)
仍然是"该做成什么样"的唯一依据,这条只规定"按什么顺序做、每步做完停下来验证什么"。

拆分成 6 个 checkpoint,顺序不能打乱,也不能因为后面某步"看起来很简单"就合并着做:

- **Checkpoint 0 — 冻结现有行为基线**:视觉改动开始前,先截图记录空/运行中/完成/失败/
  审批/diff审阅这几种状态;保存有代表性的真实 tool-call payload(**必须是真机触发的
  真实事件**——真的跑一次 Bloomberg BDP 调用、真的编辑一次文件、真的跑一次定时任务、真的
  触发一次权限审批,把对应的 event JSON 存下来,不能靠读代码猜 payload 长什么样,这正是
  这个项目之前吃过亏的地方:曾经有权限/守卫层默默拦截了写入,AI 却报告"已完成",不核实
  真实行为就没法信);记录 sessions/streaming/tools/approvals/file-changes 用到的
  QWebChannel 事件;跑一遍现有的 smoke test。这是后面所有 checkpoint 的"已知良好基线"。
- **Checkpoint 1 — 只动布局几何**:对话列限宽、文档式消息间距、侧栏/主区边界、composer
  sticky 定位、基础响应式。不动工具调用渲染,不动 composer 控件行为,不动 session 路由。
  验收:长回复更好读、diff 审阅依然正常、没有引入任何路由/渲染/composer 行为改动。
- **Checkpoint 2 — 工具调用时间线 v1**:把原始日志换成结构化时间线(执行分组、工具名、
  状态、耗时、一行摘要、已完成默认折叠、可展开查看输入/输出、原始 payload 收进"Technical
  details"里)。底层 payload 和执行行为不变,只换展示层。这一步先不做审批/错误/重复调用
  合并的状态处理。
- **Checkpoint 3 — 工具时间线的状态处理**:加 queued/running/completed/failed/cancelled/
  waiting-for-approval、streaming 更新、重复调用分组、重试/错误展示。这一步必须用真实的
  Bloomberg、文件、命令、定时任务执行来测,不能只测 mock 数据。
- **Checkpoint 4 — composer 重构**:等对话列和工具时间线都稳定之后才做。收起
  folder/permissions/mode/connectors,加紧凑的底部控制行,加"+"渐进展开菜单,保留
  send/stop/attachment/permission/connector 全部行为。
- **Checkpoint 5 — 空状态/审批卡片/错误状态统一**:空状态、审批卡片、可操作的错误卡片、
  连接/权限状态、少量动效和无障碍打磨。

每个 checkpoint 完成后必须:①停止实现;②跑相关测试和 build;③提供截图;④报告改了哪些
文件;⑤给一份真机 smoke-test 清单;⑥等明确批准才能开始下一个 checkpoint。即使后一个
checkpoint 看起来很简单顺手,也不允许合并着一起做。不能改动后端契约或 QWebChannel 事件
语义。每个 checkpoint 结束时,app 必须处于"可用、可发布"的状态,不能留下半成品。

指令(发给 AI,替代上一条"直接实现"的授权):
```text
Do not implement all of Phase 1 in one pass.

The detailed visual and interaction specification for this redesign was already
provided in the earlier message in this same document (three-region layout, design
tokens, tool-call timeline, composer redesign, file-change/diff experience, empty
state, approval/error handling, keyboard/responsive/accessibility rules, component
structure). That specification is still the source of truth for WHAT each checkpoint
should look like and how it should behave. This instruction only governs the ORDER of
work and the verification discipline — it supersedes the earlier authorization to
implement directly without pausing for approval.

Work through the following checkpoints in order. After each checkpoint:

1. stop implementation;
2. run the relevant tests and build;
3. provide screenshots;
4. report files changed;
5. provide a short real-hardware smoke-test checklist;
6. wait for explicit approval before beginning the next checkpoint.

Checkpoint 0 — Freeze the behavioral contract
Before making any visual changes:
- Capture screenshots of empty, running, completed, failed, approval, and
  diff-review states as they exist today.
- Save representative tool-call payloads captured from REAL executions — trigger an
  actual Bloomberg data call, an actual file edit, an actual scheduled-task run, and
  an actual permission-approval prompt on real hardware, and save the resulting event
  JSON. Do not infer payload shapes from reading code alone.
- Document the QWebChannel events currently used for sessions, streaming, tool calls,
  approvals, and file changes.
- Run the current smoke tests.
Report this baseline before touching any code.

Checkpoint 1 — Layout geometry only
Change only:
- transcript max width;
- document-style message spacing;
- sidebar/main-area boundaries;
- sticky composer positioning;
- basic responsive behavior.

Do not redesign tool calls or composer controls yet.

Acceptance criteria:
- no session-routing changes;
- no tool-rendering changes;
- no composer behavior changes;
- long responses become easier to read;
- diff review still works.

Checkpoint 2 — Tool timeline v1
Replace the raw tool log visually, but preserve the underlying payloads and
execution behavior.

Implement:
- execution groups;
- tool name;
- status;
- elapsed time;
- one-line summary;
- collapsed completed calls;
- expandable input/output details;
- raw payload available behind "Technical details."

Do not yet redesign approvals, errors, or repeated-call summarization.

Checkpoint 3 — Tool timeline state handling
Add:
- queued;
- running;
- completed;
- failed;
- cancelled;
- waiting for approval;
- streaming updates;
- repeated-call grouping;
- retry/error presentation.

This must be tested with real Bloomberg, file, command, and scheduled-task
executions — not mocked data.

Checkpoint 4 — Composer restructure
Only after the transcript and timeline are stable:
- collapse folder, permissions, mode, and connectors;
- add the compact bottom control row;
- introduce the "+" progressive-disclosure menu;
- preserve send, stop, attachment, permission, and connector behavior.

Checkpoint 5 — Empty, approval, and error states
Then unify:
- empty state;
- approval cards;
- actionable error cards;
- connection and permission states;
- small animation and accessibility polish.

Do not combine checkpoints, even when later work appears straightforward.
Do not change backend contracts or QWebChannel event semantics.
Every checkpoint must leave the application usable and releasable.
```

## 参考截图比对:Codex 展开态 vs 现有 AI Markets Desktop 展开态

对着一张 Codex 截图(展开 uncommitted changes 之后的状态,不是常驻三栏——两边都是点开才展
开)和两张现有 AI Markets Desktop 截图(dark/light 各一张,分别是"对话内折叠卡片"和"点开
后的 Review changes 面板")做了逐处比对,记录两点差异,作为后续相关 checkpoint 的验收参考,
**不构成新的实现授权**,不改变上面 6 个 checkpoint 的顺序和范围:

1. **展开后的空间结构不同**:Codex 展开后是三栏并列——左侧 threads、中间 chat、右侧 diff
   面板互不挤压,且 diff 面板自带一个更右侧的完整文件树列(不只是改动文件的扁平列表)。现
   有 AI Markets Desktop 点开 "Review changes" 后是挤压覆盖式——中间 chat 被压窄,右侧面板
   像抽屉/modal 一样占满剩余空间,且只有扁平的 "CHANGED FILES" 列表,没有完整项目文件树。
   → 对应 **Checkpoint 1(布局几何)** 的验收标准里应补一条:三栏展开时中间对话列不应被压
   窄到不可读,右侧 diff/changes 面板应是并列的第三栏而不是覆盖式抽屉。

2. **diff 的归属不同**:Codex 的 "Uncommitted changes" 是工作区级别的持续状态,不挂在具体
   某一条对话回复下面,顶部有独立的 Open/Commit 入口,反映的是当前 working tree 的真实状
   态。现有 AI Markets Desktop 的 "N changed files" 卡片是挂在某一条聊天回复下面的回执
   (inline card),是"这一轮做了什么"而不是独立反映仓库当前状态的面板。
   → 这一点不属于 Checkpoint 1(纯布局),需要在后续涉及文件改动/diff 体验的 checkpoint(原
   规格里的 "file-change/diff experience" 部分)一并考虑,是否要把 diff 面板的数据来源从
   "对话轮次回执"改成"独立查询 working tree 状态",但**不在当前 checkpoint 顺序里插入新步
   骤或提前实现**,只作为该 checkpoint 到达时的参考。
