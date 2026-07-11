# 定时任务(Scheduled Tasks)功能 — 独立追踪文档

> 从 [06-剩余清单.md](06-剩余清单.md) 拆出来的,因为这个功能的往返记录太长,把主清单
> 拖得又长又乱。这里是 Scheduled Tasks 这一个功能从设计到调试的完整记录(P35 起)。
> 其他还没拆分的项目(A/B/C)仍在 06-剩余清单.md 里。

---

### D. 新功能:定时任务(Scheduled),参考 Codex 的 "Scheduled" / Claude 的 "Routines"
- 核心概念:把一个 prompt 保存下来,配一个执行周期(一次性某个时间 / 每天 / 每周几 /
  自定义 cron),到点自动在指定的文件夹/workspace 里跑一遍,生成一个正常的会话记录,
  用户随时能回去看结果;可以暂停/启用/删除某个定时任务,能看每次运行的历史记录。
- 场景例子(结合金融场景更贴切):"每天开盘前总结隔夜市场变动"、"每周一检查 counterparty
  limit 使用情况并标出接近上限的"、"每天收盘后生成 PnL 摘要"。
- **这是个真正的新子系统,不只是 UI**:需要后台定时触发机制、任务定义的持久化存储、
  无人值守时自动创建/跑一个会话、跑完的通知/状态展示。跟 P26 一样是高风险项,**这次
  只发调查 + 出方案,不直接发实现指令**,方案要经过确认才能动手写代码。

  指令(发给 AI,只做调查+出方案,不要实现):
  ```text
  STEP P35 — Investigate current architecture before proposing a plan for a new
  "Scheduled Tasks" feature (like Codex's "Scheduled" / Claude's "Routines"): a saved
  prompt + a recurrence schedule that auto-runs unattended and produces a normal
  session the user can review later. Do NOT write implementation code yet.

  INVESTIGATE:
  1. Is there any existing timer/scheduling infrastructure in this app already (even
     for something unrelated), or would this be built from scratch?
  2. How is a new session currently created and a prompt submitted to it — is there an
     internal function/API path that could be called programmatically (i.e. without a
     user clicking "New session" and typing), so a scheduled trigger could reuse it
     rather than needing to simulate UI interaction?
  3. Does this desktop app run/stay alive in the background when not focused or
     minimized, or does it need to be open and in the foreground to do anything? This
     determines whether "runs while you're not using the app" is even possible, or
     whether scheduled tasks can only fire while the app happens to be open.
  4. If the app must be open for a scheduled task to fire: is there a way to have it
     start automatically at OS login/startup (so scheduled tasks still work if the user
     isn't actively using it), or should scope be limited to "fires only if the app
     happens to be running" for v1?
  5. How would this interact with P26 (multi-session concurrency)? A scheduled task
     firing while the user is actively using another session IS a form of the same
     concurrency problem — report whether it should depend on P26 being fully done
     first, or whether it can be scoped to only fire when no other session is actively
     running (simpler, avoids the dependency).
  6. Where would scheduled task definitions (prompt, schedule, target folder, enabled/
     paused, run history) be persisted — same local JSON pattern as sessions, or
     something new?

  PROPOSE A PLAN (no code yet):
  - Data model for a scheduled task (name, prompt, recurrence — one-off/daily/weekly/
    custom cron —, target folder, permission mode, enabled/paused, next-run time, run
    history with links to the sessions each run produced).
  - How the trigger mechanism would work given your findings on background execution
    (e.g. a timer loop checked periodically while the app is running; report honestly
    if "runs even when the app is fully closed" is NOT achievable without OS-level
    scheduling like Task Scheduler/cron, and if so recommend that as the real
    mechanism instead of faking it).
  - UI shape: a "Scheduled" section (reuse the existing sidebar nav pattern — see
    Routines-style entry in the design reference) listing tasks with name, next run,
    last run status (success/fail/pending), enabled/paused toggle. A creation flow
    (name, prompt, recurrence picker, folder, permission mode). A run-history view per
    task linking to each generated session.
  - Failure handling: what happens if a scheduled run errors out (API failure, the
    Bloomberg-reminder-style interruption seen before, etc.) — should it retry, just
    log the failure, or notify the user?
  - A staged rollout: smallest safe v1 (e.g. one-off and daily/weekly only, no complex
    cron; fires only while the app is open and no other session is actively running)
    before considering more advanced scheduling or true background execution.

  Do not write or change any code in this step. Report findings and the plan, then wait
  for my explicit approval before implementing anything.
  ```

#### 实测:功能已经做出来了(真机截图确认),验证清单
- 现状:Scheduled 页面已经存在,子标题诚实写了"Run saved prompts while the desktop app
  is open and idle"(符合调查阶段的诚实范围,不是假装能在 app 完全关闭时也触发)。创建
  表单有 Name / Prompt / Recurrence(Daily/Weekly 等)/ Date-time / Time / Weekly days /
  Target folder / Permissions / Mode / Enabled。
- **验证不要等真实的"每天9点"触发**,用下面几步快速测,尤其第 3 条是必测项(跟 P26 并发
  bug 是同一类风险,定时任务到点自动跑本质上就是"又开了一个 session 在运行")。

  验证清单(发给 AI,或自己动手测):
  ```text
  Verification checklist for the Scheduled Tasks feature just implemented:

  1. Is there a "Run now" manual trigger for a saved scheduled task, so it can be
     tested immediately without waiting for the scheduled time? If not, add one — useful
     both for testing and for real users who want to fire a saved prompt on demand.
  2. If no "Run now" exists: create a test task with a ONE-OFF date/time set to ~1-2
     minutes in the future (not Daily), save it, and confirm it actually fires
     automatically at that time — auto-creates/runs a session with the saved prompt
     without any user interaction.
  3. CRITICAL — test this exact scenario: schedule a task to fire in ~1-2 minutes, then
     manually open a DIFFERENT session and actively chat in it while waiting. When the
     scheduled task fires, confirm its content does NOT bleed into/corrupt the manually
     active session (the same cross-session contamination bug found in P26 testing). If
     it does bleed, STOP — this confirms the feature depends on P26 being fixed first
     and should not be considered usable yet.
  4. Restart the app and confirm the scheduled task and its next-run time are still
     there (persistence check).
  5. Uncheck "Enabled" on a task and confirm it truly does not fire at its scheduled time.
  6. Create a task pointed at a deliberately invalid Target folder and confirm the
     failure is shown clearly (a visible "failed" status), not silently doing nothing.

  Report the result of each item, especially #3.
  ```

