// ============================================================
// Forge AI IDE — 交互逻辑（原生 JS，无需构建）
// 全部包进 IIFE，避免污染宿主软件的全局命名空间。
// 数据为 mock；接真后端时，把 mockReply / 文件树 / diff 换成接口数据即可。
// ============================================================
(function () {
  "use strict";

  // ---------- 工具 ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ---------- mock 文件树 ----------
  const TREE = [
    { type: "folder", name: "src", open: true, children: [
      { type: "folder", name: "auth", open: true, children: [
        { name: "login.ts", changed: true },
        { name: "session.ts" },
      ]},
      { name: "index.ts" },
    ]},
    { name: "package.json" },
    { name: "README.md" },
  ];

  function renderTree(nodes, depth, container) {
    nodes.forEach((node) => {
      if (node.type === "folder") {
        const row = el(`<div class="tree-row ${node.open ? "open" : ""}">
          <svg class="chev" viewBox="0 0 16 16" width="12" height="12"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          <span class="name">${esc(node.name)}</span></div>`);
        const kids = el(`<div></div>`);
        kids.style.display = node.open ? "block" : "none";
        row.addEventListener("click", () => {
          node.open = !node.open;
          row.classList.toggle("open", node.open);
          kids.style.display = node.open ? "block" : "none";
        });
        container.appendChild(row);
        container.appendChild(kids);
        renderTree(node.children || [], depth + 1, kids);
      } else {
        const row = el(`<div class="tree-row indent">
          <span class="dot ${node.changed ? "dot-mod" : ""}"></span>
          <span class="name">${esc(node.name)}</span></div>`);
        row.addEventListener("click", () => {
          $("#filetree").querySelectorAll(".tree-row.active").forEach((r) => r.classList.remove("active"));
          row.classList.add("active");
        });
        container.appendChild(row);
      }
    });
  }

  // ---------- 消息渲染 ----------
  const chat = () => $("#chat");

  function addUserMsg(text) {
    const m = el(`<div class="msg">
      <div class="msg-role"><span class="avatar user">你</span>YOU</div>
      <div class="msg-body"><p>${esc(text)}</p></div></div>`);
    chat().appendChild(m);
    scrollDown();
  }

  function addAIMsg() {
    const m = el(`<div class="msg">
      <div class="msg-role"><span class="avatar ai">AI</span>FORGE</div>
      <div class="msg-body"></div></div>`);
    chat().appendChild(m);
    scrollDown();
    return $(".msg-body", m);
  }

  function scrollDown() { chat().scrollTop = chat().scrollHeight; }

  // ---------- 工具调用卡片 ----------
  function toolCard(tag, detail) {
    const card = el(`<div class="tool-card">
      <div class="tool-head">
        <svg class="chev-lead" viewBox="0 0 16 16" width="13" height="13" style="opacity:.6"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.4"/></svg>
        <span class="tool-tag">${esc(tag)}</span>
        <span class="tool-status">完成</span>
        <svg class="chev" viewBox="0 0 16 16" width="12" height="12"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      </div>
      <div class="tool-detail"><div class="tool-detail-inner">${esc(detail)}</div></div></div>`);
    $(".tool-head", card).addEventListener("click", () => card.classList.toggle("open"));
    return card;
  }

  // ---------- Diff 卡片（核心）----------
  // lines: { kind: "ctx"|"add"|"del", ln: string, txt: string }
  const MOCK_DIFF = {
    path: "src/auth/login.ts", add: 3, del: 1,
    lines: [
      { kind: "ctx", ln: "11", txt: "  if (!user) {" },
      { kind: "del", ln: "12", txt: "    return null;" },
      { kind: "add", ln: "12", txt: '    throw new AuthError("user not found");' },
      { kind: "add", ln: "13", txt: "  }" },
      { kind: "add", ln: "14", txt: "  if (user.disabled) {" },
      { kind: "ctx", ln: "15", txt: "    return session;" },
    ],
  };

  function diffCard(d) {
    const linesHtml = d.lines.map((l) => {
      const sign = l.kind === "add" ? "+" : l.kind === "del" ? "−" : "";
      return `<div class="diff-line ${l.kind}"><span class="ln">${l.ln}</span><span class="sign">${sign}</span><span class="txt">${esc(l.txt)}</span></div>`;
    }).join("");

    const card = el(`<div class="diff">
      <div class="diff-head">
        <svg viewBox="0 0 16 16" width="15" height="15" style="color:var(--text-muted)"><path d="M4 2h6l3 3v9H4z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
        <span class="diff-path">${esc(d.path)}</span>
        <span class="diff-add-n">+${d.add}</span><span class="diff-del-n">−${d.del}</span>
        <div class="diff-actions">
          <button class="btn btn-reject">✕ 拒绝</button>
          <button class="btn btn-accept">✓ 接受</button>
        </div>
      </div>
      <div class="diff-code">${linesHtml}</div></div>`);

    const resolve = (ok) => {
      card.classList.add("resolved");
      const actions = $(".diff-actions", card);
      actions.replaceWith(el(`<span class="diff-resolved-tag ${ok ? "ok" : "no"}">${ok ? "✓ 已接受" : "✕ 已拒绝"}</span>`));
      if (ok) { showToast("已应用到 " + d.path); clearChangeDot(); }
    };
    $(".btn-accept", card).addEventListener("click", () => resolve(true));
    $(".btn-reject", card).addEventListener("click", () => resolve(false));
    return card;
  }

  function clearChangeDot() {
    $("#filetree").querySelectorAll(".dot-mod").forEach((d) => d.classList.remove("dot-mod"));
  }

  // ---------- mock 流式回复 ----------
  let streaming = null;

  function streamReply(body, onDone) {
    const text = "好的，我来修改 login.ts 的错误处理逻辑。让用户不存在时抛出明确的 AuthError，并加上禁用账户的检查。";
    const p = el(`<p></p>`);
    body.appendChild(p);
    const cursor = el(`<span class="cursor"></span>`);
    p.appendChild(cursor);

    let i = 0;
    $("#sendBtn").hidden = true; $("#stopBtn").hidden = false;
    streaming = setInterval(() => {
      if (i >= text.length) {
        clearInterval(streaming); streaming = null;
        cursor.remove();
        $("#sendBtn").hidden = false; $("#stopBtn").hidden = true;
        onDone && onDone();
        return;
      }
      cursor.insertAdjacentText("beforebegin", text[i++]);
      scrollDown();
    }, 18);
  }

  function stopStream() {
    if (streaming) { clearInterval(streaming); streaming = null; }
    $("#sendBtn").hidden = false; $("#stopBtn").hidden = true;
    chat().querySelectorAll(".cursor").forEach((c) => c.remove());
  }

  // ---------- 发送流程 ----------
  function send() {
    const input = $("#input");
    const text = input.value.trim();
    if (!text || streaming) return;
    addUserMsg(text);
    input.value = ""; autosize(input);

    const body = addAIMsg();
    streamReply(body, () => {
      // 流式结束后：工具卡片 → diff 卡片
      body.appendChild(toolCard("读取文件  src/auth/login.ts", "读取 24 行。定位到第 12 行的 return null。"));
      body.appendChild(diffCard(MOCK_DIFF));
      scrollDown();
    });
  }

  // ---------- 输入框自适应高度 ----------
  function autosize(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 180) + "px"; }

  // ---------- toast ----------
  function showToast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (t.hidden = true), 2200);
  }

  // ---------- 初始化 ----------
  function init() {
    renderTree(TREE, 0, $("#filetree"));

    // 开场 mock 消息
    addUserMsg("把 login.ts 里用户不存在时的处理改成抛异常，并加上禁用账户检查");
    const body = addAIMsg();
    body.innerHTML = "<p>我已经看过这个文件，下面是建议的改动。</p>";
    body.appendChild(toolCard("读取文件  src/auth/login.ts", "读取 24 行。定位到第 12 行的 return null。"));
    body.appendChild(diffCard(MOCK_DIFF));

    // 事件
    $("#sendBtn").addEventListener("click", send);
    $("#stopBtn").addEventListener("click", stopStream);
    const input = $("#input");
    input.addEventListener("input", () => autosize(input));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $("#inspectorToggle").addEventListener("click", () => $("#inspector").classList.toggle("collapsed"));

    console.log("Forge AI IDE — ready");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
