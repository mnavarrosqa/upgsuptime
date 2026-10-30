#!/usr/bin/env bash
# Update UPG Monitor to the latest code:  sudo bash /opt/upgsuptime/deploy/oracle/update.sh
#
# The server copy is never edited by hand, so this discards local changes in
# /opt/upgsuptime (except the git-ignored .env) — that is what made
# "Your local changes would be overwritten by merge" go away.
set -euo pipefail

APP_USER=upg
APP_DIR=/opt/upgsuptime
BRANCH="${BRANCH:-main}"

# Everything runs inside main(), which bash parses in full before starting:
# the git reset below may rewrite this very file while it runs.
main() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo bash update.sh)"; exit 1; }

  echo "==> Backup before updating"
  sudo -u "$APP_USER" /usr/local/bin/upgsuptime-backup || true

  sudo -u "$APP_USER" bash -c "
    set -euo pipefail
    cd '$APP_DIR'
    echo '==> Fetch $BRANCH'
    git fetch origin '$BRANCH'
    git reset --hard 'origin/$BRANCH'
    set -a; . ./.env; set +a
    echo '==> Install dependencies (exactly as locked)'
    npm ci
    echo '==> Apply database schema (answer the prompt if it asks about data loss)'
    npm run db:push
    echo '==> Build'
    npm run build
  "

  # Pick up changes to the service files shipped with the repo.
  install -m 644 "$APP_DIR/deploy/oracle/upgsuptime.service" /etc/systemd/system/upgsuptime.service
  install -m 755 "$APP_DIR/deploy/oracle/backup.sh" /usr/local/bin/upgsuptime-backup
  systemctl daemon-reload
  systemctl restart upgsuptime
  echo "Updated to $(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1)"
}

main "$@"