#### 实测发现的表单问题(真机截图确认)
- **Target folder 选不了**:显示的是固定的默认路径(当前项目目录),看不出是个能点的输入框
  还是纯展示文字,也不确定保存后是不是真的会用这个路径,还是压根没接上。
- **Permissions 里的 "auto" / "accept-all" 不知道什么意思**:两个选项没有任何说明,
  用户分不清区别,而且这个还跟能不能跑起来直接相关——定时任务是**无人值守**运行的,
  如果选到"需要手动批准"那种权限模式,到点触发后会卡住等一个永远不会来的人工批准。
- **最右边的 "Enabled" 复选框不知道是干嘛的**:没有文字说明或 tooltip,不确定勾选/
  不勾选分别代表什么。

  指令(发给 AI):
  ```text
  STEP P36 — Fix clarity and functionality gaps found in the Scheduled Task creation
  form after real testing.

  INVESTIGATE first:
  1. Target folder: is this field currently interactive at all (clickable/editable), or
     just static display text showing the default project path? Confirm whether the
     value actually gets used when the task runs, or if it's not wired up yet.
  2. Permissions dropdown: what do "auto" and "accept-all" actually map to internally —
     are they the same two concepts as the main composer's Mode dropdown (Ask
     permissions / Accept edits / Plan mode / Auto mode / Bypass permissions), just
     under different/incomplete labels here, or a separate, smaller set specific to
     scheduled tasks?
  3. Enabled checkbox: confirm what it currently does when toggled off — does a
     disabled task simply not fire at its next scheduled time (and can be re-enabled
     later without losing its config), or something else?
  Report findings, then fix:

  FIX:
  1. Make Target folder a real, obviously-interactive control: a text field showing the
     current path PLUS a "Browse" button that opens the native folder picker, reusing
     the exact same folder-picker component/behavior already used elsewhere in the app
     (e.g. the main composer's folder selector) rather than building a new one. Make it
     visually clear it's clickable (cursor, hover state, border) — not flat static text.
  2. Permissions: relabel/align these options with the SAME taxonomy already used in
     the main composer's permission/mode dropdown, so the same word means the same
     thing everywhere in the app. Add a short one-line description under the dropdown
     (12px muted text) explaining what the selected option means for an unattended run
     — e.g. "accept-all: runs without asking for approval — required for unattended
     scheduled runs." If a permission mode requires manual approval (like "Ask
     permissions"), either exclude it from this dropdown entirely (since it can't work
     unattended) or show a clear inline warning if selected: "This mode requires manual
     approval and may hang when run on a schedule."
  3. Enabled: add a short label/tooltip next to the checkbox — e.g. "Enabled: this task
     will run automatically at its scheduled time. Turn off to pause without deleting
     it." Make sure the checkbox has a proper text label next to it (not just floating
     alone at the edge of the row).

  Verify live: confirm Target folder can actually be changed via Browse and the new
  value is what actually gets used on run; confirm the Permissions description updates
  per selection and warns appropriately for manual-approval modes; confirm Enabled's
  label makes its purpose clear at a glance, in both light and dark themes.
  ```

#### 验证清单实测结果(真机截图确认)+ 后续待修问题
- **1. Run Now**:已实现,每个任务卡片都有 Run Now 按钮,`runScheduledTaskNow(task_id)`。
- **2. 一次性未来触发**:能跑,scheduler 每 60 秒轮询一次,所以设定 1-2 分钟后触发的
  任务可能延迟最多约 60 秒才真正跑,可接受。
- **3. 关键的跨 session 污染场景**:结果比预期更好——**它没有去解决真并发,而是选了
  更安全的做法:如果主 session 正在跑(`self.worker is not None`),定时任务直接不
  触发、等空闲了再跑**,绕开了 P26 那个还没修好的并发 bug。
  **但有个真实遗留问题**:如果用户只是在**空闲地查看**另一个 session(没在生成内容),
  定时任务触发时会**强行接管主界面**、切换过去,虽然不是数据错乱,但体验很突兀,
  可能丢失 composer 里没发送的草稿(待确认)。
- **4. 重启后持久化**:已实现,存在 `~/.cheetahclaws/sessions/desktop/scheduled_tasks.json`。
- **5. Enabled 关闭后不触发**:已实现,靠 `enabled`/`paused`/`next_run_at` 三个条件控制。
- **6. 无效 target folder 失败可见性**:已实现,记录 `status: "failed"` 和具体错误文字。

  后续待修指令(发给 AI):
  ```text
  Good result overall. One follow-up worth fixing (not urgent/critical, but a real UX
  problem): when a scheduled task fires while I'm passively viewing a different IDLE
  session (not actively generating), it currently hijacks the main UI and force-switches
  to the new scheduled session.

  Fix: instead of force-switching the visible view, run the scheduled task's session in
  the background (still only when the app is idle per the current safe design) and
  surface it via a subtle notification instead — e.g. it appears in the sidebar with the
  running-indicator dot (from P3), and/or a small toast/badge saying "Scheduled task
  'Daily market brief' completed" that the user can click to view, rather than forcibly
  navigating them away from whatever they were looking at. Also confirm: if the user has
  unsent draft text in the composer when this happens, is it preserved or lost? If lost,
  fix that first as the higher-priority part of this.
  ```

