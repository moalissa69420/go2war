// Ensures direct client-page visits still require password.
// Uses the same auth flow as app/portal.js but runs on the destination page.

(function () {
  const client = String(window.GTW_CLIENT || "").trim().toLowerCase();
  if (!client) return;

  const ACCESS_PREFIX = "gtw_client_access_";
  const accessKey = ACCESS_PREFIX + client;
  const tokenKey = ACCESS_PREFIX + client + "_token";

  function getApiBase() {
    return window.GTW_API_BASE || localStorage.getItem("GTW_API_BASE") || "";
  }

  function haveAccess() {
    try {
      return sessionStorage.getItem(accessKey) === "true" && Boolean(sessionStorage.getItem(tokenKey));
    } catch {
      return false;
    }
  }

  function setAccess(token) {
    try {
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
    if (!res.ok) throw new Error("auth_failed");
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
      // Stay on page; other scripts will read sessionStorage.
    } catch {
      alert("Incorrect password");
      window.location.href = "/clients/";
    }
  }

  guard();
})();

