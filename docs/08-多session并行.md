# 多 Session 真并行运行 — 独立追踪文档

> 从 [06-剩余清单.md](06-剩余清单.md) 拆出来的,因为这个功能(P26)的往返记录太长,把主
> 清单拖得又长又乱。这里是多 session 并行从最初调查到目前进度的完整记录。
> 其他还没拆分的项目(A/B)仍在 06-剩余清单.md 里,定时任务(D)在
> [07-定时任务-scheduled-tasks.md](07-定时任务-scheduled-tasks.md)。

---

### C. 多 session 真并行运行(原本标"暂缓",现在用户明确要开始做)
- 现象(见截图):现在一个 session 在跑的时候,切到另一个 session,看到的却是**前一个
  session 的 Stop 按钮**——说明"正在运行"这个状态大概率是全局的,不是按 session 区分的。
  也就是说底层很可能是"同一时间只能有一个 session 在真正生成",切换 session 只是切换
  显示哪段历史,而不是真的支持多个 session 同时独立运行。
- 用户想要的效果:
  1. 多个 session 可以**同时**在后台运行(不是排队,是真并行)
  2. 切到某个正在跑的 session,看到的是**那个 session 自己的**实时界面(它自己的
     Stop 按钮、它自己的流式输出),不会看到别的 session 的状态泄漏过来
  3. Sessions 列表里,**每一个**正在跑的 session 都各自显示一个橙色小圆点在闪(不是
     只有一个全局指示);跑完了,对应那个点自己消失,其他还在跑的不受影响
  4. 用户可以随时点进/点出任何一个正在跑的 session 查看进度,不影响其他 session 继续跑
- **这是这个清单里风险最高的一项**,本质是并发/线程架构改动,不是 CSS/UI 层面的事——
  真正做错了容易出现 session 之间状态串台、数据写坏、race condition 等很难事后排查的
  问题。所以这次**只发"调查 + 出方案",不直接发实现指令**,方案要经过确认才能动手写代码,
  参考 A2 的教训:并发这类东西"能跑起来"和"跑对"是两回事,必须先把底层机制搞清楚。

  指令(发给 AI,只做调查+出方案,不要实现):
  ```text
  STEP P26 — Investigate current concurrency architecture, then PROPOSE A PLAN (do NOT
  write implementation code yet — I need to review the plan first, this is the highest-
  risk item in the backlog).

  INVESTIGATE:
  1. Today, when a session is "running" (generating a response / running tools), is
     that state tracked globally (e.g. a single "current running session id" variable,
     a single generation thread/task, a single Stop button wired to "whatever is
     currently running") — or is it already scoped per-session, just not surfaced
     correctly in the UI? Report exactly where this lives in the code (bridge/backend),
     file/line.
  2. What actually does the work when a session "runs" — is it a Python thread, an
     async task, a subprocess, or something else? Is the underlying AI/tool-execution
     call itself thread-safe / safe to have multiple instances running concurrently
     (e.g. does it share any global mutable state, a single API client instance with
     shared rate-limit/session state, a single working-directory assumption, etc.)?
     Report anything that would NOT be safe to run twice at once as-is.
  3. How does the frontend currently know "this session is running, show its Stop
     button / streaming text here"? Is it driven by a single global event channel, or
     could it already carry a session id that the frontend isn't using yet?
  4. Report what changing this to true per-session concurrency would actually require:
     rough scope (small/medium/large), which files/layers are affected (bridge,
     backend task runner, frontend event routing), and any genuine blockers (e.g. a
     shared resource that can't safely be used by two sessions at once without
     redesign).

  PROPOSE A PLAN (no code yet):
  - How you'd make "running" state per-session instead of global (e.g. a dict/map of
    session_id → running task/thread + its own cancellation token, instead of one
    global slot).
  - How the frontend would route activity/streaming events to the RIGHT session's UI
    even when the user has switched away and back (events must carry a session id;
    the UI for a session not currently in view should still update its underlying
    state so switching back shows the correct in-progress content, not stale/empty).
  - How the Stop button becomes session-scoped (stopping session A must not affect
    session B).
  - How the sidebar's running-indicator dot (already spec'd in P3 for a single running
    session) extends to support MULTIPLE simultaneous dots, one per running session,
    each independently clearing when that specific session finishes.
  - Any concurrency limits you'd recommend (e.g. cap at N simultaneous sessions to
    avoid resource exhaustion) and why.
  - A rollout plan: what to build/verify first as a safe checkpoint (e.g. 2 sessions
    running at once, real end-to-end test) before considering it done, rather than
    attempting full arbitrary-N concurrency in one shot.

  Do not write or change any code in this step. Report the investigation findings and
  the plan, then wait for my explicit approval before implementing anything.
  ```

