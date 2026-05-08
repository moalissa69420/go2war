// Ensures direct client-page visits still require password.
// Uses the same auth flow as app/portal.js but runs on the destination page.

(function () {
  const client = String(window.GTW_CLIENT || "").trim().toLowerCase();
  if (!client) return;
  const DEFAULT_API_BASE = "https://go2war-client-portal-api.moodiealissa.workers.dev";

  const ACCESS_PREFIX = "gtw_client_access_";
  const accessKey = ACCESS_PREFIX + client;
  const tokenKey = ACCESS_PREFIX + client + "_token";

  function safeJsonParse(s) {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  function b64urlToJson(str) {
    try {
      const base = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = base + "===".slice((base.length + 3) % 4);
      const json = atob(padded);
      return safeJsonParse(json);
    } catch {
      return null;
    }
  }

  function isTokenExpired(token) {
    // We don't need to verify signature client-side; just use exp to decide if we should re-auth.
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return true;
    const payload = b64urlToJson(parts[1]);
    const exp = payload && typeof payload.exp === "number" ? payload.exp : 0;
    if (!exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return now >= exp - 15; // small skew
  }

  function clearAccess() {
    try {
      localStorage.removeItem(accessKey);
      localStorage.removeItem(tokenKey);
      sessionStorage.removeItem(accessKey);
      sessionStorage.removeItem(tokenKey);
    } catch {
      // ignore
    }
  }

  function getApiBase() {
    return window.GTW_API_BASE || localStorage.getItem("GTW_API_BASE") || DEFAULT_API_BASE;
  }

  function haveAccess() {
    try {
      const ok = sessionStorage.getItem(accessKey) === "true" || localStorage.getItem(accessKey) === "true";
      const token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey) || "";
      if (!ok || !token) return false;
      if (isTokenExpired(token)) {
        clearAccess();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function setAccess(token) {
    try {
      localStorage.setItem(accessKey, "true");
      localStorage.setItem(tokenKey, token);
      sessionStorage.setItem(accessKey, "true");
      sessionStorage.setItem(tokenKey, token);
    } catch {
      // ignore
    }
  }

  async function requestToken(password) {
    const apiBase = getApiBase();
    if (!apiBase) throw new Error("missing_api_base");
    const url = apiBase.replace(/\/$/, "") + "/api/auth";
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client, password }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text;
      try {
        const j = JSON.parse(text);
        if (j && typeof j === "object" && "error" in j) detail = String(j.error);
      } catch {
        // ignore
      }
      throw new Error(`auth_failed:${res.status}:${detail || "unknown"}`);
    }
    const json = await res.json();
    if (!json?.token) throw new Error("missing_token");
    return json.token;
  }

  async function guard() {
    if (haveAccess()) return;

    const input = prompt(`Enter password for ${client}:`);
    if (input === null) {
      window.location.href = "/clients/";
      return;
    }

    try {
      const token = await requestToken(input.trim());
      setAccess(token);
      // Reload so scripts that read token at startup can sync.
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Password failed for "${client}".\n\n${msg}\n\nTry hard refresh (Cmd+Shift+R).`);
      window.location.href = "/clients/";
    }
  }

  guard();
})();

