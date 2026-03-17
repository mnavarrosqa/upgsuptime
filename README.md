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
3. Push database schema: `npm run db:push`
4. Run dev: `npm run dev`
5. Open the app; if no users exist you’ll be asked to create the first admin account. Then sign in.

After pulling updates, if the schema changed or login fails with an existing DB, run `npm run db:push` again to sync the database.

---

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server on port 3077 |
| `npm run build` | Build for production |
| `npm run start` | Run production server (port 3077) |
| `npm run db:push` | Apply database schema to the DB |
| `npm run db:generate` | Generate Drizzle migrations (if using migrations) |
| `npm run db:studio` | Drizzle Studio (binds to all interfaces; use when remote) |
| `npm run db:studio:local` | Drizzle Studio (localhost only) |
| `npm run db:check-users` | List user emails in the DB (useful when working remotely) |
| `npm run lint` | Run ESLint |

---

## Using a domain

To serve the app on a custom domain (e.g. `https://uptime.example.com`):

1. **DNS** – Point your domain (or subdomain) to the server’s IP (A record) or use a CNAME if you’re behind a CDN/host.
2. **Reverse proxy** – Run the app on a port (e.g. 3077) and put a reverse proxy in front:
   - **Nginx:** Proxy `https://your-domain` to `http://127.0.0.1:3077`; handle SSL with Let’s Encrypt (e.g. Certbot).
   - **Caddy:** Same idea; Caddy can obtain and renew TLS automatically.
   - **Cloudflare Tunnel / Tailscale / similar:** Use their instructions to expose the app by domain with HTTPS.
3. **Env** – Set `NEXTAUTH_URL` to the full public URL with HTTPS, e.g. `https://uptime.example.com`. No trailing slash.
4. **Cron** – Call the cron URL using the same domain (and same HTTPS), e.g. `https://uptime.example.com/api/cron/run-checks`, with the `x-cron-secret` header.

---

## Production setup

Checklist for running the app in production behind a domain:

1. **Environment**
   - Set `NEXTAUTH_URL` to your canonical HTTPS URL (e.g. `https://uptime.example.com`).
   - Set `NEXTAUTH_SECRET` to a strong value: `openssl rand -base64 32`.
   - Set `CRON_SECRET` the same way; use it only in the `x-cron-secret` header when calling the cron endpoint.
   - Ensure `DATABASE_URL` points to a persistent path (e.g. `file:./uptime.db` on the server). Back it up regularly.
   - Optional: set `DISABLE_SETUP=true` after the first admin is created to disable the setup endpoint.
   - Optional: configure SMTP (see `.env.example`) for email alerts.

2. **Build and run**
   ```bash
   npm run build
   npm run start
   ```
   Or use a process manager (e.g. systemd, PM2) to run `npm run start` and restart on failure. The app listens on port 3077 by default.

3. **HTTPS**
   - Serve the app only over HTTPS (reverse proxy or platform TLS). The app sends security headers including HSTS in production.

4. **Cron (uptime checks)**
   Call the cron endpoint every 1–5 minutes. **Use the header only** (query params can leak in logs and Referer):
   ```bash
   curl -H "x-cron-secret: YOUR_CRON_SECRET" "https://your-domain.com/api/cron/run-checks"
   ```
   Use system cron, your host’s scheduler, or an external cron service; ensure the request uses the same HTTPS URL as `NEXTAUTH_URL`.

5. **After deployments**
   If the schema changed or you see login/DB errors, run `npm run db:push` on the server and restart the app.

---

## Cron (reference)

Monitors are checked when the cron endpoint is hit. Call it periodically (e.g. every 1–5 minutes):

```bash
curl -H "x-cron-secret: YOUR_CRON_SECRET" "https://your-app/api/cron/run-checks"
```

Use your platform’s cron (e.g. Vercel Cron, system cron, or a scheduler). Always use the header; do not put the secret in the URL or query string.

---

## Security

- **Production:** Use HTTPS and set `NEXTAUTH_URL` to your canonical HTTPS URL. Set strong, unique `NEXTAUTH_SECRET` and `CRON_SECRET`; never commit them.
- **Logging:** Do not log request bodies, `Authorization` headers, `x-cron-secret`, or query params that contain secrets.
- **Dependencies:** Run `npm audit` regularly and fix or accept reported issues. Consider Dependabot or Renovate for updates.
