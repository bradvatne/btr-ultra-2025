// BTR Ultra 60K race-prep app. Reads window.DATA. Loads btr-ultra-60k-full.gpx for map + elevation.

const D = window.DATA;
const RACE_START_HOUR = 4.0;

// ---------------- utils ----------------
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function fmtPace(mpk) {
  const m = Math.floor(mpk);
  let s = Math.round((mpk - m) * 60);
  if (s === 60) return `${m+1}:00/km`;
  return `${m}:${String(s).padStart(2,"0")}/km`;
}
function hoursToClock(h, baseHour = RACE_START_HOUR) {
  const tot = Math.round((baseHour + h) * 60);
  const H = ((tot / 60) | 0) % 24;
  const M = tot % 60;
  const suf = H < 12 ? "AM" : "PM";
  const h12 = (H % 12) || 12;
  return `${h12}:${String(M).padStart(2,"0")} ${suf}`;
}
function hoursToHM(h) {
  const totMin = Math.max(0, Math.round(h * 60));
  return `${Math.floor(totMin/60)}h ${totMin%60}m`;
}
function clockToHours(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  return h + m/60;
}

// ---------------- tabs ----------------
function activateTab(tab) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (!btn) return;
  $$(".tab-btn").forEach(b => b.dataset.active = (b === btn).toString());
  $$("[data-panel]").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== tab));
  if (tab === "map" && map) setTimeout(() => map.invalidateSize(), 80);
  if (tab === "elevation" && elevChart) setTimeout(() => elevChart.resize(), 80);
  // Scroll the active tab into view on mobile (no-op if already visible).
  btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}
$$(".tab-btn").forEach(btn => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));

// In-page links can switch tabs by setting data-goto-tab="<tab name>".
// We dispatch a real click on the underlying button so lazy-load listeners
// (splits, recon) also fire.
$$("[data-goto-tab]").forEach(link => link.addEventListener("click", (e) => {
  e.preventDefault();
  const btn = document.querySelector(`.tab-btn[data-tab="${link.dataset.gotoTab}"]`);
  if (btn) btn.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}));

