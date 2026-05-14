#!/usr/bin/env python3
"""Generate a fully-augmented GPX with aid-station + fueling waypoints for the FR970.

Waypoint comments encode the v4 plan (data.js):
  - target clock time + cumulative h:mm
  - cutoff + cushion (if any)
  - leg pace and leg duration arriving at this AS
  - planned stop minutes + key action
"""
import math
import re
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "btr-ultra-60k-original.gpx"
DST = HERE / "btr-ultra-60k-full.gpx"

RACE_START_HOUR = 4.0

# (code, name, km, cutoff_h, target_h, leg_pace_min_per_km, stop_min, action)
# Mirrors window.DATA.aid_stations v4 plan in data.js.
AID = [
    ("START",  "Start - Batur Natural Hot Spring", 0.0,   None, 0.0,           None,  0,
     "Walk first 200m to settle vest. Build into pace."),
    ("AS1",    "AS1 - Pasir Culali",               10.2,  None, 2 + 43/60,     16.0,  3,
     "Top up Pocari. Quick — 3 min."),
    ("AS2",    "AS2 - Tanjakan Cinta",             18.0,  None, 4 +  8/60,     10.5,  3,
     "Top up Pocari. Sunglasses on. 3 min."),
    ("AS3",    "AS3 - Gunung Abang",               27.0,  8.0,  6 +  8/60,     13.0, 12,
     "Drop bag #1. Coke + rice/soto + banana. Refill BOTH flasks. 12 min."),
    ("AS4",    "AS4 - Desa Terunyan",              34.7, 11.0,  9 + 48/60,     27.0, 15,
     "Drop bag #2. Fresh socks. Rice+chicken+watermelon. Coke. Refill BOTH. 15 min."),
    ("AS5",    "AS5 - Pedahan",                    39.3,  None, 11 + 40/60,    21.0,  3,
     "Quick refill. 3 min."),
    ("AS6",    "AS6 - Alengkong",                  47.0,  None, 13 + 42/60,    15.5,  5,
     "Coke for caffeine. Real food. Refill. 5 min."),
    ("AS7",    "AS7 - Songan Village",             55.6,  None, 15 + 43/60,    13.5,  3,
     "Last caffeine. Refill. 3 min — send it."),
    ("FINISH", "Finish - Batur Natural Hot Spring",61.5, 19.0, 16 + 57/60,     12.0,  0,
     "Drop bag retrieval. Sit. Smile."),
]

