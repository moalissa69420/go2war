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

  function isVideo(item) {
    return String(item.contentType || "").startsWith("video/");
  }

  function render(items) {
    const token = getToken();
    if (!items?.length) {
      grid.innerHTML = `<div class="asset-card"><div class="meta">No assets yet. Use Upload.</div></div>`;
      return;
    }

    grid.innerHTML = items
      .map((item) => {
        const url = `${apiBase.replace(/\/$/, "")}${item.url}&t=${encodeURIComponent(token)}`;
        const label = (item.name || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
        if (isVideo(item)) {
          return `
            <div class="asset-card">
              <a href="#" data-asset-url="${url}" data-kind="video">
                <video src="${url}" muted playsinline preload="metadata" style="max-width:100%; display:block;"></video>
                <div class="meta" style="margin-top:6px;">${label}</div>
              </a>
            </div>
          `;
        }
        return `
          <div class="asset-card">
            <a href="#" data-asset-url="${url}" data-kind="image">
              <img src="${url}" alt="${label}" style="max-width:100%; display:block;" />
              <div class="meta" style="margin-top:6px;">${label}</div>
            </a>
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

        // MVP: we annotate images. For video, we just open in a new tab for now.
        if (kind === "video") {
          window.open(url, "_blank", "noreferrer");
          return;
        }

        media.setAttribute("src", url);
        // Keep same asset id for now (single shared board). We can evolve to per-asset ids later.
      });
    });
  }

  async function refresh() {
    try {
      const data = await listAssets();
      render(data.items || []);
    } catch {
      // ignore
    }
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