// Toggle .scrolled-start / .scrolled-end on the tab nav wrap based on scroll
// position, so the chevron indicators only show when there's actually more to scroll.
(function setupTabScrollIndicators() {
  const wrap = document.querySelector(".tab-nav-wrap");
  const nav  = wrap?.querySelector(".tab-nav");
  if (!wrap || !nav) return;
  const update = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    if (max <= 1) {
      // nothing to scroll — no indicators
      wrap.classList.remove("scrolled-start", "scrolled-end");
      wrap.classList.add("scrolled-end"); // hides right chevron
      return;
    }
    wrap.classList.toggle("scrolled-start", nav.scrollLeft > 4);
    wrap.classList.toggle("scrolled-end", nav.scrollLeft >= max - 4);
  };
  nav.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();

// ---------------- live clock ----------------
function tickClock() {
  const now = new Date();
  $("#liveClock").textContent = now.toLocaleTimeString();
}
tickClock(); setInterval(tickClock, 1000);

// ---------------- overview pace table (v2 plan, leg-by-leg) ----------------
function buildOverviewPace() {
  const A = D.aid_stations;
  const rows = A.map((a, i) => {
    const prev = i > 0 ? A[i-1] : null;
    const legDist = prev ? (a.km - prev.km) : 0;
    const legTimeMin = prev ? (a.target_h - prev.target_h) * 60 : 0;
    const legPace = a.leg_pace_min_per_km;
    const stopMin = a.stop_min;
    const cushion = a.cutoff_h != null ? (a.cutoff_h - a.target_h) : null;
    const cushionClass = cushion == null ? "text-stone-400" :
      cushion >= 0.5 ? "text-emerald-700 font-bold" :
      cushion >= 0.25 ? "text-amber-700 font-bold" :
      cushion >= 0 ? "text-rose-700 font-bold" :
      "text-white bg-rose-700 px-1.5 rounded font-bold";
    const gain = a.leg_gain_m;
    const loss = a.leg_loss_m;
    return `
      <tr class="border-t border-stone-200 ${a.cutoff_h != null ? 'bg-rose-50/40' : ''}">
        <td class="py-2 px-2 font-mono text-xs">${a.code}</td>
        <td class="py-2 px-2 text-sm">${a.name}</td>
        <td class="py-2 px-2 text-right font-mono text-xs">${a.km.toFixed(1)}</td>
        <td class="py-2 px-2 text-right font-mono text-xs text-stone-500">${legDist > 0 ? legDist.toFixed(1) : "—"}</td>
        <td class="py-2 px-2 text-right font-mono text-xs ${gain != null ? 'text-emerald-700' : 'text-stone-400'}">${gain != null ? "+" + gain : "—"}</td>
        <td class="py-2 px-2 text-right font-mono text-xs ${loss != null ? 'text-sky-700' : 'text-stone-400'}">${loss != null ? "−" + loss : "—"}</td>
        <td class="py-2 px-2 text-right font-mono ${legPace != null ? '' : 'text-stone-400'}">${legPace != null ? fmtPace(legPace) : "—"}</td>
        <td class="py-2 px-2 text-right font-mono text-xs text-stone-600">${prev ? hoursToHM(legTimeMin/60) : "—"}</td>
        <td class="py-2 px-2 text-right font-mono font-semibold">${hoursToClock(a.target_h)}</td>
        <td class="py-2 px-2 text-right font-mono text-xs ${stopMin > 0 ? 'text-stone-600' : 'text-stone-400'}">${stopMin > 0 ? stopMin + "m" : "—"}</td>
        <td class="py-2 px-2 text-right font-mono ${a.cutoff_h != null ? 'text-rose-700' : 'text-stone-400'}">${a.cutoff_h != null ? hoursToClock(a.cutoff_h) : "—"}</td>
        <td class="py-2 px-2 text-right font-mono ${cushionClass}">${cushion == null ? "—" : (cushion >= 0 ? "+" : "−") + hoursToHM(Math.abs(cushion))}</td>
      </tr>`;
  }).join("");
  $("#overviewPaceTable").innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-xs text-stone-500 uppercase">
          <th class="py-1.5 px-2 text-left">Code</th>
          <th class="py-1.5 px-2 text-left">Station</th>
          <th class="py-1.5 px-2 text-right">KM</th>
          <th class="py-1.5 px-2 text-right">Leg km</th>
          <th class="py-1.5 px-2 text-right">+Elev</th>
          <th class="py-1.5 px-2 text-right">−Elev</th>
          <th class="py-1.5 px-2 text-right">Leg pace</th>
          <th class="py-1.5 px-2 text-right">Leg time</th>
          <th class="py-1.5 px-2 text-right">Arrive</th>
          <th class="py-1.5 px-2 text-right">Stop</th>
          <th class="py-1.5 px-2 text-right">Cutoff</th>
          <th class="py-1.5 px-2 text-right">Cushion</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
buildOverviewPace();

// ---------------- per-leg strategy panel (Overview) ----------------
function buildLegStrategy() {
  const el = document.querySelector("#legStrategy");
  if (!el) return;
  el.innerHTML = D.aid_stations.filter(a => a.leg_strategy).map((a, idx) => {
    const isCutoff = a.cutoff_h != null;
    const elev = (a.leg_gain_m != null && a.leg_loss_m != null)
      ? `<span class="text-emerald-700">+${a.leg_gain_m}m</span> / <span class="text-sky-700">−${a.leg_loss_m}m</span>`
      : "";
    return `
      <div class="border-l-4 ${isCutoff ? 'border-rose-500' : (a.code === 'AS1' || a.code === 'AS2' ? 'border-emerald-500' : 'border-stone-300')} pl-3 py-2">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <div class="font-semibold text-sm">${a.code} — ${a.name}</div>
          <div class="text-xs font-mono text-stone-500">
            ${a.leg_pace_min_per_km != null ? fmtPace(a.leg_pace_min_per_km) : "—"} ·
            ${elev ? elev + ' · ' : ''}arrive ${hoursToClock(a.target_h)}${a.stop_min > 0 ? ' · stop ' + a.stop_min + 'm' : ''}
          </div>
        </div>
        <div class="text-sm text-stone-700 mt-1">${a.leg_strategy}</div>
      </div>`;
  }).join("");
}
buildLegStrategy();

// ---------------- map ----------------
let map = null;
let aidLayer = null, fuelLayer = null;
let coursePoints = []; // { lat, lon, ele, km } parsed from GPX
let waypoints = [];    // { lat, lon, name, desc, type, km }

async function loadGPX() {
  const res = await fetch("btr-ultra-60k-full.gpx");
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, "application/xml");

  // parse trkpts
  const trkpts = Array.from(doc.querySelectorAll("trkpt"));
  let cum = 0;
  let prev = null;
  coursePoints = trkpts.map(t => {
    const lat = parseFloat(t.getAttribute("lat"));
    const lon = parseFloat(t.getAttribute("lon"));
    const ele = parseFloat(t.querySelector("ele")?.textContent || "0");
    if (prev) cum += haversineKm(prev.lat, prev.lon, lat, lon);
    const p = { lat, lon, ele, km: cum };
    prev = p;
    return p;
  });

  // 5-point moving-average smoothing on elevation to kill GPS noise.
  // Replaces raw ele in-place — naive sum-of-positives over raw inflates ~50%.
  const n = coursePoints.length;
  const smoothed = coursePoints.map((p, i) => {
    const lo = Math.max(0, i - 5), hi = Math.min(n - 1, i + 5);
    let s = 0, c = 0;
    for (let j = lo; j <= hi; j++) { s += coursePoints[j].ele; c++; }
    return s / c;
  });
  coursePoints.forEach((p, i) => { p.ele = smoothed[i]; });

  // parse wpts
  waypoints = Array.from(doc.querySelectorAll("wpt")).map(w => {
    const lat = parseFloat(w.getAttribute("lat"));
    const lon = parseFloat(w.getAttribute("lon"));
    return {
      lat, lon,
      name: w.querySelector("name")?.textContent || "",
      desc: w.querySelector("desc")?.textContent || "",
      type: w.querySelector("type")?.textContent || "",
      km:   nearestKmOnCourse(lat, lon),
    };
  });

  return text;
}

function haversineKm(la1, lo1, la2, lo2) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLa = toRad(la2 - la1), dLo = toRad(lo2 - lo1);
  const a = Math.sin(dLa/2)**2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function nearestKmOnCourse(lat, lon) {
  let best = 0, bestD = Infinity;
  for (const p of coursePoints) {
    const d = haversineKm(p.lat, p.lon, lat, lon);
    if (d < bestD) { bestD = d; best = p.km; }
  }
  return best;
}

function buildMap() {
  map = L.map("map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  // course polyline
  const latlngs = coursePoints.map(p => [p.lat, p.lon]);
  const line = L.polyline(latlngs, { color: "#be123c", weight: 3, opacity: 0.85 }).addTo(map);
  map.fitBounds(line.getBounds(), { padding: [30, 30] });

  // waypoint layers
  aidLayer = L.layerGroup().addTo(map);
  fuelLayer = L.layerGroup().addTo(map);

  waypoints.forEach(w => {
    const isAid = w.type === "Aid Station";
    const isCutoff = isAid && /CUTOFF/.test(w.desc);
    const html = isAid
      ? `<div class="aid-marker ${isCutoff ? '' : 'soft'}">${w.name.replace(/^.*?(AS\d|Start|Finish).*$/, "$1").slice(0,4)}</div>`
      : `<div class="fuel-marker">F</div>`;
    const icon = L.divIcon({ html, className: "", iconSize: isAid ? [28,28] : [18,18], iconAnchor: isAid ? [14,14] : [9,9] });
    const m = L.marker([w.lat, w.lon], { icon });
    m.bindPopup(`<div style="font-size:13px;max-width:240px"><b>${w.name}</b><br><span style="color:#666">${w.desc}</span></div>`);
    m.on("click", () => showWaypointDetail(w));
    (isAid ? aidLayer : fuelLayer).addLayer(m);
  });

  $("#toggleAid").addEventListener("change", e => {
    if (e.target.checked) aidLayer.addTo(map); else map.removeLayer(aidLayer);
  });
  $("#toggleFuel").addEventListener("change", e => {
    if (e.target.checked) fuelLayer.addTo(map); else map.removeLayer(fuelLayer);
  });
}

function showWaypointDetail(w) {
  $("#waypointDetail").innerHTML = `
    <div class="font-bold text-base">${w.name}</div>
    <div class="text-xs text-stone-500 mb-2">KM ${w.km.toFixed(2)} · ${w.type}</div>
    <div class="text-sm">${w.desc.replace(/\|/g, "<br>")}</div>`;
}

// ---------------- elevation profile ----------------
let elevChart = null;
function buildElevation() {
  // sample every Nth point for smoothness
  const step = Math.max(1, Math.floor(coursePoints.length / 800));
  const sampled = coursePoints.filter((_, i) => i % step === 0);

  const data = {
    labels: sampled.map(p => p.km.toFixed(2)),
    datasets: [{
      label: "Elevation (m)",
      data: sampled.map(p => p.ele),
      borderColor: "#0c4a6e",
      backgroundColor: "rgba(14,116,144,0.18)",
      fill: true,
      tension: 0.2,
      pointRadius: 0,
    }]
  };

  // annotations for aid + fuel
  const aidLines = waypoints.map(w => ({ km: w.km, name: w.name, type: w.type }));

  elevChart = new Chart($("#elevation").getContext("2d"), {
    type: "line",
    data,
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `KM ${items[0].label}`,
            label: (it) => `${it.parsed.y.toFixed(0)} m`,
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Distance (km)" },
          ticks: {
            maxTicksLimit: 12,
            callback: (val, i) => {
              const km = parseFloat(data.labels[i]);
              return Math.round(km) === km && km % 5 === 0 ? km : "";
            }
          }
        },
        y: { title: { display: true, text: "Elevation (m)" } }
      }
    },
    plugins: [{
      id: "wpts",
      afterDraw: (chart) => {
        const { ctx, chartArea, scales } = chart;
        aidLines.forEach(w => {
          const x = scales.x.getPixelForValue(sampled.findIndex(p => p.km >= w.km));
          if (isNaN(x)) return;
          const isAid = w.type === "Aid Station";
          ctx.save();
          ctx.strokeStyle = isAid ? "#e11d48" : "#f59e0b";
          ctx.lineWidth = isAid ? 1.5 : 1;
          ctx.setLineDash(isAid ? [] : [3,3]);
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          if (isAid) {
            ctx.fillStyle = "#e11d48";
            ctx.font = "bold 10px sans-serif";
            const label = w.name.match(/AS\d|Start|Finish/)?.[0] || "";
            ctx.fillText(label, x + 2, chartArea.top + 12);
          }
          ctx.restore();
        });
      }
    }]
  });

  // compute total gain (coursePoints.ele is already smoothed in loadGPX)
  let gain = 0;
  for (let i = 1; i < coursePoints.length; i++) {
    const d = coursePoints[i].ele - coursePoints[i-1].ele;
    if (d > 0) gain += d;
  }
  $("#overviewGain").textContent = `${Math.round(gain)} m`;

  // attach per-leg elev gain/loss to each AS entry (uses already-smoothed coursePoints).
  attachLegElevToAidStations();
  // re-render any panels that depend on AS leg data now that elev is available.
  buildOverviewPace();
  buildLegStrategy();
}

function attachLegElevToAidStations() {
  const A = D.aid_stations;
  for (let i = 0; i < A.length; i++) {
    if (i === 0) { A[i].leg_gain_m = null; A[i].leg_loss_m = null; continue; }
    const lo = A[i-1].km, hi = A[i].km;
    let gain = 0, loss = 0, lastEle = null;
    for (const p of coursePoints) {
      if (p.km < lo) continue;
      if (p.km > hi) break;
      if (lastEle != null) {
        const d = p.ele - lastEle;
        if (d > 0) gain += d; else loss += -d;
      }
      lastEle = p.ele;
    }
    A[i].leg_gain_m = Math.round(gain);
    A[i].leg_loss_m = Math.round(loss);
  }
}

