#!/usr/bin/env bash
# One-time setup of UPG Monitor on an Oracle Cloud Ubuntu VM (Ampere A1 / ARM64 or x86).
#
#   curl -fsSL https://raw.githubusercontent.com/mnavarrosqa/upgsuptime/main/deploy/oracle/install.sh -o install.sh
#   DOMAIN=monitor.example.com sudo -E bash install.sh
#
# Optional: REPO_URL (default: the GitHub repo over HTTPS), BRANCH (default: main),
# SWAP_GB (default: 2, or 4 on VMs under 2 GB of RAM; 0 to skip). Safe to re-run: existing .env and data are kept.
set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN to the hostname that points at this VM, e.g. DOMAIN=monitor.example.com}"
REPO_URL="${REPO_URL:-https://github.com/mnavarrosqa/upgsuptime.git}"
BRANCH="${BRANCH:-main}"
# Small VMs (the 1 GB E2.1.Micro) need more swap: the build peaks around 2 GB.
MEM_MB="$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)"
if [ "$MEM_MB" -lt 2048 ]; then SWAP_GB="${SWAP_GB:-4}"; else SWAP_GB="${SWAP_GB:-2}"; fi

APP_USER=upg
APP_DIR=/opt/upgsuptime
DATA_DIR=/var/lib/upgsuptime
BACKUP_DIR=/var/backups/upgsuptime
# Config files come from the cloned repo, so this script also works when downloaded on its own.
HERE="$APP_DIR/deploy/oracle"
export DEBIAN_FRONTEND=noninteractive

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo -E bash install.sh)"; exit 1; }

echo "==> System packages"
apt-get update -y
apt-get install -y ca-certificates curl git gnupg sqlite3 build-essential python3 \
  debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

echo "==> Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Caddy (HTTPS reverse proxy)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Firewall: allow HTTP/HTTPS (Oracle's Ubuntu images reject everything but SSH)"
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT
done
netfilter-persistent save

if [ "$SWAP_GB" -gt 0 ] && ! swapon --show | grep -q /swapfile; then
  echo "==> ${SWAP_GB} GB swap (headroom for builds)"
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> App user and directories"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$DATA_DIR" "$BACKUP_DIR"

echo "==> Code"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Environment (.env)"
if [ ! -f "$APP_DIR/.env" ]; then
  sed -e "s#__DOMAIN__#${DOMAIN}#g" \
      -e "s#__NEXTAUTH_SECRET__#$(openssl rand -base64 32)#" \
      -e "s#__CRON_SECRET__#$(openssl rand -hex 24)#" \
      -e "s#__DATA_DIR__#${DATA_DIR}#" \
      "$HERE/env.example" > "$APP_DIR/.env"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "    Created $APP_DIR/.env (edit it later to add SMTP for email alerts)."
else
  echo "    Keeping existing $APP_DIR/.env"
fi

echo "==> Install, migrate and build (takes a few minutes)"
sudo -u "$APP_USER" bash -c "
  set -euo pipefail
  cd '$APP_DIR'
  set -a; . ./.env; set +a
  npm ci
  npm run db:push
  npm run build
"

echo "==> Services"
install -m 644 "$HERE/upgsuptime.service" /etc/systemd/system/upgsuptime.service
install -m 644 "$HERE/upgsuptime-backup.service" /etc/systemd/system/upgsuptime-backup.service
install -m 644 "$HERE/upgsuptime-backup.timer" /etc/systemd/system/upgsuptime-backup.timer
install -m 755 "$HERE/backup.sh" /usr/local/bin/upgsuptime-backup
sed "s#__DOMAIN__#${DOMAIN}#g" "$HERE/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now upgsuptime.service upgsuptime-backup.timer
systemctl reload caddy || systemctl restart caddy

echo
echo "Done. Open https://${DOMAIN} and create the first admin account."
echo "Logs: journalctl -u upgsuptime -f    Update later: sudo bash $HERE/update.sh"
