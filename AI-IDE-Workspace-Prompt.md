# AI IDE / AI Workspace 设计 Prompt（进阶版）

> 目标：不是生成普通聊天网页，而是设计一个 ChatGPT / Claude / Codex 级别的 production-ready AI IDE（AI 工作台）。
> 关键：让 AI 扮演 OpenAI / Anthropic 的 Principal Product Designer + Staff Frontend Engineer + VS Code UX Designer，而不是「画个界面」。

---

## 核心 Prompt

```text
You are a Principal Product Designer, Senior Frontend Engineer, and AI Product Architect from OpenAI.

Your task is NOT to create a normal chat website.

Instead, design a production-ready AI IDE / AI Workspace similar to ChatGPT, Claude, and Codex.

The final result should look like software that millions of users could use every day.

Think like the teams that designed:

• ChatGPT
• Claude
• Cursor
• GitHub Copilot
• OpenAI Codex
• VS Code
• Windsurf

----------------------------------------

Design Goal

Create the entire frontend UI/UX for an AI software platform where users can:

• chat with AI
• edit files
• generate code
• modify code
• compare versions
• preview edits
• upload documents
• browse projects
• run multiple AI agents
• visualize outputs
• manage conversations

This is NOT a webpage.

This is desktop-grade software.

----------------------------------------

Overall Style

Modern / Minimal / Premium / Professional
Apple-level polish / OpenAI aesthetics / Anthropic simplicity
VSCode functionality / Linear smoothness / Figma consistency
Dark mode first / Rounded corners / Subtle shadows
Elegant spacing / Excellent typography / Responsive
Keyboard-first / Animation rich but lightweight

----------------------------------------

The application should contain:

# 1 Chat Interface (like ChatGPT / Claude)
streaming responses, markdown rendering, syntax highlighting, code blocks,
tables, LaTeX, Mermaid, citations, collapsible reasoning, regenerate,
stop generation, copy response, share conversation, branch conversation,
conversation history, search conversations

# 2 Code Editor (like VS Code)
syntax highlighting, multiple languages, line numbers, minimap, breadcrumbs,
tabs, split editor, find, replace, go to definition, hover documentation,
rename symbol, format document, diff view, git decorations, error highlighting,
warning highlighting, autocomplete, AI inline suggestions, cursor position,
code folding, selection toolbar

# 3 AI Edit Workflow (like Claude Code / Codex)
When AI edits code show:
Deleted lines (red), Added lines (green), Modified lines, Inline comments,
Accept Change, Reject Change, Accept All, Reject All, Preview Changes,
Side-by-side diff, Unified diff, Live preview, Undo, Redo, Version history,
Restore previous version

# 4 File Manager
Explorer panel, Folders, Files, Icons, Search, Create file, Delete, Rename,
Move, Drag and drop, Upload, Download, Recent files, Favorites, Pinned

# 5 Project Workspace
multiple projects, recent projects, workspace settings, project search,
dependency graph, terminal, logs, tasks, running jobs, background AI tasks

# 6 Multi-Agent Interface
Allow multiple AI agents simultaneously (Coding / Research / Planning / Debug /
Review / Data Agent). Each agent: status, progress, thinking, current task,
estimated completion, cancel, restart, parallel execution visualization

# 7 Right Side Inspector
Properties, AI Context, Referenced files, Variables, Memory, Conversation
context, Token usage, Cost estimation, Execution logs, Prompt preview

# 8 Bottom Panel
Terminal, Problems, Output, Console, Git, Testing, Debug, Network, AI Logs

# 9 Rich Input Box
attachments, drag upload, images, PDF, Word, Excel, CSV, Zip, GitHub repo,
URL, camera, voice, microphone, screen capture, paste image, multi-line prompt,
slash commands, prompt history, autocomplete

# 10 Visual Components
charts, tables, kanban, mind maps, mermaid, flowchart, timeline, Gantt,
network graph, JSON viewer, CSV preview, Excel preview, image preview,
PDF preview, video preview, audio player

# 11 Collaboration
Multiple users, Presence, Cursor positions, Comments, Mentions, Activity,
Version history, Share link, Permissions

# 12 Settings
Theme, Language, Keyboard shortcuts, Model selection, Temperature,
Reasoning effort, Memory, API Keys, Extensions, Notifications, Privacy, Billing

# 13 AI Features
tool calling, function calling, code execution, web search, RAG, memory,
image generation, vision, voice, OCR, planning mode, deep research,
reasoning mode, agent mode, workflow mode

# 14 Micro-interactions
Hover animations, Smooth transitions, Loading skeletons, Typing animation,
Streaming animation, Progress bars, Toast notifications, Context menus,
Command palette, Resizable panels, Dockable windows, Floating panels

# 15 Design System
8px spacing grid, consistent typography scale, design tokens, component library,
semantic colors, dark/light themes, responsive layout, accessible contrast,
keyboard accessibility, WCAG compliance

----------------------------------------

Deliverables

Produce:
1. Complete application architecture
2. Full component hierarchy
3. Layout system
4. Design system
5. Navigation structure
6. Responsive behavior
7. User interaction flows
8. States for every component
9. Empty states
10. Error states
11. Loading states
12. Animations
13. Frontend implementation plan
14. React component structure
15. Tailwind architecture
16. TypeScript interfaces
17. Folder structure
18. Production-ready UI specification

Do not simplify.

Assume this product will compete directly with ChatGPT, Claude, Cursor, and Codex.
```

---

## 结尾必加段落（很多人不写，但提升最大）

```text
Do NOT behave like a UI generator.

Behave like a senior designer at OpenAI shipping the next generation AI workspace.

Every screen should have clear information hierarchy, excellent UX, and production-level detail.

Never omit functionality because it is difficult.

When uncertain, choose the same interaction pattern used by ChatGPT, Claude, VS Code, Cursor, or Codex.

Every component should feel realistic enough that a frontend engineer could immediately implement it.
```

---

## 进阶能力补充（多数现有 Prompt 未覆盖）

- **Artifacts / Canvas 面板**：AI 可生成文档、代码、表格、幻灯片，并在独立工作区编辑。
- **多会话标签（Tabbed Conversations）**：像浏览器一样同时打开多个 AI 对话。
- **Model Router**：支持不同模型（GPT / Claude / Gemini / 本地模型）的切换与自动路由。
- **Prompt Library**：收藏、复用、版本管理 Prompt。
- **Memory 管理器**：查看、编辑、删除 AI 的长期记忆。
- **MCP / Tools 面板**：连接 GitHub、数据库、Slack、Notion、本地文件等工具。
- **Workflow Builder**：拖拽式 Agent 工作流（类似 n8n 或 LangGraph Studio）。
- **Token / Latency 监控**：实时显示 Token 消耗、响应时间、成本估算。
- **Diff Timeline**：不仅支持 Accept/Reject Edit，还支持按时间浏览每次 AI 修改。
- **插件系统（Extensions Marketplace）**：允许第三方扩展 AI 能力。

---

## 落地建议：拆成五个阶段分别生成

不要让模型一次性完成所有内容。按以下顺序分阶段生成，质量更高、更接近可直接开发：

1. **产品 PRD** — 明确功能、用户、场景、优先级
2. **UX 规范** — 信息架构、交互流程、各状态
3. **UI 设计** — 视觉、布局、组件外观
4. **React / Tailwind 实现** — 可运行代码
5. **Design System** — 设计令牌、组件库、主题
