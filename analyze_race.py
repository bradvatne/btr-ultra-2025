#!/usr/bin/env python3
"""Analyze actual race vs v4 plan.

Filters GPS jitter (1Hz tracking compounds noise) by:
  - downsampling to ~5s intervals
  - dropping inter-point segments where speed implies < 0.3 m/s movement (standing still)
  - capping single-step movement at 25 m (reject GPS teleport spikes)

Matches aid stations by GPS proximity to the planned waypoint, not by accumulated km.

Usage: python3 analyze_race.py [/path/to/race.gpx]
"""
import math
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

GPX = Path(sys.argv[1] if len(sys.argv) > 1 else "/Users/brad/Downloads/BTR_Ultra_60k_DNF_didn_t_make_the_cutoff_time_.gpx")
BALI_OFFSET = timedelta(hours=8)

# AS coordinates from the v4 GPX. (code, lat, lon, planned_km, target_h, cutoff_h, leg_pace, stop_min)
AID = [
    ("START", -8.251530, 115.398840, 0.0,  0.0,         None, None,  0),
    ("AS1",   -8.259590, 115.352180, 10.2, 2 + 43/60,   None, 16.0,  3),
    ("AS2",   -8.271530, 115.372010, 18.0, 4 +  8/60,   None, 10.5,  3),
    ("AS3",   -8.285190, 115.414490, 27.0, 6 +  8/60,   8.0,  13.0, 12),
    ("AS4",   -8.248550, 115.428360, 34.7, 9 + 48/60,   11.0, 27.0, 15),
]


