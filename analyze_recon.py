#!/usr/bin/env python3
"""
analyze_recon.py — Build pace × grade × HR models from two reference efforts:

    1. AS3→AS4 recon (hiking baseline — calibrates pace on steep / technical terrain).
    2. Flat 30k run in heat (running baseline — calibrates pace on runnable terrain).

For each km of the race course, pick the model whose terrain best matches:
    - |grade| > GRADE_THRESHOLD_PCT  → hike model
    - otherwise                       → run model

Then project Z2 race-day times by HR cap.

Usage:
    python3 analyze_recon.py

Inputs (in same dir):
    recon-abang-terunyan.gpx   - recon (hike) with HR
    run-flat-30k.gpx           - flat run in heat with HR
    btr-ultra-60k-full.gpx     - race course

Outputs:
    recon-analysis.json        - structured output the web app consumes
    stdout                     - readable summary
"""

import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from statistics import median

HERE = Path(__file__).parent
RECON_GPX = HERE / "recon-abang-terunyan.gpx"
RUN_GPX = HERE / "run-flat-30k.gpx"
COURSE_GPX = HERE / "btr-ultra-60k-full.gpx"
OUT_JSON = HERE / "recon-analysis.json"

GPX_NS = {
    "g": "http://www.topografix.com/GPX/1/1",
    "tpx": "http://www.garmin.com/xmlschemas/TrackPointExtension/v1",
}

# HR caps to model — Brad asked for multiple so he can compare projections.
HR_CAPS = [140, 145, 150]

# Grade bin edges in percent — chosen to cover the recon's observed grade range.
GRADE_BINS = [-30, -22, -16, -12, -8, -5, -2, 2, 5, 8, 12, 16, 22, 30]

# Below this |grade|, use the running baseline; above, use the hiking baseline.
GRADE_THRESHOLD_PCT = 8.0

# Linear fatigue ramp applied per-km. Both baselines are fresh-effort samples
# (the recon was a fresh hike, the run was a fresh 30k). On race day Brad hits
# km 50+ glycogen-depleted, heat-cooked, and slower at the same Z2 HR.
# Ramp goes from 1.0× at km 0 to FATIGUE_END_FACTOR at km 60.
FATIGUE_END_FACTOR = 1.18  # 18% slower at finish vs fresh-pace baseline


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def parse_iso_to_epoch_sec(s):
    # GPX timestamps are like "2026-04-04T23:12:56Z"
    s = s.rstrip("Z")
    # split fractional seconds if present
    if "." in s:
        s = s.split(".", 1)[0]
    yyyy, mm, rest = s.split("-", 2)
    dd, tm = rest.split("T", 1)
    HH, MM, SS = tm.split(":")
    # Naive epoch — only diffs matter for this analysis.
    import datetime
    dt = datetime.datetime(
        int(yyyy), int(mm), int(dd), int(HH), int(MM), int(SS),
        tzinfo=datetime.timezone.utc,
    )
    return dt.timestamp()


def parse_gpx(path, want_hr=False):
    """Returns a list of dicts: {lat, lon, ele, t (sec, may be None), hr (may be None)}."""
    tree = ET.parse(path)
    root = tree.getroot()
    pts = []
    for trkpt in root.iter("{http://www.topografix.com/GPX/1/1}trkpt"):
        lat = float(trkpt.attrib["lat"])
        lon = float(trkpt.attrib["lon"])
        ele_el = trkpt.find("g:ele", GPX_NS)
        ele = float(ele_el.text) if ele_el is not None else 0.0
        t = None
        time_el = trkpt.find("g:time", GPX_NS)
        if time_el is not None and time_el.text:
            try:
                t = parse_iso_to_epoch_sec(time_el.text)
            except Exception:
                t = None
        hr = None
        if want_hr:
            for hr_el in trkpt.iter("{http://www.garmin.com/xmlschemas/TrackPointExtension/v1}hr"):
                try:
                    hr = int(hr_el.text)
                    break
                except Exception:
                    pass
        pts.append({"lat": lat, "lon": lon, "ele": ele, "t": t, "hr": hr})
    return pts


def smooth_ele(pts, window=5):
    """5-point moving average on elevation."""
    n = len(pts)
    smoothed = []
    for i, p in enumerate(pts):
        lo = max(0, i - window)
        hi = min(n - 1, i + window)
        s = sum(pts[j]["ele"] for j in range(lo, hi + 1))
        smoothed.append({**p, "ele_sm": s / (hi - lo + 1)})
    return smoothed


