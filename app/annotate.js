// Minimal shared annotation system (circle, rect highlight, note pin).
// Stores shapes in normalized coordinates (0..1) relative to displayed media box.

(function () {
  const client = window.GTW_CLIENT;
  const assetId = window.GTW_ASSET_ID;
  if (!client || !assetId) return;

  const canvas = document.getElementById("canvas");
  const viewer = document.getElementById("viewer");
  const media = document.getElementById("media");
  const statusEl = document.getElementById("status");
  const noteListEl = document.getElementById("noteList");

  const ACCESS_PREFIX = "gtw_client_access_";
  const tokenKey = ACCESS_PREFIX + client + "_token";
  const token = (() => {
    try {
      return sessionStorage.getItem(tokenKey) || "";
    } catch {
      return "";
    }
  })();

  const apiBase = window.GTW_API_BASE || localStorage.getItem("GTW_API_BASE") || "";
  const apiUrl = (apiBase ? apiBase.replace(/\/$/, "") : "") + "/api/annotations";

  const ctx = canvas.getContext("2d");
  const state = {
    tool: "select",
    shapes: [],
    selectedId: null,
    drag: null,
    dirty: false,
  };

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function pxRect() {
    const r = media.getBoundingClientRect();
    const vr = viewer.getBoundingClientRect();
    return {
      x: r.left - vr.left,
      y: r.top - vr.top,
      w: r.width,
      h: r.height,
    };
  }

  function resizeCanvas() {
    const r = viewer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function toNorm(e) {
    const vr = viewer.getBoundingClientRect();
    const p = pxRect();
    const x = e.clientX - vr.left - p.x;
    const y = e.clientY - vr.top - p.y;
    return {
      nx: p.w ? x / p.w : 0,
      ny: p.h ? y / p.h : 0,
    };
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function hitTest(normPt) {
    // Simple bbox hit test with small tolerance.
    const tol = 0.02;
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const s = state.shapes[i];
      if (s.type === "circle") {
        const dx = normPt.nx - s.cx;
        const dy = normPt.ny - s.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(d - s.r) <= tol || d <= s.r) return s.id;
      } else if (s.type === "rect") {
        if (
          normPt.nx >= Math.min(s.x1, s.x2) - tol &&
          normPt.nx <= Math.max(s.x1, s.x2) + tol &&
          normPt.ny >= Math.min(s.y1, s.y2) - tol &&
          normPt.ny <= Math.max(s.y1, s.y2) + tol
        ) {
          return s.id;
        }
      } else if (s.type === "note") {
        if (Math.abs(normPt.nx - s.x) <= tol && Math.abs(normPt.ny - s.y) <= tol) return s.id;
      }
    }
    return null;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const p = pxRect();
    // darken outside image area a bit to show boundaries
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.fillRect(0, 0, p.x, canvas.height);
    ctx.fillRect(p.x + p.w, 0, canvas.width, canvas.height);
    ctx.fillRect(p.x, 0, p.w, p.y);
    ctx.fillRect(p.x, p.y + p.h, p.w, canvas.height);
    ctx.restore();

    function toPxX(nx) {
      return p.x + nx * p.w;
    }
    function toPxY(ny) {
      return p.y + ny * p.h;
    }

    state.shapes.forEach((s) => {
      const selected = s.id === state.selectedId;
      const stroke = selected ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.75)";

      if (s.type === "circle") {
        ctx.beginPath();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.arc(toPxX(s.cx), toPxY(s.cy), s.r * p.w, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === "rect") {
        const x = toPxX(Math.min(s.x1, s.x2));
        const y = toPxY(Math.min(s.y1, s.y2));
        const w = Math.abs(s.x2 - s.x1) * p.w;
        const h = Math.abs(s.y2 - s.y1) * p.h;
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(x, y, w, h);
      } else if (s.type === "note") {
        const x = toPxX(s.x);
        const y = toPxY(s.y);
        ctx.fillStyle = selected ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.75)";
        ctx.beginPath();
        ctx.arc(x, y, selected ? 7 : 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function renderNotes() {
    if (!noteListEl) return;
    const notes = state.shapes.filter((s) => s.type === "note");
    if (!notes.length) {
      noteListEl.innerHTML = "<div class=\"subtitle\">No notes yet.</div>";
      return;
    }

    noteListEl.innerHTML = notes
      .map((n, idx) => {
        const text = (n.text || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
        const sel = n.id === state.selectedId ? "style=\"text-decoration:underline;\"" : "";
        return `<div class="note-item"><a href="#" data-note="${n.id}" ${sel}><strong>${idx + 1}.</strong> ${text || "(empty note)"}</a></div>`;
      })
      .join("");

    noteListEl.querySelectorAll("a[data-note]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        state.selectedId = a.getAttribute("data-note");
        draw();
      });
    });
  }

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll("button[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tool") === tool);
    });
  }

  function addShape(s) {
    state.shapes.push(s);
    state.selectedId = s.id;
    state.dirty = true;
    renderNotes();
    draw();
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    const before = state.shapes.length;
    state.shapes = state.shapes.filter((s) => s.id !== state.selectedId);
    if (state.shapes.length !== before) {
      state.selectedId = null;
      state.dirty = true;
      renderNotes();
      draw();
    }
  }

  function undo() {
    if (!state.shapes.length) return;
    const removed = state.shapes.pop();
    if (removed?.id === state.selectedId) state.selectedId = null;
    state.dirty = true;
    renderNotes();
    draw();
  }

  async function loadRemote() {
    if (!token) {
      setStatus("No access token. Go back and enter password.");
      return;
    }
    setStatus("Loading…");
    const res = await fetch(`${apiUrl}?client=${encodeURIComponent(client)}&asset=${encodeURIComponent(assetId)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setStatus("Load failed");
      return;
    }
    const json = await res.json();
    state.shapes = Array.isArray(json?.shapes) ? json.shapes : [];
    state.selectedId = null;
    state.dirty = false;
    renderNotes();
    draw();
    setStatus("Loaded");
    setTimeout(() => setStatus(""), 1200);
  }

  async function saveRemote() {
    if (!token) {
      alert("No access token. Go back and enter password.");
      return;
    }
    setStatus("Saving…");
    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ client, asset: assetId, shapes: state.shapes }),
    });
    if (!res.ok) {
      setStatus("Save failed");
      return;
    }
    state.dirty = false;
    setStatus("Saved");
    setTimeout(() => setStatus(""), 1200);
  }

  function onPointerDown(e) {
    const { nx, ny } = toNorm(e);
    const pt = { nx: clamp01(nx), ny: clamp01(ny) };

    if (state.tool === "select") {
      const hit = hitTest(pt);
      state.selectedId = hit;
      if (hit) {
        state.drag = { kind: "move", id: hit, start: pt };
      }
      draw();
      renderNotes();
      return;
    }

    if (state.tool === "note") {
      const text = prompt("Note:");
      if (text === null) return;
      addShape({ id: uid(), type: "note", x: pt.nx, y: pt.ny, text: text.trim() });
      return;
    }

    if (state.tool === "circle") {
      const id = uid();
      const s = { id, type: "circle", cx: pt.nx, cy: pt.ny, r: 0.0001 };
      addShape(s);
      state.drag = { kind: "circle", id, start: pt };
      return;
    }

    if (state.tool === "rect") {
      const id = uid();
      const s = { id, type: "rect", x1: pt.nx, y1: pt.ny, x2: pt.nx, y2: pt.ny };
      addShape(s);
      state.drag = { kind: "rect", id, start: pt };
      return;
    }
  }

  function onPointerMove(e) {
    if (!state.drag) return;
    const { nx, ny } = toNorm(e);
    const pt = { nx: clamp01(nx), ny: clamp01(ny) };

    const s = state.shapes.find((x) => x.id === state.drag.id);
    if (!s) return;

    if (state.drag.kind === "circle" && s.type === "circle") {
      const dx = pt.nx - s.cx;
      const dy = pt.ny - s.cy;
      s.r = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
      state.dirty = true;
      draw();
      return;
    }

    if (state.drag.kind === "rect" && s.type === "rect") {
      s.x2 = pt.nx;
      s.y2 = pt.ny;
      state.dirty = true;
      draw();
      return;
    }

    if (state.drag.kind === "move") {
      // move only note pins for MVP
      if (s.type !== "note") return;
      s.x = pt.nx;
      s.y = pt.ny;
      state.dirty = true;
      draw();
      renderNotes();
      return;
    }
  }

  function onPointerUp() {
    state.drag = null;
  }

  function bindUI() {
    document.querySelectorAll("button[data-tool]").forEach((b) => {
      b.addEventListener("click", () => setTool(b.getAttribute("data-tool")));
    });
    document.querySelectorAll("button[data-action]").forEach((b) => {
      const a = b.getAttribute("data-action");
      if (a === "delete") b.addEventListener("click", deleteSelected);
      if (a === "undo") b.addEventListener("click", undo);
      if (a === "save") b.addEventListener("click", saveRemote);
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("resize", resizeCanvas);
    media.addEventListener("load", resizeCanvas);
  }

  bindUI();
  resizeCanvas();
  loadRemote();
})();

