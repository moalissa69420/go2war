// AlphaStyle Ad Library: uploads to Cloudflare R2 via Worker and renders a grid.

(function () {
  const client = String(window.GTW_CLIENT || "").trim().toLowerCase();
  if (!client) return;

  const ACCESS_PREFIX = "gtw_client_access_";
  const tokenKey = ACCESS_PREFIX + client + "_token";

  function getToken() {
    try {
      return sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey) || "";
    } catch {
      return "";
    }
  }

  const apiBase = window.GTW_API_BASE || localStorage.getItem("GTW_API_BASE") || "";
  const uploader = document.getElementById("uploader");
  const grid = document.getElementById("assetGrid");
  const media = document.getElementById("media");
  const statusEl = document.getElementById("status");

  if (!apiBase || !grid || !media) return;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
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
    if (!res.ok) throw new Error("batch_failed");
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
    if (!res.ok) throw new Error("flag_failed");
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
    if (!res.ok) throw new Error("comment_failed");
    return await res.json();
  }

  function isVideo(item) {
    return String(item.contentType || "").startsWith("video/");
  }

  function render(items, summariesByAssetId) {
    const token = getToken();
    if (!items?.length) {
      grid.innerHTML = `<div class="asset-card"><div class="meta">No assets yet. Use Upload.</div></div>`;
      return;
    }

    grid.innerHTML = items
      .map((item) => {
        const assetId = `r2:${item.key}`;
        const summary = summariesByAssetId?.[assetId] || {};
        const approved = summary.approved === true;
        const notes = Array.isArray(summary.notes) ? summary.notes : [];
        const notePreview = notes.slice(0, 2).map((t) => `<div class="asset-note">${escapeHtml(t)}</div>`).join("");
        const more = notes.length > 2 ? `<div class="asset-note meta">+${notes.length - 2} more</div>` : "";
        const url = `${apiBase.replace(/\/$/, "")}${item.url}&t=${encodeURIComponent(token)}`;
        const label = (item.name || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
        const del = `<button type="button" data-delete-key="${item.key}" style="margin-top:6px;">Delete</button>`;
        const approveBtn = `<button type="button" class="asset-approve ${approved ? "is-approved" : ""}" data-approve-asset="${assetId}" aria-label="Approve">${approved ? "✓ Approved" : "✓ Approve"}</button>`;
        const noteBtn = `<button type="button" class="asset-note-btn" data-note-asset="${assetId}">Add note</button>`;
        if (isVideo(item)) {
          return `
            <div class="asset-card">
              <a href="#" data-asset-url="${url}" data-asset-key="${item.key}" data-kind="video">
                <video src="${url}" muted playsinline preload="metadata" style="max-width:100%; display:block;"></video>
                <div class="meta" style="margin-top:6px;">${label}</div>
              </a>
              <div class="asset-card-actions">${approveBtn}${noteBtn}</div>
              <div class="asset-notes">${notePreview}${more}</div>
              ${del}
            </div>
          `;
        }
        return `
          <div class="asset-card">
            <a href="#" data-asset-url="${url}" data-asset-key="${item.key}" data-kind="image">
              <img src="${url}" alt="${label}" style="max-width:100%; display:block;" />
              <div class="meta" style="margin-top:6px;">${label}</div>
            </a>
            <div class="asset-card-actions">${approveBtn}${noteBtn}</div>
            <div class="asset-notes">${notePreview}${more}</div>
            ${del}
          </div>
        `;
      })
      .join("");

    grid.querySelectorAll("a[data-asset-url]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const url = a.getAttribute("data-asset-url");
        const kind = a.getAttribute("data-kind");
        if (!url) return;

        const key = a.getAttribute("data-asset-key") || "";

        // MVP: we annotate images. For video, we just open in a new tab for now.
        if (kind === "video") {
          window.open(url, "_blank", "noreferrer");
          return;
        }

        media.setAttribute("src", url);
        // Save notes per creative (per asset key)
        if (key && window.GTW_ANNOTATE?.setAssetId) {
          window.GTW_ANNOTATE.setAssetId(`r2:${key}`);
        }
      });
    });

    grid.querySelectorAll("button[data-approve-asset]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const assetId = btn.getAttribute("data-approve-asset") || "";
        if (!assetId) return;
        const nextApproved = !btn.classList.contains("is-approved");
        try {
          btn.disabled = true;
          await setApproved(assetId, nextApproved);
          btn.classList.toggle("is-approved", nextApproved);
          btn.textContent = nextApproved ? "✓ Approved" : "✓ Approve";
        } catch {
          alert("Approve failed");
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
        const text = prompt("Add a note for this creative:");
        if (!text || !String(text).trim()) return;
        try {
          btn.disabled = true;
          await addComment(assetId, String(text).trim());
          await refresh();
        } catch {
          alert("Note failed");
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
      render(items, sums.items || {});
    } catch (e) {
      setStatus("Failed to load assets");
    }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  async function uploadFile(file) {
    const token = getToken();
    if (!token) throw new Error("no_token");

    const fd = new FormData();
    fd.append("client", client);
    fd.append("file", file, file.name);

    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/assets/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "upload_failed");
    }
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

  if (uploader) {
    uploader.addEventListener("change", async () => {
      const files = Array.from(uploader.files || []);
      if (!files.length) return;
      setStatus(`Uploading ${files.length}…`);
      for (const f of files) {
        await uploadFile(f);
      }
      uploader.value = "";
      setStatus("Uploaded");
      setTimeout(() => setStatus(""), 1200);
      await refresh();
    });
  }

  refresh();
})();

