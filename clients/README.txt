Client portal notes

- This folder is a password-gated portal (prompt-based).
- Passwords are verified by a Vercel API (see /api/auth.js).
- Shared annotations are stored in Vercel KV (see /api/annotations.js).

To add a new client:
1) Create /clients/<slug>/index.html (copy from /clients/troll/index.html)
2) Add the client link in /clients/index.html
3) On Vercel, set env var: CLIENT_PASSWORD_<SLUG_UPPER>=<password>
   Example: CLIENT_PASSWORD_TROLL=troll100

Frontend API base:
- Set window.GTW_API_BASE in the page, or set localStorage key GTW_API_BASE.
  Example: https://your-vercel-project.vercel.app

