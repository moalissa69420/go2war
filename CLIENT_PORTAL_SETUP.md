# Client Portal Setup (shared password, shared notes)

This repo contains a static client portal (`/clients/`) that uses a **simple password prompt** (mo-site style) and a small API to **share annotations** (circles/highlights/notes) between you + the client.

## Public pages
- Home: `/`
- Client portal: `/clients/`
- Troll board (example): `/clients/troll/`

## How the password works
1. Client clicks their name (ex: Troll)
2. Browser prompts for password
3. If correct, the API returns a short-lived token
4. Token is used to load/save shared annotations

## Cloudflare backend (recommended in plan)
The shared annotations backend is in:
- `cloudflare/src/index.js`
- `cloudflare/schema.sql`
- `cloudflare/wrangler.toml`

### Deploy steps
1. Install Wrangler (once):

```bash
npm i -g wrangler
```

2. Login:

```bash
wrangler login
```

3. Create D1 DB:

```bash
cd cloudflare
wrangler d1 create go2war-client-portal
```

Copy the printed `database_id` into `cloudflare/wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).

4. Apply schema:

```bash
wrangler d1 execute go2war-client-portal --file=./schema.sql
```

5. Add Worker secret for signing tokens:

```bash
wrangler secret put GTW_TOKEN_SECRET
```

6. Add client password(s) (as secrets is best):

```bash
wrangler secret put CLIENT_PASSWORD_TROLL
wrangler secret put CLIENT_PASSWORD_PIERREBASSE
wrangler secret put CLIENT_PASSWORD_PRNGRPHY
```

Set value to `troll100` (or whatever you want).
Set Pierre Basse password value to `g2w`.
Set PRNGRPHY password value to `gtw`.

7. Deploy the Worker:

```bash
wrangler deploy
```

Wrangler will print a URL like `https://go2war-client-portal-api.<your-account>.workers.dev`.

## Point the frontend at the API
The portal reads the API base from:
- `window.GTW_API_BASE` (optional), OR
- `localStorage.GTW_API_BASE`

Fastest way (one-time per browser):

```js
localStorage.setItem("GTW_API_BASE", "https://YOUR_WORKER_URL");
```

Then reload `/clients/`.

If you want it hardcoded (so clients don’t need this step), we can set `window.GTW_API_BASE` in `/clients/index.html` and each client board page.

## Add a new client
1. Create a new board page: `clients/<slug>/index.html` (copy `clients/troll/index.html`).
2. Add the link in `clients/index.html`.
3. Add a password secret: `CLIENT_PASSWORD_<SLUG_UPPER>` (ex: `CLIENT_PASSWORD_NUBCAT`).
4. Put that client’s media in a public folder (example pattern): `assets/clients/<slug>/...` and reference it from the board gallery.

## Notes / limitations (MVP)
- **Shared password, no accounts**: anyone with the password can edit.
- **Annotations** are per-asset (`asset_01`, `asset_02`, …).
- **Video annotation** can be added next; MVP supports images.