#### P26 第一轮方案 review(真机截图确认,方案被截断,尚未批准实现)
- AI 返回的 blockers 部分质量不错,两个发现特别值得重视:
  1. **`os.chdir()` 是进程全局状态** —— 多 session 各自切工作目录会互相踩踏,建议 v1
     先只允许同一 workspace 内并发,或把工具改成显式传 cwd,而不是依赖进程全局 cwd。
  2. **Desktop COM APIs(Outlook/Bloomberg)线程不安全** —— Windows COM 对象通常是
     单线程单元,不能随便跨线程访问;建议先用 per-tool lock 把这两个工具串行化。
- 核心数据结构方向也对:`session_runs: dict[session_id, SessionRun]`,取代原来全局
  唯一的 `MainWindow.worker`,每个 SessionRun 自己持有 worker/state/config/
  chat_entries/cancel_event/status。
- **但方案在这里被截断了**(截图底部有 `[stream error 500] LLM call failed`,是
  LLM 调用报错导致生成中断,不是方案本来就这么短),P26 要求的这几点还没看到:
  前端事件怎么路由到正确 session 的界面、Stop 按钮怎么按 session 隔离、P3 的运行中
  小圆点怎么扩展成支持多个同时独立闪烁/消失、建议的并发上限、分阶段落地计划。
- **尚未批准实现**,先让它把方案讲完。

  指令(发给 AI):
  ```text
  The plan got cut off right after defining SessionRun — please continue and complete it,
  covering the parts I originally asked for that are still missing:
  1. How frontend events get routed to the RIGHT session's UI, including when the user
     has switched away and back (the underlying session state must keep updating even
     when not currently in view).
  2. How the Stop button becomes session-scoped (stopping session A must not touch B).
  3. How the sidebar running-indicator dot (from P3) extends to show multiple independent
     dots, each clearing only when ITS session finishes.
  4. A recommended concurrency limit (max N simultaneous sessions) and why.
  5. A staged rollout: what's the smallest safe checkpoint to build and verify first
     (e.g. exactly 2 sessions running at once, real end-to-end test) before attempting
     more. Still no implementation code — plan only.
  ```

#### P26 第二轮方案 review(真机截图确认,方案已完整,评估结论:可以放行)
- 补完的部分质量很好,涵盖了第一轮缺的全部五点:
  1. **"What not to do initially"** —— 明确点名不能被多 worker 共用的全局状态
     (`self.worker`/`self.state`/`self._chat_entries`/`self._assistant_open`),流式
     输出不能按全局 `assistantId` 路由,`bridge.stop()` 不能继续是唯一停止机制,不能
     假设"当前选中 session"就是"正在跑的 session"。
  2. **"Recommended minimal safe implementation target"** —— 具体、可测试的 checkpoint:
     恰好两个 session 同时跑,各自独立 worker/state/config/cancel token,事件带
     session_path,前端保存离屏 session 更新,侧边栏两个独立圆点,停 A 不影响 B,
     A/B 最终内容都正确保存。明确说"这个测试端到端通过之前,不算 P26 完成"。
  3. **"Risk rating: Large / high-risk"** —— 判断准确:核心风险不是 QThread 本身
     (本来就能跑多个 worker),而是整个 app 架构默认只有一份 active conversation
     runtime(one state/worker/assistant id/stream buffer/visible chat target/
     stop button/current session path)。明确定性为"staged refactor,不是 quick
     patch"。