#### 🔴 真机测试发现两个新问题(真机截图确认,比之前的更严重)
- **假成功 bug**:定时任务到点"运行"了,但实际显示的是 "You do not have permission to
  use the Studio Chat feature. Please use the link below to request access." ——说明
  这次触发的 session 没有正确带上主 app 已经登录的 Studio 认证,导致实际调用直接被拒绝,
  要求生成的文件根本没创建。**更严重的是**:之前测试"文件夹不存在"时能正确标成
  `status: failed`,但这次的权限报错似乎没走同一套失败判定,看起来像是"已开始"而不是
  "失败"——**用户会误以为任务真的跑了**,这比诚实报错更危险。
- **每次 run 都新开一个 session,主列表会被刷爆**:如果一个定时任务每天跑,一个月后
  Sessions 列表里就多 30 条,完全没法用。截图里已经能看到同一个任务的两条
  "Scheduled: Daily Markt Brief" 记录堆在最上面了。

- **表单字段冗余/不联动 Recurrence**:One-off 选中时,Date/time(空)、Time(09:00 AM)、
  Weekly days("0,2,4 for Mon/Wed/Fri" 占位文字)三个字段同时显示,互相矛盾又没用。
- **Target folder 不该强制必填**:比如"发邮件总结"这种任务根本不需要碰文件夹。
- **Permissions / Mode / Enabled 三者容易被当成同一件事**:不是真的重复(Permissions=
  运行时AI能自主到什么程度,Mode=用哪个工作模式,Enabled=整个任务是否启用),但 UI 没
  解释清楚导致困惑;Mode 里的 "Coding" 选项对定时任务这个场景没必要,只留 Studio。

  整合后的修复指令(发给 AI,跳过单独调查,直接改):
  ```text
  Please fix all of the following in the Scheduled Task feature (creation/edit form +
  the false-success/session-clutter issues found earlier). Investigate as needed while
  fixing, but no separate investigate-only round this time.

  1. FALSE SUCCESS BUG: a scheduled task fired, was reported as "started", but the
     actual chat call failed with "You do not have permission to use the Studio Chat
     feature" and the requested output was never created.
     - Fix scheduled-task sessions to properly inherit/reuse the same authenticated
       Studio connection the main app already has — a scheduled run should have the
       same access as if the user had typed the prompt themselves.
     - Fix failure detection to catch ANY error from the chat call (not just specific
       known error types like a missing folder), reliably setting status: "failed"
       with the real error message shown — never "started" when it actually failed.

  2. SESSION LIST CLUTTER: stop scheduled runs from appearing as separate entries in
     the main Sessions list. Group them under their own scheduled task instead —
     clicking into the scheduled task (via the Scheduled section) shows its own run
     history list (one row per run, status/timestamp, linking to that run's
     transcript). The main Sessions sidebar should show at most one entry per
     scheduled task (or none), not one row per run.

  3. FORM FIELDS SHOULD MATCH THE SELECTED RECURRENCE — stop showing all of Date/time,
     Time, and Weekly days at once regardless of what Recurrence is selected:
     - Recurrence = "One-off": show ONE combined date+time picker only. Hide Time and
       Weekly days entirely.
     - Recurrence = "Daily": show Time only (fires every day at that time). Hide
       Date/time and Weekly days.
     - Recurrence = "Weekly": show Time plus a proper day-of-week picker — actual
       clickable day toggles/checkboxes (Mon/Tue/Wed/Thu/Fri/Sat/Sun), NOT a raw text
       field like "0,2,4 for Mon/Wed/Fri". Hide Date/time.
     Only the fields relevant to the currently selected Recurrence should ever be
     visible — no leftover placeholder text from an irrelevant mode.

  4. TARGET FOLDER SHOULD BE OPTIONAL, not required — some scheduled tasks (e.g. "send
     a daily email summary") don't touch any files at all. Make it a clearly optional
     field, e.g. "Target folder (optional — only needed if this task reads/writes
     files)", and confirm the task can be saved and actually run successfully with it
     left empty.

  5. CLARIFY Permissions vs Mode vs Enabled so they don't read as redundant:
     - Add a short one-line description under each control explaining specifically
       what it does (Permissions: how much approval the run needs while executing;
       Mode: which workflow mode it runs in; Enabled: whether this task is active and
       will fire at its scheduled time at all).
     - Remove "Coding" as an option from the Mode dropdown for scheduled tasks —
       "Studio" is the only mode that makes sense here. If Studio ends up being the
       only option, simplify this to a fixed label instead of a single-option dropdown.

  Verify live: create a One-off task and confirm only the relevant date/time field
  shows; switch to Weekly and confirm proper day checkboxes appear (no raw text field);
  save a task with Target folder left empty and confirm it runs successfully; trigger
  an auth/permission failure and confirm it's clearly marked "failed" not "started";
  run the same scheduled task 3+ times and confirm the main Sessions list does NOT grow
  by 3 new entries; confirm the Mode dropdown for scheduled tasks no longer offers
  "Coding". Both light and dark themes.
  ```

  **追加证据(真机截图确认,同一个 bug 的另一种表现)**:点进一个显示"运行成功"的定时
  session,里面卡在一个**永远转不完的骨架屏(灰色占位条)**,既没有真实内容,也没有报错
  文字——比之前看到的"显示报错文字但标成成功"更差,这次是连错误都没展示出来,用户完全
  不知道发生了什么。侧边栏里同一个任务的多条 "Scheduled: Daily Markt Brief" 也还堆着,
  说明列表刷屏那条也还没修。追加发这段:
  ```text
  Additional repro of the same bug class: opening a scheduled session that shows as
  "succeeded" reveals it's actually stuck on a permanent loading skeleton (grey
  placeholder bars) — no real content, no error text either, just stuck forever. This
  is presumably the same underlying auth/session failure as before, but this time even
  the error message itself never rendered. Fix this as part of the same false-success
  investigation: a scheduled run must always end in one of two states shown to the user
  — real completed content, or a clearly marked failed state with the error — never an
  indefinitely stuck loading skeleton. Also confirm: is there a timeout so a stuck run
  eventually gets marked failed automatically, rather than hanging forever?
  ```