def cumulate_km(pts):
    cum = 0.0
    out = []
    for i, p in enumerate(pts):
        if i > 0:
            cum += haversine_m(pts[i - 1]["lat"], pts[i - 1]["lon"], p["lat"], p["lon"]) / 1000.0
        out.append({**p, "km": cum})
    return out


def compute_segments(pts, max_gap_sec=30, min_dx_m=1.0):
    """For each consecutive trkpt pair: return dt, dx, de, grade, pace_min_per_km, hr_avg."""
    segs = []
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        dt = (b["t"] - a["t"]) if (a["t"] is not None and b["t"] is not None) else None
        dx = haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])
        de = b["ele_sm"] - a["ele_sm"]
        if dt is None or dt <= 0 or dt > max_gap_sec:
            continue
        if dx < min_dx_m:
            continue
        pace = (dt / 60.0) / (dx / 1000.0)  # min/km
        if pace > 60:  # effectively stopped
            continue
        grade = (de / dx) * 100.0
        hr_avg = None
        if a["hr"] is not None and b["hr"] is not None:
            hr_avg = (a["hr"] + b["hr"]) / 2.0
        segs.append({
            "dt": dt, "dx": dx, "de": de,
            "pace": pace, "grade": grade, "hr": hr_avg,
        })
    return segs


def bin_index(grade, edges):
    for i in range(len(edges) - 1):
        if edges[i] <= grade < edges[i + 1]:
            return i
    return None


def build_lookup(segs, hr_cap, edges):
    """Returns: {grade_pct (bin midpoint): {median_pace, n, p25, p75, mean_grade}}."""
    buckets = [[] for _ in range(len(edges) - 1)]
    for s in segs:
        if s["hr"] is None or s["hr"] > hr_cap:
            continue
        i = bin_index(s["grade"], edges)
        if i is None:
            continue
        buckets[i].append(s)
    lookup = {}
    for i, segs_in_bin in enumerate(buckets):
        if not segs_in_bin:
            continue
        mid = (edges[i] + edges[i + 1]) / 2.0
        # weight pace by segment distance so longer segments count more
        # but for median, use raw paces
        paces = sorted(s["pace"] for s in segs_in_bin)
        p25 = paces[int(len(paces) * 0.25)]
        p75 = paces[min(len(paces) - 1, int(len(paces) * 0.75))]
        # distance-weighted mean pace = total time / total distance
        total_time = sum(s["dt"] for s in segs_in_bin)
        total_dx = sum(s["dx"] for s in segs_in_bin)
        weighted_pace = (total_time / 60.0) / (total_dx / 1000.0)
        lookup[round(mid, 2)] = {
            "median_pace": round(median(paces), 2),
            "weighted_pace": round(weighted_pace, 2),
            "p25": round(p25, 2),
            "p75": round(p75, 2),
            "n_segments": len(segs_in_bin),
            "total_km": round(total_dx / 1000.0, 3),
        }
    return lookup


def predict_pace(grade, lookup):
    """Linear-interpolate pace from the lookup at a given grade. Use weighted_pace."""
    if not lookup:
        return None
    grades = sorted(lookup.keys())
    # clamp to extremes
    if grade <= grades[0]:
        return lookup[grades[0]]["weighted_pace"]
    if grade >= grades[-1]:
        return lookup[grades[-1]]["weighted_pace"]
    # linear between two flanking grades
    for i in range(len(grades) - 1):
        g_lo, g_hi = grades[i], grades[i + 1]
        if g_lo <= grade <= g_hi:
            p_lo = lookup[g_lo]["weighted_pace"]
            p_hi = lookup[g_hi]["weighted_pace"]
            frac = (grade - g_lo) / (g_hi - g_lo) if g_hi > g_lo else 0
            return p_lo + frac * (p_hi - p_lo)
    return None


def fatigue_factor(km, total_km, end_factor):
    """Linear ramp from 1.0 at km 0 to end_factor at km total_km."""
    if total_km <= 0:
        return 1.0
    return 1.0 + (end_factor - 1.0) * (km / total_km)