- **结论:方案质量足够,可以放行,但放行时要带两个限制条件**,不要让它一次做完:
  1. 只批准这次给的"最小 checkpoint"(2 个 session),不批准超出这个范围的东西。
  2. 明确提醒它确认第一轮提到的 `os.chdir()` 限制(v1 只允许同一 workspace 内并发)
     有没有被带进最终方案的 config 处理里 —— 以及 Outlook/Bloomberg per-tool lock、
     并发权限弹窗的 session 识别,这两项**不算在**这次的 2-session 验收标准里,得
     单独验证,不能因为 2-session 测试过了就默认这两项也没问题。

  批准指令(发给 AI):
  ```text
  Approved for STEP P26's minimal checkpoint ONLY — implement exactly what's in
  "Recommended minimal safe implementation target" (two sessions running
  concurrently, independent worker/state/config/cancel token, events carrying
  session_path, frontend storing offscreen session updates, two independent
  sidebar dots, Stop scoped per-session, both sessions' final content saving
  correctly). Confirm the v1 workspace constraint from your earlier os.chdir()
  finding is included in how config/cwd is handled per session.

  Do NOT go beyond 2-session concurrency yet. Work incrementally, git commit a
  checkpoint first. Once this passes your own "I would not consider P26 complete
  until that exact test passes end-to-end" bar — verify it live, for real, not
  just statically — report back before we discuss extending further or tackling
  the Outlook/Bloomberg per-tool locking and concurrent-permission-dialog cases
  separately.
  ```

#### P26 实现进度(真机截图确认,agent 仍在运行中)
- 已做安全 checkpoint commit:`8304ebb checkpoint before session concurrency`。
- **没有直接在主工作区改这个高风险功能,而是启动了一个隔离 worktree 的 coder agent**
  单独实现"P26 minimal checkpoint only"——这个是它自己额外加的谨慎做法(不是我们要求
  的),好处是改动出问题不会污染主线,方便干净地 review diff 后再决定要不要合并。
- 复述的 checklist 完全对齐已批准范围,没有 scope creep:max 2 concurrent sessions、
  独立 worker/state/config/cancel token、events 带 session_path、frontend offscreen
  session state 更新、多个 sidebar running dots、Stop scoped to current session、两个
  session 最终内容正确保存、**且确认包含 v1 workspace constraint(不同 cwd 不允许
  并发)**——这正是批准消息里特别要求它确认的一点,已确认。
- 当前状态:worktree 里的 coder agent 仍在运行中,尚未 review、尚未合并回主工作区。

  **合并前必须做的验证(不要只看它说"通过了"就信):**
  ```text
  Before merging the isolated worktree back into the main workspace:
  1. Show me the full diff first — do not merge until I've reviewed it.
  2. Walk through all 7 checkpoint criteria live in the real running app (not static
     checks): run two sessions concurrently for real, click Stop on one and confirm
     the other keeps running, switch away from a running session and back and confirm
     its progress/state is still correct, confirm both sessions' final content saved
     correctly, confirm the sidebar shows two independent dots that clear
     independently.
  3. Confirm the v1 workspace/cwd constraint actually blocks concurrent sessions with
     different working directories (don't just take the code's word for it — try it).
  4. Remind me this checkpoint does NOT cover Outlook/Bloomberg per-tool locking or
     concurrent-permission-dialog session identity — those still need separate
     verification before the concurrency feature is considered fully safe.
  ```

#### 🔴 P26 真机测试发现严重 bug(真机截图确认,命中了当初预警的 blocker #3)
- 现象:在 session A 发一条消息,再切到 session B 发另一条,再切回 A —— 两个 session 的
  消息被合并显示在同一个 session 里,顺序也错了(回复出现在用户发的消息**上面**),回复
  内容本身还被拼接坏了(一个"写 hello world 文件"的回复里混进了完全无关的市场分析内容,
  外加一段 "No final text was returned by the model" 的错误兜底文案)。
- 这正是最初 P26 调查阶段列的 **blocker #3**:"Shared chat_entries and stream handling
  —— must become per session or events will write to wrong chat"。现在真的命中了,说明
  要么这部分没做完,要么做了但没做对。