#### D 补充:表单布局细节(真机截图确认,功能已经修好,这次是纯视觉)
- 好消息:P38 那次整合修复的功能部分看起来已经落地了(Target folder 变成可选、有
  Browse 按钮和说明文字;Mode 简化成固定的 "Studio";Permissions/Mode/Enabled 都加了
  一行解释文字)。这次剩下的是纯布局/视觉问题。

  指令(发给 AI):
  ```text
  STEP P39 — Polish the Scheduled Task form layout. Frontend-only CSS, no logic changes
  — the functional fixes from the last round already landed correctly.

  1. Align the Permissions and Mode fields into a proper two-column grid: same input/
     select height, same vertical position, same label style above each, so the two
     boxes sit on a clean shared baseline instead of looking offset from each other.
  2. Center "No scheduled tasks yet." properly (both horizontally and with balanced
     spacing above/below), and give it clear visual separation from the create-task
     form below it — the form should read as its own distinct card (background/border
     matching the app's existing card style), not run directly into the empty-state
     text above it.
  3. Investigate and fix the empty box below the Save/Cancel buttons: report what it
     actually is (my guess: an empty run-history panel, since a new/unsaved task has no
     runs yet). If that's what it is, show a proper empty state inside it ("No runs
     yet" in muted text) instead of a blank box with no explanation, or hide it
     entirely until the task has been saved and has at least one run.

  Verify live in both light and dark themes: create a new scheduled task and confirm
  the form reads as a clean, aligned, clearly-separated card with no unexplained empty
  elements.
  ```

- 另外你问的"其他系统弹框改成 Permission 那样"——这个之前已经写好完整方案了,就是
  **A16**(在本文档更前面),还没发给它执行的话,现在正好一起发,顺便包含 Scheduled
  这个新功能里可能新增的弹框(比如删除定时任务的确认框)。

#### D 补充2:表单还是丑,这次给完整设计规范(不再零敲碎打)
- 现象:P39 之后 Enabled 那一行文字断成两截、中间隔一大段空白;根本原因大概率是
  **整个表单没有约束最大宽度**,在宽屏窗口里每个字段被拉得很长很松散,才反复出现对
  不齐、留白怪异这些问题。这次给一套完整规范,而不是一个个补丁。

  指令(发给 AI):
  ```text
  STEP P40 — Redesign the Scheduled Task form as one cohesive, well-designed form.
  Frontend-only CSS, no logic changes. This replaces/supersedes P39's smaller patches —
  apply this full spec instead of just fixing the Enabled row in isolation.

  1. CONSTRAIN THE FORM WIDTH: wrap the whole create/edit form in a container with
     max-width ~640px, centered horizontally on the page (margin: 0 auto). Do not let
     input fields, textareas, or helper text stretch across the full window width —
     this is very likely the root cause of the repeated alignment/spacing complaints.
     Wrap it in a card: background = surface color, border 1px at 8% opacity,
     border-radius 12px, padding 24px.

  2. CONSISTENT FIELD PATTERN — apply this exact structure to EVERY field (Name,
     Prompt, Recurrence, Date/time, Target folder, Permissions, Mode):
     - Label: 13px, weight 500, primary text color, 6px margin-bottom before the input.
     - Input/select/textarea: full width of the 640px container, consistent height
       (36px for single-line inputs/selects, auto-grow for the Prompt textarea),
       consistent padding (8px 12px), same border/radius as elsewhere in the app.
     - Helper/description text (if any): 12px, muted color, 4px margin-top, max-width
       matches the input above it (not free-floating or wider than the field).
     - 20px gap between each field group.

  3. TWO-COLUMN PAIRS (Recurrence+Date/time, Permissions+Mode): use CSS grid with two
     equal columns and a defined gap (e.g. `grid-template-columns: 1fr 1fr; gap: 20px`)
     so both columns' labels, inputs, and helper text align on the same horizontal
     lines row by row — no more visual offset between the two sides.

  4. ENABLED ROW — stop treating this as a special inline sentence. Use the SAME field
     pattern as everything else:
     - A row with the checkbox and a short bold label directly next to it, inline:
       [checkbox] Enabled
     - Directly below that (indented to align with the label, not the checkbox), the
       explanatory text in the same 12px muted helper-text style as every other field:
       "This task is active and will fire at its scheduled time. Turn off to pause
       without deleting it." — wrapping naturally within the 640px container, never
       split into two disconnected chunks with a gap between them.

  5. SAVE/CANCEL: place at the bottom of the card with normal field spacing above them
     (not cramped against the last field), Save using the app's existing primary
     button style, Cancel as ghost/secondary, 12px gap between them.

  6. Empty state ("No scheduled tasks yet.") stays fully centered above this card, with
     clear spacing separating it from the card — confirm no visual crowding between the
     two.

  Verify live in both light and dark themes: create a new task and confirm every field
  — including Enabled — reads as one clean, aligned, readable column with no orphaned
  text fragments or misaligned pairs.
  ```

#### D 补充3:空白 Scheduled 列表页有个飘在外面的 "No runs yet",以及 app 默认落地页确认
- 现象:P40 之后 "No scheduled tasks yet." 已经居中了(好消息),但页面右侧空白处
  飘着一行 "No runs yet" 文字,跟任何卡片/区块都没关系,像是残留/位置放错的元素——
  这个页面此刻没有选中任何任务,不应该出现这行字。
- 顺便确认:打开整个 app 是不是默认就落在这个 Scheduled 页面(而不是聊天/session
  页)?如果是,这本身可能是个需要讨论的产品决策问题,不只是视觉 bug。

  指令(发给 AI):
  ```text
  STEP P41 — Two things:

  1. Fix the orphaned "No runs yet" text floating in empty space on the Scheduled list
     page when NO task is selected/being created. Investigate why it renders here at
     all — is it leftover markup from a run-history component that isn't properly
     scoped to only render when a task is actually selected/open? Remove it from this
     view entirely; it should only ever appear inside a specific task's own run-history
     section (per P39/P40), never floating unattached on the top-level list page.

  2. Report: when the app is launched fresh, does it default to landing on this
     Scheduled/Automations page, or on the normal chat/session view (last active
     session, or a new-session empty state)? If it currently defaults to Scheduled,
     confirm that's intentional — report where this default is set in the code — since
     landing on an automations/admin page rather than the chat interface seems like an
     unusual default for a coding assistant app. Don't change it yet, just report what
     you find and wait for my decision.

  Verify live: reload/reopen the Scheduled page with nothing selected and confirm no
  orphaned "No runs yet" text appears anywhere, in both light and dark themes.
  ```

