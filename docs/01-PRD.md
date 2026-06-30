# 产品需求文档（PRD）— Forge AI IDE

> 阶段 1 / 6：PRD → UX 规范 → UI 设计 → 前端架构 → Design System → 交互规范
> 目标：定义一个 Claude / ChatGPT / Codex 级别的 AI IDE 的产品范围、用户、功能与优先级。

---

## 1. 产品愿景（Vision）

打造下一代 **AI 工作台（AI Workspace）**：用户通过自然语言对话，驱动 AI 阅读、生成、修改、提交代码，并对每一处改动拥有完全的可视化控制权。融合 ChatGPT 的对话、Claude 的 Artifacts、Cursor 的内联编辑、VS Code 的编辑器、GitHub PR 的 diff 审批于一体。

**一句话定位**：让人和 AI 像结对编程一样高效协作的桌面级 Web 软件。

## 2. 目标用户（Personas）

| 角色 | 核心诉求 | 关键场景 |
|------|----------|----------|
| **开发者 Dev** | 用 AI 快速写/改代码，但要能逐行审查、可控提交 | 修 bug、写功能、重构、生成测试 |
| **技术产品/设计** | 用 Artifacts 快速生成可交互原型 | 出 demo、做数据可视化、写文档 |
| **数据/研究** | 跑代码、查资料、整理产出 | 数据分析、深度研究、报告 |

首发主力用户：**开发者 Dev**。

## 3. 问题陈述（Problem）

- 现有 AI 聊天工具改代码"黑箱"，用户看不清改了什么、不敢直接用。
- 代码编辑器（VS Code）与 AI 对话割裂，上下文来回复制。
- 缺乏对 AI 改动的**逐处审批 + 版本回溯**能力。

## 4. 解决方案核心（Solution Pillars）

1. **对话即操作**：对话区驱动一切，工具调用透明可见。
2. **改动全可视**：git 风格 diff，绿增红删，hunk 级 Accept/Reject。
3. **可控提交**：用户决定哪些改动落盘、何时 commit。
4. **上下文统一**：文件、选区、项目、记忆在同一工作区内共享。

## 5. 功能范围（Scope）

### 5.1 MVP（第一版必须有）— P0

| 模块 | 功能 |
|------|------|
| 对话区 | 流式输出、Markdown/代码高亮、停止生成、工具调用卡片、对话历史 |
| 代码编辑器 | 语法高亮、行号、多标签、查看文件 |
| **Diff 审批** | 绿增红删、并排/行内切换、hunk 级 Accept/Reject、Accept All、文件级 +N/-M |
| 文件管理 | 文件树、改动标记、新建/删除/重命名、查看 |
| 提交 | 选文件 + commit message + 确认提交 |
| 状态/权限 | 当前模型/分支/运行态、手动审批 / 自动接受 / 计划模式、不可逆动作二次确认 |
| 输入框 | 多行、文件上传、slash 命令、模型选择器 |

### 5.2 V1.x（重要增强）— P1

- Artifacts / Canvas 面板（React/HTML/Markdown/Mermaid 实时预览编辑）
- 内联 AI 编辑（Cursor 风格：解释/重构/优化/生成测试）
- 多会话标签、分支对话、编辑历史消息、重新生成
- 右侧 Inspector：引用文件、Token 用量、成本估算、prompt 预览
- 内嵌终端、Problems/Output/Git 底部面板
- Diff Timeline（按时间浏览每次 AI 修改）

### 5.3 V2+（平台化）— P2

- 多 Agent 并行（Coding/Research/Planning/Debug/Review）
- MCP / Tools 面板（GitHub、数据库、Slack、Notion）
- Workflow Builder（拖拽式 Agent 工作流）
- Memory 管理器、Prompt Library、Model Router
- 协作（多人在线、评论、共享链接、权限）
- 插件市场（Extensions Marketplace）

### 5.4 暂不做（Out of Scope，首发）

- 实时多人协同编辑（OT/CRDT）
- 移动端原生 App
- 自建模型训练/微调

## 6. 用户核心流程（Key User Flow）

```
用户提问
  → AI 流式回复 + 调用工具（读文件/搜索）
  → AI 提出代码改动 → 渲染 git 风格 diff
  → 用户逐处 Accept / Reject（或开启自动接受）
  → 改动落到工作区，文件树标记
  → 用户选择文件 + 填写 message → Commit
  → 状态栏更新（分支/运行态）
```

## 7. 成功指标（Success Metrics）

| 指标 | 目标 |
|------|------|
| 改动接受率（Accept rate） | > 60% AI 改动被采纳 |
| 审查效率 | 单处 diff 决策中位耗时 < 5s |
| 留存 | 周活留存 > 40% |
| 任务完成率 | 一次会话内完成预期编码任务 > 50% |
| 信任度 | 用户主动开启"自动接受"比例（侧面反映信任）|

## 8. 关键约束与非功能需求（NFR）

- **性能**：流式首字 < 1s；大文件 diff（>2k 行）虚拟滚动不卡顿。
- **可控/可逆**：所有 AI 改动可撤销、可回溯版本。
- **安全**：删除/提交/运行命令前二次确认；API Key 安全存储。
- **可访问性**：键盘优先、命令面板、WCAG 对比度。
- **主题**：深色优先，支持浅色。

## 9. 技术方向（建议，待定）

> 这些是 PRD 阶段的倾向性建议，最终在「前端架构」阶段（阶段 4）确定。

- 前端：React + TypeScript + Next.js
- 样式：TailwindCSS + shadcn/ui
- 编辑器：Monaco / CodeMirror 6
- Diff：自研虚拟化渲染或 react-diff-viewer
- 高亮：Shiki
- 动效：Framer Motion
- 状态：Zustand
- 通信：SSE/WebSocket 流式 + REST 工具调用

## 10. 里程碑（Milestones）

| 阶段 | 内容 | 产出 |
|------|------|------|
| M1 | MVP（P0） | 可对话、可改代码、可审批、可提交 |
| M2 | Artifacts + 内联编辑 + 多标签（P1 部分） | 接近 Claude/Cursor 体验 |
| M3 | Inspector + 终端 + Diff Timeline（P1 余） | 完整单用户工作台 |
| M4 | 多 Agent + MCP + 协作（P2） | 平台化 |

## 11. 风险（Risks）

| 风险 | 缓解 |
|------|------|
| 一次性做太全 → 都不精 | 严格按 P0→P1→P2 推进，MVP 先打透 diff 审批 |
| 大文件 diff 性能 | 虚拟滚动 + 按 hunk 懒加载 |
| 用户不信任 AI 改动 | 默认手动审批 + 强可视化 + 一键回滚建立信任 |
| 多模型/MCP 复杂度 | 后置到 V2，MVP 单模型跑通 |

---

**下一阶段（阶段 2）**：基于本 PRD 产出 **UX 规范** —— 信息架构、详细用户流程、各界面状态与交互逻辑。
