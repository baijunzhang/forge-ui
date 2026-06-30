# Design System — Forge AI IDE（颜色 + 字体规范）

> 目标：像 Claude / Codex 那样克制、统一、耐看。先把令牌（tokens）定死，后面每个 STEP 都照这套用，整体自然协调。
> 风格关键词：低饱和、暖中性灰、留白充足、深色优先、几乎无纯黑纯白。

---

## 1. 颜色（Color Tokens）

### 设计原则
- **不用纯黑 `#000` / 纯白 `#fff`**：纯黑刺眼，改用接近黑的暖灰；文字用偏灰的白。
- **中性色占 90%**，强调色（accent）只用在关键动作和焦点，少即是多。
- 语义色（增/删/警告）低饱和，diff 才不会"花"。

### 深色主题（默认）
```css
:root[data-theme="dark"] {
  /* 背景层次：越上层越亮一点点 */
  --bg-base:        #1a1a18;  /* 最底层背景（暖黑）*/
  --bg-surface:     #212121;  /* 面板/侧栏 */
  --bg-elevated:    #2a2a28;  /* 卡片/悬浮 */
  --bg-hover:       #323230;  /* hover 态 */
  --bg-active:      #3a3a37;  /* 选中/按下 */

  /* 边框：极淡，靠明度区分而非粗线 */
  --border-subtle:  #2e2e2c;
  --border-default: #3a3a37;
  --border-strong:  #4a4a46;

  /* 文字：分三级，不要全是同一个白 */
  --text-primary:   #ececec;  /* 正文/标题 */
  --text-secondary: #b4b4b0;  /* 次要说明 */
  --text-muted:     #8a8a86;  /* 占位/禁用 */

  /* 强调色（克制的暖橙，接近 Claude/Codex 的调子）*/
  --accent:         #d97757;  /* 主按钮、链接、焦点 */
  --accent-hover:   #e08968;
  --accent-subtle:  rgba(217,119,87,0.12); /* 强调背景底 */
  --focus-ring:     rgba(217,119,87,0.45);

  /* 语义色（低饱和，diff 友好）*/
  --success:        #6cae75;
  --warning:        #d6a85c;
  --danger:         #cf6b66;

  /* Diff 专用 */
  --diff-add-bg:    rgba(108,174,117,0.14);
  --diff-add-text:  #8fce97;
  --diff-del-bg:    rgba(207,107,102,0.14);
  --diff-del-text:  #e0908b;
  --diff-gutter:    #6cae75;  /* 行号区 + 标记 */
}
```

### 浅色主题
```css
:root[data-theme="light"] {
  --bg-base:        #f7f6f3;  /* 暖白，不刺眼 */
  --bg-surface:     #ffffff;
  --bg-elevated:    #ffffff;
  --bg-hover:       #f0efea;
  --bg-active:      #e8e6df;

  --border-subtle:  #ecebe6;
  --border-default: #e0ded7;
  --border-strong:  #cbc9c0;

  --text-primary:   #2a2a28;
  --text-secondary: #5a5a55;
  --text-muted:     #8a8a83;

  --accent:         #c45c3c;
  --accent-hover:   #b04e30;
  --accent-subtle:  rgba(196,92,60,0.10);
  --focus-ring:     rgba(196,92,60,0.40);

  --success:        #4f9d5f;
  --warning:        #c08a3e;
  --danger:         #c0504b;

  --diff-add-bg:    rgba(79,157,95,0.12);
  --diff-add-text:  #2e7d40;
  --diff-del-bg:    rgba(192,80,75,0.12);
  --diff-del-text:  #b03a35;
  --diff-gutter:    #4f9d5f;
}
```

---

## 2. 字体（Typography）

### 字体族
```css
:root {
  /* UI 正文：系统无衬线栈，跨平台一致、加载快 */
  --font-sans: ui-sans-serif, -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, "PingFang SC",
               "Microsoft YaHei", sans-serif;

  /* 代码 / diff / 终端：等宽 */
  --font-mono: "SF Mono", ui-monospace, "JetBrains Mono",
               "Fira Code", Menlo, Consolas, monospace;
}
```
> 想更有"产品感"可换正文为 **Inter**，代码为 **JetBrains Mono**（需自行引入字体文件）。系统栈胜在零加载、稳定。

### 字号阶梯（Type Scale）
保持克制，UI 里只用这几档，不要随意造字号：

| Token | size / line-height | 用途 |
|-------|--------------------|------|
| `--text-xs`   | 12px / 16px | 标签、徽标、行号 |
| `--text-sm`   | 13px / 20px | 次要文字、按钮、菜单 |
| `--text-base` | 14px / 22px | **正文默认**（IDE 里 14px 比 16px 更合适）|
| `--text-md`   | 15px / 24px | 对话正文 |
| `--text-lg`   | 18px / 26px | 小标题 |
| `--text-xl`   | 22px / 30px | 页面标题 |

