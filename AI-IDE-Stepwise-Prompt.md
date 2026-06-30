# AI IDE 分步施工 Prompt（精简高效版）

> 为什么需要这版：v1–v3 都是"一次性吐出整个产品"，模型注意力被摊薄 → 页面丑、bug 多。
> 这版的核心：**小步迭代**。一次只做一个 step，做完能跑、自检通过，再做下一步。
> 用法：先发"总纲"，模型确认后，每次只发一个 STEP。

---

## 第一条消息：总纲（先发这个）

```text
You are a senior frontend engineer building an AI IDE (like Claude / Cursor),
using React + TypeScript + Tailwind + shadcn/ui.

We will build it INCREMENTALLY, one small step at a time.

Rules you MUST follow:
1. Do ONLY the current step. Do not build ahead.
2. After each step, the app must compile and run with no errors.
3. Keep it simple. Prefer fewer, cleaner components over many clever ones.
4. Reuse existing components and styles. Do not reinvent.
5. After writing code, self-review: list what you changed, and any risk/bug you see.
6. Use placeholder/mock data first. Wire real logic only when a step asks for it.
7. If a step is ambiguous, ask ONE clarifying question before coding.

Tech constraints:
- Dark mode first, clean and minimal (Linear / Claude aesthetic).
- 8px spacing grid, consistent typography, soft rounded corners.
- No heavy animations. Subtle only.

Design tokens (colors + typography) are defined in docs/design-system.md.
- Use ONLY those tokens (CSS variables / Tailwind semantic classes like
  bg-surface, text-secondary, accent). Never hardcode hex or font sizes.
- No pure black or pure white. No font-weight above 600.
- Stick to the 8px spacing grid and the defined radius/shadow tokens.

Reply "Ready" and wait. I will give you ONE step at a time.
```

> 注：STEP 1 之前先让 AI 把 `docs/design-system.md` 里的令牌写进全局 CSS / `tailwind.config`，作为 STEP 0。

---

## 分步清单（每次只发一个 STEP）

### STEP 1 — 布局骨架
```text
STEP 1: Build the app shell only.
- Three-column layout: left sidebar (240px), center chat area (flex), right panel (320px, collapsible).
- Top bar: app name left, model selector + status dot right.
- Use mock empty states. No real data yet.
- Make panels resizable is NOT needed yet. Just fixed layout.
Self-review and confirm it runs before we continue.
```

### STEP 2 — 对话区（静态）
```text
STEP 2: Build the chat message list (static mock data).
- User message vs AI message styling (different alignment/background).
- Markdown rendering + code blocks with syntax highlighting.
- Scrollable, newest at bottom.
- No input box yet, no streaming yet. Just render 4-5 mock messages.
```

### STEP 3 — 输入框
```text
STEP 3: Add the chat input box at the bottom.
- Multi-line textarea, auto-grow, Enter to send / Shift+Enter newline.
- Send button + stop button (stop only visible while "generating").
- On send: append the user message to the list (local state only).
- Mock the AI reply with a fixed string after 500ms.
```

### STEP 4 — 流式输出
```text
STEP 4: Make the AI reply stream.
- Replace the instant mock reply with a typing/streaming effect
  (reveal text chunk by chunk).
- Show a blinking cursor while streaming; "stop" button cancels it.
- Keep it a local mock stream (no backend).
```

### STEP 5 — 工具调用卡片
```text
STEP 5: Add collapsible tool-call cards in the AI message.
- When AI "uses a tool" (mock), show a card: tool name + status
  (running / done) + collapsible details.
- Example tools: "Read file", "Search". Mock the results.
```

### STEP 6 — 文件树
```text
STEP 6: Fill the left sidebar with a file tree.
- Folders expand/collapse, files clickable.
- Mark files with unsaved changes (colored dot).
- Clicking a file selects it (highlight). Use mock file structure.
```

### STEP 7 — Diff 视图（核心）
```text
STEP 7: Build the diff viewer in the center (or right panel).
- Git-style: added lines green (+), deleted lines red (-), context normal.
- Unified (inline) mode first. Side-by-side can come later.
- Show file path + "+N / -M" line count header.
- Use one mock diff. This is the most important piece — make it clean.
```

### STEP 8 — Accept / Reject
```text
STEP 8: Add edit approval to the diff viewer.
- Per-hunk Accept / Reject buttons.
- Accept All / Reject All at the top.
- An "Auto-accept edits" toggle in the top bar.
- Accepting updates the file (mock state) and clears that hunk.
```

### STEP 9 — 提交
```text
STEP 9: Add a commit flow.
- A "Commit" button shows a panel: list changed files (checkbox),
  commit message input, confirm button.
- Confirm clears the "changed" markers (mock). Show a toast on success.
```

### STEP 10 — 打磨
```text
STEP 10: Polish pass only. No new features.
- Fix spacing/alignment inconsistencies.
- Add empty states, loading skeletons, hover states.
- Check dark mode contrast and keyboard focus rings.
- List any remaining bugs you notice.
```

---

## 为什么这样更好（给你自己参考）

| 问题（v3） | 这版怎么解决 |
|------------|--------------|
| 一次做太多 → 注意力摊薄 → 丑 + bug | 每步只做一件事，模型能聚焦做精 |
| 几千行一次生成，没法 review | 每步小改动，看得懂、好验证 |
| 出 bug 不知道哪来的 | 每步都要求"能跑 + 自检"，问题隔离在单步 |
| 模型自由发挥跑偏 | 规则锁死：只做当前步、复用、不超前 |

**关键口诀**：少即是多，能跑再继续，做完一步再开下一步。
