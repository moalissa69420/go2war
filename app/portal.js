// Client-side password prompt, mo-site style.
// We still call an API to get a token so annotations can be shared/persistent.

(function () {
  const ACCESS_PREFIX = "gtw_client_access_";
  const FALLBACK_PASSWORD = "g2w";
  const DEFAULT_API_BASE = "https://go2war-client-portal-api.moodiealissa.workers.dev";

  function getClientKey(slug) {
    return ACCESS_PREFIX + slug;
  }

  function haveAccess(slug) {
    try {
      const k = getClientKey(slug);
      const tk = k + "_token";
      const ok = sessionStorage.getItem(k) === "true" || localStorage.getItem(k) === "true";
      const token = sessionStorage.getItem(tk) || localStorage.getItem(tk) || "";
      return ok && Boolean(token);
    } catch {
      return false;
    }
  }

  function setAccess(slug, token) {
    try {
      const k = getClientKey(slug);
      const tk = k + "_token";
      // localStorage lets it work across tabs in the same browser
      localStorage.setItem(k, "true");
      localStorage.setItem(tk, token);
      // sessionStorage keeps behavior consistent even if localStorage is blocked
      sessionStorage.setItem(k, "true");
      sessionStorage.setItem(tk, token);
    } catch {
      // ignore
    }
  }

  function getApiBase() {
    return window.GTW_API_BASE || localStorage.getItem("GTW_API_BASE") || DEFAULT_API_BASE;
  }

  async function requestToken(slug, password) {
    const apiBase = getApiBase();
    const url = (apiBase ? apiBase.replace(/\/$/, "") : "") + "/api/auth";

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client: slug, password }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Auth failed");
    }
    const json = await res.json();
    if (!json?.token) throw new Error("Missing token");
    return json.token;
  }

  async function guardLink(link) {
    const slug = link.getAttribute("data-client");
    const dest = link.getAttribute("data-dest") || link.getAttribute("href");
    if (!slug || !dest) return;

    link.addEventListener("click", async (e) => {
      e.preventDefault();
      if (haveAccess(slug)) {
        window.location.href = dest;
        return;
      }

      const input = prompt(`Enter password for ${slug}:`);
      if (input === null) return;
      const password = input.trim();

      try {
        // If API base isn't configured yet, allow a simple local fallback so
        // the portal works immediately during setup.
        const apiBase = getApiBase();
        const token = apiBase ? await requestToken(slug, password) : password === FALLBACK_PASSWORD ? "local" : "";
        if (!token) throw new Error("Auth failed");
        setAccess(slug, token);
        window.location.href = dest;
      } catch (err) {
        alert("Incorrect password");
      }
    });
  }

  document.querySelectorAll("a[data-client]").forEach((a) => guardLink(a));
})();