// ---------------- pace calculator ----------------
function buildPaceTab() {
  function render() {
    const pace = parseFloat($("#targetPace").value);
    const startH = clockToHours($("#startTime").value);
    if (isNaN(pace) || pace <= 0) return;

    const totalH = (D.race.distance_km * pace) / 60;
    $("#projectedTotal").textContent = `${hoursToHM(totalH)} → finish ${hoursToClock(totalH, startH)}`;

    const rows = D.aid_stations.map(a => {
      const arrivalH = (a.km * pace) / 60;
      const cushion = a.cutoff_h != null ? (a.cutoff_h - arrivalH) : null;
      const cushionClass = cushion == null ? "" :
        cushion >= 1 ? "text-emerald-700 font-bold" :
        cushion >= 0.25 ? "text-amber-700 font-bold" :
        "text-rose-700 font-bold";
      return `
        <tr class="border-t border-stone-200 ${a.cutoff_h != null ? 'bg-rose-50/40' : ''}">
          <td class="py-2 px-2 font-mono text-xs">${a.code}</td>
          <td class="py-2 px-2 text-sm">${a.name}</td>
          <td class="py-2 px-2 text-right font-mono">${a.km.toFixed(1)}</td>
          <td class="py-2 px-2 text-right font-mono">${hoursToClock(arrivalH, startH)}</td>
          <td class="py-2 px-2 text-right font-mono text-xs text-stone-500">+${hoursToHM(arrivalH)}</td>
          <td class="py-2 px-2 text-right font-mono ${a.cutoff_h != null ? 'text-rose-700' : 'text-stone-400'}">${a.cutoff_h != null ? hoursToClock(a.cutoff_h, startH) : "—"}</td>
          <td class="py-2 px-2 text-right font-mono ${cushionClass}">${cushion == null ? "—" : (cushion >= 0 ? "+" : "") + hoursToHM(Math.abs(cushion))}</td>
        </tr>`;
    }).join("");
    $("#paceTable").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-xs text-stone-500 uppercase">
            <th class="py-1.5 px-2 text-left">Code</th>
            <th class="py-1.5 px-2 text-left">Station</th>
            <th class="py-1.5 px-2 text-right">KM</th>
            <th class="py-1.5 px-2 text-right">Arrival</th>
            <th class="py-1.5 px-2 text-right">Elapsed</th>
            <th class="py-1.5 px-2 text-right">Cutoff</th>
            <th class="py-1.5 px-2 text-right">Cushion</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }
  $("#targetPace").addEventListener("input", render);
  $("#startTime").addEventListener("input", render);
  render();
}
buildPaceTab();

// ---------------- live on-track ----------------
function buildLiveCheck() {
  function render() {
    const km = parseFloat($("#liveKm").value);
    const tStr = $("#liveTime").value;
    if (isNaN(km) || !tStr) { $("#liveStatus").innerHTML = '<p class="text-stone-500">Enter both fields.</p>'; return; }
    const t = clockToHours(tStr);
    const startH = clockToHours($("#startTime").value || "04:00");
    const elapsedH = t - startH;
    if (elapsedH < 0) { $("#liveStatus").innerHTML = '<p class="text-rose-700">Current time is before start.</p>'; return; }

    const currentPace = elapsedH > 0 && km > 0 ? (elapsedH * 60) / km : 0;
    // next aid station after current km
    const nextAid = D.aid_stations.find(a => a.km > km);
    let nextLine = "";
    if (nextAid) {
      const projectedH = (nextAid.km * currentPace) / 60;
      if (nextAid.cutoff_h != null) {
        const cushion = nextAid.cutoff_h - projectedH;
        const tone = cushion >= 1 ? "bg-emerald-100 text-emerald-900" :
                     cushion >= 0.25 ? "bg-amber-100 text-amber-900" :
                     "bg-rose-100 text-rose-900 font-bold";
        nextLine = `<div class="p-3 rounded-md ${tone}">Next hard cutoff: <b>${nextAid.code}</b> at km ${nextAid.km}. Projected arrival ${hoursToClock(projectedH, startH)} vs cutoff ${hoursToClock(nextAid.cutoff_h, startH)} → cushion <b>${cushion >= 0 ? '+' : ''}${hoursToHM(Math.abs(cushion))}</b>${cushion < 0 ? ' BEHIND' : ''}.</div>`;
      } else {
        // find the next cutoff station
        const nextCutoff = D.aid_stations.find(a => a.km > km && a.cutoff_h != null);
        if (nextCutoff) {
          const projectedH2 = (nextCutoff.km * currentPace) / 60;
          const cushion = nextCutoff.cutoff_h - projectedH2;
          const tone = cushion >= 1 ? "bg-emerald-100 text-emerald-900" :
                       cushion >= 0.25 ? "bg-amber-100 text-amber-900" :
                       "bg-rose-100 text-rose-900 font-bold";
          nextLine = `<div class="p-3 rounded-md ${tone}">Next hard cutoff: <b>${nextCutoff.code}</b> at km ${nextCutoff.km}. Projected arrival ${hoursToClock(projectedH2, startH)} vs cutoff ${hoursToClock(nextCutoff.cutoff_h, startH)} → cushion <b>${cushion >= 0 ? '+' : ''}${hoursToHM(Math.abs(cushion))}</b>${cushion < 0 ? ' BEHIND' : ''}.</div>`;
        }
      }
    }

    $("#liveStatus").innerHTML = `
      <div class="grid md:grid-cols-3 gap-3 mb-3">
        <div class="bg-stone-50 rounded-md p-3"><div class="text-xs text-stone-500">Elapsed</div><div class="text-lg font-bold">${hoursToHM(elapsedH)}</div></div>
        <div class="bg-stone-50 rounded-md p-3"><div class="text-xs text-stone-500">Avg pace so far</div><div class="text-lg font-bold">${currentPace > 0 ? fmtPace(currentPace) : "—"}</div></div>
        <div class="bg-stone-50 rounded-md p-3"><div class="text-xs text-stone-500">Projected finish</div><div class="text-lg font-bold">${currentPace > 0 ? hoursToClock((D.race.distance_km * currentPace)/60, startH) : "—"}</div></div>
      </div>
      ${nextLine}`;
  }
  $("#liveTime").addEventListener("input", render);
  $("#liveKm").addEventListener("input", render);
}
buildLiveCheck();

