#!/usr/bin/env bash
# Deploy the BTR Ultra static site to the lifeos box.
# Rsyncs the runtime files (HTML/JS/data/GPX/JSON/favicon) to /var/www/btr-ultra/.
# Does NOT push the Python analysis script, README, or this scripts/ directory.
#
# Idempotent and safe to re-run.
#
# Usage: bash scripts/deploy/deploy.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="lifeos"
DEST="/var/www/btr-ultra"
PORT=7443

echo "==> Deploying from $REPO_ROOT to $SSH_HOST:$DEST"

# Explicit allowlist of files to deploy. Everything else stays local.
RSYNC_FILES=(
  index.html
  app.js
  data.js
  favicon.svg
  manifest.json
  service-worker.js
  apple-touch-icon.png
  btr-ultra-60k-full.gpx
  recon-abang-terunyan.gpx
  recon-analysis.json
)

# Directories deployed recursively.
RSYNC_DIRS=(
  icons
)

# Verify every file exists locally before pushing.
cd "$REPO_ROOT"
for f in "${RSYNC_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing local file: $f" >&2
    exit 1
  fi
done
for d in "${RSYNC_DIRS[@]}"; do
  if [ ! -d "$d" ]; then
    echo "ERROR: missing local directory: $d (run scripts/build_icons.sh first)" >&2
    exit 1
  fi
done

# Push nginx config if it changed (idempotent — install only triggers a reload
# when the file actually differs).
echo "==> Syncing nginx vhost..."
scp -q "$REPO_ROOT/deploy/nginx/btr-ultra.conf" "$SSH_HOST:/tmp/btr-ultra.conf.new"
ssh "$SSH_HOST" bash -s <<'EOF'
set -euo pipefail
if ! cmp -s /tmp/btr-ultra.conf.new /etc/nginx/sites-available/btr-ultra.conf 2>/dev/null; then
  install -m 644 /tmp/btr-ultra.conf.new /etc/nginx/sites-available/btr-ultra.conf
  ln -sf /etc/nginx/sites-available/btr-ultra.conf /etc/nginx/sites-enabled/btr-ultra.conf
  nginx -t
  systemctl reload nginx
  echo "    nginx vhost updated + reloaded"
else
  echo "    nginx vhost unchanged"
fi
rm -f /tmp/btr-ultra.conf.new
EOF

# rsync each file. (macOS bundled rsync doesn't support --chown, so we fix
# ownership in the post-deploy ssh below.)
rsync -avz "${RSYNC_FILES[@]}" "$SSH_HOST:$DEST/"
rsync -avz "${RSYNC_DIRS[@]}" "$SSH_HOST:$DEST/"

# Normalize ownership + perms after the upload.
ssh "$SSH_HOST" "chown -R www-data:www-data $DEST && find $DEST -type f -exec chmod 644 {} \;"

echo
echo "==> Verifying..."
ssh "$SSH_HOST" "ls -la $DEST/"
echo
BASE="https://103.6.170.102.nip.io:${PORT}"
check() {
  local path=$1
  local code
  code=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE$path")
  printf "    %-32s %s\n" "$path" "HTTP $code"
}
echo "==> Public HTTPS checks:"
check "/"
check "/manifest.json"
check "/service-worker.js"
check "/apple-touch-icon.png"
check "/icons/icon-192.png"
check "/icons/icon-512.png"
check "/icons/icon-maskable-512.png"
echo
echo "URL: $BASE/"
