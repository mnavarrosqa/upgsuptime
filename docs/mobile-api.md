# Mobile API (v1)

Versioned JSON API for the native Android app, served under `/api/v1`. Response
shapes are a contract: new fields may be added, existing ones are not renamed or
removed without a new version.

- All responses are JSON with `Cache-Control: no-store`.
- Errors look like `{ "errorCode": "SOME_CODE", "error"?: "human-readable detail" }`.
- Timestamps are ISO 8601 strings in UTC.

## Authentication

The app signs in with the same email/username and password as the web app and
gets two tokens:

| Token | Lifetime | Use |
|---|---|---|
| Access token (JWT) | 15 minutes | `Authorization: Bearer <accessToken>` on every request |
| Refresh token (`upg_rt_…`) | 60 days, extended on each refresh | Exchange for a new pair at `/auth/refresh` |

Store the refresh token in encrypted storage (e.g. Android Keystore-backed
`EncryptedSharedPreferences`). Refresh tokens **rotate**: every refresh returns a
new one and the old one stops working. If an old refresh token is presented again,
the server treats it as leaked and signs that device out.

Sessions end when the user signs out, changes their password (all devices), or the
account is deleted. A revoked session makes every call return `401 UNAUTHORIZED`;
the app should then send the user to the sign-in screen.

Recommended client flow:

1. `POST /auth/token` on sign-in.
2. Call the API with the access token.
3. On `401`, call `POST /auth/refresh` once; on success retry the request, on failure sign out locally.

Without an `Authorization` header, `/api/v1` also accepts the web session cookie,
which is handy for trying endpoints from a signed-in browser. A request that sends
a Bearer token never falls back to the cookie.

### `POST /api/v1/auth/token`

```json
{ "login": "user@example.com", "password": "…", "deviceName": "Pixel 9" }
```

`200`:

```json
{
  "tokenType": "Bearer",
  "accessToken": "eyJ…",
  "accessTokenExpiresAt": "2026-10-29T00:35:00.000Z",
  "refreshToken": "upg_rt_…",
  "refreshTokenExpiresAt": "2026-12-28T00:20:00.000Z",
  "sessionId": "…",
  "user": { "id": "…", "email": "…", "username": "…", "role": "user", "language": "es" }
}
```

Errors: `400 CREDENTIALS_REQUIRED`, `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED`
(shares the web sign-in limit: 10 attempts per 15 minutes per IP).

### `POST /api/v1/auth/refresh`

`{ "refreshToken": "upg_rt_…" }` → same token fields as above (without `user`).
Errors: `401 REFRESH_TOKEN_INVALID`, `401 REFRESH_TOKEN_EXPIRED`.

### `POST /api/v1/auth/logout`

Bearer token required. Revokes this device's session and removes its push
registrations. `204` on success.

### `GET /api/v1/me`

`{ "id", "email", "username", "role", "language" }`

## Monitors

### `GET /api/v1/monitors`

```json
{
  "monitors": [
    {
      "id": "…",
      "name": "Shop",
      "type": "http",
      "url": "https://example.com",
      "status": "up",
      "paused": false,
      "intervalMinutes": 5,
      "lastCheckAt": "…",
      "lastStatusChangedAt": "…",
      "downtimeAcknowledged": false,
      "ssl": { "valid": true, "expiresAt": "…" },
      "latestCheck": { "ok": true, "responseTimeMs": 182, "message": null, "createdAt": "…" },
      "uptime90dPct": 99.9
    }
  ]
}
```

`status` is one of `up`, `down`, `pending` (not checked yet) or `paused`. `ssl` is
`null` when SSL monitoring is off. `type` is `http`, `keyword`, `dns` or `tcp`.

### `GET /api/v1/monitors/{id}`

The list fields plus configuration: `method`, `timeoutSeconds`,
`expectedStatusCodes`, `requestHeaders` (values of sensitive headers such as
`Authorization` are `"[redacted]"`), `followRedirects`, `maxRedirects`, `keyword`,
`dns`, `tcp` (each `null` unless it matches `type`), `alertEmail`, `maintenance`,
`createdAt`. `404 NOT_FOUND` for monitors of other users.

### `PATCH /api/v1/monitors/{id}`

Pause or resume: `{ "paused": true }`. Returns the monitor detail. Any other field
is rejected with `400 UNSUPPORTED_FIELD`; editing settings stays on the web for now.

### `POST /api/v1/monitors/{id}/check`

Runs a check immediately:

```json
{
  "ok": true,
  "statusCode": 200,
  "responseTimeMs": 182,
  "timings": { "dnsMs": 12, "connectMs": 30, "tlsMs": 45, "ttfbMs": 170 },
  "attempts": 1,
  "message": null
}
```

### `GET /api/v1/monitors/{id}/results?limit=50&before=…`

Check history, newest first. `limit` is 1–200 (default 50). Pass the returned
`nextBefore` as `before` to get the next page; it is `null` on the last page.

```json
{
  "results": [
    {
      "id": "…",
      "createdAt": "…",
      "ok": false,
      "statusCode": 503,
      "responseTimeMs": 240,
      "timings": { "dnsMs": 10, "connectMs": 28, "tlsMs": 40, "ttfbMs": 230 },
      "attempts": 3,
      "message": "Service Unavailable",
      "duringMaintenance": false
    }
  ],
  "nextBefore": "…"
}
```

### `GET /api/v1/activity`

Status changes and slow-response alerts from the last 7 days, newest first:
`{ "items": [ { "kind": "status", "monitorId", "name", "url", "recovered", "at", … } ] }`.
`kind` is `status` or `degradation` (with `recentAvgMs` and `baselineP75Ms`).

## Push notifications

Alerts are sent through Firebase Cloud Messaging when a monitor is confirmed down
(two failed checks in a row) or recovers, the same moments the alert email is sent.
Push goes to every device the user registered, whether or not email alerts are on
for that monitor, and is skipped during maintenance windows.

### `POST /api/v1/devices`

Bearer token required (cookie sessions get `403 APP_TOKEN_REQUIRED`).

```json
{ "token": "<FCM registration token>", "platform": "android" }
```

`201` the first time, `200` when the token is already registered (it moves to the
current session). Call it after sign-in and from `FirebaseMessagingService.onNewToken`.

### `DELETE /api/v1/devices`

`{ "token": "…" }` → `204`. Signing out also removes the device's registrations.

### Message format

```json
{
  "notification": { "title": "[Caído] Shop — inalcanzable", "body": "Service Unavailable" },
  "data": { "type": "monitor_status", "monitorId": "…", "status": "down" },
  "android": { "priority": "high", "notification": { "channel_id": "monitor_alerts" } }
}
```

Text uses the account's language. The app must create the `monitor_alerts`
notification channel and can open the monitor from `data.monitorId`. Tokens that
FCM reports as unregistered are deleted automatically.

### Server setup

1. Create a Firebase project and add the Android app.
2. In *Project settings → Service accounts*, generate a private key (JSON).
3. Set `FCM_SERVICE_ACCOUNT_JSON` to the contents of that file (one line). Without
   it, push is disabled and everything else keeps working.
