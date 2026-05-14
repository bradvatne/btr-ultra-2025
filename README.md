# BTR Ultra 60K — Race Prep

Self-contained static web app. No build step.

## Run

```bash
cd /Users/brad/code/btr-ultra-2025
python3 -m http.server 8765
# open http://localhost:8765
```

Must be served over HTTP (not `file://`) — the app fetches `btr-ultra-60k-full.gpx`.

## Files

- `index.html` — UI shell
- `app.js` — interactivity (map, elevation chart, pace calc, live tracker, checklists)
- `data.js` — all editable race data (aid stations, fueling, gear, tips, FR970 setup)
- `btr-ultra-60k-full.gpx` — **upload this to the watch** (course + 9 aid + 13 fueling)
- `btr-ultra-60k.gpx` — course + 9 aid only (no fueling waypoints)
- `btr-ultra-60k-original.gpx` — untouched from Trace de Trail
- `build_fueling_gpx.py` — regenerate the full GPX after editing aid/fueling in the script

## Edit content

Everything is in `data.js`. Aid stations, fueling points, tips, gear, timeline — all there. Reload page after edits. Checklist state is in localStorage (`btr.*` keys).