def project_course(course_pts, hike_lookup, run_lookup, grade_threshold_pct, fatigue_end=1.0, total_km=60.0):
    """For each km of the course, pick hike or run model based on grade, predict Z2 pace.
    Apply linear fatigue ramp from 1.0× at km 0 to fatigue_end× at total_km.
    Returns per-km list + total."""
    if not course_pts:
        return {"per_km": [], "total_min": 0.0}
    per_km = []
    n_km = int(course_pts[-1]["km"]) + 1
    for k in range(n_km):
        lo, hi = float(k), float(k + 1)
        in_km = [p for p in course_pts if lo <= p["km"] < hi]
        if not in_km:
            continue
        first, last = in_km[0], in_km[-1]
        dx = (last["km"] - first["km"]) * 1000.0
        if dx < 50:
            continue
        de = last["ele_sm"] - first["ele_sm"]
        grade = (de / dx) * 100.0 if dx > 0 else 0
        # Pick model: steep grades use hike; runnable grades use run.
        if abs(grade) > grade_threshold_pct:
            model_used = "hike"
            base_pace = predict_pace(grade, hike_lookup)
        else:
            model_used = "run"
            base_pace = predict_pace(grade, run_lookup)
            if base_pace is None and hike_lookup:
                base_pace = predict_pace(grade, hike_lookup)
                model_used = "hike"
        # Apply fatigue ramp at midpoint of this km
        mid_km = (first["km"] + last["km"]) / 2.0
        fat = fatigue_factor(mid_km, total_km, fatigue_end)
        pace = base_pace * fat if base_pace is not None else None
        gain = 0.0
        loss = 0.0
        for j in range(1, len(in_km)):
            d = in_km[j]["ele_sm"] - in_km[j - 1]["ele_sm"]
            if d > 0:
                gain += d
            else:
                loss += -d
        per_km.append({
            "km": k + 1,
            "km_start": round(first["km"], 3),
            "km_end": round(last["km"], 3),
            "dist_km": round(last["km"] - first["km"], 3),
            "ele_start": round(first["ele_sm"], 1),
            "ele_end": round(last["ele_sm"], 1),
            "grade_pct": round(grade, 2),
            "gain_m": round(gain, 1),
            "loss_m": round(loss, 1),
            "fatigue_factor": round(fat, 3),
            "base_pace": round(base_pace, 2) if base_pace is not None else None,
            "z2_pace": round(pace, 2) if pace is not None else None,
            "z2_min": round(pace * (last["km"] - first["km"]), 2) if pace is not None else None,
            "model_used": model_used,
        })
    total_min = sum(r["z2_min"] for r in per_km if r["z2_min"] is not None)
    return {"per_km": per_km, "total_min": round(total_min, 1)}


def project_per_leg(per_km_rows, aid_stations):
    """Group per-km rows by leg (between consecutive AS km marks). Returns per-leg summary."""
    legs = []
    for i in range(1, len(aid_stations)):
        prev = aid_stations[i - 1]
        cur = aid_stations[i]
        rows = [r for r in per_km_rows if r["km_start"] >= prev["km"] - 0.001 and r["km_end"] <= cur["km"] + 0.5]
        if not rows:
            continue
        total_min = sum(r["z2_min"] for r in rows if r["z2_min"] is not None)
        total_km = sum(r["dist_km"] for r in rows)
        avg_pace = total_min / total_km if total_km > 0 else 0
        gain = sum(r["gain_m"] for r in rows)
        loss = sum(r["loss_m"] for r in rows)
        legs.append({
            "from_code": prev["code"], "to_code": cur["code"],
            "dist_km": round(total_km, 2),
            "avg_pace_min_per_km": round(avg_pace, 2),
            "z2_min": round(total_min, 1),
            "gain_m": round(gain, 1),
            "loss_m": round(loss, 1),
        })
    return legs


def fmt_hm(minutes):
    total = int(round(minutes * 60))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h}h {m:02d}m {s:02d}s"


def fmt_pace(mpk):
    if mpk is None:
        return "—"
    m = int(mpk)
    s = int(round((mpk - m) * 60))
    if s == 60:
        m += 1
        s = 0
    return f"{m}:{s:02d}/km"


# Hard-coded AS km marks (kept in sync with data.js).
AID_STATIONS = [
    {"code": "START", "name": "Hot Spring",      "km": 0.0},
    {"code": "AS1",   "name": "Pasir Culali",    "km": 10.2},
    {"code": "AS2",   "name": "Tanjakan Cinta",  "km": 18.0},
    {"code": "AS3",   "name": "Gunung Abang",    "km": 27.0},
    {"code": "AS4",   "name": "Desa Terunyan",   "km": 34.7},
    {"code": "AS5",   "name": "Pedahan",         "km": 39.3},
    {"code": "AS6",   "name": "Alengkong",       "km": 47.0},
    {"code": "AS7",   "name": "Songan",          "km": 55.6},
    {"code": "FINISH","name": "Hot Spring",      "km": 61.5},
]


