// AlphaStyle Klaviyo: per-template uploads (slot prefix in filename), same approve/notes API as ad library.

(function () {
  const client = String(window.GTW_CLIENT || "").trim().toLowerCase();
  if (!client) return;

  const ACCESS_PREFIX = "gtw_client_access_";
  const tokenKey = ACCESS_PREFIX + client + "_token";

  const KLAVIYO_BASE = "../../../ALPHASTYLE/";

  const FLOWS = [
    {
      title: "Welcome Series · 5 Emails",
      slots: [
        { id: "welcome-01-brand-welcome", label: "Welcome 01 · Brand Welcome" },
        { id: "welcome-02-founder-note", label: "Welcome 02 · Founder Note" },
        { id: "welcome-03-bestsellers", label: "Welcome 03 · Bestsellers" },
        { id: "welcome-04-welcome10-offer", label: "Welcome 04 · WELCOME10 Offer" },
        { id: "welcome-05-final-nudge", label: "Welcome 05 · Final Nudge" },
      ],
    },
    {
      title: "Abandoned Cart · 3 Emails",
      slots: [
        { id: "cart-01-gentle-reminder", label: "Cart 01 · Gentle Reminder" },
        { id: "cart-02-social-proof", label: "Cart 02 · Social Proof" },
        { id: "cart-03-discount-lever", label: "Cart 03 · CART10 Lever" },
      ],
    },
    {
      title: "Post-Purchase · 4 Emails",
      slots: [
        { id: "postpurchase-01-confirmation", label: "Post-Purchase 01 · Confirmation" },
        { id: "postpurchase-02-shipping", label: "Post-Purchase 02 · Shipping" },
        { id: "postpurchase-03-delivered", label: "Post-Purchase 03 · Delivered" },
        { id: "postpurchase-04-review-request", label: "Post-Purchase 04 · Review Request" },
      ],
    },
    {
      title: "Win-Back · 4 Emails",
      slots: [
        { id: "winback-01-check-in", label: "Win-Back 01 · Check-In" },
        { id: "winback-02-what-changed", label: "Win-Back 02 · What Changed" },
        { id: "winback-03-comeback-offer", label: "Win-Back 03 · COMEBACK15" },
        { id: "winback-04-last-touch", label: "Win-Back 04 · Last Touch" },
      ],
    },
  ];

  const KNOWN_SLOTS = new Set(FLOWS.flatMap((f) => f.slots.map((s) => s.id)));

  function getToken() {
    try {
      return sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey) || "";
    } catch {
      return "";
    }
  }

  const apiBase = window.GTW_API_BASE || localStorage.getItem("GTW_API_BASE") || "";
  const root = document.getElementById("klaviyoAssetPortal");
  const statusEl = document.getElementById("status");

  if (!apiBase || !root) return;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function escapeAttr(s) {
    return String(s || "").replace(/["&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function slotFromName(name) {
    const tail = String(name || "").replace(/^\d+-/, "");
    const sep = tail.indexOf("__");
    if (sep === -1) return "";
    return tail.slice(0, sep);
  }

  function isVideo(item) {
    return String(item.contentType || "").startsWith("video/");
  }

  async function listAssets() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/assets?client=${encodeURIComponent(client)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("list_failed");
    return await res.json();
  }

  async function batchSummaries(assetIds) {
    const token = getToken();
    if (!token) throw new Error("no_token");
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/annotations/batch`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ client, assets: assetIds }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `batch_failed:${res.status}`);
    }
    return await res.json();
  }

  async function setApproved(assetId, approved) {
    const token = getToken();
    if (!token) throw new Error("no_token");
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/annotations/flag`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ client, asset: assetId, approved: Boolean(approved) }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `flag_failed:${res.status}`);
    }
    return await res.json();
  }

  async function addComment(assetId, text) {
    const token = getToken();
    if (!token) throw new Error("no_token");
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/annotations/comment`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ client, asset: assetId, text: String(text || "") }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `comment_failed:${res.status}`);
    }
    return await res.json();
  }

  async function deleteComment(assetId, id) {
    const token = getToken();
    if (!token) throw new Error("no_token");
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/annotations/comment/delete`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ client, asset: assetId, id: String(id || "") }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `comment_delete_failed:${res.status}`);
    }
    return await res.json();
  }

  async function deleteAsset(key) {
    const token = getToken();
    if (!token) throw new Error("no_token");
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/assets/delete`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error("delete_failed");
  }

  async function uploadFileRaw(file) {
    const token = getToken();
    if (!token) throw new Error("no_token");
    const base = apiBase.replace(/\/$/, "");
    const putUrl = `${base}/api/assets/upload?client=${encodeURIComponent(client)}&name=${encodeURIComponent(file.name || "upload")}`;
    let res = await fetch(putUrl, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": file.type || "application/octet-stream",
      },
      body: file,
    });
    if (res.status === 405 || res.status === 415 || res.status === 404) {
      const fd = new FormData();
      fd.append("client", client);
      fd.append("file", file, file.name);
      res = await fetch(`${base}/api/assets/upload`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "upload_failed");
    }
  }

  function buildLayout() {
    root.innerHTML = FLOWS.map((flow) => {
      const blocks = flow.slots
        .map((s) => {
          const vid = escapeAttr(s.id);
          return `
      <div class="klaviyo-slot" data-slot-wrap="${vid}">
        <div class="klaviyo-slot-head">
          <strong>${escapeHtml(s.label)}</strong>
          <a href="${KLAVIYO_BASE}visual/${vid}.html" target="_blank" rel="noreferrer">Open visual</a>
          <span aria-hidden="true" style="color:var(--muted);">·</span>
          <a href="${KLAVIYO_BASE}klaviyo/${vid}.html" target="_blank" rel="noreferrer">Open Klaviyo HTML</a>
        </div>
        <div class="klaviyo-slot-body">
          <div class="klaviyo-slot-preview">
            <div class="klaviyo-slot-preview-label">Design preview (visual template)</div>
            <div class="klaviyo-slot-preview-frame">
              <iframe
                class="klaviyo-slot-iframe"
                title="${escapeAttr(s.label)} visual mockup"
                src="${KLAVIYO_BASE}visual/${vid}.html"
                loading="lazy"
              ></iframe>
            </div>
            <p class="klaviyo-slot-preview-meta">
              Uploads for this row are stored as <code>${escapeHtml(s.id)}__yourfile.jpg</code> and map to this email’s hero / product art in Klaviyo.
            </p>
          </div>
          <div class="klaviyo-slot-actions">
            <div class="klaviyo-slot-upload-row">
              <label>
                <span>Upload creative</span>
                <input type="file" accept="image/*,image/gif,video/*" multiple data-kl-upload="${vid}" />
              </label>
            </div>
            <div class="meta" style="margin-bottom:8px;">Client assets · approve each file and add notes (same as ad library).</div>
            <div class="asset-grid" data-slot-grid="${vid}"></div>
          </div>
        </div>
      </div>`;
        })
        .join("");
      return `<section class="klaviyo-flow"><h3>${escapeHtml(flow.title)}</h3>${blocks}</section>`;
    }).join("");
  }

  function renderGrid(grid, items, summariesByAssetId) {
    const token = getToken();
    if (!items?.length) {
      grid.innerHTML = `<div class="asset-card"><div class="meta">No asset for this email yet. Upload above.</div></div>`;
      return;
    }

    grid.innerHTML = items
      .map((item) => {
        const assetId = `r2:${item.key}`;
        const summary = summariesByAssetId?.[assetId] || {};
        const approved = summary.approved === true;
        const comments = Array.isArray(summary.comments) ? summary.comments : [];
        const notes = Array.isArray(summary.notes) ? summary.notes : [];
        const preview = (comments.length ? comments.map((c) => c?.text).filter(Boolean) : notes).slice(0, 3);
        const notePreview = preview
          .map((t, idx) => {
            const c = comments[idx];
            const del = c?.id
              ? `<button type="button" class="asset-note-del" data-note-del-asset="${assetId}" data-note-del-id="${escapeAttr(c.id)}" aria-label="Delete note">×</button>`
              : "";
            return `<div class="asset-note-row"><div class="asset-note">${escapeHtml(t)}</div>${del}</div>`;
          })
          .join("");
        const more =
          (comments.length ? comments.length : notes.length) > 3 ? `<div class="asset-note meta">+more</div>` : "";
        const url = `${apiBase.replace(/\/$/, "")}${item.url}&t=${encodeURIComponent(token)}`;
        const label = (item.name || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
        const del = `<button type="button" data-delete-key="${escapeAttr(item.key)}" style="margin-top:6px;">Delete</button>`;
        const approveBtn = `<button type="button" class="asset-approve ${approved ? "is-approved" : ""}" data-approve-asset="${assetId}" aria-label="Approve">${approved ? "✓ Approved" : "✓ Approve"}</button>`;
        const noteBtn = `<button type="button" class="asset-note-btn" data-note-asset="${assetId}">Add note</button>`;
        const approvedCardClass = approved ? " is-approved" : "";
        if (isVideo(item)) {
          return `
            <div class="asset-card${approvedCardClass}">
              <a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">
                <div class="asset-thumb">
                  <video data-thumb-video="1" src="${escapeAttr(url)}" muted playsinline preload="metadata"></video>
                </div>
                <div class="meta" style="margin-top:6px;">${label}</div>
              </a>
              <div class="asset-card-actions">${approveBtn}${noteBtn}</div>
              <div class="asset-notes">${notePreview}${more}</div>
              ${del}
            </div>`;
        }
        return `
          <div class="asset-card${approvedCardClass}">
            <a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">
              <div class="asset-thumb">
                <img src="${escapeAttr(url)}" alt="${label}" loading="lazy" />
              </div>
              <div class="meta" style="margin-top:6px;">${label}</div>
            </a>
            <div class="asset-card-actions">${approveBtn}${noteBtn}</div>
            <div class="asset-notes">${notePreview}${more}</div>
            ${del}
          </div>`;
      })
      .join("");

    grid.querySelectorAll("video[data-thumb-video]").forEach((v) => {
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.addEventListener(
        "loadedmetadata",
        () => {
          try {
            v.currentTime = Math.min(0.1, (v.duration || 0) * 0.02);
          } catch {
            // ignore
          }
        },
        { once: true }
      );
    });

    grid.querySelectorAll("button[data-approve-asset]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const assetId = btn.getAttribute("data-approve-asset") || "";
        if (!assetId) return;
        const nextApproved = !btn.classList.contains("is-approved");
        const card = btn.closest(".asset-card");
        try {
          btn.disabled = true;
          await setApproved(assetId, nextApproved);
          btn.classList.toggle("is-approved", nextApproved);
          btn.textContent = nextApproved ? "✓ Approved" : "✓ Approve";
          if (card) card.classList.toggle("is-approved", nextApproved);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          alert(`Approve failed\n\n${msg}`);
        } finally {
          btn.disabled = false;
        }
      });
    });

    grid.querySelectorAll("button[data-note-asset]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const assetId = btn.getAttribute("data-note-asset") || "";
        if (!assetId) return;
        const text = prompt("Add a note for this asset:");
        if (!text || !String(text).trim()) return;
        try {
          btn.disabled = true;
          await addComment(assetId, String(text).trim());
          await refresh();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          alert(`Note failed\n\n${msg}`);
        } finally {
          btn.disabled = false;
        }
      });
    });

    grid.querySelectorAll("button[data-note-del-id]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const assetId = btn.getAttribute("data-note-del-asset") || "";
        const id = btn.getAttribute("data-note-del-id") || "";
        if (!assetId || !id) return;
        try {
          btn.disabled = true;
          await deleteComment(assetId, id);
          await refresh();
        } catch {
          alert("Delete note failed");
        } finally {
          btn.disabled = false;
        }
      });
    });

    grid.querySelectorAll("button[data-delete-key]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const key = btn.getAttribute("data-delete-key");
        if (!key) return;
        if (!confirm("Delete this asset?")) return;
        try {
          await deleteAsset(key);
          await refresh();
        } catch {
          alert("Delete failed");
        }
      });
    });
  }

  async function refresh() {
    try {
      const token = getToken();
      if (!token) {
        setStatus("Enter password to load assets…");
        setTimeout(() => refresh(), 500);
        return;
      }
      const data = await listAssets();
      const items = data.items || [];
      const assetIds = items.map((it) => `r2:${it.key}`);
      const sums = assetIds.length ? await batchSummaries(assetIds).catch(() => ({ items: {} })) : { items: {} };
      const summaryMap = sums.items || {};

      const bySlot = new Map();
      for (const id of KNOWN_SLOTS) bySlot.set(id, []);

      for (const it of items) {
        const slot = slotFromName(it.name);
        if (slot && KNOWN_SLOTS.has(slot)) {
          bySlot.get(slot).push(it);
        }
      }

      for (const id of KNOWN_SLOTS) {
        const list = bySlot.get(id) || [];
        list.sort((a, b) => (b.uploaded || "").localeCompare(a.uploaded || ""));
        const grid = root.querySelector(`[data-slot-grid="${id}"]`);
        if (grid) renderGrid(grid, list, summaryMap);
      }

      setStatus("");
    } catch {
      setStatus("Failed to load assets");
    }
  }

  root.addEventListener("change", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.matches("[data-kl-upload]")) return;
    const slotId = t.getAttribute("data-kl-upload") || "";
    const files = Array.from(t.files || []);
    t.value = "";
    if (!slotId || !files.length) return;
    setStatus(`Uploading ${files.length}…`);
    try {
      for (const f of files) {
        const renamed = new File([f], `${slotId}__${f.name}`, { type: f.type });
        await uploadFileRaw(renamed);
      }
      setStatus("Uploaded");
      setTimeout(() => setStatus(""), 1500);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Upload failed\n\n${msg}`);
      setStatus("");
    }
  });

  buildLayout();
  refresh();
})();