def haversine_m(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = math.radians(b[0] - a[0])
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def parse_iso(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def fmt_clock(dt):
    return (dt + BALI_OFFSET).strftime("%H:%M:%S")


def fmt_elapsed(td):
    s = int(td.total_seconds())
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}"


def fmt_pace(mpk):
    if mpk is None or math.isinf(mpk) or math.isnan(mpk) or mpk == 0:
        return "  --  "
    m = int(mpk)
    s = int(round((mpk - m) * 60))
    if s == 60:
        m += 1
        s = 0
    return f"{m:2d}:{s:02d}/km"


# --- parse trackpoints ---
text = GPX.read_text()
pt_re = re.compile(
    r'<trkpt lat="(-?[\d.]+)" lon="(-?[\d.]+)">\s*'
    r'<ele>(-?[\d.]+)</ele>\s*'
    r'<time>([^<]+)</time>'
    r'(?:.*?<gpxtpx:hr>(\d+)</gpxtpx:hr>)?',
    re.S,
)

raw = []
for m in pt_re.finditer(text):
    raw.append((float(m.group(1)), float(m.group(2)), float(m.group(3)), parse_iso(m.group(4)), int(m.group(5)) if m.group(5) else None))

GUN = raw[0][3]
END = raw[-1][3]
total_elapsed = END - GUN
print(f"Raw trackpoints: {len(raw)}")
print(f"Gun (Bali): {fmt_clock(GUN)}    End (Bali): {fmt_clock(END)}    Elapsed: {fmt_elapsed(total_elapsed)}")
print()

# --- downsample to ~5s + reject GPS-noise / teleport segments ---
DOWNSAMPLE_S = 5
MIN_SPEED_MPS = 0.3   # below this, treat as stationary
MAX_STEP_M = 50       # reject GPS teleport (above 50m in 5s = 36 km/h, impossible on this terrain)

ds = [raw[0]]
last_t = raw[0][3]
for p in raw[1:]:
    if (p[3] - last_t).total_seconds() >= DOWNSAMPLE_S:
        ds.append(p)
        last_t = p[3]
if ds[-1] is not raw[-1]:
    ds.append(raw[-1])
print(f"Downsampled to {len(ds)} points (every ~{DOWNSAMPLE_S}s)")

# build filtered cumulative distance
cum_km = [0.0]
seg_counted = 0
seg_rejected_static = 0
seg_rejected_teleport = 0
for i in range(1, len(ds)):
    d_m = haversine_m(ds[i - 1][:2], ds[i][:2])
    dt_s = (ds[i][3] - ds[i - 1][3]).total_seconds()
    if dt_s <= 0:
        cum_km.append(cum_km[-1])
        continue
    speed = d_m / dt_s
    if speed < MIN_SPEED_MPS:
        cum_km.append(cum_km[-1])  # standing still
        seg_rejected_static += 1
        continue
    if d_m > MAX_STEP_M:
        cum_km.append(cum_km[-1])  # GPS teleport — drop
        seg_rejected_teleport += 1
        continue
    cum_km.append(cum_km[-1] + d_m / 1000.0)
    seg_counted += 1

total_km = cum_km[-1]
print(f"Counted segments: {seg_counted}  rejected (static): {seg_rejected_static}  rejected (teleport): {seg_rejected_teleport}")
print(f"Filtered total distance: {total_km:.2f} km  (course is 61.5 km — Brad covered {total_km - 61.5:+.1f} km vs plan)")
print()

# --- aid station arrivals by GPS proximity (use downsampled track) ---
PROXIMITY_M = 100
print("=" * 100)
print("AID STATION ARRIVALS (first time within 100m of planned waypoint)")
print("=" * 100)
print(f"{'AS':<5} {'plan TGT':>10} {'actual':>10} {'elapsed':>10} {'plan elap':>11} {'Δ vs plan':>12} {'cutoff':>8} {'status':>16} {'filt km':>9}")
print("-" * 100)

as_arrivals = []
for code, lat, lon, plan_km, target_h, cutoff_h, _, _ in AID:
    target = (lat, lon)
    idx_arr = None
    for i, p in enumerate(ds):
        if haversine_m((p[0], p[1]), target) <= PROXIMITY_M:
            idx_arr = i
            break
    if idx_arr is None:
        print(f"{code:<5}  (never within {PROXIMITY_M}m)")
        as_arrivals.append((code, None, None, None))
        continue
    t_arr = ds[idx_arr][3]
    elapsed_h = (t_arr - GUN).total_seconds() / 3600.0
    filt_km_at = cum_km[idx_arr]
    target_clock = (GUN + BALI_OFFSET + timedelta(hours=target_h)).strftime("%H:%M")
    actual_clock = (t_arr + BALI_OFFSET).strftime("%H:%M")
    delta_min = (elapsed_h - target_h) * 60
    cutoff_clock = ""
    status = ""
    if cutoff_h is not None:
        cutoff_clock = (GUN + BALI_OFFSET + timedelta(hours=cutoff_h)).strftime("%H:%M")
        margin_min = (cutoff_h - elapsed_h) * 60
        status = f"OK +{int(margin_min)}m" if margin_min >= 0 else f"MISSED {int(margin_min)}m"
    print(
        f"{code:<5} {target_clock:>10} {actual_clock:>10} {elapsed_h:>9.2f}h {target_h:>10.2f}h {delta_min:>+11.0f}m {cutoff_clock:>8} {status:>16} {filt_km_at:>8.1f}"
    )
    as_arrivals.append((code, t_arr, elapsed_h, filt_km_at))

print()
print("=" * 100)
print("PER-LEG SUMMARY")
print("=" * 100)
print(f"{'leg':<14} {'plan km':>8} {'actual km':>10} {'plan pace':>11} {'actual pace':>12} {'Δ pace':>10} {'plan time':>11} {'actual':>9} {'Δ time':>10}")
for i in range(1, len(AID)):
    prev_code = AID[i - 1][0]
    code = AID[i][0]
    plan_km = AID[i][3] - AID[i - 1][3]
    leg_pace_plan = AID[i][6]
    plan_time_min = (leg_pace_plan * plan_km) if leg_pace_plan else None

    prev_arr = as_arrivals[i - 1]
    arr = as_arrivals[i]
    if arr[1] is None or prev_arr[1] is None:
        continue

    actual_km_leg = arr[3] - prev_arr[3]
    leg_dur_min = (arr[1] - prev_arr[1]).total_seconds() / 60.0
    actual_pace = leg_dur_min / actual_km_leg if actual_km_leg > 0 else None

    label = f"{prev_code}→{code}"
    plan_str = fmt_pace(leg_pace_plan) if leg_pace_plan else "  --  "
    act_str = fmt_pace(actual_pace)
    dpace = actual_pace - leg_pace_plan if (leg_pace_plan and actual_pace) else None
    dpace_str = f"{dpace:+5.1f}min" if dpace is not None else "  --  "
    plan_time_str = f"{int(plan_time_min // 60)}h{int(plan_time_min % 60):02d}" if plan_time_min is not None else "  --  "
    act_time_str = f"{int(leg_dur_min // 60)}h{int(leg_dur_min % 60):02d}"
    dtime = leg_dur_min - plan_time_min if plan_time_min is not None else None
    dtime_str = f"{dtime:+5.0f}m" if dtime is not None else "  --  "
    print(f"{label:<14} {plan_km:>7.1f}  {actual_km_leg:>9.1f}  {plan_str:>11} {act_str:>12} {dpace_str:>10} {plan_time_str:>11} {act_time_str:>9} {dtime_str:>10}")

# --- per-km splits, sliding by FILTERED distance ---
print()
print("=" * 100)
print("PER-KM SPLITS (filtered cumulative; HR, elevation gain/loss)")
print("=" * 100)
print(f"{'km':>4} {'pace':>10} {'HR':>4} {'gain':>5} {'loss':>5} {'cum time':>10}  {'note'}")
splits = []
current_km = 1
gain = 0.0
loss = 0.0
hr_sum = 0
hr_n = 0
last_t = ds[0][3]
for i in range(1, len(ds)):
    de = ds[i][2] - ds[i - 1][2]
    if de > 0:
        gain += de
    else:
        loss += -de
    if ds[i][4]:
        hr_sum += ds[i][4]
        hr_n += 1
    while cum_km[i] >= current_km and current_km <= int(total_km):
        t_at = ds[i][3]
        dur_s = (t_at - last_t).total_seconds()
        pace = dur_s / 60.0
        avg_hr = hr_sum / hr_n if hr_n else None
        splits.append((current_km, t_at - GUN, pace, avg_hr, gain, loss))
        gain = 0.0
        loss = 0.0
        hr_sum = 0
        hr_n = 0
        last_t = t_at
        current_km += 1

# annotate each km with the leg it belongs to
def leg_for_km(km_filt):
    for j in range(1, len(as_arrivals)):
        if as_arrivals[j][3] is None:
            continue
        if km_filt <= as_arrivals[j][3]:
            return f"{as_arrivals[j-1][0]}→{as_arrivals[j][0]}"
    return ""

for s in splits:
    km, elapsed, pace, hr, g, l = s
    hr_str = f"{hr:.0f}" if hr else " — "
    leg = leg_for_km(km)
    flag = ""
    if pace > 25:
        flag = "  (long stop / hike)"
    print(f"{km:>4d} {fmt_pace(pace):>10} {hr_str:>4} {g:>5.0f} {l:>5.0f} {fmt_elapsed(elapsed):>10}  {leg}{flag}")
