#!/usr/bin/env bash
# One-time bootstrap for BTR Ultra on the lifeos box.
#   - Creates /var/www/btr-ultra (owned by www-data)
#   - Installs nginx vhost from deploy/nginx/btr-ultra.conf
#   - Tests nginx config + reloads
#   - Opens ufw 7443/tcp
#
# Safe to re-run (idempotent). Run AFTER deploy.sh has pushed files at least once,
# OR run a deploy.sh right after this to populate the docroot.
#
# Usage: bash scripts/deploy/setup_server.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="lifeos"
PORT=7443

echo "==> Pushing nginx vhost to lifeos..."
scp "$REPO_ROOT/deploy/nginx/btr-ultra.conf" "$SSH_HOST:/tmp/btr-ultra.conf.new"

ssh "$SSH_HOST" bash -s <<EOF
set -euo pipefail

echo "==> Creating /var/www/btr-ultra..."
mkdir -p /var/www/btr-ultra
chown -R www-data:www-data /var/www/btr-ultra
chmod 755 /var/www/btr-ultra

# Drop a placeholder so the docroot has something even before the first deploy.
if [ ! -f /var/www/btr-ultra/index.html ]; then
  cat > /var/www/btr-ultra/index.html <<'HTML'
<!DOCTYPE html><html><body><h1>BTR Ultra — site not yet deployed</h1>
<p>Run <code>bash scripts/deploy/deploy.sh</code> on the dev machine.</p></body></html>
HTML
  chown www-data:www-data /var/www/btr-ultra/index.html
fi

echo "==> Installing nginx vhost..."
install -m 644 /tmp/btr-ultra.conf.new /etc/nginx/sites-available/btr-ultra.conf
ln -sf /etc/nginx/sites-available/btr-ultra.conf /etc/nginx/sites-enabled/btr-ultra.conf
rm -f /tmp/btr-ultra.conf.new

echo "==> nginx -t (must pass before reload)..."
nginx -t

echo "==> Reloading nginx..."
systemctl reload nginx

echo "==> Opening ufw $PORT/tcp..."
ufw allow ${PORT}/tcp comment 'btr-ultra' || true

echo "==> Sanity check..."
ss -tlnp | grep ":${PORT}" || { echo "WARN: nginx not listening on :${PORT} yet"; exit 1; }
curl -sk -o /dev/null -w "HTTP %{http_code} from local\n" "https://127.0.0.1:${PORT}/"
EOF

echo "==> Done."
echo
echo "Now run:  bash scripts/deploy/deploy.sh"
echo "Then visit: https://103.6.170.102.nip.io:${PORT}/"
