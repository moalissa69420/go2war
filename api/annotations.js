import crypto from "node:crypto";
import { kv } from "@vercel/kv";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  // Allow your static site (custom domain) to call this API:
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  res.setHeader("access-control-allow-methods", "GET,PUT,OPTIONS");
  res.end(JSON.stringify(body));
}

function parseJwt(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("bad_token");
  const [h, b, s] = parts;
  const data = `${h}.${b}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(s))) throw new Error("bad_sig");
  const payload = JSON.parse(Buffer.from(b, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("expired");
  return payload;
}

function authClient(req) {
  const secret = process.env.GTW_TOKEN_SECRET;
  if (!secret) throw new Error("missing_secret");
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("missing_bearer");
  const token = m[1];
  const payload = parseJwt(token, secret);
  return payload?.client;
}

function key(client, asset) {
  return `gtw:annotations:${client}:${asset}`;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization, content-type");
    res.setHeader("access-control-allow-methods", "GET,PUT,OPTIONS");
    return res.end();
  }

  if (req.method !== "GET" && req.method !== "PUT") return json(res, 405, { error: "method_not_allowed" });

  let clientFromToken;
  try {
    clientFromToken = authClient(req);
  } catch (e) {
    return json(res, 401, { error: "unauthorized" });
  }

  if (req.method === "GET") {
    const client = String(req.query.client || "").trim().toLowerCase();
    const asset = String(req.query.asset || "").trim();
    if (!client || !asset) return json(res, 400, { error: "missing_query" });
    if (client !== clientFromToken) return json(res, 403, { error: "forbidden" });

    const value = await kv.get(key(client, asset));
    return json(res, 200, value || { client, asset, shapes: [] });
  }

  // PUT
  let body = "";
  for await (const chunk of req) body += chunk;
  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    return json(res, 400, { error: "bad_json" });
  }

  const client = String(parsed.client || "").trim().toLowerCase();
  const asset = String(parsed.asset || "").trim();
  const shapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
  if (!client || !asset) return json(res, 400, { error: "missing_fields" });
  if (client !== clientFromToken) return json(res, 403, { error: "forbidden" });

  const payload = { client, asset, shapes, updatedAt: new Date().toISOString() };
  await kv.set(key(client, asset), payload);
  return json(res, 200, { ok: true, updatedAt: payload.updatedAt });
}