# Fueling waypoints between aid stations. (km, label, what to do)
FUEL = [
    (3.0,  "Fuel - Sari Roti #1",     "1 piece Sari Roti Cokelat. Sip Pocari."),
    (6.0,  "Fuel - Salt + Drink",     "1x salt cap. 200ml Pocari. Pre-Pasir climb."),
    (13.0, "Fuel - Sari Roti #2",     "1 piece. AS1 just refilled your flasks."),
    (16.0, "Fuel - Salt + Sip",       "1x salt cap. Force a drink — heat building."),
    (21.0, "Fuel - Sari Roti #3",     "1 piece. Big drink before Abang push."),
    (24.0, "Fuel - Salt + Sip",       "1x salt cap. Coke at AS3 = caffeine onramp."),
    (30.0, "Fuel - CAFFEINE backup",  "Caffeine gel ONLY if Coke at AS3 didn't land. Salt."),
    (33.0, "Fuel - Small bite",       "Half Sari Roti or banana. Brutal descent — stomach-safe only."),
    (37.0, "Fuel - Sari Roti #4",     "1 piece. AS4 was the big reset — you're stocked."),
    (42.0, "Fuel - Salt + Drink",     "1x salt cap. Drain bottle before AS5."),
    (45.0, "Fuel - Sari Roti #5",     "1 piece. Caffeine backup gel if energy dipping."),
    (51.0, "Fuel - Sari Roti #6",     "1 piece + salt. Long final leg."),
    (58.0, "Fuel - Final CAFFEINE",   "Last caffeine gel OR Coke at AS7. Drive home."),
]


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def fmt_clock(h):
    total = round((RACE_START_HOUR + h) * 60)
    H = (total // 60) % 24
    M = total % 60
    suf = "AM" if H < 12 else "PM"
    h12 = H % 12 or 12
    return f"{h12}:{M:02d} {suf}"


def fmt_pace(mpk):
    m = int(mpk)
    s = int(round((mpk - m) * 60))
    if s == 60:
        m += 1
        s = 0
    return f"{m}:{s:02d}/km"


def fmt_hm(minutes):
    h = int(minutes // 60)
    m = int(round(minutes - h * 60))
    if m == 60:
        h += 1
        m = 0
    if h == 0:
        return f"{m}min"
    return f"{h}h{m:02d}"


text = SRC.read_text()
pts_re = re.compile(r'<trkpt lat="(-?[\d.]+)" lon="(-?[\d.]+)">\s*<ele>(-?[\d.]+)</ele>', re.S)
points = [(float(la), float(lo), float(el)) for la, lo, el in pts_re.findall(text)]
cum = [0.0]
for i in range(1, len(points)):
    cum.append(cum[-1] + haversine_m(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]) / 1000.0)
total_km = cum[-1]


def wpt_at(km):
    idx = min(range(len(cum)), key=lambda i: abs(cum[i] - min(km, total_km)))
    return idx, points[idx], cum[idx]


wpts = []

prev_km = None
for code, name, km, cutoff_h, target_h, leg_pace, stop_min, action in AID:
    idx, (lat, lon, ele), actual_km = wpt_at(km)

    parts = [f"KM {km:.1f}"]
    parts.append(f"TGT {fmt_clock(target_h)} (+{fmt_hm(target_h*60)})")

    if cutoff_h is not None and km > 0:
        cushion = (cutoff_h - target_h) * 60
        parts.append(f"CUTOFF {fmt_clock(cutoff_h)} (+{fmt_hm(cushion)} cushion)")

    if leg_pace is not None and prev_km is not None:
        leg_dist = km - prev_km
        leg_min = leg_dist * leg_pace
        parts.append(f"Leg {fmt_pace(leg_pace)} ({leg_dist:.1f}km / {fmt_hm(leg_min)})")

    if stop_min > 0:
        parts.append(f"Stop {stop_min}min")

    parts.append(action)

    desc = " | ".join(parts)
    sym = "Flag, Red" if cutoff_h is not None else "Flag, Blue"
    wpts.append({
        "lat": lat, "lon": lon, "ele": ele,
        "name": name, "desc": desc, "sym": sym, "type": "Aid Station",
        "km": km,
    })
    prev_km = km

for km, name, action in FUEL:
    idx, (lat, lon, ele), actual_km = wpt_at(km)
    # linearly interpolate target time using v4 cumulative targets at surrounding AID
    aid_kms = [a[2] for a in AID]
    aid_ts = [a[4] for a in AID]
    target_h = None
    for i in range(len(aid_kms) - 1):
        if aid_kms[i] <= km <= aid_kms[i + 1]:
            f = (km - aid_kms[i]) / (aid_kms[i + 1] - aid_kms[i])
            target_h = aid_ts[i] + f * (aid_ts[i + 1] - aid_ts[i])
            break
    target_str = f" | TGT {fmt_clock(target_h)}" if target_h is not None else ""
    desc = f"KM {km:.1f}{target_str} | {action}"
    wpts.append({
        "lat": lat, "lon": lon, "ele": ele,
        "name": name, "desc": desc, "sym": "Restaurant", "type": "Fueling",
        "km": km,
    })

wpts.sort(key=lambda w: w["km"])

xml = []
for w in wpts:
    xml.append(
        f'  <wpt lat="{w["lat"]:.6f}" lon="{w["lon"]:.6f}">\n'
        f'    <ele>{w["ele"]:.0f}</ele>\n'
        f'    <name>{w["name"]}</name>\n'
        f'    <cmt>{w["desc"]}</cmt>\n'
        f'    <desc>{w["desc"]}</desc>\n'
        f'    <sym>{w["sym"]}</sym>\n'
        f'    <type>{w["type"]}</type>\n'
        f'  </wpt>\n'
    )

block = "".join(xml)
out = text.replace("</metadata>", "</metadata>\n" + block.rstrip() + "\n", 1)
DST.write_text(out)
n_aid = sum(1 for w in wpts if w['type'] == 'Aid Station')
n_fuel = sum(1 for w in wpts if w['type'] == 'Fueling')
print(f"Wrote {DST.name}: {len(wpts)} waypoints ({n_aid} aid, {n_fuel} fueling) — v4 plan")