#### D 补充4:定时任务 prompt 不够具体时,AI 不该"停下来问",该做假设并说明
- 现象(真机截图确认):定时任务 "22" 的 prompt 是 "please summarize today's email to
  this folder",触发后 AI 回复的是"你要哪个 Outlook 文件夹?"这种澄清问题,并给了几个
  备选(Inbox today / Sent Items today / 具体子文件夹),甚至提了"如果没指定,我可以默认
  用今天的 Inbox"——但**只停在问句上,没有真的按这个默认值执行下去**。无人值守场景下
  这等于白跑一次,因为没有人在那回答。
- 核心原则:定时任务永远不该"停下来问",应该"选一个最合理的假设、照着做完、并且清楚
  说明自己做了什么假设",而不是把选择权丢给一个不存在的人。

  指令(发给 AI):
  ```text
  STEP P42 — Fix how scheduled/unattended runs handle ambiguous prompts. Currently,
  when a scheduled task's prompt is under-specified (e.g. "summarize today's email to
  this folder" without naming a folder), the AI stops and asks a clarifying question
  instead of completing the task — but scheduled runs are unattended, so nobody is
  there to answer, and the run effectively wastes itself doing nothing useful.

  INVESTIGATE first: how is a scheduled run's prompt currently submitted to the AI —
  is there any existing system-level context/instruction wrapping it that's specific to
  "this is a scheduled/unattended run," or does it go through exactly the same path as
  a normal interactive message (which is why it behaves the same way and asks
  questions)?

  FIX:
  1. When submitting a scheduled task's prompt, prepend a system-level instruction
     specific to unattended execution: "This is an unattended scheduled run — there is
     no user available to answer clarifying questions. If the prompt is ambiguous or
     underspecified, make the most reasonable assumption, clearly state that assumption
     at the START of your response (e.g. 'Assumption: used today's Inbox since no
     folder was specified.'), and proceed to complete the task using that assumption.
     Do not stop and only ask a question without attempting the task — a best-effort
     completion with a stated assumption is always better than an unanswered question."
  2. In the run's history/status, detect when a run's response includes an
     "Assumption:" prefix (or however you implement the signal) and mark that run
     distinctly — e.g. a "Completed (assumption made)" status, different from plain
     "success" and different from "failed" — so the user can see at a glance which runs
     needed guessing and may want to refine their prompt.
  3. Add a short, always-visible hint under the Prompt field in the create/edit form
     (12px muted text, same helper-text style as other fields): "Scheduled tasks run
     unattended — be specific (e.g. name the exact folder) rather than relying on
     follow-up questions. Use Run Now to test before enabling."

  Verify live: create a task with a deliberately ambiguous prompt (like the "this
  folder" example), run it, and confirm it now completes with a stated assumption
  instead of just asking a question and stopping; confirm the run history shows the
  "assumption made" status distinctly; confirm the new hint text appears under the
  Prompt field, in both light and dark themes.
  ```

### 🔴 D 停止打补丁,先做诚实全面自查(真机截图确认,核心功能始终没跑通)
- 经过 P36-P42 七八轮修复,核心问题仍然存在:**每次 run 还是新开一个 session**、
  **内容还是卡在骨架屏跑不完**、**设定的时间/周期好像根本没被真正使用**。这跟当初
  P26 并发问题的模式一样——一直在修表面症状,没有真正碰到病根。这次先停止继续打补丁,
  用 Codex Scheduled 功能的标准模型(触发器 / 任务指令 / 上下文 / 执行 / 反馈)逐项
  逼它诚实自查,参考当初 P26 "What IS and ISN'T actually done" 那种问法,拿到真实清单
  之后再决定下一步是继续修还是重做执行链路。

  指令(发给 AI):
  ```text
  STOP further patching. Before any more fixes, do a full honest audit of the
  Scheduled Tasks feature using this standard model (trigger → task instruction →
  context → execution/run → output/feedback), and report exactly what IS and ISN'T
  actually working for each, with code-level evidence — not just claims. This is the
  same rigor as the earlier P26 "What IS and ISN'T actually done" audit.

  1. TRIGGER — is there a real background timer/polling loop that checks scheduled
     tasks and fires them at the correct time, or does the schedule (Date/time,
     Recurrence, Time) get saved but never actually read by anything except "Run Now"?
     Trace the exact code path from "task is due" to "task starts running." If changing
     the scheduled time doesn't change real behavior, say so explicitly — don't imply it
     works if you haven't confirmed it does.

  2. TASK INSTRUCTION — when a scheduled run fires (via trigger OR Run Now), is the
     saved prompt actually passed to the AI correctly and completely? Trace this path
     too.

  3. CONTEXT — does a scheduled run carry any user context (target folder, permission
     mode, etc. already in the form) through to execution correctly? Confirm each field
     from the form actually reaches the running task, not just gets saved to JSON and
     ignored.

  4. EXECUTION/RUN — this is where real breakage has been observed repeatedly: sessions
     get stuck showing a permanent loading skeleton with no real content ever arriving.
     Trace the FULL lifecycle of a scheduled run from "started" to "completed": what
     event/signal is supposed to mark it complete, and why does that signal appear to
     never arrive? Is the scheduled run's session properly connected to the same
     completion/streaming machinery a normal interactive session uses, or is it a
     separate, incomplete code path that was never fully wired up?

  5. OUTPUT/FEEDBACK — once (if) a run completes, does its result actually reach the
     user in a sensible place? Confirm whether the "new session per run" behavior
     (which should have been fixed in the earlier P38 pass) is actually fixed or was
     only reported as fixed without being verified live.

  For each of the 5 areas, classify honestly as: fully working / partially working /
  stubbed-looks-real-but-isn't / not implemented. Report this as a clear table. Do NOT
  write any fix code in this step — I want the honest audit first, then we decide
  together whether to keep patching or rebuild the execution path from scratch, the
  same way we did for P26.
  ```

  参考:Codex 官方的 Scheduled 概念模型(供对照,不用照抄):"用户提前设定一个任务,AI 在
  指定时间/周期/条件满足时自动运行,并把结果反馈给用户" —— 五个组成部分是触发器
  (决定何时运行)、任务指令(决定做什么)、上下文(带着用户偏好运行)、执行(到点唤醒
  AI 完成查询/分析/生成)、反馈(结果以摘要/报告/提醒等形式送达用户)。金融场景的典型
  用例包括:每日盘前摘要、投资组合监控、财报提醒总结、宏观数据日历、利率汇率商品监控、
  新闻风险监控、每周投资复盘——这些可以作为以后功能设计的参考方向,但**现阶段优先级
  是先把最基础的"触发-执行-反馈"链路真正跑通**,不用急着扩展场景。

