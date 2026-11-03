---
title: Dashboard overview has its own MonitorCard separate from monitor-card.tsx
author: Martinnavarrosantex
date: 2026-11-03
branch: claude/monitor-cards-improvements-fb18be
cost: { minutes: 16, tokens: 251991 }
id: l-f00a9681
scope: repo
status: active
src: agent
touches:
  - src/app/(app)/dashboard/page.tsx
  - src/components/dashboard-overview.tsx
  - messages/en.json
  - messages/es.json
  - src/components/dashboard-content.tsx
  - src/components/monitor-card.tsx
  - src/components/uptime-trend-charts.tsx
  - src/components/monitor-card-trend.tsx
  - src/lib/monitor-card-stats.ts
---

## Decided
Changes to monitor cards must be applied to both components:
- `src/components/monitor-card.tsx` — used on `/monitors` page
- `src/components/dashboard-overview.tsx` — used on `/` dashboard page (has its own `MonitorCard` function at ~L417 and `MonitorCardData` type at L44)

## Watch out
The two `MonitorCard` components share a name but are completely independent. The dashboard overview cards use `MonitorCardData` (built in `src/app/(app)/dashboard/page.tsx` ~L267) with a pre-computed `strip` array and `since` field, while the monitors page cards use `MonitorCardProps` with raw `trendResults` and `lastStatusChangedAt`. Any visual improvement to monitor cards must be applied to both or the user will only see it on one page.