- **在查清楚并修复之前,不要继续在这个基础上加新功能。**

  指令(发给 AI):
  ```text
  Critical bug found while testing: when sending a message in session A, then a different
  message in session B, then switching back to A — the two conversations' messages and
  responses are getting merged into ONE session's transcript, in the WRONG order (the
  reply appears above the user's sent message), and the response content itself looks
  corrupted/concatenated (e.g. a "hello world" file-write response got mixed with an
  unrelated market-view response, plus a stray "No final text was returned by the model"
  error fallback string appended into it).

  This is exactly blocker #3 from your original P26 investigation: "Shared chat_entries
  and stream handling — must become per session or events will write to wrong chat."

  Before writing any fix, answer honestly:
  1. Did the per-session SessionRun isolation from the approved plan actually get fully
     implemented and merged, or is what I'm testing right now still partially on the old
     shared-state architecture? Check git log/diff against the "8304ebb checkpoint before
     session concurrency" commit to confirm exactly what's currently in the main workspace.
  2. If it WAS implemented: trace exactly where chat_entries/streaming events get appended
     for the wrong session — is there still a shared/global buffer somewhere that both
     sessions' event handlers are writing into? Is the frontend routing events by
     session_path correctly, or is it using some other stale/shared identifier?
  3. If it was NOT fully implemented (or only partially): stop, and tell me clearly what
     IS and ISN'T actually done yet, rather than me discovering it through broken behavior.

  Given this violates the core safety requirement of the approved plan, do not build
  anything further on top of this until it's root-caused and fixed. Consider whether it's
  safer to reset to the "8304ebb checkpoint before session concurrency" commit and redo
  the per-session isolation more carefully, versus patching forward from the current
  broken state — tell me which you recommend and why.
  ```

#### 诊断结果(真机截图确认)+ 批准重做
- **根因确认**:backend 现在还是在用**全局可变的 chat/session 字段、来回互相替换
  (swap)来模拟隔离**,不是每个 session 真正拥有自己独立的状态。这正是 blocker #3
  一直警告的那种做法,截图里的错位/拼接就是这么来的。
- **它给的 Done / Not fully done 清单**很诚实:已加了多 worker 追踪、2-session 上限、
  按 session 停止、多个运行圆点、部分事件过滤;但"真正按 session 隔离的 backend 状态、
  AgentState、chat_entries、streaming buffer、tool stack、安全切换、前端按 session 分开
  的 runtime map、权限路由、文件/cwd 隔离"全部**没做完/是坏的**。
- **重做方案是对的架构方向**:用 `SessionRuntime` 对象(每个 session 自己持有 state/
  chat_entries/assistant_buffer/active_tool_*/worker/config_snapshot),通过
  `self.sessions[session_id]` 查找,不再临时顶替一个共享字段;前端也要从"一个全局
  mainAgentState"改成"按 session 分开的 runtime map"。
- **结论:同意回退到 `8304ebb checkpoint before session concurrency`,用真正的
  per-session 对象重做**。这是第三次尝试了(前两次:worktree 隔离被 Bloomberg reminder
  打断两次;直接改主工作区又做出了这个架构错误的版本),批准时加了严格条件。

  批准指令(发给 AI):
  ```text
  Approved: revert the tracked P26 changes in desktop.py and frontend/index.html back to
  the 8304ebb checkpoint, then reimplement using real per-session SessionRuntime objects
  as you described (backend: self.sessions[session_id].chat_entries etc., not swapping a
  shared field; frontend: session-keyed runtime map instead of one mainAgentState).

  Conditions this time, since two previous attempts have failed:
  1. Work in small, separately-committed pieces — e.g. commit once the SessionRuntime
     class + backend dict exist (before any frontend change), commit again once the
     backend fully routes chat_entries/streaming through per-session lookups, commit
     again once the frontend's session-keyed runtime map is in place. Do not do this as
     one large uncommitted pass.
  2. After EACH of those commits, re-run the EXACT test that caught the original bug:
     send a message in session A, switch to session B and send a different message,
     switch back to A, and confirm A's transcript is still correct and uncorrupted — not
     just "no errors in the console," the actual visible content must be right.
  3. Do not mark this done until that test passes cleanly at least twice in a row (once
     right after implementing, once again after a fresh app restart).
  4. If you hit the same "Bloomberg reminder" interruption issue from the earlier
     sub-agent attempts, stop and tell me immediately rather than working around it
     silently.
  ```

#### 第三次尝试进度(真机截图确认)+ 诚实卡点,值得表扬
- 已完成:`b659071` 回退到 checkpoint,`09daaa3` 只加了 `SessionRuntime` dataclass 和
  后端骨架(`self.sessions`/`self.current_session`/`self.running_sessions`/
  `maxconcurrent_sessions`),**还没接通 chat/streaming 逻辑,前端也完全没动**。
