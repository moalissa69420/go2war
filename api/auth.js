import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function getClientPassword(client) {
  // Set env like: CLIENT_PASSWORD_TROLL=troll100
  const key = `CLIENT_PASSWORD_${String(client || "").toUpperCase()}`;
  return process.env[key] || "";
}

function signToken(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const secret = process.env.GTW_TOKEN_SECRET;
  if (!secret) return json(res, 500, { error: "missing_GTW_TOKEN_SECRET" });

  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    return json(res, 400, { error: "bad_json" });
  }

  const client = String(parsed.client || "").trim().toLowerCase();
  const password = String(parsed.password || "").trim();
  if (!client || !password) return json(res, 400, { error: "missing_fields" });

  const expected = getClientPassword(client);
  if (!expected) return json(res, 403, { error: "unknown_client" });

  const ok = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  if (!ok) return json(res, 403, { error: "wrong_password" });

  const now = Math.floor(Date.now() / 1000);
  const token = signToken(
    {
      sub: `client:${client}`,
      client,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    },
    secret
  );

  return json(res, 200, { token, client, expiresIn: TOKEN_TTL_SECONDS });
}