---

## 全面自查结果(真机截图确认,质量很高,给了具体代码证据)

### 五维度分类表(它自己给的)

| 环节 | 判定 | 原因 |
|---|---|---|
| Trigger(触发器) | 部分能用 | 真实的 QTimer 每 60 秒轮询一次,正确读取 `next_run_at` 并跟 `datetime.now()` 比较。但只在 app 打开时才生效、60 秒轮询粒度、一次只处理一个到期任务,健壮性有限 |
| Task instruction(任务指令) | 部分能用 | prompt 确实被传给了 `AgentWorker`,但**绕过了普通聊天的 prompt enrichment(增强处理)** |
| Context(上下文) | 部分能用 | `target_folder`/`permission_mode`/`desktop_mode`/recurrence/enabled-paused 能传到执行层;但附件、quote、已选文件夹、知识库/当前对话上下文都传不过去 |
| Execution/run(执行) | 部分能用,且是脆弱的独立路径 | worker 真的启动了,但定时执行**完全独立于普通对话的生命周期**;text/最终状态可能被写到错误的 `chat_entries[-1]`,导致 assistant 消息永久卡在骨架屏 |
| Output/feedback(反馈) | 部分能用 | session 文件、运行历史、toast 通知都存在,但只有在完成流程真正触发时才生效;输出可能是畸形的;每次新建 session 的问题依然存在 |

### 关键发现 1:找到"卡骨架屏"的真正代码 bug

定时任务的 `chat_entries` 一开始是:
```python
chat_entries = [..., {"kind": "assistant", "text": "", "status": "Working"}]
```
但工具调用(`on_tool_start`)会往列表末尾追加 `"activity"` 类型的条目;而 `on_text()` 和最终状态更新都想当然地认为 `chat_entries[-1]` 永远是 assistant 消息,直接对它做修改。**只要这次运行调用过任何工具,`chat_entries[-1]` 就变成了 activity 条目,文本和完成状态就写错了地方,真正的 assistant 消息永远停在 `text: "", status: "Working"`**——这就是反复看到的"卡骨架屏"现象的根因,定位非常精确。

### 关键发现 2:定时任务走的是完全独立的执行路径

明确回答"定时任务是否连到跟普通对话一样的完成/流式机制":**不是**。它用的是一条独立的 `AgentWorker` 路径,自己维护本地回调和文件快照,没有用普通聊天的 `sendPrompt` 生命周期或正常的 UI 流式处理器。这是所有这些 bug 反复出现的系统性原因——两套平行实现,一套(普通聊天)经过大量实战验证,另一套(定时任务)是仓促搭建、没被真正测过的。

### 关键发现 3:P38 那次"修好了 new-session-per-run"其实没有真的实现

当前代码依然是:
```python
session_path = DESKTOP_SESSIONS_DIR / f"session_{time.strftime('%Y%m%d_%H%M%S')}_scheduled.json"
```
每次 `start_scheduled_task_run` 都会新建一个 session 文件,标题固定为 `f"Scheduled: {task name}"`。之前的修复被报告为"完成"但实际没有真的做。

### 结论:不是纯前端假货,但确实没真正做好

它自己的总结:"Scheduled Tasks 不只是一个视觉上的 stub,但也确实没有完全工作。触发器和基础的 worker 启动是真实存在的。真正危险的坏掉部分是独立的定时执行/输出路径,尤其是 `chat_entries[-1]` 的处理方式,以及没有接入正常的交互式生命周期。"

### 下一步:先修两个已经诊断清楚的具体 bug,再讨论要不要重构成复用普通聊天管线

  指令(发给 AI):
  ```text
  Excellent diagnosis. Please fix these two concrete, well-understood bugs first:

  1. THE chat_entries[-1] BUG: on_text() and the finalization code must not blindly
     mutate chat_entries[-1]. Instead, track the assistant entry explicitly (e.g. store
     its index or a reference when it's first created) and always update THAT entry,
     regardless of how many activity/tool entries get appended after it. Verify by
     running a scheduled task that actually calls a tool (not a trivial no-tool prompt)
     and confirming the assistant's response text and final status land correctly, not
     stuck on "Working".

  2. ACTUALLY implement one-session-per-task with appended run history, replacing the
     current new-session-per-run behavior (P38 was reported done but never actually was).

  Do these two first, verify both live for real (trigger via schedule, not just Run Now),
  then report back. After that we'll separately discuss whether the deeper issue —
  scheduled execution using a completely separate AgentWorker path instead of the same
  sendPrompt/streaming lifecycle as normal chat — is worth fixing by reusing the normal
  pipeline, or whether patching the separate path is good enough going forward.
  ```

