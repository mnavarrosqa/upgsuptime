---
title: "Recovery email duration comes from the pre-update monitor row's lastStatusChangedAt"
author: Martinnavarrosantex
date: 2026-11-02
branch: claude/better-stack-app-improvements-be8cd1
cost: { minutes: 5, tokens: 204156 }
id: l-feb11d62
scope: repo
status: active
src: agent
touches:
  - src/lib/email-templates.ts
  - src/lib/email-i18n.ts
  - messages/en.json
  - messages/es.json
  - src/lib/notify.ts
  - src/components/uptime-trend-charts.tsx
  - src/lib/run-check.ts
  - "src/app/(app)/monitors/[id]/page.tsx"
  - src/db/schema.ts
---

## Decided
The "Downtime duration" in the recovery email is computed in sendEmailAlert (src/lib/notify.ts) as now minus m.lastStatusChangedAt, with no new parameter or column.

## Watch out
This only works because applyCheckResult (src/lib/run-check.ts) writes lastStatusChangedAt = now to the DB but passes the old in-memory monitor row `m` to sendNotifications. If that call is changed to use a refreshed row, the duration becomes about 0.
