#!/usr/bin/env bash
# Consistent SQLite snapshot of the UPG Monitor database, keeping the last KEEP_DAYS days.
# Run by upgsuptime-backup.timer; safe to run by hand: sudo -u upg upgsuptime-backup
set -euo pipefail

DB="${DB:-/var/lib/upgsuptime/uptime.db}"
DEST="${DEST:-/var/backups/upgsuptime}"
KEEP_DAYS="${KEEP_DAYS:-14}"

[ -f "$DB" ] || { echo "No database at $DB yet"; exit 0; }
mkdir -p "$DEST"
out="$DEST/uptime-$(date -u +%Y%m%d-%H%M%S).db"
# .backup is safe while the app is writing (unlike cp).
sqlite3 "$DB" ".backup '$out'"
gzip -f "$out"
find "$DEST" -name 'uptime-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $out.gz"
