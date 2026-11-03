export function formatDurationMs(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  return [d && `${d}d`, h && `${h}h`, (min || (!d && !h)) && `${min}m`].filter(Boolean).join(" ");
}
