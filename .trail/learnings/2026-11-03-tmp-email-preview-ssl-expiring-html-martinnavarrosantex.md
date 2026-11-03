---
title: "tmp/email-preview-ssl-expiring.html changes on every test run, don't commit that diff"
author: Martinnavarrosantex
date: 2026-11-03
branch: claude/better-stack-app-improvements-be8cd1
cost: { minutes: 5, tokens: 205856 }
id: l-e3ac813f
scope: repo
status: active
src: agent
touches:
  - "src/app/(app)/monitors/[id]/page.tsx"
  - src/components/check-timing-breakdown.tsx
  - src/components/uptime-trend-charts-client.tsx
  - src/components/uptime-trend-charts.tsx
  - messages/en.json
  - messages/es.json
  - src/lib/email-i18n.ts
  - src/lib/email-preview.test.ts
  - src/lib/email-templates.ts
  - src/lib/notify.ts
---

## Decided
Restored tmp/email-preview-ssl-expiring.html with git checkout instead of committing it.

## Watch out
src/lib/email-preview.test.ts rewrites the tmp/email-preview-*.html files on every vitest run, and the SSL one embeds an expiry date computed from the current time, so it shows a diff each run that is not a real change. Commit the other previews only when the template itself changed.
