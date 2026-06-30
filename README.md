# Forge UI — AI IDE 设计资料

构建一个 Claude / ChatGPT / Codex 级别的 AI IDE（AI 工作台）的设计 prompt 与产品文档集合。

## Prompt 索引

| 文件 | 定位 | 适用场景 |
|------|------|----------|
| [AI-Coding-Assistant-Prompt.md](AI-Coding-Assistant-Prompt.md) | **v1 · 精简版** | 聚焦代码编辑 + diff 审批（Accept/Reject、提交）。需求清晰、想快速出原型时用。 |
| [AI-IDE-Workspace-Prompt.md](AI-IDE-Workspace-Prompt.md) | **v2 · 全功能工作台** | 让 AI 扮演 OpenAI/Anthropic 设计师，做 production-ready 全功能 AI 工作台（15 大模块）。 |
| [AI-IDE-Workspace-Prompt-v3.md](AI-IDE-Workspace-Prompt-v3.md) | **v3 · 逆向拆解版** | 先逆向拆解 ChatGPT/Claude/Cursor 等再融合，30 项 deliverables。⚠️ 一次性输出过重，实测易出现页面不美观、bug 多。 |
| [AI-IDE-Stepwise-Prompt.md](AI-IDE-Stepwise-Prompt.md) | **v4 · 分步施工版（React/npm）** | 精简高效。把构建拆成 10 个小 step，AI 一次只改一块、能跑再继续。需要 npm。 |
| [AI-IDE-Stepwise-Prompt-HTML.md](AI-IDE-Stepwise-Prompt-HTML.md) | **v4-HTML · 纯 HTML 版（推荐，无需 npm）** | 同样 10 步，但纯 HTML + CSS + 原生 JS，双击 index.html 即可运行，不装任何环境。 |

## 产品文档（落地）

| 文件 | 阶段 |
|------|------|
| [docs/01-PRD.md](docs/01-PRD.md) | 1. 产品需求文档（PRD） |
| [docs/02-如何实施.md](docs/02-如何实施.md) | 实施指南：建项目、放令牌、发开场白、分步施工（照着做即可）|
| [docs/design-system.md](docs/design-system.md) | 设计系统：颜色 + 字体 + 间距 + 轻盈感规范（Claude/Codex 风格）|
| [index.html](index.html) | 纯 HTML 版起步文件：双击即可在浏览器打开（无需 npm）|
| [styles.css](styles.css) | 纯 HTML 版的设计令牌（= globals.css，供 index.html 引入）|
| [app.css](app.css) / [app.js](app.js) | 纯 HTML 版的组件样式与原生 JS 逻辑（AI 按 STEP 追加）|
| [app/globals.css](app/globals.css) | React/npm 版全局样式：设计令牌 + 轻盈动效工具类 |
| [tailwind.config.ts](tailwind.config.ts) | React/npm 版 Tailwind 配置：令牌映射成语义类名 |

> v3 建议把设计流程拆成 6 个阶段分别生成：**PRD → UX 规范 → UI 设计 → 前端架构 → Design System → 交互规范**。当前已完成第 1 阶段，后续阶段会陆续补充到 `docs/`。

## 使用建议
- 直接落地用 **v3**，并务必填写其中的技术栈 / 配色 / 状态管理占位符。
- 不要让模型一次产出全部内容；按 6 阶段分步生成，质量更稳定、更可直接开发。
