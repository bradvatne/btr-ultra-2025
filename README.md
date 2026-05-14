# BTR Ultra 60K — Race Prep

Self-contained static web app. No build step. Installs as a phone app via PWA.

**Live:** https://103.6.170.102.nip.io:7443/
**Repo:** https://github.com/bradvatne/btr-ultra-2025

## Run locally

```bash
cd /Users/brad/code/btr-ultra-2025
python3 -m http.server 8765
# open http://localhost:8765
```

Must be served over HTTP/HTTPS (not `file://`) — the app fetches GPX and JSON files. PWA install + service worker require HTTPS in production (already wired on the live URL).

## Install on phone

**iPhone (Safari):**
1. Visit https://103.6.170.102.nip.io:7443/
2. Tap the **Share** button (square with up-arrow).
3. Tap **Add to Home Screen**.
4. Confirm. The BTR Ultra icon appears on your home screen and launches in standalone mode (no Safari chrome).

**Android (Chrome):** an "Install" banner appears at the top of the page on first visit. Tap it. Or use Chrome menu → **Add to Home screen**.

Once installed, the app works **offline** — every tab except Map loads from cache (Map tiles require network). All race-day data (timeline, fueling, gear, watch setup) is fully offline.

## Files

- `index.html` — UI shell
- `app.js` — interactivity (map, elevation chart, pace calc, live tracker, checklists, PWA install flow)
- `data.js` — all editable race data (aid stations, fueling, gear, tips, FR970 setup)
- `manifest.json` — PWA manifest
- `service-worker.js` — offline cache (bump `CACHE_NAME` to force clients to refetch)
- `btr-ultra-60k-full.gpx` — **upload this to the watch** (course + 9 aid + 13 fueling)
- `btr-ultra-60k.gpx` — course + 9 aid only (no fueling waypoints)
- `btr-ultra-60k-original.gpx` — untouched from Trace de Trail
- `build_fueling_gpx.py` — regenerate the full GPX after editing aid/fueling in the script
- `scripts/build_icons.sh` — regenerate PWA icons from `favicon.svg`
- `scripts/deploy/deploy.sh` — push to lifeos
- `scripts/deploy/setup_server.sh` — one-time server bootstrap
- `deploy/nginx/btr-ultra.conf` — nginx vhost (auto-pushed by deploy.sh)

## Edit content

Everything is in `data.js`. Aid stations, fueling points, tips, gear, timeline — all there. Reload page after edits. Checklist state is in localStorage (`btr.*` keys).

## Deploy

```bash
bash scripts/deploy/deploy.sh
```

Pushes the runtime files + icons to `/var/www/btr-ultra/` on lifeos, syncs the nginx vhost (reloads only on change), and runs curl checks against the public URL.

## Force a cache update for installed clients

If you change `app.js`, `data.js`, or any cached asset and want existing installs to pick it up immediately (instead of waiting for the SW background-refresh cycle):

1. Bump the constant at the top of `service-worker.js`:
   ```js
   const CACHE_NAME = "btr-v2";  // was v1
   ```
2. Deploy. Installed clients will install the new SW on next launch and replace their cache.