```css
:root {
  --text-xs: 12px;   --lh-xs: 16px;
  --text-sm: 13px;   --lh-sm: 20px;
  --text-base: 14px; --lh-base: 22px;
  --text-md: 15px;   --lh-md: 24px;
  --text-lg: 18px;   --lh-lg: 26px;
  --text-xl: 22px;   --lh-xl: 30px;

  /* 字重：只用 3 档 */
  --fw-normal: 400;
  --fw-medium: 500;   /* 按钮、标签、强调 */
  --fw-semibold: 600; /* 标题 */

  /* 代码字号略小一档，行高松一点 */
  --code-size: 13px;
  --code-lh: 21px;
}
```

### 排版规则
- 正文用 `--fw-normal`，标题/按钮用 `--fw-medium`，大标题 `--fw-semibold`。**不用 700+ 的粗体**，太重不耐看。
- 字间距：大标题可加 `letter-spacing: -0.01em`（更紧致）；正文保持默认。
- 段落、消息之间用间距分隔，少用分割线。

---

## 3. 间距 / 圆角 / 阴影

```css
:root {
  /* 8px 网格：所有 padding/margin/gap 用这些值 */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;
  --space-4: 16px;  --space-5: 24px;  --space-6: 32px;  --space-8: 48px;

  /* 圆角：统一、温和 */
  --radius-sm: 6px;   /* 按钮、输入框、标签 */
  --radius-md: 10px;  /* 卡片、面板 */
  --radius-lg: 14px;  /* 模态框、大容器 */
  --radius-full: 9999px;

  /* 阴影：极淡，靠层次而非重投影 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.18);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.22);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.30);
}
```

---

## 4. Tailwind 接入（如果用 Tailwind）

`tailwind.config.ts` 里把令牌映射成语义类名：

```ts
export default {
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        hover: "var(--bg-hover)",
        active: "var(--bg-active)",
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
        },
        text: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          subtle: "var(--accent-subtle)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
    },
  },
}
```

用法示例：`<div class="bg-surface text-secondary border border-subtle rounded-md">`

---

## 5. 给 AI 的一句话（加到分步 prompt 里）

> 把下面这段加到 `AI-IDE-Stepwise-Prompt.md` 总纲里，每步都会遵守：

```text
Use ONLY the design tokens defined in docs/design-system.md.
- Never hardcode hex colors or font sizes — always use the CSS variables /
  Tailwind semantic classes (bg-surface, text-secondary, accent, etc.).
- No pure black or pure white. No font-weight above 600.
- Stick to the 8px spacing grid and the defined radius/shadow tokens.
```

---

## 6.5 轻盈感原则（Lightweight Feel）

> 目标：界面看起来通透、不厚重。Claude/Linear 那种"轻"，不是少功能，而是视觉重量控制得好。

**核心：能用边框和留白分层，就不用阴影和填充。**

| 做 ✅ | 不做 ❌ |
|-------|---------|
| 面板之间用 1px `border-subtle` 分隔 | 给每个面板加重投影、厚边框 |
| 工具栏/卡片背景用 `bg-surface`（与底色差一点点） | 大块高对比纯色填充 |
| 展开 toolbar / 面板用**高度+淡入动画**滑出 | 突然撑开、生硬跳变 |
| 图标按钮：透明底，仅 hover 时显 `bg-hover` | 每个按钮都有边框+背景 |
| 次要信息用 `text-muted`，弱化存在感 | 所有文字一样重 |
| 分隔靠间距（`space-4/5`），少用分割线 | 到处画横线竖线 |
| 阴影只给真正悬浮的元素（菜单/模态/toast） | 静态卡片也加阴影 |

**展开/收起类交互（toolbar、tool-call 卡片、侧栏、面板）统一规则：**
- 用高度过渡 + 淡入：`transition: height 180ms, opacity 120ms`（已封装为 `.collapsible` / `animation: slide-down`）。
- 收起时元素从布局流移除，不留空占位。
- 折叠按钮用极简的 chevron 图标（▸ / ▾），不用大按钮。
- 默认**收起**次要面板（如右侧 Inspector、底部终端），需要时才展开 —— 默认轻、按需重。

**动效原则（轻而不飘）：**
- 时长短：120–260ms，绝不超过 300ms。
- 缓动统一：`cubic-bezier(0.2,0,0,1)`（快出慢入，干脆）。
- 只动 `opacity` 和 `transform`（性能好、不卡）。
- 不用弹跳、不用大位移、不用持续循环动画（除 loading）。
- 尊重 `prefers-reduced-motion`（已在 globals.css 处理）。

---

## 速查：为什么这套耐看

| 决策 | 原因 |
|------|------|
| 暖黑/暖白，不用纯黑白 | 减少眩光，长时间看不累（Claude/Codex 同款思路）|
| 文字分 3 级明度 | 信息层次清楚，不会"一片白糊在一起" |
| 强调色只一个、低饱和 | 克制 = 高级；强调色一多就乱 |
| diff 语义色低饱和 | 大段 diff 不刺眼、好读 |
| 字号只 6 档、字重只 3 档 | 约束=统一；选择越少越协调 |
| 圆角/间距/阴影全令牌化 | 全局一致，改一处全局生效 |
