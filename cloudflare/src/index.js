/**
 * Cloudflare Worker API for shared-password auth + shared annotations.
 *
 * Endpoints:
 * - POST /api/auth        { client, password } -> { token, expiresIn }
 * - GET  /api/annotations?client=...&asset=...  (Bearer token) -> { shapes: [] }
 * - PUT  /api/annotations { client, asset, shapes } (Bearer token) -> { ok: true }
 * - GET  /api/assets?client=...                (Bearer token) -> { items: [...] }
 * - POST /api/assets/upload                    (Bearer token, multipart) -> { item }
 * - GET  /api/assets/file?key=...              (Bearer token) -> file bytes
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

function constantTimeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(String(a));
  const bb = enc.encode(String(b));
  const max = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < max; i++) {
    diff |= (ab[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0;
}

function safeKeyPart(s) {
  return String(s || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function guessContentType(name) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
        },
      });
    }

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
      if (!constantTimeEqual(password, expected)) return bad(403, "wrong_password");

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

    // --------------------
    // Assets (R2 uploads)
    // --------------------
    if (path === "/api/assets" || path === "/api/assets/upload" || path === "/api/assets/file" || path === "/api/assets/delete") {
      if (!env.GTW_TOKEN_SECRET) return bad(500, "missing_GTW_TOKEN_SECRET");
      if (!env.ASSETS) return bad(500, "missing_R2_binding");

      async function getTokenPayload() {
        const auth = req.headers.get("authorization") || "";
        const m = auth.match(/^Bearer\s+(.+)$/i);
        const token = m?.[1] || String(url.searchParams.get("t") || "").trim();
        if (!token) throw new Error("unauthorized");
        return await verifyToken(token, env.GTW_TOKEN_SECRET);
      }

      let tokenPayload;
      try {
        tokenPayload = await getTokenPayload();
      } catch {
        return bad(401, "unauthorized");
      }

      if (path === "/api/assets" && req.method === "GET") {
        const client = String(url.searchParams.get("client") || "").trim().toLowerCase();
        if (!client) return bad(400, "missing_query");
        if (client !== tokenPayload.client) return bad(403, "forbidden");

        const prefix = `${client}/`;
        const listed = await env.ASSETS.list({ prefix });
        const items = (listed.objects || []).map((o) => {
          const key = o.key;
          const name = key.slice(prefix.length);
          return {
            key,
            name,
            size: o.size,
            uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : undefined,
            url: `/api/assets/file?key=${encodeURIComponent(key)}`,
            contentType: guessContentType(name),
          };
        });

        // newest first
        items.sort((a, b) => (b.uploaded || "").localeCompare(a.uploaded || ""));
        return json({ client, items });
      }

      if (path === "/api/assets/upload" && req.method === "POST") {
        const contentType = req.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) return bad(415, "expected_multipart");

        let form;
        try {
          form = await req.formData();
        } catch {
          return bad(400, "bad_form_data");
        }

        const client = String(form.get("client") || "").trim().toLowerCase();
        if (!client) return bad(400, "missing_client");
        if (client !== tokenPayload.client) return bad(403, "forbidden");

        const file = form.get("file");
        if (!(file instanceof File)) return bad(400, "missing_file");

        const original = safeKeyPart(file.name || "upload");
        const ts = Date.now();
        const key = `${client}/${ts}-${original || "upload"}`;

        const ct = file.type || guessContentType(original);
        await env.ASSETS.put(key, file.stream(), {
          httpMetadata: { contentType: ct },
          customMetadata: { client },
        });

        const item = {
          key,
          name: key.slice((client + "/").length),
          size: file.size,
          url: `/api/assets/file?key=${encodeURIComponent(key)}`,
          contentType: ct,
        };
        return json({ ok: true, item });
      }

      if (path === "/api/assets/file" && req.method === "GET") {
        const key = String(url.searchParams.get("key") || "").trim();
        if (!key) return bad(400, "missing_key");

        const clientPrefix = `${tokenPayload.client}/`;
        if (!key.startsWith(clientPrefix)) return bad(403, "forbidden");

        const obj = await env.ASSETS.get(key);
        if (!obj) return bad(404, "not_found");

        const headers = new Headers();
        headers.set("access-control-allow-origin", "*");
        if (obj.httpMetadata?.contentType) headers.set("content-type", obj.httpMetadata.contentType);
        // Cache a bit (safe because key includes timestamp)
        headers.set("cache-control", "public, max-age=3600");
        return new Response(obj.body, { status: 200, headers });
      }

      if (path === "/api/assets/delete" && req.method === "POST") {
        let parsed;
        try {
          parsed = await req.json();
        } catch {
          return bad(400, "bad_json");
        }
        const key = String(parsed.key || "").trim();
        if (!key) return bad(400, "missing_key");

        const clientPrefix = `${tokenPayload.client}/`;
        if (!key.startsWith(clientPrefix)) return bad(403, "forbidden");

        await env.ASSETS.delete(key);
        return json({ ok: true });
      }

      return bad(405, "method_not_allowed");
    }

    return bad(404, "not_found");
  },
};