### Plan Mode 进入,方案已出(真机截图确认,尚未动代码,值得肯定)
- 好现象:它主动进了 Plan Mode(只读模式),理由是"这是非平凡的后端行为改动"。方案
  内容跟批准范围完全对得上(显式追踪 assistant 条目、稳定的一任务一 session)。也
  提前声明如果 Studio 认证/运行环境没法真机验证,会明确说清楚,不会谎称测过——延续
  了 P26 那次学到的诚实态度。"1 changed file: default.md +59 -347" 是 Plan Mode 自己
  写计划用的文件,不是动了 desktop.py 正式代码,正常。

  批准指令(发给 AI):
  ```text
  Approved. Proceed with exactly these two fixes as planned:
  1. Explicit assistant-entry tracking for scheduled runs (no more chat_entries[-1]).
  2. Stable one-session-per-task scheduled session file with appended run history.

  Run python -m py_compile desktop.py as a minimum sanity check. Then attempt a real
  scheduled-trigger verification (not just Run Now) — actually wait for the schedule to
  fire, not just simulate it. If Studio auth/runtime genuinely prevents you from verifying
  live in this environment, say so explicitly and tell me exactly what to test myself,
  rather than reporting success without having confirmed it.
  ```

### 实现完成,诚实拒绝伪造真机验证,给了手动测试清单(真机截图确认)
- `python -m py_compile desktop.py` 在这个 shell 里因为 `python` 别名不存在而失败,
  它自己换成 `py -m py_compile desktop.py` 重跑,通过、无报错。
- **诚实声明**:没法在这个工具环境里真的验证定时触发(需要打开 Qt 桌面 app + Studio
  认证 + 真的等 scheduler 触发),没有在没验证的情况下就说"成功"。这正是批准消息里
  要求的态度。
- `desktop.py +43 -13`,改动规模跟"两个针对性修复"的范围相符,不是大范围重写。

  **需要你亲自测的步骤(它给的,已梳理)**:
  ```text
  1. Open the desktop app, confirm Studio is signed in.
  2. Create a scheduled task: Target folder = a real folder containing hello.txt;
     Prompt = something that forces a tool call, e.g. "In the target folder, list the
     files and read the contents of hello.txt if it exists. Then summarize."
  3. Schedule it 1-2 minutes in the future. Do NOT use Run Now — wait for the real
     scheduled trigger to fire automatically.
  4. After it finishes, inspect the session:
     - Filename should be session_scheduled_<task_id>.json (stable, no timestamp).
     - The assistant entry should have non-empty text and status "Final" (not stuck
       on "Working").
  5. CRITICAL second check: let the same task fire again (or edit its next run time and
     wait again). Confirm it APPENDS to the same session_scheduled_<task_id>.json —
     it should NOT create a new timestamped session_YYYYMMDD_HHMMSS_scheduled.json.
  ```

