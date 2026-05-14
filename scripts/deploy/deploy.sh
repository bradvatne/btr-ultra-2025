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
  btr-ultra-60k-full.gpx
  recon-abang-terunyan.gpx
  recon-analysis.json
)

# Verify every file exists locally before pushing.
cd "$REPO_ROOT"
for f in "${RSYNC_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing local file: $f" >&2
    exit 1
  fi
done

# rsync each file. (macOS bundled rsync doesn't support --chown, so we fix
# ownership in the post-deploy ssh below.)
rsync -avz "${RSYNC_FILES[@]}" "$SSH_HOST:$DEST/"

# Normalize ownership + perms after the upload.
ssh "$SSH_HOST" "chown -R www-data:www-data $DEST && find $DEST -type f -exec chmod 644 {} \;"

echo
echo "==> Verifying..."
ssh "$SSH_HOST" "ls -la $DEST/"
echo
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://103.6.170.102.nip.io:${PORT}/")
echo "==> Public HTTPS check: HTTP $HTTP_CODE"
echo
echo "URL: https://103.6.170.102.nip.io:${PORT}/"
