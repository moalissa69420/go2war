/**
 * Cloudflare Worker API for shared-password auth + shared annotations.
 *
 * Endpoints:
 * - POST /api/auth        { client, password } -> { token, expiresIn }
 * - GET  /api/annotations?client=...&asset=...  (Bearer token) -> { shapes: [] }
 * - PUT  /api/annotations { client, asset, shapes } (Bearer token) -> { ok: true }
 */

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
      ...extraHeaders,
    },
  });
}

function bad(status, error) {
  return json({ error }, status);
}

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(str) {
  const base = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(base);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSHA256(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
}

async function signToken(payload, secret) {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const sig = b64url(await hmacSHA256(secret, data));
  return `${data}.${sig}`;
}

async function verifyToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("bad_token");
  const [h, b, s] = parts;
  const data = `${h}.${b}`;
  const expected = b64url(await hmacSHA256(secret, data));
  if (expected !== s) throw new Error("bad_sig");
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(b)));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("expired");
  return payload;
}

function getClientPassword(env, slug) {
  const key = `CLIENT_PASSWORD_${String(slug || "").toUpperCase()}`;
  return env[key] || "";
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });

    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/api/auth" && req.method === "POST") {
      if (!env.GTW_TOKEN_SECRET) return bad(500, "missing_GTW_TOKEN_SECRET");
      let parsed;
      try {
        parsed = await req.json();
      } catch {
        return bad(400, "bad_json");
      }
      const client = String(parsed.client || "").trim().toLowerCase();
      const password = String(parsed.password || "").trim();
      if (!client || !password) return bad(400, "missing_fields");

      const expected = getClientPassword(env, client);
      if (!expected) return bad(403, "unknown_client");
      if (password !== expected) return bad(403, "wrong_password");

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = 60 * 60 * 8;
      const token = await signToken({ client, iat: now, exp: now + expiresIn }, env.GTW_TOKEN_SECRET);
      return json({ token, client, expiresIn });
    }

    if (path === "/api/annotations") {
      if (!env.GTW_TOKEN_SECRET) return bad(500, "missing_GTW_TOKEN_SECRET");

      const auth = req.headers.get("authorization") || "";
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return bad(401, "unauthorized");

      let tokenPayload;
      try {
        tokenPayload = await verifyToken(m[1], env.GTW_TOKEN_SECRET);
      } catch {
        return bad(401, "unauthorized");
      }

      if (req.method === "GET") {
        const client = String(url.searchParams.get("client") || "").trim().toLowerCase();
        const asset = String(url.searchParams.get("asset") || "").trim();
        if (!client || !asset) return bad(400, "missing_query");
        if (client !== tokenPayload.client) return bad(403, "forbidden");

        const row = await env.DB.prepare(
          "SELECT shapes_json, updated_at FROM annotations WHERE client_slug = ?1 AND asset_id = ?2"
        )
          .bind(client, asset)
          .first();

        if (!row) return json({ client, asset, shapes: [] });
        return json({
          client,
          asset,
          shapes: JSON.parse(row.shapes_json || "[]"),
          updatedAt: row.updated_at,
        });
      }

      if (req.method === "PUT") {
        let parsed;
        try {
          parsed = await req.json();
        } catch {
          return bad(400, "bad_json");
        }

        const client = String(parsed.client || "").trim().toLowerCase();
        const asset = String(parsed.asset || "").trim();
        const shapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
        if (!client || !asset) return bad(400, "missing_fields");
        if (client !== tokenPayload.client) return bad(403, "forbidden");

        const updatedAt = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO annotations (client_slug, asset_id, shapes_json, updated_at) VALUES (?1, ?2, ?3, ?4)\n" +
            "ON CONFLICT(client_slug, asset_id) DO UPDATE SET shapes_json = excluded.shapes_json, updated_at = excluded.updated_at"
        )
          .bind(client, asset, JSON.stringify(shapes), updatedAt)
          .run();

        return json({ ok: true, updatedAt });
      }

      return bad(405, "method_not_allowed");
    }

    return bad(404, "not_found");
  },
};