def hr_summary(segs):
    hrs = sorted([s["hr"] for s in segs if s["hr"] is not None])
    if not hrs:
        return {"n": 0}
    return {
        "n": len(hrs),
        "min": hrs[0],
        "max": hrs[-1],
        "p10": hrs[int(len(hrs) * 0.10)],
        "p25": hrs[int(len(hrs) * 0.25)],
        "median": hrs[int(len(hrs) * 0.50)],
        "p75": hrs[int(len(hrs) * 0.75)],
        "p90": hrs[int(len(hrs) * 0.90)],
    }


def load_effort(gpx_path, label):
    print(f"Parsing {label}: {gpx_path.name}")
    raw = parse_gpx(gpx_path, want_hr=True)
    sm = smooth_ele(raw, window=5)
    pts = cumulate_km(sm)
    segs = compute_segments(pts)
    hr_s = hr_summary(segs)
    print(f"  {len(pts)} trkpts · {pts[-1]['km']:.2f} km · {len(segs)} moving segments · HR median={hr_s.get('median')}")
    return pts, segs, hr_s


def main():
    for p in (RECON_GPX, RUN_GPX, COURSE_GPX):
        if not p.exists():
            print(f"ERROR: missing {p}", file=sys.stderr)
            sys.exit(1)

    # Two reference efforts.
    hike_pts, hike_segs, hike_hr = load_effort(RECON_GPX, "hike-recon")
    run_pts, run_segs, run_hr = load_effort(RUN_GPX, "flat-run")

    # Course
    print(f"Parsing course: {COURSE_GPX.name}")
    course_raw = parse_gpx(COURSE_GPX, want_hr=False)
    course_smoothed = smooth_ele(course_raw, window=5)
    course_pts = cumulate_km(course_smoothed)
    total_gain = 0.0
    total_loss = 0.0
    for i in range(1, len(course_pts)):
        d = course_pts[i]["ele_sm"] - course_pts[i - 1]["ele_sm"]
        if d > 0:
            total_gain += d
        else:
            total_loss += -d
    print(f"  {len(course_pts)} trkpts · {course_pts[-1]['km']:.2f} km · +{round(total_gain)}m / -{round(total_loss)}m (smoothed)")
    print(f"Grade threshold for picking hike vs run: ±{GRADE_THRESHOLD_PCT}%")
    print(f"Fatigue ramp: 1.00× at km 0 → {FATIGUE_END_FACTOR}× at km {course_pts[-1]['km']:.1f}")
    print()

    course_total_km = course_pts[-1]["km"]

    # Build models per HR cap — separate lookups for hike + run, combined per-km projection.
    models = {}
    for cap in HR_CAPS:
        hike_lookup = build_lookup(hike_segs, cap, GRADE_BINS)
        run_lookup = build_lookup(run_segs, cap, GRADE_BINS)
        course_proj = project_course(course_pts, hike_lookup, run_lookup, GRADE_THRESHOLD_PCT,
                                     fatigue_end=FATIGUE_END_FACTOR, total_km=course_total_km)
        leg_proj = project_per_leg(course_proj["per_km"], AID_STATIONS)
        models[str(cap)] = {
            "hr_cap": cap,
            "n_hike_segments_used": sum(b["n_segments"] for b in hike_lookup.values()),
            "n_run_segments_used": sum(b["n_segments"] for b in run_lookup.values()),
            # legacy field for backwards compat with existing splits tab
            "n_segments_used": sum(b["n_segments"] for b in hike_lookup.values()) + sum(b["n_segments"] for b in run_lookup.values()),
            "hike_grade_lookup": hike_lookup,
            "run_grade_lookup": run_lookup,
            # legacy alias so existing splits tab keeps working
            "grade_lookup": hike_lookup,
            "course_per_km": course_proj["per_km"],
            "course_total_min": course_proj["total_min"],
            "course_leg_proj": leg_proj,
        }

    # Stdout: human summary
    print("=" * 84)
    print(f"{'HR cap':<10}{'hike segs':>12}{'run segs':>12}{'course total':>20}{'finish ETA':>20}")
    print("-" * 84)
    for cap in HR_CAPS:
        m = models[str(cap)]
        total_h = m["course_total_min"] / 60.0
        eta_min = 4 * 60 + m["course_total_min"]
        eta_h = int(eta_min // 60) % 24
        eta_m = int(round(eta_min % 60))
        eta = f"{eta_h:02d}:{eta_m:02d}"
        cushion = (19 - total_h) * 60
        cushion_str = f"{'+' if cushion >= 0 else '-'}{abs(cushion):.0f}m"
        print(f"≤{cap:<9}{m['n_hike_segments_used']:>12}{m['n_run_segments_used']:>12}{fmt_hm(m['course_total_min']):>20}{eta + ' (' + cushion_str + ')':>20}")
    print("=" * 84)
    print()
    print("Per-leg projection (HR cap = 145, hike-vs-run picked per km):")
    print(f"{'Leg':<22}{'Dist':>8}{'+Elev':>8}{'-Elev':>8}{'Avg pace':>12}{'Time':>12}")
    print("-" * 78)
    cumul = 0.0
    for leg in models["145"]["course_leg_proj"]:
        cumul += leg["z2_min"]
        print(f"{leg['from_code']+' → '+leg['to_code']:<22}"
              f"{leg['dist_km']:>6.2f}km"
              f"{'+'+str(int(leg['gain_m'])):>8}"
              f"{'-'+str(int(leg['loss_m'])):>8}"
              f"{fmt_pace(leg['avg_pace_min_per_km']):>12}"
              f"{fmt_hm(leg['z2_min']):>12}")
    print("-" * 78)
    print(f"{'TOTAL':<22}{'':<8}{'':<8}{'':<8}{'':<12}{fmt_hm(cumul):>12}")
    print()

    # Show grade-bin tables for transparency — HR 145 only
    cap = 145
    m = models[str(cap)]
    print(f"Hike grade-bin lookup (HR ≤ {cap}):")
    print(f"  {'Grade %':>10}{'Pace':>12}{'P25':>10}{'P75':>10}{'n_seg':>8}{'km':>8}")
    for g, b in sorted(m["hike_grade_lookup"].items()):
        print(f"  {g:>10}{fmt_pace(b['weighted_pace']):>12}{fmt_pace(b['p25']):>10}{fmt_pace(b['p75']):>10}{b['n_segments']:>8}{b['total_km']:>8.3f}")
    print()
    print(f"Run grade-bin lookup (HR ≤ {cap}):")
    print(f"  {'Grade %':>10}{'Pace':>12}{'P25':>10}{'P75':>10}{'n_seg':>8}{'km':>8}")
    for g, b in sorted(m["run_grade_lookup"].items()):
        print(f"  {g:>10}{fmt_pace(b['weighted_pace']):>12}{fmt_pace(b['p25']):>10}{fmt_pace(b['p75']):>10}{b['n_segments']:>8}{b['total_km']:>8.3f}")
    print()

    # Per-km model usage summary
    used_run = sum(1 for r in m["course_per_km"] if r["model_used"] == "run")
    used_hike = sum(1 for r in m["course_per_km"] if r["model_used"] == "hike")
    print(f"Per-km model choice (HR 145): {used_run} km use the run model, {used_hike} km use the hike model.")
    print()

    # Write JSON
    out = {
        "recon_summary": {
            "n_segments": len(hike_segs),
            "total_km": round(hike_pts[-1]["km"], 3),
            "hr_stats": hike_hr,
        },
        "run_summary": {
            "n_segments": len(run_segs),
            "total_km": round(run_pts[-1]["km"], 3),
            "hr_stats": run_hr,
        },
        "course_summary": {
            "n_trkpts": len(course_pts),
            "total_km": round(course_pts[-1]["km"], 3),
            "smoothed_gain_m": round(total_gain, 1),
            "smoothed_loss_m": round(total_loss, 1),
        },
        "aid_stations": AID_STATIONS,
        "grade_bins": GRADE_BINS,
        "grade_threshold_pct": GRADE_THRESHOLD_PCT,
        "fatigue_end_factor": FATIGUE_END_FACTOR,
        "hr_caps": HR_CAPS,
        "models": models,
    }
    with OUT_JSON.open("w") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {OUT_JSON.name} ({OUT_JSON.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
