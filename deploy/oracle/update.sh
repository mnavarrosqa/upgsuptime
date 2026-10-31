#!/usr/bin/env bash
# Deploy the latest main of UPG Monitor.
#
#   sudo upgsuptime-update            # deploy now if main has new commits (FORCE=1 to redeploy)
#   sudo upgsuptime-update --auto     # what upgsuptime-update.timer runs every 5 minutes
#
# The new version is built in a separate checkout ($BUILD_DIR) while the current one
# keeps serving, which matters on small VMs where a build takes many minutes. Only a
# successful build is swapped in: back up the database, apply the schema, stop the
# app, copy the build over $APP_DIR, start it and check it answers. If it does not,
# the previous version is restored and that commit is not retried automatically.
#
# The server copy is never edited by hand: local changes in $APP_DIR are replaced
# (except the git-ignored .env).
set -euo pipefail

APP_USER=upg
APP_DIR=/opt/upgsuptime
BUILD_DIR=/opt/upgsuptime-build
PREV_DIR=/opt/upgsuptime-prev
STATE_DIR=/var/lib/upgsuptime
BRANCH="${BRANCH:-main}"
HEALTH_URL="http://127.0.0.1:3077/login"

# Everything runs inside main(), which bash parses in full before starting: the
# deploy rewrites the copy of this script that lives in $APP_DIR.
main() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo upgsuptime-update)"; exit 1; }
  local auto=false
  [ "${1:-}" = "--auto" ] && auto=true

  # One deploy at a time (the timer and a manual run could overlap).
  exec 9>/run/upgsuptime-update.lock
  flock -n 9 || { echo "Another update is running."; exit 0; }

  local repo_url target deployed failed_file="$STATE_DIR/deploy-failed-sha"
  repo_url="$(app_git config --get remote.origin.url)"
  target="$(git ls-remote "$repo_url" "refs/heads/$BRANCH" | cut -f1)"
  [ -n "$target" ] || { echo "Could not read $BRANCH from $repo_url"; exit 1; }
  deployed="$(app_git rev-parse HEAD 2>/dev/null || true)"

  if [ "$target" = "$deployed" ] && [ "${FORCE:-0}" != 1 ]; then
    $auto || echo "Already on ${target:0:7}."
    exit 0
  fi
  if $auto && [ -f "$failed_file" ] && [ "$(cat "$failed_file")" = "$target" ]; then
    exit 0 # this commit already failed; wait for a new one (or run by hand)
  fi

  echo "==> Deploying ${target:0:7} (currently ${deployed:0:7})"
  command -v rsync >/dev/null || apt-get install -y rsync

  echo "==> Build in $BUILD_DIR (the running app is not touched)"
  install -d -o "$APP_USER" -g "$APP_USER" "$BUILD_DIR"
  install -m 600 -o "$APP_USER" -g "$APP_USER" "$APP_DIR/.env" "$BUILD_DIR/.env"
  if ! sudo -u "$APP_USER" bash -c "
    set -euo pipefail
    cd '$BUILD_DIR'
    [ -d .git ] || { git init --quiet && git remote add origin '$repo_url'; }
    # Only the commit being deployed: history is not needed to build.
    git fetch --quiet --depth 1 origin '$BRANCH'
    git reset --quiet --hard FETCH_HEAD
    git clean -fdq -e .env -e node_modules -e .next
    set -a; . ./.env; set +a
    # npm ci only when the lockfile changed: it is the slowest step after the build.
    lock_hash=\$(sha256sum package-lock.json | cut -d' ' -f1)
    if [ \"\$(cat node_modules/.upg-lock-hash 2>/dev/null)\" != \"\$lock_hash\" ]; then
      npm ci
      echo \"\$lock_hash\" > node_modules/.upg-lock-hash
    fi
    npm run build
  "; then
    fail "$target" "build failed"
  fi

  echo "==> Backup before switching"
  sudo -u "$APP_USER" /usr/local/bin/upgsuptime-backup || true

  echo "==> Apply database schema"
  # No terminal here: if drizzle asks to confirm data loss this fails instead of
  # guessing. Then run 'cd $BUILD_DIR && npm run db:push' by hand and deploy again.
  if ! sudo -u "$APP_USER" bash -c "
    set -euo pipefail
    cd '$BUILD_DIR'
    set -a; . ./.env; set +a
    timeout 600 npm run db:push </dev/null
  "; then
    fail "$target" "db:push needs attention"
  fi

  echo "==> Switch"
  rsync -a --delete "$APP_DIR/" "$PREV_DIR/"
  systemctl stop upgsuptime
  rsync -a --delete --exclude=.env "$BUILD_DIR/" "$APP_DIR/"
  install_system_files
  systemctl start upgsuptime

  if healthy; then
    rm -f "$failed_file"
    echo "Deployed $(app_git log --oneline -1)"
  else
    echo "==> New version does not answer on $HEALTH_URL; rolling back"
    systemctl stop upgsuptime
    rsync -a --delete "$PREV_DIR/" "$APP_DIR/"
    install_system_files
    systemctl start upgsuptime
    fail "$target" "new version did not start (rolled back; see journalctl -u upgsuptime)"
  fi
}

# git refuses to work as root in a repository owned by another user.
app_git() { sudo -u "$APP_USER" git -C "$APP_DIR" "$@"; }

healthy() {
  local i
  for i in $(seq 1 30); do
    curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL" && return 0
    sleep 3
  done
  return 1
}

fail() {
  echo "$1" > "$STATE_DIR/deploy-failed-sha"
  echo "DEPLOY FAILED for ${1:0:7}: $2"
  exit 1
}

# Service, backup and update units shipped with the repo. The update timer is
# enabled the first time it is installed; disable it with
# 'systemctl disable --now upgsuptime-update.timer' and it stays off.
install_system_files() {
  local src="$APP_DIR/deploy/oracle" new_timer=false
  [ -f /etc/systemd/system/upgsuptime-update.timer ] || new_timer=true
  install -m 644 "$src/upgsuptime.service" /etc/systemd/system/upgsuptime.service
  install -m 644 "$src/upgsuptime-backup.service" /etc/systemd/system/upgsuptime-backup.service
  install -m 644 "$src/upgsuptime-backup.timer" /etc/systemd/system/upgsuptime-backup.timer
  install -m 644 "$src/upgsuptime-update.service" /etc/systemd/system/upgsuptime-update.service
  install -m 644 "$src/upgsuptime-update.timer" /etc/systemd/system/upgsuptime-update.timer
  install -m 755 "$src/backup.sh" /usr/local/bin/upgsuptime-backup
  install -m 755 "$src/update.sh" /usr/local/bin/upgsuptime-update
  systemctl daemon-reload
  if $new_timer; then systemctl enable --now upgsuptime-update.timer; fi
}

main "$@"