### 真机测试:修复只生效了一部分,+ 发现新的深层问题(真机截图确认)
- **进展**:这次真的生成了实际文本内容("I can do that, but this session doesn't
  currently have access to your mailbox/folder contents...")——说明 `chat_entries[-1]`
  写错地方那个 bug **修好了一部分**,文本这次是落在对的条目上的。
- **但仍未完全修好**:内容末尾还是卡在一条转不完的骨架屏上,说明"标记完成"这一步还有
  别的地方没接住信号。
- **新发现的深层问题**:AI 的回复显示,定时任务的 session **没有真实的 Outlook/邮箱
  数据访问权限**,建议用户手动导出/转发邮件——这对每天自动跑的定时任务完全不现实。
  跟之前诊断报告里"Context 部分能用:附件/connector 传不到执行层"这条对上了,说明
  已有的 Outlook mail+Calendar connector 没有被传递给定时任务的执行 session。

  指令(发给 AI):
  ```text
  Progress but not fully fixed. Real content NOW renders (e.g. "I can do that, but this
  session doesn't currently have access to your mailbox/folder contents...") — this
  confirms the chat_entries[-1] fix partially worked. But the run still ends stuck on a
  permanent loading skeleton after that text. Please re-diagnose specifically: since text
  IS landing on the right entry now, what's still failing to mark the run as complete —
  is it the "Final" status update, a continuation/second turn, or something else? Give
  code-level evidence again, don't guess.

  Separately, flag this as a related but distinct gap: the response shows the scheduled
  session has no real access to Outlook/mailbox data (it asks the user to manually
  export/forward emails), which defeats the purpose of an unattended recurring task. Does
  the existing Outlook mail+Calendar connector (already used in interactive sessions)
  get passed through to scheduled runs at all? If not, that's part of the "Context"
  gap already noted in the audit (attachments/connectors not reaching execution) —
  report what it would take to fix that too, but don't implement yet, just report.
  ```

### 参考资料存档:Codex 真实 Scheduled 界面截图(等执行链路稳定后再用于重新设计)
- **Heartbeat vs Cron 两种类型**:Heartbeat 用于"让同一个对话线程醒来续聊/提醒你"
  (比如"45分钟后提醒我"、"每周一继续这个话题");Cron 用于"独立的、绑定某个 workspace
  的周期性任务"(比如"每个工作日检查这个仓库、总结失败的测试")。我们现在只有一种
  "定时任务"类型,可能同时在做这两件不同的事,是设计别扭的原因之一。
- **一个定时任务通常需要**:名字、prompt(到点做什么)、schedule(一次性/周期,含
  时区)、destination(续这个线程 / 本地 workspace / 隔离的 worktree 式运行)、
  status(active/paused)。"destination"是个我们现在没有的独立概念,跟"Target folder"
  不是一回事——destination 决定"这次运行发生在哪种上下文里"。
- **列表页极简**:按 Current / Paused 分组,每条只显示名字 + app 标签 + 下次运行时间的
  大白话描述("Next run in 2 days · Weekdays at 8:00 AM"),不是一堆原始字段堆在一起。
- **创建方式是对话式访谈**,不是静态表单——直接问用户:"到点要做什么?一次性还是重复?
  什么时候(带时区感知)?续聊还是新建独立任务?只提醒还是要真的执行并汇报结果?"
- 这些设计思路值得借鉴,但**当前优先级仍是先把核心执行链路(骨架屏卡住、Context
  传递不全)修稳**,不建议现在就做 UI 大改。

### 更细的诊断结果(真机截图确认,用户提到还有部分内容未拍到)

**骨架屏问题:根因换了,不再是 chat_entries[-1]**
- 现在文本已经正确落地,剩下的卡住大概率是**前端渲染问题**:`renderStoredAssistantFlow`
  (负责渲染已存 session 里 assistant 文本的函数)没有在渲染完存储文本后明确隐藏"正在
  输入"指示器或标记流程完成。
- **给了低成本的验证方法**:直接看最新那个定时 session JSON 里 assistant 的状态字段——
  是 `Final` 说明问题在前端渲染清理;还是 `Working` 说明后端"保存完成状态"依然没做对。

**Outlook 上下文问题:根因完全定位清楚**
- 定时任务运行时**不调用 `apply_web_settings()`**,只用当时 `self.config` 里恰好有
  什么就用什么。
- 创建表单的 payload 只有 `name/prompt/recurrence/target_folder/permission_mode/
  desktop_mode/enabled/paused`,**完全没有 connector 相关字段**,所以 AI 不知道该查
  哪个邮箱/文件夹,只能让用户手动导出。
- 修复方案分三步:①表单加 connector 上下文字段(给了具体 JSON schema:connectors 列表、
  outlook 的 mailbox/folder/calendar id、query、date_window);②后端
  `normalize_scheduled_payload()` 现在会丢弃这些信息,得改成保留;③执行时把这些上下文
  注入 `run_config`,在 `build_system_prompt()` 之前。
- 分类为:跟之前审计报告里的 "Context" 缺口是同一类问题,不是骨架屏那个 bug。

  指令(发给 AI):
  ```text
  Do the cheap verification first: check the assistant status field in the latest
  scheduled session's JSON file.
  - If status is "Final": confirm this is a frontend rendering cleanup bug in
    renderStoredAssistantFlow (it needs to hide the typing indicator / mark the flow
    complete after rendering stored assistant text, not just when actively streaming).
    Fix that specifically.
  - If status is still "Working": the backend finish/final-save path is still broken —
    re-diagnose that instead, don't assume it's the frontend.

  Separately, please implement the Outlook/connector context fix as you scoped it:
  1. Add connector-context fields to the scheduled task form (per your proposed schema).
  2. Make normalize_scheduled_payload() preserve this instead of discarding it.
  3. Inject the saved connector context into run_config before build_system_prompt()
     at execution time.

  Test with: "At the scheduled time, use Outlook mail tools to list the latest 5
  received messages from my Inbox since yesterday." Expected: scheduled run actually
  calls Outlook tools (no manual export/forward request), summary lands in the
  scheduled session, final assistant status is complete.

  Work incrementally, commit after the skeleton fix and separately after the Outlook
  context fix, verify each live before moving to the next.
  ```

### 真机测试:又一次运行失败(新失败模式)+ 发现设计缺陷 + UI 还是没修好(真机截图确认)

- **新失败模式**:这次用 Outlook 测试 prompt,触发后几乎完全空白,连报错都没有——跟之前
  "至少有部分文本+卡骨架屏"不一样,可能是 Outlook COM 在定时任务的后台 worker 线程里
  访问不了(呼应最早 P26 调查阶段就提过的"Desktop COM API 线程安全"风险)。
- **设计缺陷**:用户发现测试 prompt 里必须显式写"at the scheduled time"才像是"有效"的
  定时任务——但触发时机应该完全由 Date/time + Recurrence 这些设置决定,不该依赖用户在
  prompt 文字里手写措辞。需要确认 P42 那次"无人值守"提示是不是真的对所有定时任务自动
  注入,而不是要求用户自己写触发相关的话。
- **UI 依然没修好**:P39、P40 两次尝试修 Enabled 那行文字断成两截的问题都没修干净,这次
  给了 Codex 单任务详情页的参考截图(Status 区块 + Details 区块 + Previous runs 区块的
  清晰分层),不再继续在原表单结构里打补丁,直接照这个结构重做。

  指令(发给 AI):
  ```text
  Three things:

  1. RE-DIAGNOSE this new failure honestly: the Outlook test task fired but the session
     shows almost nothing — not even an error, just blank. This is different from the
     earlier skeleton bug. Check whether Outlook COM access is failing silently inside
     the scheduled task's background worker thread (COM objects are often not safe to
     access from arbitrary threads without proper apartment initialization — this was
     flagged as a risk back in the original P26 investigation). Give code-level evidence,
     and if it's silently swallowing an exception, surface that error instead of leaving
     the session blank.

  2. DESIGN QUESTION: does the "this is an unattended scheduled run, make assumptions
     and don't ask for clarification" instruction (from P42) get injected automatically
     into EVERY scheduled task's prompt at execution time, regardless of what the user
     wrote? Or does it only apply if the user's own prompt happens to reference
     scheduling/timing? The trigger timing must be fully controlled by the Date/time and
     Recurrence settings — the user should never need to write phrases like "at the
     scheduled time" in their own prompt for the task to behave correctly as unattended.
     Confirm this is injected server-side unconditionally, and fix it if it isn't.

  3. REDESIGN the scheduled task detail/edit view to match this structure instead of
     patching the current form layout again (P39/P40 already failed twice on the
     Enabled row specifically):
     - A "Status" block: Active/Paused state, Next run time, Last ran time.
     - A "Details" block: Target folder, Connector context, Permissions, Mode,
       Recurrence — each as a clean label+value row.
     - A "Previous runs" section at the bottom, clearly labeled, showing "No runs yet"
       as its own empty state when there's nothing (not floating unattached).
     - The editable fields (Name, Prompt, Enabled toggle) stay editable, but the
       Enabled control specifically must be: [toggle] "Enabled" on one line, with the
       explanation text as a separate line directly below it in the same helper-text
       style used everywhere else in the app — verify this specific row renders as ONE
       clean paragraph, not two disconnected fragments, before moving on.

  Verify all three live, in both light and dark themes.
  ```