// ---------------- fueling ----------------
function buildFueling() {
  const t = D.fueling_targets;
  $("#fuelingTargets").innerHTML = `
    <div class="flex justify-between border-b border-stone-100 pb-2"><dt class="text-stone-500">Carbs (1st half)</dt><dd class="font-mono">${t.carbs_first_half_g_per_h} g/h</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-2"><dt class="text-stone-500">Carbs (2nd half)</dt><dd class="font-mono">${t.carbs_second_half_g_per_h} g/h</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-2"><dt class="text-stone-500">Fluids</dt><dd class="font-mono">${t.fluid_ml_per_h} ml/h</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-2"><dt class="text-stone-500">Sodium</dt><dd class="font-mono">${t.sodium_mg_per_h} mg/h</dd></div>
    <div class="flex justify-between"><dt class="text-stone-500">Caffeine total</dt><dd class="font-mono">${t.caffeine_total_mg}</dd></div>`;

  // merged timeline (aid + fuel)
  const merged = [
    ...D.aid_stations.map(a => ({ km: a.km, kind: "aid", label: `${a.code} — ${a.name}`, note: a.cutoff_h != null ? `CUTOFF ${hoursToClock(a.cutoff_h)} · target ${hoursToClock(a.target_h)} · facilities: ${a.facilities.join(", ")}` : `target ${hoursToClock(a.target_h)} · facilities: ${a.facilities.join(", ")}` })),
    ...D.fueling_points.map(f => ({ km: f.km, kind: "fuel", label: f.label, note: f.note })),
  ].sort((a, b) => a.km - b.km);

  // target time interp from aid_stations
  function targetAt(km) {
    const a = D.aid_stations;
    for (let i = 0; i < a.length - 1; i++) {
      if (km >= a[i].km && km <= a[i+1].km) {
        const f = (km - a[i].km) / (a[i+1].km - a[i].km);
        return a[i].target_h + f * (a[i+1].target_h - a[i].target_h);
      }
    }
    return 0;
  }

  $("#fuelTimeline").innerHTML = merged.map(item => {
    const isAid = item.kind === "aid";
    const t = targetAt(item.km);
    return `
      <div class="flex items-start gap-3 py-3 border-b border-stone-100 last:border-b-0">
        <div class="flex flex-col items-center min-w-[64px]">
          <span class="font-mono text-xs text-stone-500">${item.km.toFixed(1)} km</span>
          <span class="font-mono text-sm font-bold ${isAid ? 'text-rose-700' : 'text-amber-700'}">${hoursToClock(t)}</span>
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium ${isAid ? 'text-rose-900' : ''}">${item.label}</div>
          <div class="text-xs text-stone-500">${item.note}</div>
        </div>
        <div class="text-xs px-2 py-0.5 rounded-md ${isAid ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}">${isAid ? 'AID' : 'FUEL'}</div>
      </div>`;
  }).join("");

  // shopping checklist
  const shopping = [
    "Sari Roti Cokelat x 12 (6-8 to carry, 4-6 in AS4 drop bag, eat ~1 per 30 min)",
    "Pocari Sweat — 2× 500ml bottles for race morning + start (refill at every AS during race)",
    "Salt tabs x 20 (SaltStick Plus / LMNT capsules) — 1 per hour",
    "Caffeine gels x 4 (Maurten 100 Caf or GU Roctane) — BACKUP only; Coca Cola at AS is the primary source",
    "Standard gels x 6 (Maurten 100, GU, Spring) — backup if Sari Roti gets tedious",
    "Anti-nausea backup (ginger chews, Tums) — for late race",
    "Pre-race breakfast: oats + honey + banana OR nasi goreng (rice + egg)",
    "Post-race recovery: chocolate milk + nasi campur (rice + protein + veg)",
  ];
  renderChecklist("#foodChecklist", shopping, "shopping");

  // fueling staples
  if (D.fueling_staples) {
    $("#fuelingStaples").innerHTML = D.fueling_staples.map(s => `
      <div class="border-l-4 border-amber-400 bg-amber-50/40 pl-4 py-2">
        <div class="flex items-baseline justify-between gap-3">
          <div class="font-semibold text-sm">${s.item}</div>
          <div class="text-xs text-stone-600">${s.role}</div>
        </div>
        <div class="text-xs font-mono text-stone-600 mt-1">${s.macros}</div>
        <div class="text-sm text-stone-800 mt-1">${s.strategy}</div>
      </div>
    `).join("");
  }

  // per-AS menus + medic
  const menuStations = D.aid_stations.filter(a => a.menu && a.menu.drinks);
  $("#aidMenus").innerHTML = menuStations.map(a => {
    const cutoffBadge = a.cutoff_h != null
      ? `<span class="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">CUTOFF ${hoursToClock(a.cutoff_h)}</span>`
      : "";
    const noteLine = a.note ? `<div class="text-xs text-rose-700 font-medium mt-1">${a.note}</div>` : "";
    return `
      <div class="border border-stone-200 rounded-lg p-4">
        <div class="flex items-center justify-between gap-3 mb-2">
          <div>
            <span class="font-bold">${a.code} — ${a.name}</span>
            <span class="text-xs text-stone-500 ml-2 font-mono">km ${a.km.toFixed(1)} · target ${hoursToClock(a.target_h)}</span>
          </div>
          ${cutoffBadge}
        </div>
        ${noteLine}
        <div class="grid md:grid-cols-2 gap-4 mt-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-sky-700 mb-1">Drinks</div>
            <ul class="text-sm space-y-0.5">
              ${a.menu.drinks.map(d => `<li>• ${d}</li>`).join("")}
            </ul>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">Food</div>
            <ul class="text-sm space-y-0.5">
              ${a.menu.food.map(f => `<li>• ${f}</li>`).join("")}
            </ul>
          </div>
        </div>
        <div class="text-xs text-stone-600 mt-3 pt-2 border-t border-stone-100">
          <span class="font-semibold text-stone-700">Medic:</span> ${a.medic}
        </div>
      </div>
    `;
  }).join("");
}
buildFueling();

// ---------------- watch checklists ----------------
function renderChecklist(selector, items, ns) {
  const saved = JSON.parse(localStorage.getItem(`btr.${ns}`) || "{}");
  $(selector).innerHTML = items.map((item, i) => {
    const id = typeof item === "object" ? item.id : `${ns}-${i}`;
    const task = typeof item === "object" ? item.task : item;
    const detail = typeof item === "object" ? item.detail : "";
    const done = !!saved[id];
    return `
      <li class="check-row flex items-start gap-3 p-2 rounded-md hover:bg-stone-50 cursor-pointer" data-id="${id}" data-ns="${ns}" data-done="${done}">
        <input type="checkbox" ${done ? "checked" : ""} class="mt-1">
        <div class="flex-1">
          <div class="check-label text-sm font-medium">${task}</div>
          ${detail ? `<div class="text-xs text-stone-500 mt-0.5">${detail}</div>` : ""}
        </div>
      </li>`;
  }).join("");
  $$(`${selector} .check-row`).forEach(row => {
    row.addEventListener("click", (e) => {
      const cb = row.querySelector("input");
      if (e.target.tagName !== "INPUT") cb.checked = !cb.checked;
      const id = row.dataset.id, ns2 = row.dataset.ns;
      const s = JSON.parse(localStorage.getItem(`btr.${ns2}`) || "{}");
      s[id] = cb.checked;
      localStorage.setItem(`btr.${ns2}`, JSON.stringify(s));
      row.dataset.done = cb.checked.toString();
    });
  });
}

renderChecklist("#watchPreRace", D.watch_setup.pre_race, "watchPre");
renderChecklist("#watchRaceDay", D.watch_setup.race_day, "watchDay");
renderChecklist("#watchGpxUsage", D.watch_setup.gpx_usage, "watchGpx");

// Recommended data screens
(function renderScreens() {
  const el = $("#watchScreens");
  if (!el || !D.watch_setup.data_screens) return;
  el.innerHTML = D.watch_setup.data_screens.map(s => `
    <div class="bg-white border border-stone-200 rounded-lg p-4">
      <div class="font-semibold text-sm">${s.name}</div>
      <div class="text-xs text-stone-500 mt-0.5"><b>Fields:</b> ${s.fields}</div>
      <div class="text-xs text-stone-500"><b>When:</b> ${s.when}</div>
      <div class="text-xs text-stone-600 mt-1.5">${s.why}</div>
    </div>
  `).join("");
})();

// ---------------- gear ----------------
renderChecklist("#gearMandatory",   D.gear.mandatory,            "gearMand");
renderChecklist("#gearRecommended", D.gear.strongly_recommended, "gearRec");
renderChecklist("#dropAS3",         D.gear.drop_bag_AS3,         "dropAS3");
renderChecklist("#dropAS4",         D.gear.drop_bag_AS4,         "dropAS4");

// ---------------- timeline ----------------
$("#timelineList").innerHTML = D.race_day_timeline.map(block => `
  <div class="bg-white border border-stone-200 rounded-xl p-5">
    <h3 class="font-bold text-base mb-2">${block.time}</h3>
    <ul class="space-y-1.5 text-sm list-disc list-inside text-stone-700">
      ${block.actions.map(a => `<li>${a}</li>`).join("")}
    </ul>
  </div>
`).join("");

