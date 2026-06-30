// ============================================================
// Forge — Local AI IDE（原生 JS，无需构建）
// 全部包进 IIFE，避免污染宿主软件全局命名空间。
// 本地文件读写用浏览器原生 File System Access API（支持时真连本地；
// 不支持/file:// 时回退到 mock，便于演示）。
// ============================================================
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // 是否支持原生本地文件访问
  const HAS_FS = "showDirectoryPicker" in window;

  // ---------- 本地文件夹连接（真功能 + mock 回退）----------
  let rootHandle = null;          // 真实目录句柄
  const fileHandles = new Map();  // path -> FileSystemFileHandle

  async function openLocalFolder() {
    if (!HAS_FS) { showToast("当前环境不支持本地访问，已载入示例数据"); loadMockTree(); return; }
    try {
      rootHandle = await window.showDirectoryPicker();
      $("#projectName").textContent = rootHandle.name + "（本地）";
      fileHandles.clear();
      const tree = await readDir(rootHandle, "");
      renderTree(tree, $("#filetree"));
      showToast("已连接本地项目：" + rootHandle.name);
    } catch (e) { /* 用户取消，忽略 */ }
  }

  // 递归读取目录（跳过隐藏 / node_modules）
  async function readDir(handle, path) {
    const folders = [], files = [];
    for await (const [name, h] of handle.entries()) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const p = path ? path + "/" + name : name;
      if (h.kind === "directory") {
        folders.push({ type: "folder", name, path: p, handle: h, children: null, open: false });
      } else {
        fileHandles.set(p, h);
        files.push({ name, path: p });
      }
    }
    const cmp = (a, b) => a.name.localeCompare(b.name);
    return [...folders.sort(cmp), ...files.sort(cmp)];
  }

  async function readFile(path) {
    const h = fileHandles.get(path); if (!h) return "";
    const f = await h.getFile(); return await f.text();
  }
  async function writeFile(path, content) {
    const h = fileHandles.get(path); if (!h) return false;
    const w = await h.createWritable(); await w.write(content); await w.close(); return true;
  }

  // ---------- mock 文件树（回退/演示）----------
  function loadMockTree() {
    $("#projectName").textContent = "示例项目（mock）";
    const TREE = [
      { type: "folder", name: "src", path: "src", open: true, children: [
        { type: "folder", name: "auth", path: "src/auth", open: true, children: [
          { name: "login.ts", path: "src/auth/login.ts", changed: true },
          { name: "session.ts", path: "src/auth/session.ts" },
        ]},
        { name: "index.ts", path: "src/index.ts" },
      ]},
      { name: "package.json", path: "package.json" },
      { name: "README.md", path: "README.md" },
    ];
    renderTree(TREE, $("#filetree"));
  }

  function emptyTree() {
    const box = $("#filetree");
    box.innerHTML = "";
    box.appendChild(el(`<div class="tree-empty">
      <p>连接一个本地文件夹，Forge 就能直接读取并修改你的代码。</p>
      <button class="connect-btn" id="connectBtn">
        <svg viewBox="0 0 16 16" width="15" height="15"><path d="M2 4h4l1.5 2H14v7H2z" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>
        连接本地文件夹
      </button>
      <span class="tree-hint">${HAS_FS ? "将请求文件夹访问授权" : "当前环境将载入示例数据"}</span>
    </div>`));
    $("#connectBtn").addEventListener("click", openLocalFolder);
  }

  // ---------- 文件树渲染 ----------
  function renderTree(nodes, container) {
    container.innerHTML = "";
    buildTree(nodes, container);
  }
  function buildTree(nodes, container) {
    nodes.forEach((node) => {
      if (node.type === "folder") {
        const row = el(`<div class="tree-row ${node.open ? "open" : ""}">
          <svg class="chev" viewBox="0 0 16 16" width="12" height="12"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          <span class="name">${esc(node.name)}</span></div>`);
        const kids = el(`<div></div>`);
        kids.style.display = node.open ? "block" : "none";
        row.addEventListener("click", async () => {
          node.open = !node.open;
          row.classList.toggle("open", node.open);
          if (node.open && node.children === null && node.handle) {
            node.children = await readDir(node.handle, node.path);
            buildTree(node.children, kids);
          }
          kids.style.display = node.open ? "block" : "none";
        });
        container.appendChild(row); container.appendChild(kids);
        if (node.children) buildTree(node.children, kids);
      } else {
        const row = el(`<div class="tree-row indent">
          <span class="dot ${node.changed ? "dot-mod" : ""}"></span>
          <span class="name">${esc(node.name)}</span></div>`);
        row.addEventListener("click", () => {
          $("#filetree").querySelectorAll(".tree-row.active").forEach((r) => r.classList.remove("active"));
          row.classList.add("active");
          addRef(node.path);
        });
        container.appendChild(row);
      }
    });
  }

  function addRef(path) {
    const list = $("#refList");
    if (list.querySelector(`[data-p="${CSS.escape(path)}"]`)) return;
    if (list.querySelector(".ref .dot:not(.dot-mod)") && list.textContent.includes("尚未")) list.innerHTML = "";
    list.appendChild(el(`<div class="ref" data-p="${esc(path)}"><span class="dot"></span>${esc(path)}</div>`));
  }

  // ---------- 消息 ----------
  const chat = () => $("#chat");
  const scrollDown = () => (chat().scrollTop = chat().scrollHeight);

  function addUserMsg(text) {
    chat().appendChild(el(`<div class="msg">
      <div class="msg-role"><span class="avatar user">你</span>YOU</div>
      <div class="msg-body"><p>${esc(text)}</p></div></div>`));
    scrollDown();
  }
  function addAIMsg() {
    const m = el(`<div class="msg">
      <div class="msg-role"><span class="avatar ai">AI</span>FORGE</div>
      <div class="msg-body"></div></div>`);
    chat().appendChild(m); scrollDown();
    return $(".msg-body", m);
  }

  function toolCard(tag, detail) {
    const card = el(`<div class="tool-card">
      <div class="tool-head">
        <svg viewBox="0 0 16 16" width="13" height="13" style="opacity:.6"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.4"/></svg>
        <span class="tool-tag">${esc(tag)}</span><span class="tool-status">完成</span>
        <svg class="chev" viewBox="0 0 16 16" width="12" height="12"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      </div>
      <div class="tool-detail"><div class="tool-detail-inner">${esc(detail)}</div></div></div>`);
    $(".tool-head", card).addEventListener("click", () => card.classList.toggle("open"));
    return card;
  }

  // ---------- Diff（核心，支持 inline / split 切换）----------
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

  function renderInline(d) {
    return `<div class="diff-code">` + d.lines.map((l) => {
      const sign = l.kind === "add" ? "+" : l.kind === "del" ? "−" : "";
      return `<div class="diff-line ${l.kind}"><span class="ln">${l.ln}</span><span class="sign">${sign}</span><span class="txt">${esc(l.txt)}</span></div>`;
    }).join("") + `</div>`;
  }

  function renderSplit(d) {
    const left = [], right = [];
    d.lines.forEach((l) => {
      if (l.kind === "ctx") {
        left.push({ k: "ctx", ln: l.ln, t: l.txt }); right.push({ k: "ctx", ln: l.ln, t: l.txt });
      } else if (l.kind === "del") {
        left.push({ k: "del", ln: l.ln, t: l.txt }); right.push({ k: "empty", ln: "", t: "" });
      } else {
        left.push({ k: "empty", ln: "", t: "" }); right.push({ k: "add", ln: l.ln, t: l.txt });
      }
    });
    const col = (rows) => rows.map((r) => {
      const sign = r.k === "add" ? "+" : r.k === "del" ? "−" : "";
      return `<div class="diff-line ${r.k}"><span class="ln">${r.ln}</span><span class="sign">${sign}</span><span class="txt">${esc(r.t)}</span></div>`;
    }).join("");
    return `<div class="diff-split">
      <div class="col"><div class="col-head">修改前</div><div class="diff-code">${col(left)}</div></div>
      <div class="col"><div class="col-head">修改后</div><div class="diff-code">${col(right)}</div></div>
    </div>`;
  }

  function diffCard(d) {
    let mode = "inline";
    const card = el(`<div class="diff">
      <div class="diff-head">
        <svg viewBox="0 0 16 16" width="15" height="15" style="color:var(--text-muted)"><path d="M4 2h6l3 3v9H4z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
        <span class="diff-path">${esc(d.path)}</span>
        <span class="diff-add-n">+${d.add}</span><span class="diff-del-n">−${d.del}</span>
        <div class="diff-actions">
          <span class="diff-mode"><button class="m-inline on">行内</button><button class="m-split">并排</button></span>
          <button class="btn btn-reject">✕ 拒绝</button>
          <button class="btn btn-accept">✓ 接受</button>
        </div>
      </div>
      <div class="diff-views">${renderInline(d)}</div></div>`);

    const views = $(".diff-views", card);
    const setMode = (m) => {
      mode = m;
      views.innerHTML = m === "inline" ? renderInline(d) : renderSplit(d);
      $(".m-inline", card).classList.toggle("on", m === "inline");
      $(".m-split", card).classList.toggle("on", m === "split");
    };
    $(".m-inline", card).addEventListener("click", () => setMode("inline"));
    $(".m-split", card).addEventListener("click", () => setMode("split"));

    const resolve = async (ok) => {
      card.classList.add("resolved");
      $(".diff-actions", card).replaceWith(el(`<span class="diff-resolved-tag ${ok ? "ok" : "no"}">${ok ? "✓ 已接受" : "✕ 已拒绝"}</span>`));
      if (ok) {
        clearChangeDot(d.path);
        // 真连本地时：把新内容写回文件（这里示意，实际内容由后端/AI 提供）
        if (rootHandle && fileHandles.has(d.path)) {
          showToast("已写入本地文件：" + d.path);
        } else {
          showToast("已应用：" + d.path);
        }
      }
    };
    $(".btn-accept", card).addEventListener("click", () => resolve(true));
    $(".btn-reject", card).addEventListener("click", () => resolve(false));
    return card;
  }

  function clearChangeDot(path) {
    $("#filetree").querySelectorAll(".tree-row").forEach((r) => {
      const d = r.querySelector(".dot-mod");
      if (d && r.querySelector(".name") && path.endsWith(r.querySelector(".name").textContent)) d.classList.remove("dot-mod");
    });
  }

  // ---------- 流式 mock ----------
  let streaming = null;
  function streamReply(body, onDone) {
    const text = "好的，我来修改 login.ts 的错误处理：用户不存在时抛出明确的 AuthError，并加上禁用账户检查。";
    const p = el(`<p></p>`); body.appendChild(p);
    const cursor = el(`<span class="cursor"></span>`); p.appendChild(cursor);
    let i = 0;
    $("#sendBtn").hidden = true; $("#stopBtn").hidden = false;
    streaming = setInterval(() => {
      if (i >= text.length) {
        clearInterval(streaming); streaming = null; cursor.remove();
        $("#sendBtn").hidden = false; $("#stopBtn").hidden = true; onDone && onDone(); return;
      }
      cursor.insertAdjacentText("beforebegin", text[i++]); scrollDown();
    }, 16);
  }
  function stopStream() {
    if (streaming) { clearInterval(streaming); streaming = null; }
    $("#sendBtn").hidden = false; $("#stopBtn").hidden = true;
    chat().querySelectorAll(".cursor").forEach((c) => c.remove());
  }

  function send() {
    const input = $("#input"); const text = input.value.trim();
    if (!text || streaming) return;
    addUserMsg(text); input.value = ""; autosize(input);
    const body = addAIMsg();
    streamReply(body, () => {
      body.appendChild(toolCard("读取文件  src/auth/login.ts", "读取 24 行，定位到第 12 行 return null。"));
      body.appendChild(diffCard(MOCK_DIFF)); addRef(MOCK_DIFF.path); scrollDown();
    });
  }

  const autosize = (t) => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 180) + "px"; };

  function showToast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(showToast._t); showToast._t = setTimeout(() => (t.hidden = true), 2200);
  }

  // ---------- 主题切换 ----------
  function toggleTheme() {
    const root = document.documentElement;
    root.setAttribute("data-theme", root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }

  // ---------- 标签 ----------
  function initTabs() {
    const tabs = $("#tabs");
    tabs.addEventListener("click", (e) => {
      const close = e.target.closest(".tab-close");
      if (close) { e.stopPropagation(); const t = close.closest(".tab"); const wasActive = t.classList.contains("active"); t.remove();
        if (wasActive) { const first = tabs.querySelector(".tab"); if (first) first.classList.add("active"); } return; }
      const tab = e.target.closest(".tab");
      if (tab) { tabs.querySelectorAll(".tab").forEach((x) => x.classList.remove("active")); tab.classList.add("active"); }
    });
    $("#tabNew").addEventListener("click", () => {
      tabs.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      const t = el(`<button class="tab active"><span class="tab-title">新会话</span><span class="tab-close" aria-label="关闭">✕</span></button>`);
      tabs.insertBefore(t, $("#tabNew"));
    });
  }

  // ---------- 初始化 ----------
  function init() {
    emptyTree(); // 先显示"连接本地文件夹"空状态

    // 演示用：开场放一段已有对话（含 diff），方便看效果
    loadMockTree();
    addUserMsg("把 login.ts 里用户不存在时的处理改成抛异常，并加上禁用账户检查");
    const body = addAIMsg();
    body.innerHTML = "<p>我已经读取了本地文件，下面是建议的改动。</p>";
    body.appendChild(toolCard("读取文件  src/auth/login.ts", "读取 24 行，定位到第 12 行 return null。"));
    body.appendChild(diffCard(MOCK_DIFF)); addRef(MOCK_DIFF.path);

    $("#openFolderBtn").addEventListener("click", openLocalFolder);
    $("#themeBtn").addEventListener("click", toggleTheme);
    $("#sendBtn").addEventListener("click", send);
    $("#stopBtn").addEventListener("click", stopStream);
    const input = $("#input");
    input.addEventListener("input", () => autosize(input));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    $("#inspectorToggle").addEventListener("click", () => $("#inspector").classList.toggle("collapsed"));
    initTabs();

    console.log("Forge — Local AI IDE ready. FS access:", HAS_FS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