- **这次的行为明显更好**:它没有像前两次那样硬着头皮往下做或者谎报"测试通过",而是
  诚实说明"我在这个工具环境里没法真的操作桌面 app 的 GUI,点不了按钮、看不了真实界面、
  重启不了 app",主动停下来问用户接下来怎么办,并给了两个选项(用户自己测 / 放宽验证
  节奏)。也确认了这次没有再遇到 Bloomberg reminder 打断的问题。
- **采纳的方案**:不是无限放宽验证要求,而是调整验证节奏——纯后端骨架(没有行为变化)
  不需要真机测;后端接通 SessionRuntime 之后,先让它自己写一个 Python 级别的测试脚本
  程序化验证 `self.sessions[A]`/`self.sessions[B]` 不会互相污染(这个它自己能验证,
  不需要 GUI);前端也接通之后,必须停下来,由用户亲自在真机上做那个"A发消息、切B发
  消息、切回A"的关键验证,不能它自己说"应该好了"就算数。

  指令(发给 AI):
  ```text
  Approved: relax the "test after every commit" requirement to this cadence instead —

  1. Backend scaffolding (this commit) — no live GUI test needed yet, nothing observable
     changed. Proceed to wiring chat_entries/streaming through SessionRuntime.

  2. Once backend routing through SessionRuntime is complete (before touching frontend):
     write and run a Python-level test that simulates two sessions concurrently (or
     sequentially) sending messages, and programmatically asserts self.sessions[A] and
     self.sessions[B] never cross-contaminate — you CAN verify this yourself without a
     GUI. Show me that test and its output before proceeding to frontend changes.

  3. Once frontend is also wired to route per-session (session-keyed runtime map instead
     of one mainAgentState): STOP. This is the point where only I can do the real
     verification, since it requires actually clicking through the live desktop app. Tell
     me exactly what to test (step by step) and I will run it myself and report back
     the result — do not mark P26 done until I confirm.

  Confirmed: no Bloomberg-reminder issue this time, understood you don't need Bloomberg
  tools for this work. Proceed with step 2 now.
  ```

### 中间被定时任务功能打断,现在重新捡起来:交叉关联一个新发现

- 在 [07-定时任务-scheduled-tasks.md](07-定时任务-scheduled-tasks.md) 测试定时任务
  期间发现:**定时任务运行时,系统消息明确显示整个 app 锁死,任何其他 session 都发不了
  消息**("A scheduled task is running in the background. Please wait for it to finish
  before starting another prompt.")。这本质上是同一个"还没做到真正按 session 隔离"的
  地基问题,值得这次一起解决。
- 用户明确了目标行为(其实就是最早批准的 checkpoint 标准,重新说一遍以便对齐):
  运行中的 session 在侧边栏显示橙色小圆点,跑完圆点消失;可以有多个 session 同时显示
  圆点、同时在跑;从 session A 切到 session B **不会**让 A 暂停,切回 A 时它还在正常跑
  (或者已经跑完了),是真正的并行,不是"切走就冻结、切回来才继续"。

  指令(发给 AI):
  ```text
  Picking this back up after a long detour into Scheduled Tasks debugging — re-stating
  the target behavior clearly since it's been a while:

  1. A running session shows a small orange dot in the sidebar (per P3's spec). The dot
     disappears when that session finishes.
  2. Multiple sessions can show the dot and be actively running AT THE SAME TIME.
  3. Switching from session A (running) to session B does NOT pause or stop A — A keeps
     running in the background while you view B.
  4. Switching back to A shows its current state correctly — either still running with
     live updates, or already finished with the complete result, never frozen/stale.

  New related finding to fold in: while testing Scheduled Tasks, we found that a running
  scheduled task currently blocks the ENTIRE app from accepting prompts in ANY other
  session ("A scheduled task is running in the background. Please wait..."). This is the
  same underlying single-worker-at-a-time architecture problem — a scheduled task run is
  itself just another "session running," so fixing true per-session concurrency should
  fix this too.

  Please report current status first: given everything committed so far (SessionRuntime
  refactor, the chat_entries[-1] fix, the duplicate-activity-card fix from Scheduled
  Tasks work), where does true 2-session concurrency actually stand right now? Re-run
  the "what IS and ISN'T actually done" style honest audit against the CURRENT code
  before proposing next steps — don't assume the old audit from earlier still applies,
  a lot has changed since then (including fixes that originated from the Scheduled Tasks
  side that may have incidentally helped or need to be reconciled with this).
  ```

