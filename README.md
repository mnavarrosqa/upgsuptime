# Uptime Monitor

Multi-user uptime monitoring with Next.js. First run creates an admin account; then users sign in to manage monitors.

## Setup

1. Install dependencies: `npm install`
2. Copy env: `cp .env.example .env` and set:
   - `DATABASE_URL` – SQLite path (default `file:./uptime.db`)
   - `NEXTAUTH_SECRET` – **required in production.** Generate with `openssl rand -base64 32`. Use a different value per environment; never commit real secrets.
   - `NEXTAUTH_URL` – app URL (e.g. `http://localhost:3077`). **In production use HTTPS** (e.g. `https://your-domain.com`). In development, login also works when opening the app by IP (e.g. `http://192.168.x.x:3077`) because the app trusts the request host.
   - `CRON_SECRET` – secret for the cron endpoint. Generate with `openssl rand -base64 32`; use header only (see Cron below).
   - `DISABLE_SETUP` – optional; set to `true` to disable the first-time setup endpoint after initial setup.
3. Push database schema: `DATABASE_URL=file:./uptime.db npm run db:push`
4. Run dev: `npm run dev`
5. Open the app; if no users exist you’ll be asked to create the first admin account. Then sign in.

After pulling updates, if the schema changed or login fails with an existing DB, run `npm run db:push` again to sync the database.

## Cron (uptime checks)

Call the cron endpoint periodically (e.g. every 1–5 minutes) so monitors are checked. **Use the header only** (query params can leak in logs and Referer):

```bash
curl -H "x-cron-secret: YOUR_CRON_SECRET" "https://your-app/api/cron/run-checks"
```

Use your platform’s cron (e.g. Vercel Cron, system cron, or a scheduler) to hit this URL.

## Security

- **Production:** Use HTTPS and set `NEXTAUTH_URL` to your canonical HTTPS URL. Set strong, unique `NEXTAUTH_SECRET` and `CRON_SECRET`; never commit them.
- **Logging:** Do not log request bodies, `Authorization` headers, `x-cron-secret`, or query params that contain secrets.
- **Dependencies:** Run `npm audit` regularly and fix or accept reported issues. Consider Dependabot or Renovate for updates.

## Scripts

- `npm run dev` – development server (port 3077)
- `npm run build` / `npm run start` – production
- `npm run db:push` – apply schema to DB
- `npm run db:studio` – run Drizzle Studio (bind to all interfaces; open https://local.drizzle.studio only when your browser is on the same machine as the server)
- `npm run db:check-users` – list user emails in the DB (for verifying login when working remotely)
