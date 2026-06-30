# AI IDE 分步施工 Prompt — 纯 HTML 版（无需 npm / 无构建）

> 适用：用纯 HTML + CSS + 原生 JS 写,不装 npm、不用 React/Tailwind 构建。
> 双击 `index.html` 就能在浏览器打开看效果。
> 核心思路不变:**小步迭代**,一次只做一个 STEP,做完能在浏览器打开看,再做下一步。

---

## 项目结构(已备好,4 个文件)

```
index.html   ← 页面骨架,引入下面三个文件
styles.css   ← 设计令牌(颜色/字体/间距/轻盈动效),不要改
app.css      ← 组件样式,AI 按 STEP 追加
app.js       ← 交互逻辑(原生 JS),AI 按 STEP 追加
```

打开方式:**直接双击 `index.html`**,或在浏览器里 `文件 → 打开`。改完代码刷新页面即可,无需任何命令。

---

## 第一条消息:开场白(先发这个,等 AI 回 "Ready")

```text
You are a senior frontend engineer building an AI IDE (like Claude / Cursor).

IMPORTANT constraints:
- Pure HTML + CSS + vanilla JavaScript ONLY.
- NO npm, NO build tools, NO frameworks (no React/Vue), NO Tailwind, NO bundler.
- The app must run by simply opening index.html in a browser (file://).
- Use only browser-native APIs. If you need an icon, use inline SVG or a unicode glyph — do NOT add external dependencies.

Project files (already created):
- index.html  : page shell, has <div id="app"></div>, links styles.css, app.css, app.js
- styles.css  : design tokens (colors/fonts/spacing/animations). DO NOT modify this file. Use its CSS variables.
- app.css     : component styles. Append here.
- app.js      : interaction logic (vanilla JS). Append here.

We build INCREMENTALLY, one small step at a time.

Rules you MUST follow:
1. Do ONLY the current step. Do not build ahead.
2. After each step, opening index.html in a browser must work with no console errors.
3. Keep it simple. Vanilla JS, clear functions, no clever abstractions.
4. Reuse existing styles/elements. Do not reinvent.
5. After writing code, self-review: list what you changed and any risk/bug.
6. Use mock data first. Wire real logic only when a step asks.
7. If a step is ambiguous, ask ONE clarifying question before coding.

Styling rules:
- Use ONLY the CSS variables from styles.css (var(--bg-surface), var(--text-secondary), var(--accent), var(--border-subtle), etc.). Never hardcode hex colors or font sizes.
- No pure black or pure white. No font-weight above 600. 8px spacing grid.
- Dark mode first, clean and minimal (Linear / Claude aesthetic).

Keep the UI LIGHTWEIGHT, not heavy:
- Separate panels with 1px subtle borders + whitespace, not heavy shadows/fills.
- Icon buttons are transparent; show hover background only on hover.
- Expand/collapse (toolbar, cards, panels) uses a height + fade animation. No abrupt jumps.
- Collapse secondary panels (right inspector, bottom terminal) BY DEFAULT.
- Animations 120-260ms, ease cubic-bezier(0.2,0,0,1), animate only opacity/transform. No bounce, no looping (except loaders).

Reply "Ready" and wait. I will give you ONE step at a time.
```

---

## 分步清单(每次只发一个 STEP)

### STEP 1 — 布局骨架
```text
STEP 1: Build the app shell inside #app (HTML in index.html, styles in app.css).
- Three columns: left sidebar (240px), center area (flex: 1), right panel (320px).
- Top bar across the top: app name on the left, model selector + status dot on the right.
- Use empty placeholder content for now. No real data.
- Fixed layout (no resizing yet). Must look clean opened in a browser.
Self-review and confirm before we continue.
```

### STEP 2 — 对话区(静态)
```text
STEP 2: Build the chat message list in the center column (static mock data in app.js, rendered into the DOM).
- User vs AI message styling (different alignment/background).
- Render basic markdown-ish text and code blocks (monospace block with subtle bg).
- Scrollable, newest at bottom. Render 4-5 mock messages.
- No input box yet, no streaming yet.
```

### STEP 3 — 输入框
```text
STEP 3: Add the chat input box at the bottom of the center column.
- Multi-line textarea that auto-grows. Enter to send, Shift+Enter for newline.
- Send button + stop button (stop only visible while "generating").
- On send: append the user message to the list. Then show a fixed mock AI reply after 500ms.
```

### STEP 4 — 流式输出
```text
STEP 4: Make the AI reply stream in.
- Replace the instant mock reply with a typing effect (reveal text chunk by chunk via setInterval/setTimeout).
- Blinking cursor while streaming; the stop button cancels it.
- Keep it a local mock (no network).
```

### STEP 5 — 工具调用卡片
```text
STEP 5: Add collapsible tool-call cards inside AI messages.
- When the AI "uses a tool" (mock), show a card: tool name + status (running/done) + a collapsible details section.
- Use the height+fade expand/collapse animation. Example tools: "Read file", "Search".
```

### STEP 6 — 文件树
```text
STEP 6: Fill the left sidebar with a file tree.
- Folders expand/collapse, files clickable (highlight selected).
- Mark files with unsaved changes using a small colored dot.
- Use a mock file structure (array in app.js, rendered to DOM).
```

### STEP 7 — Diff 视图(核心)
```text
STEP 7: Build the diff viewer in the center (or right panel).
- Git-style: added lines green background with "+", deleted lines red background with "-", context lines normal.
- Use the diff color variables from styles.css (--diff-add-bg, --diff-add-text, --diff-del-bg, --diff-del-text).
- Show a header: file path + "+N / -M" counts. Unified (inline) mode first.
- Use one mock diff. This is the most important piece — make it clean and readable.
```

### STEP 8 — Accept / Reject
```text
STEP 8: Add edit approval to the diff viewer.
- Per-hunk Accept / Reject buttons. Accept All / Reject All at the top.
- An "Auto-accept edits" toggle in the top bar.
- Accepting updates the mock file state and clears that hunk from the view.
```

### STEP 9 — 提交
```text
STEP 9: Add a commit flow.
- A "Commit" button opens a panel: list of changed files (checkboxes), a commit message input, a confirm button.
- Confirm clears the "changed" dots (mock) and shows a toast on success.
```

### STEP 10 — 打磨
```text
STEP 10: Polish pass only. No new features.
- Fix spacing/alignment inconsistencies.
- Add empty states, loading states, hover states.
- Check dark mode contrast and keyboard focus rings.
- List any remaining bugs you notice.
```

---

## 实操节奏

```
发 STEP N
  → AI 写代码(改 index.html / app.css / app.js)
  → 你刷新浏览器看一眼(双击 index.html 打开的那个页面)
  → 没问题 → 发 STEP N+1
  → 有 bug  → 回它:"这里有问题 [描述],先修好再继续"
```

**一次只发一个 STEP。** 别一次贴十个,那会退回"又丑又 bug"的老问题。

---

## 和 npm 版的区别

| | npm/React 版 | 纯 HTML 版(这份)|
|---|---|---|
| 装环境 | 要 `npx create-next-app` | 不用,4 个文件已备好 |
| 运行 | `npm run dev` | 双击 `index.html` |
| 样式 | Tailwind 语义类名 | styles.css 的 CSS 变量 |
| 逻辑 | React 组件 | 原生 JS + DOM |
| 适合 | 想做成真产品 | 快速做原型 / 没有 npm |
