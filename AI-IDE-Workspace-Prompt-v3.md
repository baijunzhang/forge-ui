# AI IDE 设计 Prompt（v3 · 逆向拆解 + 融合设计）

> 关键升级：不直接画界面，而是先让 AI **逆向拆解** ChatGPT / Claude / Codex / Cursor 等产品的交互模式，再融合成统一设计系统。这一步显著提升输出质量。

---

## 开头必加段落（先研究，再设计）

```text
Before generating any design, first reverse engineer the interaction patterns, UX decisions, and product architecture of:

• ChatGPT
• Claude
• OpenAI Codex
• Cursor
• Windsurf
• VSCode
• GitHub Pull Requests
• Figma
• Linear
• Notion

Identify the best interaction patterns from each product, explain why they work, and synthesize them into one unified design system rather than copying any single interface.
```

---

## 核心 Prompt

```text
You are one of the world's best AI Product Designers, Senior UX Designers, and Frontend Architects.

Your task is to design an AI IDE that is comparable to ChatGPT, Claude, and OpenAI Codex.

The goal is NOT simply to make a beautiful UI.

The goal is to design the complete interaction system that allows users to work with AI efficiently.

Assume this product will become the next-generation AI workspace.

Think like the design teams at OpenAI, Anthropic, Cursor, Windsurf, and Linear.

----------------------------------------------------
Product Goal
----------------------------------------------------

Design a modern AI application that combines:

• ChatGPT
• Claude
• OpenAI Codex
• Cursor
• VSCode
• Figma
• Notion
• GitHub Pull Request UI

into one coherent experience.

The UI should feel extremely polished, premium, minimal, and productivity-focused.
No unnecessary decoration. Everything should prioritize usability.

----------------------------------------------------
Design Language
----------------------------------------------------

Style: Minimal, Apple HIG inspired, Linear, Notion, Vercel, Claude, ChatGPT, GitHub, Figma

Use: soft shadows, rounded corners, subtle animations, glassmorphism only when appropriate,
generous spacing, responsive layout, excellent typography, dark mode first, light mode supported

----------------------------------------------------
Overall Layout
----------------------------------------------------

Left Sidebar: conversations, folders, search, memory, projects, files, prompts, settings

Main Chat Area: streaming response, markdown, code blocks, tables, images, charts,
artifacts, thinking process, citations

Right Context Panel (context-aware): uploaded files, workspace, variables, model settings,
memory, references, git status, plugins, MCP tools

Bottom Input: multiline, drag & drop, upload, microphone, screenshots, slash commands,
model selector, tool selector, context selector

----------------------------------------------------
Core Features
----------------------------------------------------

1. Code Editor
syntax highlighting, minimap, autocomplete, diagnostics, inline errors, linting,
folding, multiple tabs, split editor, search, replace, breadcrumbs

2. Diff Viewer (exactly like GitHub Pull Request)
green additions, red deletions, side-by-side mode, inline mode, accept edit,
reject edit, accept all, undo, redo, preview changes

3. Artifact Panel (exactly like Claude Artifacts)
React, HTML, Markdown, SVG, Mermaid, Python, JSON — preview live, edit live,
download, duplicate, fullscreen, open in new tab

4. File System (like VSCode)
folders, drag files, rename, delete, new file, new folder, search, filter,
multiple upload, images, pdf, excel, csv, word, ppt, zip

5. Code Generation
streaming code generation, typing animation, line-by-line generation,
live syntax highlighting, token streaming, cancel generation, resume generation

6. Chat
branch conversation, edit previous message, retry, compare answers, multiple models,
pin message, bookmark, copy, share, regenerate

7. Context Management
multiple files, workspace, folder context, selected code, selected text, clipboard,
URL, documentation, Git repository

8. AI Editing (exactly like Cursor)
apply edit, reject edit, show diff, inline suggestion, quick fix, auto fix,
explain change, refactor, optimize, translate, comment code, generate tests, generate docs

9. Terminal
embedded terminal, multiple tabs, logs, run commands, cancel, history, copy, clear

10. Preview
live preview, React, Next.js, HTML, Markdown, Python, data visualization,
responsive mode, mobile/desktop switch

----------------------------------------------------
AI Features
----------------------------------------------------

Memory, long-term memory, temporary memory, prompt library, agents, sub-agents, MCP,
tool calling, reasoning mode, fast mode, research mode, vision, voice, image generation,
web search, browser, code execution, Python execution, SQL, API testing

----------------------------------------------------
Interaction Design
----------------------------------------------------

Hover states, focus states, loading states, streaming animation, typing animation,
tool execution animation, accept edit animation, file upload animation, diff animation,
page transition, modal transition, toast, notification, empty state, skeleton loading,
error state, offline state

----------------------------------------------------
Accessibility
----------------------------------------------------

Keyboard shortcuts, command palette, screen reader, tab navigation, ARIA,
color contrast, resizable panels

----------------------------------------------------
Output Requirements
----------------------------------------------------

Produce:
1. Product Architecture
2. Information Architecture
3. User Flow
4. UX Decisions
5. UI Layout
6. Component Hierarchy
7. Design Tokens
8. Color Palette
9. Typography
10. Spacing System
11. Component Library
12. Interaction Specifications
13. Responsive Design
14. Desktop Version
15. Tablet Version
16. Mobile Version
17. Every screen required
18. Edge cases
19. Error handling
20. Micro-interactions
21. Complete frontend component tree
22. Suggested React component structure
23. Suggested Next.js folder architecture
24. Tailwind design system
25. Shadcn component mapping
26. Animation specifications (Framer Motion)
27. State management architecture
28. API interaction flow
29. WebSocket streaming architecture
30. AI response rendering pipeline

Do NOT simplify.

Think at the level of a Lead Product Designer at OpenAI.

Every interaction should be production-ready.

Output should be detailed enough that a frontend engineer can immediately implement the product.
```

---

## 终极建议：拆成 6 个专业 Prompt 形成产品设计工作流

真正做 Claude / Codex / Cursor 级产品时，单个超长 prompt 不如把流程拆开，按大型科技公司实际设计流程分角色生成，输出更稳定、更可落地：

1. **产品经理（PM）** — PRD、功能优先级、用户故事
2. **UX 设计师** — 信息架构、用户流程、交互逻辑
3. **UI 设计师** — 视觉、布局、各屏幕
4. **前端架构师** — 组件树、状态管理、技术选型
5. **Design System** — 设计令牌、组件库、主题
6. **交互规范** — 动效、状态、微交互、可访问性
