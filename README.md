# UPG Monitor

Multi-user uptime monitoring with Next.js. First run creates an admin account; then users sign in to manage monitors.

## Local development

1. `npm install`
2. `cp .env.example .env` and fill in values (see comments in `.env.example`). At minimum: `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (e.g. `http://localhost:3077`), `CRON_SECRET`. `DATABASE_URL` defaults to `file:./uptime.db`.
3. `npm run db:push && npm run dev`
4. Open [http://localhost:3077](http://localhost:3077). If no users exist, create the first admin; then sign in.

After pulling code, if the schema changed or you see DB errors: `npm run db:push` again.

---

## Production

Configure `.env` like local development, but set `NEXTAUTH_URL` to your real HTTPS URL (same URL users open in the browser; no trailing slash). Use a persistent `DATABASE_URL` and back up that file. Full list of variables: `.env.example`.

Deploy — **always run `db:push` before `build`** (the production build queries the database):

```bash
npm install && npm run db:push && npm run build && npm run start
```

- App listens on **3077** — terminate HTTPS at your reverse proxy (Nginx, Caddy, …).
- Cron (every 1–5 min): `curl -H "x-cron-secret: YOUR_CRON_SECRET" "https://your-domain/api/cron/run-checks"`
- After `git pull`: `npm run db:push` and restart the process if the schema changed.
- Pick one scheduler owner per environment: either the in-process scheduler or an external cron hitting `/api/cron/run-checks`. Running both is safe enough for small installs but wastes work under concurrency.
- Login/API rate limits are in-memory and per Node process. For multi-instance deployments, put rate limiting at the proxy/load balancer or move buckets to a shared store.
- The production CSP is intentionally compatible with Next.js defaults. If you need a stricter policy, plan a nonce-based CSP pass before removing inline/eval allowances.

---

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Dev server (port 3077) |
| `npm run build` | Production build |
| `npm run start` | Production server (port 3077) |
| `npm run db:push` | Apply DB schema (run before `build` in production) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Drizzle Studio (all interfaces; remote-friendly) |
| `npm run db:studio:local` | Drizzle Studio (localhost only) |
| `npm run db:check-users` | List user emails in the DB |
| `npm run lint` | ESLint |
| `npm run knip` | Find unused files/exports/deps ([Knip](https://github.com/webpro-nl/knip)) |

For remote development, set `ALLOWED_DEV_ORIGINS` in `.env` as a comma-separated list of hostnames/IPs that should be allowed to open the dev server.

---

## Security

Do not commit secrets. In production, use HTTPS and never log `x-cron-secret`, auth headers, or secrets in URLs.