// ---------------- course intel ----------------
$("#courseSections").innerHTML = D.course_sections.map(s => `
  <div class="bg-white border border-stone-200 rounded-xl p-5">
    <div class="flex items-baseline justify-between mb-2">
      <h3 class="font-bold">${s.name}</h3>
      <span class="text-xs font-mono text-stone-500">km ${s.from_km} → ${s.to_km} · ${(s.to_km - s.from_km).toFixed(1)} km</span>
    </div>
    <p class="text-sm text-stone-700">${s.notes}</p>
  </div>
`).join("");

// ---------------- rules ----------------
$("#rulesList").innerHTML = D.pacing_rules.map(r => `
  <li class="border-l-4 border-emerald-500 pl-3 py-1">
    <div class="font-medium">${r.rule}</div>
    <div class="text-xs text-stone-500 mt-0.5">${r.why}</div>
  </li>
`).join("");

$("#warningsList").innerHTML = D.warning_signs.map(w => `<li class="flex gap-2"><span>⚠</span><span>${w}</span></li>`).join("");

// ---------------- splits / Z2 ----------------
let analysisData = null;
let analysisLoaded = false;
let splitsHrCap = 145;

async function loadAnalysis() {
  if (analysisLoaded) return analysisData;
  analysisLoaded = true;
  try {
    const res = await fetch("recon-analysis.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    analysisData = await res.json();
    return analysisData;
  } catch (e) {
    $("#splitsStatus").innerHTML = `<span class="text-rose-700">Couldn't load recon-analysis.json: ${e.message}.
      Run <code class="bg-stone-100 px-1 rounded">python3 analyze_recon.py</code> in the project root, then reload.</span>`;
    throw e;
  }
}

function renderSplitsTotals() {
  const totals = $("#z2Totals");
  const caps = analysisData.hr_caps;
  totals.innerHTML = caps.map(cap => {
    const m = analysisData.models[String(cap)];
    const totalH = m.course_total_min / 60;
    const etaH = (4 + totalH) % 24;
    const etaHH = Math.floor(etaH);
    const etaMM = Math.round((etaH - etaHH) * 60);
    const eta = `${String(etaHH).padStart(2,"0")}:${String(etaMM).padStart(2,"0")}`;
    const cushion = (19 - totalH) * 60; // min vs 23:00 cutoff
    const cushionCls = cushion >= 30 ? "text-emerald-700" : cushion >= 10 ? "text-amber-700" : "text-rose-700";
    const selected = cap === splitsHrCap;
    return `
      <button class="z2-cap-btn text-left rounded-xl border-2 p-4 transition ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-400'}" data-cap="${cap}">
        <div class="text-xs text-stone-500 uppercase tracking-wide">HR cap ≤ ${cap}</div>
        <div class="text-2xl font-bold mt-1">${fmtHMSmin(m.course_total_min)}</div>
        <div class="text-xs text-stone-600 mt-1">ETA <span class="font-mono font-semibold">${eta}</span></div>
        <div class="text-xs font-mono ${cushionCls} font-semibold mt-1">${cushion >= 0 ? '+' : '−'}${Math.abs(Math.round(cushion))} min cushion</div>
        <div class="text-xs text-stone-400 mt-1">${m.n_segments_used.toLocaleString()} recon segments</div>
      </button>`;
  }).join("");
  $$(".z2-cap-btn").forEach(b => b.addEventListener("click", () => {
    splitsHrCap = parseInt(b.dataset.cap, 10);
    renderSplitsTotals();
    renderZ2Legs();
    renderSplitsTable();
  }));

  $("#z2Caveats").innerHTML = `
    Recon was a hike — running may yield faster pace at the same HR on runnable terrain. The model is most reliable for steep/technical terrain (matches recon).
    Recon median HR ${analysisData.recon_summary.hr_stats.median}, P90 ${analysisData.recon_summary.hr_stats.p90}.
  `;
}

function fmtHMSmin(min) {
  const sec = Math.round(min * 60);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m ${String(s).padStart(2,"0")}s`;
}

function renderZ2Legs() {
  const m = analysisData.models[String(splitsHrCap)];
  const legs = m.course_leg_proj;
  const A = D.aid_stations;

  // build a quick map for plan leg pace
  const planByLeg = {};
  for (let i = 1; i < A.length; i++) {
    planByLeg[A[i-1].code + "→" + A[i].code] = A[i].leg_pace_min_per_km;
  }

  // cumulative for Z2 + plan
  let cumZ2 = 0;
  let cumPlan = 0;
  const rows = legs.map((leg, idx) => {
    cumZ2 += leg.z2_min;
    const planPace = planByLeg[leg.from_code + "→" + leg.to_code];
    const planMin = planPace != null ? planPace * leg.dist_km : null;
    if (planMin != null) cumPlan += planMin;
    // include AS stop after destination for cumulative (find corresponding AS)
    const destAs = A.find(a => a.code === leg.to_code);
    const stopMin = destAs && destAs.stop_min ? destAs.stop_min : 0;
    cumZ2 += stopMin;
    if (planMin != null) cumPlan += stopMin;
    const cutoffMin = destAs && destAs.cutoff_h != null ? destAs.cutoff_h * 60 : null;
    const z2Cushion = cutoffMin != null ? cutoffMin - cumZ2 : null;
    const planCushion = cutoffMin != null && planMin != null ? cutoffMin - cumPlan : null;
    const cushCls = (c) => c == null ? "text-stone-400" :
      c >= 30 ? "text-emerald-700 font-semibold" :
      c >= 10 ? "text-amber-700 font-semibold" :
      c >= 0  ? "text-rose-700 font-semibold" :
                "text-white bg-rose-700 px-1.5 rounded font-bold";
    return `
      <tr class="border-t border-stone-200 ${destAs && destAs.cutoff_h != null ? 'bg-rose-50/40' : ''}">
        <td class="py-2 px-2 font-mono text-xs">${leg.from_code} → ${leg.to_code}</td>
        <td class="py-2 px-2 text-right font-mono text-xs">${leg.dist_km.toFixed(2)}</td>
        <td class="py-2 px-2 text-right font-mono text-xs text-emerald-700">+${Math.round(leg.gain_m)}</td>
        <td class="py-2 px-2 text-right font-mono text-xs text-sky-700">−${Math.round(leg.loss_m)}</td>
        <td class="py-2 px-2 text-right font-mono">${fmtPace(leg.avg_pace_min_per_km)}</td>
        <td class="py-2 px-2 text-right font-mono text-xs">${fmtHMSmin(leg.z2_min)}</td>
        <td class="py-2 px-2 text-right font-mono">${planPace != null ? fmtPace(planPace) : "—"}</td>
        <td class="py-2 px-2 text-right font-mono text-xs">${planMin != null ? fmtHMSmin(planMin) : "—"}</td>
        <td class="py-2 px-2 text-right font-mono text-xs text-stone-600">${fmtHMSmin(cumZ2)}</td>
        <td class="py-2 px-2 text-right font-mono ${cushCls(z2Cushion)}">${z2Cushion == null ? "—" : (z2Cushion >= 0 ? "+" : "−") + Math.abs(Math.round(z2Cushion)) + "m"}</td>
        <td class="py-2 px-2 text-right font-mono ${cushCls(planCushion)}">${planCushion == null ? "—" : (planCushion >= 0 ? "+" : "−") + Math.abs(Math.round(planCushion)) + "m"}</td>
      </tr>`;
  }).join("");

  $("#z2LegTable").innerHTML = `
    <table class="w-full text-sm">
      <thead><tr class="text-xs text-stone-500 uppercase">
        <th class="py-1.5 px-2 text-left">Leg</th>
        <th class="py-1.5 px-2 text-right">Dist</th>
        <th class="py-1.5 px-2 text-right">+Elev</th>
        <th class="py-1.5 px-2 text-right">−Elev</th>
        <th class="py-1.5 px-2 text-right">Z2 pace</th>
        <th class="py-1.5 px-2 text-right">Z2 time</th>
        <th class="py-1.5 px-2 text-right">v4 pace</th>
        <th class="py-1.5 px-2 text-right">v4 time</th>
        <th class="py-1.5 px-2 text-right">Cum (Z2)</th>
        <th class="py-1.5 px-2 text-right">Z2 vs cutoff</th>
        <th class="py-1.5 px-2 text-right">v4 vs cutoff</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function pacePerKmAtCutoff(km) {
  // Find the next cutoff station from this km, return required avg pace from this km to that AS.
  const A = D.aid_stations;
  for (let i = 0; i < A.length; i++) {
    if (A[i].km > km && A[i].cutoff_h != null) {
      const distLeft = A[i].km - km;
      // assume cumulative arrival at this km is some best-case... but the column is a pure "must average" view
      // we'll just show cutoff pace as cumulative-from-start required
      return (A[i].cutoff_h * 60) / A[i].km;
    }
  }
  return null;
}

function planPaceAtKm(km) {
  // Find which leg this km falls in, return that leg's pace.
  const A = D.aid_stations;
  for (let i = 1; i < A.length; i++) {
    if (km > A[i-1].km && km <= A[i].km) return A[i].leg_pace_min_per_km;
  }
  if (km <= A[0].km) return A[1].leg_pace_min_per_km;
  return A[A.length - 1].leg_pace_min_per_km;
}

function renderSplitsTable() {
  const m = analysisData.models[String(splitsHrCap)];
  const perKm = m.course_per_km;
  const A = D.aid_stations;
  // build set of km marks at which to insert AS rows
  const asByKm = new Map(A.map(a => [Math.round(a.km), a]));

  // cumulative trackers
  let cumZ2 = 0;
  let cumPlan = 0;
  const rows = [];

  for (let i = 0; i < perKm.length; i++) {
    const r = perKm[i];
    const km = r.km_end;
    const grade = r.grade_pct;
    const z2 = r.z2_pace;
    const z2Time = r.z2_min;
    const plan = planPaceAtKm(km);
    const planTime = plan != null ? plan * r.dist_km : null;
    cumZ2 += z2Time != null ? z2Time : 0;
    if (planTime != null) cumPlan += planTime;

    // delta v3 vs z2
    const delta = (plan != null && z2 != null) ? (plan - z2) : null;
    let deltaCls = "text-stone-400";
    let deltaSym = "";
    if (delta != null) {
      if (delta >= 1.0) { deltaCls = "text-emerald-700"; deltaSym = "🟢"; }
      else if (delta >= -1.0) { deltaCls = "text-amber-700"; deltaSym = "🟡"; }
      else { deltaCls = "text-rose-700"; deltaSym = "🔴"; }
    }

    // cutoff cushion at this km — find next cutoff AS, see if cumZ2 to that point is under
    let cushionStr = "—", cushionCls = "text-stone-400";
    for (let j = 0; j < A.length; j++) {
      if (A[j].km > km && A[j].cutoff_h != null) {
        // estimate cumZ2 from current to that AS using remaining per-km z2_min
        let extra = 0;
        for (let k = i + 1; k < perKm.length && perKm[k].km_end <= A[j].km + 0.5; k++) {
          extra += perKm[k].z2_min || 0;
        }
        // also include AS stops between here and there
        for (let k = 0; k < A.length; k++) {
          if (A[k].km > km && A[k].km <= A[j].km) extra += A[k].stop_min || 0;
        }
        const projAtCutoffAs = cumZ2 + extra;
        const cushion = (A[j].cutoff_h * 60) - projAtCutoffAs;
        cushionStr = (cushion >= 0 ? "+" : "−") + Math.abs(Math.round(cushion)) + "m → " + A[j].code;
        cushionCls = cushion >= 30 ? "text-emerald-700" : cushion >= 10 ? "text-amber-700" : cushion >= 0 ? "text-rose-700" : "text-white bg-rose-700 px-1.5 rounded font-bold";
        break;
      }
    }

    // insert AS marker row when an AS exists in this km
    const asHere = A.find(a => a.km > r.km_start && a.km <= r.km_end);
    if (asHere && asHere.code !== "START") {
      rows.push(`
        <tr class="bg-stone-100 border-t-2 border-stone-300">
          <td colspan="12" class="py-2 px-2 text-xs font-bold text-stone-700 uppercase tracking-wide">
            ${asHere.code} — ${asHere.name} (km ${asHere.km.toFixed(1)}) ·
            <span class="font-mono">Z2 cum ${fmtHMSmin(cumZ2)}</span> ·
            v3 cum ${fmtHMSmin(cumPlan)}
            ${asHere.cutoff_h != null ? ` · <span class="text-rose-700">cutoff ${hoursToClock(asHere.cutoff_h)}</span>` : ""}
            ${asHere.stop_min ? ` · stop ${asHere.stop_min}m` : ""}
          </td>
        </tr>`);
      if (asHere.stop_min) {
        cumZ2 += asHere.stop_min;
        cumPlan += asHere.stop_min;
      }
    }

    const gradeStr = grade >= 0 ? "+" + grade.toFixed(1) : grade.toFixed(1);
    const gradeCls = Math.abs(grade) >= 15 ? "font-bold" : "";

    const modelBadge = r.model_used === "run"
      ? `<span class="inline-block bg-emerald-100 text-emerald-800 px-1 rounded text-[10px]">RUN</span>`
      : `<span class="inline-block bg-amber-100 text-amber-800 px-1 rounded text-[10px]">HIKE</span>`;
    rows.push(`
      <tr class="border-t border-stone-100 hover:bg-stone-50">
        <td class="py-1 px-2 font-mono text-xs">${km.toFixed(1)}</td>
        <td class="py-1 px-2 text-right font-mono text-xs text-stone-600">${Math.round(r.ele_end)}</td>
        <td class="py-1 px-2 text-right font-mono text-xs text-emerald-700">+${Math.round(r.gain_m)}</td>
        <td class="py-1 px-2 text-right font-mono text-xs text-sky-700">−${Math.round(r.loss_m)}</td>
        <td class="py-1 px-2 text-right font-mono text-xs ${gradeCls}">${gradeStr}%</td>
        <td class="py-1 px-2 text-center">${modelBadge}</td>
        <td class="py-1 px-2 text-right font-mono text-xs">${z2 != null ? fmtPace(z2) : "—"}</td>
        <td class="py-1 px-2 text-right font-mono text-xs">${plan != null ? fmtPace(plan) : "—"}</td>
        <td class="py-1 px-2 text-right font-mono text-xs ${deltaCls}">${deltaSym} ${delta != null ? (delta>=0?"+":"")+delta.toFixed(1) : "—"}</td>
        <td class="py-1 px-2 text-right font-mono text-xs text-stone-600">${fmtHMSmin(cumZ2)}</td>
        <td class="py-1 px-2 text-right font-mono text-xs text-stone-600">${fmtHMSmin(cumPlan)}</td>
        <td class="py-1 px-2 text-right font-mono text-xs ${cushionCls}">${cushionStr}</td>
      </tr>`);
  }

  $("#splitsTableWrap").innerHTML = `
    <table class="w-full text-xs">
      <thead><tr class="text-xs text-stone-500 uppercase bg-stone-50">
        <th class="py-1.5 px-2 text-left">KM</th>
        <th class="py-1.5 px-2 text-right">Elev (m)</th>
        <th class="py-1.5 px-2 text-right">+Elev</th>
        <th class="py-1.5 px-2 text-right">−Elev</th>
        <th class="py-1.5 px-2 text-right">Grade</th>
        <th class="py-1.5 px-2 text-center">Model</th>
        <th class="py-1.5 px-2 text-right">Z2 pace</th>
        <th class="py-1.5 px-2 text-right">v4 pace</th>
        <th class="py-1.5 px-2 text-right">v4 − Z2</th>
        <th class="py-1.5 px-2 text-right">Z2 cum</th>
        <th class="py-1.5 px-2 text-right">v4 cum</th>
        <th class="py-1.5 px-2 text-right">Z2 cushion vs next cutoff</th>
      </tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
}

async function initSplits() {
  try {
    await loadAnalysis();
    $("#splitsStatus").remove();
    $("#splitsBody").classList.remove("hidden");
    renderSplitsTotals();
    renderZ2Legs();
    renderSplitsTable();
  } catch (e) {
    console.error(e);
  }
}

let splitsInitPromise = null;
$$(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
  if (btn.dataset.tab === "splits" && !splitsInitPromise) {
    splitsInitPromise = initSplits();
  }
}));

// ---------------- recon: AS3 → AS4 ----------------
let reconLoaded = false;
let reconChart = null;
let reconStats = null; // populated after parse

async function loadRecon() {
  if (reconLoaded) return reconStats;
  reconLoaded = true;
  try {
    const res = await fetch("recon-abang-terunyan.gpx");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const trkpts = Array.from(doc.querySelectorAll("trkpt"));
    if (trkpts.length < 2) throw new Error("not enough trackpoints");

    // parse points: { lat, lon, ele, t (ms), cumKm }
    let cum = 0, prev = null;
    const points = trkpts.map(t => {
      const lat = parseFloat(t.getAttribute("lat"));
      const lon = parseFloat(t.getAttribute("lon"));
      const ele = parseFloat(t.querySelector("ele")?.textContent || "0");
      const tm  = new Date(t.querySelector("time")?.textContent || 0).getTime();
      if (prev) cum += haversineKm(prev.lat, prev.lon, lat, lon);
      const p = { lat, lon, ele, t: tm, cumKm: cum };
      prev = p;
      return p;
    });

    const totalSec = (points.at(-1).t - points[0].t) / 1000;
    const totalKm = points.at(-1).cumKm;

    // elevation gain / loss + moving time (gap < 30s, dist > 0.5m to count)
    let gain = 0, loss = 0, movingSec = 0;
    for (let i = 1; i < points.length; i++) {
      const de = points[i].ele - points[i-1].ele;
      if (de > 0) gain += de; else loss += -de;
      const dt = (points[i].t - points[i-1].t) / 1000;
      const dx = (points[i].cumKm - points[i-1].cumKm) * 1000; // m
      if (dt > 0 && dt < 30 && dx > 0.5) movingSec += dt;
    }

    // per-km splits
    const splits = []; // { km, dtSec, pacePerKm, cumSec, gainM, lossM }
    let nextMark = 1, segStartT = points[0].t, segStartEle = points[0].ele;
    let segGain = 0, segLoss = 0, lastEle = points[0].ele;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const de = p.ele - lastEle;
      if (de > 0) segGain += de; else segLoss += -de;
      lastEle = p.ele;
      while (p.cumKm >= nextMark) {
        // interpolate timestamp at the exact km boundary
        const prevP = points[i-1];
        const frac = (nextMark - prevP.cumKm) / (p.cumKm - prevP.cumKm || 1);
        const tAtMark = prevP.t + frac * (p.t - prevP.t);
        const dt = (tAtMark - segStartT) / 1000;
        splits.push({
          km: nextMark,
          dtSec: dt,
          pacePerKm: dt / 60, // min for 1 km
          cumSec: (tAtMark - points[0].t) / 1000,
          gainM: segGain,
          lossM: segLoss,
        });
        segStartT = tAtMark;
        segGain = 0; segLoss = 0;
        nextMark += 1;
      }
    }
    // tail partial km
    const tailKm = totalKm - (nextMark - 1);
    if (tailKm > 0.05) {
      const dt = (points.at(-1).t - segStartT) / 1000;
      splits.push({
        km: totalKm,
        partial: tailKm,
        dtSec: dt,
        pacePerKm: dt / 60 / tailKm,
        cumSec: totalSec,
        gainM: segGain,
        lossM: segLoss,
      });
    }

    reconStats = { points, totalSec, totalKm, gain, loss, movingSec, splits };
    return reconStats;
  } catch (e) {
    $("#reconStatus").innerHTML = `<span class="text-rose-700">Couldn't load recon GPX: ${e.message}. Make sure the page is served via http (not file://) and that recon-abang-terunyan.gpx is in the project root.</span>`;
    throw e;
  }
}

function fmtHMS(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s` : `${m}m ${String(s).padStart(2,"0")}s`;
}

function renderRecon() {
  if (!reconStats) return;
  const { totalSec, totalKm, gain, loss, movingSec, splits } = reconStats;
  const fatigue = parseFloat($("#fatigueSlider").value);
  $("#fatigueValDisplay").textContent = fatigue.toFixed(2);

  // baseline = "moving" | "elapsed"
  const baselineKind = document.querySelector('input[name="reconBaseline"]:checked')?.value || "moving";
  // distance basis = "plan" | "recon"
  const distKind = document.querySelector('input[name="reconDistance"]:checked')?.value || "plan";

  const baselineSec = baselineKind === "moving" ? movingSec : totalSec;
  const baselinePacePerKm = (baselineSec / 60) / totalKm; // min/km on recon distance

  // planned leg time from data.js (AS4.target_h - AS3.target_h)
  const as3 = D.aid_stations.find(a => a.code === "AS3");
  const as4 = D.aid_stations.find(a => a.code === "AS4");
  const planLegHours = as4.target_h - as3.target_h;
  const planLegSec = planLegHours * 3600;
  const planKm = as4.km - as3.km;

  const distKm = distKind === "plan" ? planKm : totalKm;
  const adjSec = baselinePacePerKm * 60 * fatigue * distKm; // sec
  const adjPaceMpk = baselinePacePerKm * fatigue;

  const reconElapsedPace = (totalSec / 60) / totalKm;
  const reconMovingPace  = (movingSec / 60) / totalKm;
  const planPaceMpk      = (planLegSec / 60) / planKm;

  // headline cards
  $("#reconElapsedTime").textContent = fmtHMS(totalSec);
  $("#reconElapsedPace").textContent = `${totalKm.toFixed(2)} km · ${fmtPace(reconElapsedPace)}`;
  $("#reconMovingTime").textContent  = fmtHMS(movingSec);
  $("#reconMovingPace").textContent  = `${totalKm.toFixed(2)} km · ${fmtPace(reconMovingPace)}`;
  $("#reconPlanTime").textContent    = fmtHMS(planLegSec);
  $("#reconPlanPace").textContent    = `${planKm.toFixed(2)} km · ${fmtPace(planPaceMpk)}`;
  $("#reconAdjTime").textContent     = fmtHMS(adjSec);
  $("#reconAdjPace").textContent     = `${fmtPace(adjPaceMpk)} · ${distKm.toFixed(2)} km · ${baselineKind} × ${fatigue.toFixed(2)}`;

  $("#planKmLabel").textContent  = planKm.toFixed(1);
  $("#reconKmLabel").textContent = totalKm.toFixed(1);

  // verdict
  // AS4 cutoff window from AS3 target = 4h (11h - 7h)
  const AS4_cutoff_sec = (as4.cutoff_h - as3.target_h) * 3600;
  const card = $("#reconVerdictCard");
  const lbl = $("#reconVerdictLabel");
  const v = $("#reconVerdict");
  const vd = $("#reconVerdictDetail");
  const overPlanSec = adjSec - planLegSec;
  const cushionVsCutoffSec = AS4_cutoff_sec - adjSec;

  if (adjSec <= planLegSec) {
    card.className = "rounded-xl p-5 border bg-emerald-50 border-emerald-200 text-emerald-900";
    lbl.textContent = "Verdict";
    v.textContent = "Plan has cushion — leave as-is";
    vd.innerHTML = `Projected race-day leg is <b>${fmtHMS(planLegSec - adjSec)}</b> under plan. AS4 cutoff cushion ≈ <b>${fmtHMS(cushionVsCutoffSec)}</b>. No change needed.`;
  } else if (cushionVsCutoffSec >= 30 * 60) {
    card.className = "rounded-xl p-5 border bg-amber-50 border-amber-200 text-amber-900";
    lbl.textContent = "Verdict";
    v.textContent = "Push AS4 target out";
    vd.innerHTML = `Plan is short by <b>${fmtHMS(overPlanSec)}</b>. AS4 cutoff cushion still <b>${fmtHMS(cushionVsCutoffSec)}</b>, but tighter than ideal.<br>
    Consider moving AS4 target from <b>${hoursToClock(as4.target_h)}</b> to <b>~${hoursToClock(as3.target_h + adjSec/3600)}</b> and shifting AS5–AS7 + finish targets by ${fmtHMS(overPlanSec)}.`;
  } else if (cushionVsCutoffSec > 0) {
    card.className = "rounded-xl p-5 border bg-rose-50 border-rose-300 text-rose-900";
    lbl.textContent = "⚠ Verdict";
    v.textContent = "Tight to AS4 cutoff";
    vd.innerHTML = `Projected leg eats almost the entire AS4 cutoff window. Cushion only <b>${fmtHMS(cushionVsCutoffSec)}</b>.<br>
    <b>Bank time before AS3</b> — every minute earlier than ${hoursToClock(as3.target_h)} at AS3 is a minute of life at AS4. Consider tightening AS1–AS2 targets.`;
  } else {
    card.className = "rounded-xl p-5 border bg-rose-600 border-rose-700 text-white";
    lbl.textContent = "🚨 Verdict";
    v.textContent = "Plan misses AS4 cutoff";
    vd.innerHTML = `At ${fatigue.toFixed(2)}× fatigue with ${baselineKind} baseline you'd hit AS4 <b>${fmtHMS(-cushionVsCutoffSec)} after cutoff</b>.<br>
    Mitigations: (a) arrive AS3 earlier (target <b>${hoursToClock(as4.cutoff_h - adjSec/3600)}</b> instead of ${hoursToClock(as3.target_h)}); (b) drop the ${baselineKind} multiplier (run, don't hike); (c) accept this is a real DNF risk and pre-commit to walking the descent under 25 min/km moving.`;
  }

  // stats list
  $("#reconStatsList").innerHTML = `
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Distance</dt><dd class="font-mono">${totalKm.toFixed(2)} km</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Elapsed time</dt><dd class="font-mono">${fmtHMS(totalSec)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Moving time</dt><dd class="font-mono">${fmtHMS(movingSec)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Stopped</dt><dd class="font-mono">${fmtHMS(totalSec - movingSec)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Avg pace (elapsed)</dt><dd class="font-mono">${fmtPace(reconElapsedPace)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Avg pace (moving)</dt><dd class="font-mono">${fmtPace(reconMovingPace)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Elev gain</dt><dd class="font-mono">+${Math.round(gain)} m</dd></div>
    <div class="flex justify-between"><dt class="text-stone-500">Elev loss</dt><dd class="font-mono">-${Math.round(loss)} m</dd></div>
  `;

  // projection list
  const planMargin = planLegSec - adjSec;
  $("#reconProjList").innerHTML = `
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Baseline</dt><dd class="font-mono">${baselineKind} (${fmtPace(baselinePacePerKm)})</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Fatigue multiplier</dt><dd class="font-mono">${fatigue.toFixed(2)}×</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Distance applied</dt><dd class="font-mono">${distKm.toFixed(2)} km (${distKind})</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Projected leg time</dt><dd class="font-mono">${fmtHMS(adjSec)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Plan budget</dt><dd class="font-mono">${fmtHMS(planLegSec)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Plan vs projected</dt><dd class="font-mono ${planMargin>=0?'text-emerald-700':'text-rose-700'}">${planMargin>=0?'+':'-'}${fmtHMS(Math.abs(planMargin))}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">Arrive AS4 (if AS3 on plan)</dt><dd class="font-mono">${hoursToClock(as3.target_h + adjSec/3600)}</dd></div>
    <div class="flex justify-between border-b border-stone-100 pb-1"><dt class="text-stone-500">AS4 cutoff</dt><dd class="font-mono text-rose-700">${hoursToClock(as4.cutoff_h)}</dd></div>
    <div class="flex justify-between"><dt class="text-stone-500">Cushion vs cutoff</dt><dd class="font-mono ${cushionVsCutoffSec>=0?'text-emerald-700':'text-rose-700'}">${cushionVsCutoffSec>=0?'+':'-'}${fmtHMS(Math.abs(cushionVsCutoffSec))}</dd></div>
  `;

  // splits table
  let cum = 0;
  $("#reconSplits").innerHTML = splits.map(s => {
    cum = s.cumSec;
    const projSec = s.dtSec * fatigue;
    return `
      <tr class="border-t border-stone-100">
        <td class="py-1.5 px-2 font-mono">${s.partial ? `${(s.km - (s.km % 1)).toFixed(0)}–${s.km.toFixed(2)}` : s.km.toFixed(0)}</td>
        <td class="py-1.5 px-2 text-right font-mono">${fmtHMS(s.dtSec)}</td>
        <td class="py-1.5 px-2 text-right font-mono">${fmtPace(s.pacePerKm)}</td>
        <td class="py-1.5 px-2 text-right font-mono text-stone-500">${fmtHMS(cum)}</td>
        <td class="py-1.5 px-2 text-right font-mono text-emerald-700">+${Math.round(s.gainM)}</td>
        <td class="py-1.5 px-2 text-right font-mono text-sky-700">-${Math.round(s.lossM)}</td>
        <td class="py-1.5 px-2 text-right font-mono text-amber-700">${fmtHMS(projSec)}</td>
      </tr>`;
  }).join("");

  // chart: pace bars + elevation line
  if (reconChart) reconChart.destroy();
  const labels = splits.map(s => s.partial ? s.km.toFixed(1) : s.km.toFixed(0));
  // elevation per-km: cumulative elevation at end of each km
  let eleAtKm = [];
  let mark = 1, lastEle = reconStats.points[0].ele;
  for (let i = 0; i < reconStats.points.length; i++) {
    const p = reconStats.points[i];
    while (p.cumKm >= mark && eleAtKm.length < splits.length) {
      eleAtKm.push(p.ele);
      mark += 1;
    }
  }
  while (eleAtKm.length < splits.length) eleAtKm.push(lastEle);

  reconChart = new Chart($("#reconChart").getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Pace (min/km)",
          data: splits.map(s => s.pacePerKm),
          backgroundColor: "rgba(14,116,144,0.7)",
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Elevation (m)",
          data: eleAtKm,
          borderColor: "rgba(120,113,108,0.6)",
          backgroundColor: "rgba(120,113,108,0.08)",
          fill: true,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { position: "top" } },
      scales: {
        y:  { position: "left",  title: { display: true, text: "Pace (min/km)" } },
        y1: { position: "right", title: { display: true, text: "Elevation (m)" }, grid: { drawOnChartArea: false } },
        x:  { title: { display: true, text: "KM" } },
      },
    },
  });
}

async function initRecon() {
  $("#reconStatus").textContent = "Loading recon GPX (~1.4 MB)…";
  await loadRecon();
  $("#reconStatus").remove();
  $("#reconBody").classList.remove("hidden");
  $("#fatigueSlider").addEventListener("input", renderRecon);
  $$('input[name="reconBaseline"]').forEach(r => r.addEventListener("change", renderRecon));
  $$('input[name="reconDistance"]').forEach(r => r.addEventListener("change", renderRecon));
  renderRecon();
}

// hook into tab switching to lazy-load recon
let reconInitPromise = null;
$$(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
  if (btn.dataset.tab === "recon" && !reconInitPromise) {
    reconInitPromise = initRecon().catch(e => console.error(e));
  }
}));

// ---------------- boot ----------------
(async () => {
  try {
    await loadGPX();
    buildMap();
    buildElevation();
  } catch (e) {
    console.error("Failed to load GPX:", e);
    $("#map").innerHTML = `<div class="p-8 text-rose-700">Couldn't load GPX. Make sure you're serving via http (not file://).</div>`;
  }
})();
