// All structured race data. Loaded as a plain script (window.DATA).
window.DATA = {
  race: {
    name: "BTR Ultra — BTRU 60K",
    location: "Mt. Batur, Bali",
    distance_km: 61.5,
    elevation_gain_m: 3400, // typical for this course; will be recomputed from GPX in app.js
    start_time: "04:00",
    cutoff_time: "23:00",
    cutoff_h: 19,
  },

  // Race start = 04:00. cutoff_h / target_h are hours after gun.
  // PLAN v4 (two-baseline model + fatigue ramp):
  //   - run pace (flat 30k in heat, HR ≤145) for runnable grades (|grade| ≤ 8%)
  //   - hike pace (AS3→AS4 recon, HR ≤145) for steep grades (|grade| > 8%)
  //   - linear fatigue ramp: 1.00× at km 0 → 1.18× at km 60
  // See analyze_recon.py for the full model. v4 paces below add small honest buffers
  // on top of model output. Cushions: AS3 +1h52m · AS4 +1h12m · Finish +2h03m.
  // leg_pace_min_per_km describes the leg ARRIVING at this AS. stop_min is the planned stop AT this AS.
  aid_stations: [
    { code: "START", name: "Batur Natural Hot Spring", km: 0.0,  cutoff_h: null, target_h: 0.0,            facilities: ["toilets","water","first aid"], dropbag: true,  spectators: true, menu: [], medic: "",
      leg_pace_min_per_km: null, stop_min: 0,
      leg_strategy: "Gun goes at 04:00. Walk first 200m to settle vest, then build into pace.",
    },
    { code: "AS1",   name: "Pasir Culali",             km: 10.2, cutoff_h: null, target_h: 2 + 43/60,       facilities: ["toilets","water","food","first aid"], dropbag: false, spectators: false,
      menu: {
        drinks: ["Mineral Water","Isotonic (Pocari Sweat)","Hot Tea & Coffee","VSoy Milk","Coca Cola"],
        food:   ["Boiled Potato","Boiled Egg","Instant Noodle","Porridge","Fitbar","Banana","Watermelon"],
      },
      medic: "3 Doctor · 2 Nurse · 1 Ambulance · 1 Hospital Team · 5 Physiotherapy",
      leg_pace_min_per_km: 16.0, stop_min: 3,
      leg_strategy: "Mt. Batur summit climb (+691m) and descent (−649m) over 10.2 km in the dark. Power-hike up, RUN the descent. Model says 15:49 (HR ≤145 w/ fatigue); v4 uses 16:00 for headlamp/vest/fresh-pace caution.",
    },
    { code: "AS2",   name: "Tanjakan Cinta",           km: 18.0, cutoff_h: null, target_h: 4 + 8/60,        facilities: ["toilets","water","food","first aid"], dropbag: false, spectators: false,
      menu: {
        drinks: ["Mineral Water","Isotonic (Pocari Sweat)","Hot Tea & Coffee","VSoy Milk","Coca Cola","Ice Syrup"],
        food:   ["Cassava Chips","Boiled Potato","Boiled Egg","Instant Noodle","Porridge","Green Beans Soup","Fitbar","Bengbeng Chocolate","Chips","Banana","Watermelon"],
      },
      medic: "1 Doctor · 3 Nurse · 1 Ambulance · 1 Hospital Team · 3 Physiotherapy",
      leg_pace_min_per_km: 10.5, stop_min: 3,
      leg_strategy: "Rolling 7.8 km, sunrise at km 14. RUN this leg — net flat (+163m / −199m). Run-baseline says 9:53/km @HR ≤145; v4 uses 10:30 for headlamp transition, fueling, and dawn-vest-cinch. Sunglasses + hat on at sunrise.",
    },
    { code: "AS3",   name: "Gunung Abang",             km: 27.0, cutoff_h: 8.0,  target_h: 6 + 8/60,        facilities: ["toilets","water","food","first aid","vehicle access"], dropbag: true,  spectators: true,
      menu: {
        drinks: ["Mineral Water","Isotonic (Pocari Sweat)","Hot Tea & Coffee","VSoy Milk","Coca Cola","Ice Syrup"],
        food:   ["Cassava Chips","Boiled Potato","Boiled Egg","Instant Noodle","Rice + Chicken Soto","Porridge","Green Beans Soup","Fitbar","Bengbeng Chocolate","Chips","Banana","Watermelon","Dates"],
      },
      medic: "3 Doctor · 2 Nurse · 1 Ambulance · 1 Hospital Team · 2 Physiotherapy",
      note: "60K cutoff 12:00 (gun + 8h). Drop bag #1.",
      leg_pace_min_per_km: 13.0, stop_min: 12,
      leg_strategy: "Climb to ~1620m (+541m / −141m over 9 km). MIXED terrain — per-km model alternates flat 7-8/km bits with steep 18-22/km bits. RUN the runnable, power-hike the steep. v4 13:00 weighted avg. DO NOT chase Virtual Partner.",
    },
    { code: "AS4",   name: "Desa Terunyan",            km: 34.7, cutoff_h: 11.0, target_h: 9 + 48/60,       facilities: ["toilets","water","food","first aid","vehicle access"], dropbag: true,  spectators: true,
      menu: {
        drinks: ["Mineral Water","Isotonic (Pocari Sweat)","Hot Tea & Coffee","VSoy Milk","Coca Cola","Ice Syrup"],
        food:   ["Cassava Chips","Boiled Potato","Boiled Egg","Instant Noodle","Rice + Chicken Soup","Porridge","Fitbar","Bengbeng Chocolate","Chips","Banana","Watermelon"],
      },
      medic: "2 Doctor · 1 Nurse · 1 Ambulance · 1 Hospital Team · 1 Physiotherapy",
      note: "60K cutoff 15:00 (gun + 11h). Drop bag #2. FULLY REFILL LOGISTIC HERE.",
      leg_pace_min_per_km: 27.0, stop_min: 15,
      leg_strategy: "Recon-validated leg (+1033m / −1194m over 7.7 km). Model says 27:07/km w/ fatigue at km 30. Heat hits hard. Walk steepest descents to save quads. AS4 cushion is +1h 12m in v4 — comfortable but earn it.",
    },
    { code: "AS5",   name: "Pedahan",                  km: 39.3, cutoff_h: null, target_h: 11 + 40/60,      facilities: ["water","food","first aid"], dropbag: false, spectators: false,
      menu: {
        drinks: ["Mineral Water","Isotonic (Pocari Sweat)","Hot Tea & Coffee","VSoy Milk","Coca Cola","Ice Syrup"],
        food:   ["Cassava Chips","Boiled Potato","Boiled Egg","Instant Noodle","Nata de coco","Porridge","Fitbar","Bengbeng Chocolate","Chips","Banana","Watermelon","Jelly","Dates"],
      },
      medic: "1 Doctor · 2 Nurse · 1 Hospital Team · 1 Physiotherapy (no ambulance on-site)",
      leg_pace_min_per_km: 21.0, stop_min: 3,
      leg_strategy: "Technical descent to lake (+21m / −549m over 4.6 km — almost pure descent). Model says 21:23/km. Save quads. The AS4 reload has you fueled — just control descent and drink.",
    },
    { code: "AS6",   name: "Alengkong",                km: 47.0, cutoff_h: null, target_h: 13 + 42/60,      facilities: ["water","food","first aid"], dropbag: false, spectators: false,
      menu: {
        drinks: ["Mineral Water","Isotonic (Pocari Sweat)","Hot Tea & Coffee","VSoy Milk","Coca Cola","Ice Syrup"],
        food:   ["Cassava Chips","Boiled Potato","Boiled Egg","Instant Noodle","Porridge","Fitbar","Bengbeng Chocolate","Chips","Banana","Watermelon","Jelly","Dates"],
      },
      medic: "1 Doctor · 2 Nurse · 1 Hospital Team · 3 Physiotherapy (no ambulance on-site)",
      leg_pace_min_per_km: 15.5, stop_min: 5,
      leg_strategy: "Major late-race climb: +805m / −213m over 7.7 km (mostly steep but with runnable bits). Hottest part of day. Model says 14:43/km w/ fatigue; v4 15:30 for heat buffer. Coca Cola at AS6 = caffeine top-up for the mental wall (km 45-50).",
    },
    { code: "AS7",   name: "Songan Village",           km: 55.6, cutoff_h: null, target_h: 15 + 43/60,      facilities: ["water","food","first aid"], dropbag: false, spectators: false,
      menu: {
        drinks: ["Mineral Water","Isotonic (Pocari Sweat)","Hot Tea & Coffee","VSoy Milk","Coca Cola","Ice Syrup","Nata de coco"],
        food:   ["Cassava Chips","Boiled Potato","Boiled Egg","Instant Noodle","Porridge","Fitbar","Bengbeng Chocolate","Chips","Banana","Watermelon","Jelly","Dates"],
      },
      medic: "1 Doctor · 1 Ambulance · 2 Physiotherapy (no hospital team on-site)",
      leg_pace_min_per_km: 13.5, stop_min: 3,
      leg_strategy: "Rolling terrain (+288m / −358m). Model says 13:22/km w/ fatigue — runnable mostly downhill. v4 13:30 small buffer. Caffeine + Sari Roti for the ultra wall (km 45-50). Songan = launchpad.",
    },
    { code: "FINISH",name: "Batur Natural Hot Spring", km: 61.5, cutoff_h: 19.0, target_h: 16 + 57/60,      facilities: ["toilets","water","food","first aid","drop bag retrieval"], dropbag: true, spectators: true, menu: [], medic: "",
      leg_pace_min_per_km: 12.0, stop_min: 0,
      leg_strategy: "5.9 km net downhill (+110m / −210m). Lights stay off (sunset ~18:15, but you finish before 21:00). Model says 11:54/km. Last caffeine then send it home.",
    },
  ],

  fueling_points: [
    { km: 3.0,  label: "Sari Roti Cokelat #1",  note: "1 piece (~22g carbs). Sip Pocari from flask." },
    { km: 6.0,  label: "Salt tab + 200ml",      note: "1× salt cap. Drink Pocari. Pre-Pasir climb." },
    { km: 13.0, label: "Sari Roti Cokelat #2",  note: "1 piece. AS1 refilled your flask with Pocari." },
    { km: 16.0, label: "Salt + sip",            note: "1× salt cap. Force a drink — heat building." },
    { km: 21.0, label: "Sari Roti Cokelat #3",  note: "1 piece. Big drink before Abang push." },
    { km: 24.0, label: "Salt + sip",            note: "1× salt cap. Coca Cola at AS3 = caffeine onramp." },
    { km: 30.0, label: "CAFFEINE backup gel",   note: "Only if Coke at AS3 didn't land. Salt cap." },
    { km: 33.0, label: "Small bite + sip",      note: "Brutal descent. Stomach-safe only — half a Sari Roti or banana from AS4 prep pocket." },
    { km: 37.0, label: "Sari Roti Cokelat #4",  note: "1 piece. AS4 was the big reset — you're stocked." },
    { km: 42.0, label: "Salt + drink",          note: "1× salt cap. Drain bottle before AS5." },
    { km: 45.0, label: "Sari Roti Cokelat #5",  note: "1 piece. Caffeine backup gel if energy dipping." },
    { km: 51.0, label: "Sari Roti Cokelat #6",  note: "1 piece + salt. Long final leg." },
    { km: 58.0, label: "Final CAFFEINE",        note: "Last caffeine gel OR Coca Cola at AS7. Drive to finish." },
  ],

  // Hourly fueling targets (per coach/research consensus for 12-15h hot ultras).
  fueling_targets: {
    carbs_first_half_g_per_h: "60-90",
    carbs_second_half_g_per_h: "30-60",
    fluid_ml_per_h: "500-750",
    sodium_mg_per_h: "500-700",
    caffeine_total_mg: "200-400 over race, start at AS3 (Coca Cola first, gels backup)",
  },

  // Indonesian fueling staples — what Brad's plan is built around.
  fueling_staples: [
    { item: "Pocari Sweat",         role: "Primary isotonic — refilled at EVERY AS",        macros: "Per 500 ml: ~31g carbs · ~245 mg sodium · ~100 mg potassium",         strategy: "Two flasks. Drain one between AS, refill both at every stop. Target 500–750 ml/h." },
    { item: "Sari Roti Cokelat",    role: "Primary solid carb — carried personally",       macros: "Per piece: ~140 kcal · ~22g carbs · easy on stomach in heat",         strategy: "1 piece every ~30 min from km 3. Carry 6–8 pieces; restock 4–6 more at the AS4 drop bag." },
    { item: "Coca Cola",            role: "Primary caffeine source — at every AS",         macros: "Per 200 ml cup: ~21g carbs · ~20 mg caffeine",                       strategy: "Start at AS3 (km 27). 1 cup at AS3, AS4, AS6, AS7. Backup caffeine gels only if Coke supply runs dry." },
    { item: "Banana / Boiled potato",role: "Real-food carbs at AS3, AS4 stops",            macros: "Banana ~25g carbs · Boiled potato ~15g carbs + sodium",              strategy: "Eat sitting at AS3 and AS4. Skip at faster AS (in-and-out)." },
    { item: "Rice + Chicken Soto/Soup", role: "Hot meal at AS3 + AS4 only",                macros: "~50g carbs + sodium + protein",                                      strategy: "Force this down at AS4 (Terunyan) even if not hungry. It's the engine for the back half." },
    { item: "Dates / Jelly / Nata de coco", role: "Late-race sugar hits at AS5–AS7",       macros: "Date ~5g carbs each · Jelly ~10g · Nata de coco fluid + sugar",      strategy: "Free 'palate reset' carbs when sweet gels start to nauseate. Take a small handful at AS5+." },
    { item: "Salt caps (SaltStick / LMNT)", role: "Sodium beyond what Pocari delivers",    macros: "~200 mg sodium per cap",                                             strategy: "1 cap every 60 min, plus 1 extra after any rice/soup meal. Pocari + 1 cap/h ≈ 500 mg/h." },
  ],

  // Section-by-section course intel.
  course_sections: [
    { from_km: 0,    to_km: 10.2, name: "Start → AS1 Pasir Culali",  notes: "Roll-out from Batur hot springs. First 2h in dark — headlamp on. Mostly runnable, gentle rollers. Don't get sucked into early pace. Hold Z2." },
    { from_km: 10.2, to_km: 18,   name: "AS1 → AS2 Tanjakan Cinta",  notes: "Begins climbing toward Tanjakan Cinta (Cinta = 'love'; usually means a brutal romance with vertical). Sunrise hits around km 14 — sunglasses + hat from here. Power hike anything >10%." },
    { from_km: 18,   to_km: 27,   name: "AS2 → AS3 Gunung Abang",    notes: "The big climb. Gunung Abang summit area, ~2150m. Cool air pre-noon helps. PacePro target will be slow — trust it. Pole-friendly. Reach AS3 by 11:00 = comfortable; 11:30 = warning; 12:00 = cutoff DNF." },
    { from_km: 27,   to_km: 34.7, name: "AS3 → AS4 Terunyan",        notes: "The hardest 7.7km. Steep technical descent off Abang, then traverse to Lake Batur shore. Heat starting to bake. Watch ankles on volcanic scree. Walk the steepest descents — quad blowout = race over. AS4 cutoff is THE bottleneck." },
    { from_km: 34.7, to_km: 39.3, name: "AS4 → AS5 Pedahan",         notes: "Recovery section along the lake. Mostly flat / rolling. Hottest part of the day (12-2pm). Drench buff. Caloric reset must have happened at AS4." },
    { from_km: 39.3, to_km: 47,   name: "AS5 → AS6 Alengkong",       notes: "Inland climb away from the lake. Sun exposure heavy. AS5 is water-only — refill at AS6 properly. Long leg — manage perceived effort, walk to keep HR sub-LT." },
    { from_km: 47,   to_km: 55.6, name: "AS6 → AS7 Songan Village",  notes: "Villages and rolling terrain. Mental low point usually hits here (km 45-50 = ultra wall). Caffeine + real food at AS6 to push through. Songan = stage for final push." },
    { from_km: 55.6, to_km: 61.5, name: "AS7 → FINISH",              notes: "Last 5.9 km back to hot springs. Mostly downhill / rolling. Lights back on by km 58 (sunset ~18:15). Final caffeine. Send it." },
  ],

  // FR970-specific min/max tips. Verify each in Garmin menus pre-race.
  watch_setup: {
    pre_race: [
      { id: "fw",      task: "Update FR970 firmware via Garmin Connect", detail: "Settings → System → Software Update. Do this >3 days out so any regression has time to surface." },
      { id: "course",  task: "Send course (btr-ultra-60k-full.gpx) to watch", detail: "Garmin Connect → Training → Courses → Import → Send to Device. Verify it appears in Navigate → Courses on the watch. The file encodes the <b>v4 plan</b> — each aid + fueling point includes target clock time, cutoff cushion, leg pace, and the planned action." },
      { id: "pacepro", task: "Create PacePro strategy from course", detail: "Connect app → Training & Planning → PacePro Strategies → New → Course: BTR Ultra 60K → Goal time 17:00:00 (matches v4 finish target 20:57) → Slight positive split → Climb sensitivity HIGH. Sync. <i>Note: PacePro will recommend its own split paces; trust the GPX waypoint targets over PacePro when they differ — PacePro doesn't know we banked time AS1→AS2.</i>" },
      { id: "vp",      task: "Set Virtual Partner pace to 16:30/km", detail: "Trail Run profile → Training → Virtual Partner → On → 16:30/km. This is the v4 race-average pace (61.5 km in 16h57m ≈ 16:33/km). VP at 15:00/km would be wildly ahead on climbs and tempt you to push." },
      { id: "screens", task: "Add data screens (see Recommended screens below)", detail: "Trail Run profile → Data Screens. Five screens in the order shown in the recommended block: Up Ahead → PacePro → VP → 4-field Run → Map." },
      { id: "alerts",  task: "Set HR alert at 145 bpm (high)", detail: "Trail Run profile → Alerts → Heart Rate → High → 145 bpm. Above LT1 in the first 30 km = glycogen crash. Pace alerts are noisy on this terrain — skip them, trust HR + waypoint targets instead." },
      { id: "courseAlerts", task: "Enable Course Point alerts (CRITICAL)", detail: "Trail Run profile → Alerts → Course Point Alerts → On. Each aid + fueling waypoint will buzz ~200 m before you arrive and pop up the comment field showing target time / leg pace / planned action. <b>This is how you race off the watch.</b>" },
      { id: "hr",      task: "Pair chest HR strap (HRM-Pro Plus or Polar H10)", detail: "Wrist HR is unreliable on technical descents and dehydrated skin. Chest strap is non-negotiable for serious efforts." },
      { id: "power",   task: "Create custom Power Mode", detail: "Power Manager → Customize Power Modes → New. GPS: All Systems (not multi-band — saves ~30% battery). Music: off. Phone: off. Pulse Ox: off. Backlight: gesture only at 50%." },
      { id: "battery", task: "Charge to 100% night before", detail: "FR970 has ~26h GPS in All Systems mode. You need ~17h. Margin is fine but don't start at 70%." },
      { id: "music",   task: "Sideload offline music (optional)", detail: "Save battery: only ~5h playback on FR970. Use sparingly post-AS4 if mental low hits." },
      { id: "notif",   task: "Disable smart notifications + DND on", detail: "System → Notifications → Off during activity. Sound & Vibe → DND → On. You don't need pings mid-race." },
      { id: "race",    task: "Use the Race / Up Ahead feature", detail: "Trail Run profile → Race → Add upcoming course. Watch will show splits, target finish, and aid-station ETAs as 'Up Ahead' cards on the data screens." },
      { id: "lap",     task: "Auto-lap by CoursePoint (not distance)", detail: "Trail Run profile → Laps → Auto Lap → By Course Point. Each aid station / fueling point splits the activity log cleanly." },
      { id: "energy",  task: "Check Body Battery + Sleep score race morning", detail: "Want Body Battery 80+, Sleep score 75+. If under, adjust the goal — don't chase the A-goal on a B-goal day." },
      { id: "find",    task: "Save start line as a Saved Location", detail: "Save Location at the hot springs gate. If you ever bail or get lost, navigate-back-to-start works offline." },
    ],
    race_day: [
      { id: "start",   task: "Start activity 5 min before gun", detail: "Confirms GPS lock before adrenaline takes over. Pause until the actual start if needed." },
      { id: "ppLoad",  task: "Load PacePro on activity start", detail: "When you start Trail Run + Course, the watch prompts: 'Load PacePro?'. Yes." },
      { id: "vpScreen",task: "Confirm Up Ahead screen on the carousel", detail: "Swipe through data screens before gun. Up Ahead is the primary race screen — it shows the next 3 course points with their target arrival times." },
      { id: "darkness",task: "Headlamp + reflective strip on shoes", detail: "First 2h in dark. FR970 backlight on gesture is fine but headlamp is your real light source." },
      { id: "manualLap",task:"Manual-lap on aid station entry", detail: "Backup if auto-lap-on-CoursePoint misses. Press the lap button as you enter the aid station tent." },
      { id: "coursePoint", task: "On every CoursePoint buzz: glance, act, dismiss", detail: "Watch buzzes → glance at the popup (KM · TGT · leg pace · action) → execute the action (gel / salt / refill) → press back to dismiss. Should take <5 seconds while still moving." },
    ],

    // Data screens, in order. The watch carousel shows them with swipe / button press.
    data_screens: [
      {
        name: "1. Up Ahead",
        when: "Default screen between aid stations. Live snapshot of the race.",
        fields: "Next 3 course points + distance + target ETA",
        why: "v4 plan is encoded in the GPX as target clock times. This screen tells you whether you're on / ahead / behind for the next aid station without doing math.",
      },
      {
        name: "2. PacePro",
        when: "On climbs and descents. Skip on flats.",
        fields: "Current split target pace · Ahead/Behind bar · Next split preview",
        why: "PacePro adjusts the per-split target by grade. On the AS3→AS4 descent it'll target ~27:00/km — that's a feature, not a bug. Trust it on hills; the bar should sit near center.",
      },
      {
        name: "3. Virtual Partner",
        when: "Glance at each aid station to read cumulative banking.",
        fields: "Distance ahead / behind VP at 16:30/km flat",
        why: "VP is a flat-pace ghost. Ignore it mid-climb (you'll always be behind). Use it as a sanity check at aid stations — at AS3 you want to be roughly even with VP; if you're 20+ min behind, dial back the back half.",
      },
      {
        name: "4. 4-field Run (custom)",
        when: "Default screen on runnable flats and the final 6 km.",
        fields: "HR · Current Pace · Time of Day · Distance to Next Course Point",
        why: "HR is your governor (≤145 first 30 km). Time of Day is your absolute cutoff reference. Distance to next CoursePoint tells you how far until the next buzz.",
      },
      {
        name: "5. Map (zoomed)",
        when: "Navigation checks — junctions, scree fields, when you 'feel off course'.",
        fields: "Course line + your position + next waypoint",
        why: "If the breadcrumb diverges from your position by more than ~50 m, you're off course. Backtrack to the line — don't bushwhack a shortcut.",
      },
    ],

    // How the v4-encoded GPX shows up on race day.
    gpx_usage: [
      { id: "g1", task: "What's in the GPX file", detail: "<code>btr-ultra-60k-full.gpx</code> contains the course track + 22 course points (9 aid stations, 13 fueling reminders). Each point's comment encodes: KM marker · target clock time · cumulative h:mm · cutoff cushion (where applicable) · planned leg pace · planned stop minutes · the one-line action." },
      { id: "g2", task: "What you'll see on the watch when it buzzes", detail: "About 200 m before each course point the FR970 buzzes and pops a banner with the waypoint name + comment. Example at AS3: <code>KM 27.0 | TGT 10:08 AM (+6h08) | CUTOFF 12:00 PM (+1h52 cushion) | Leg 13:00/km (9.0km / 1h57) | Stop 12min | Drop bag #1. Coke + rice/soto + banana. Refill BOTH flasks. 12 min.</code>" },
      { id: "g3", task: "Reading the leg pace mid-leg", detail: "When you're between AS2 and AS3, the most-recent CoursePoint alert tells you the target leg pace for the leg you're ON. Compare against current pace on the 4-field screen. Behind by 0–1 min/km = fine. Behind by 2+ min/km consistently = drop fuel or HR check." },
      { id: "g4", task: "Reading cutoff cushion at AS3 / AS4", detail: "Cutoff cushion = how much slack you have vs. the official cutoff if you hit your v4 target. AS3 cushion is +1h52m, AS4 is +1h12m. If you arrive AT the v4 target, that cushion is your absolute float. If you arrive 30 min late, cushion shrinks to 1h22m / 42m — still safe but tighten up." },
      { id: "g5", task: "If the watch dies", detail: "GPX is also on your phone (Garmin Connect mobile or any GPX viewer like Maps.me / Gaia GPS / Avenza). Race directors require it as backup anyway. The phone GPX has the same waypoint comments." },
    ],
  },

  gear: {
    mandatory: [
      { id: "gm-bib",      task: "Bib number",                                       detail: `<span class="text-rose-600 font-semibold">Missing = DISQUALIFIED</span>` },
      { id: "gm-water",    task: "Water / flask — minimum 500 ml capacity",          detail: `<span class="text-amber-600 font-semibold">Missing = 1-hour time deduction.</span> Plan for 1.5L+ across two flasks for Bali heat.` },
      { id: "gm-phone",    task: "Handphone (charged)",                              detail: `<span class="text-amber-600 font-semibold">Missing = 1-hour time deduction.</span> Save race director's number before gun.` },
      { id: "gm-food",     task: "Energy food / bar",                                detail: `<span class="text-amber-600 font-semibold">Missing = 1-hour time deduction.</span> Keep at least one solid bar visible in a top pocket at all times.` },
      { id: "gm-aidkit",   task: "Personal aid kit",                                 detail: `<span class="text-rose-600 font-semibold">Missing = DISQUALIFIED.</span> Blister plasters, antiseptic wipe, painkillers, tape.` },
      { id: "gm-pack",     task: "Running pack / vest or belt",                      detail: `<span class="text-rose-600 font-semibold">Missing = DISQUALIFIED.</span> 12L+ vest recommended to fit all mandatory items.` },
      { id: "gm-gpx",      task: "GPX file / maps loaded on watch or phone",         detail: `<span class="text-rose-600 font-semibold">Missing = DISQUALIFIED.</span> Use btr-ultra-60k-full.gpx (course + aid + fueling waypoints).` },
      { id: "gm-cup",      task: "Foldable glass / cup",                             detail: `Mandatory. No single-use cups provided.` },
      { id: "gm-bowl",     task: "Foldable cup / plate WITH spoon &amp; fork",       detail: `Mandatory. No single-use bowls/cutlery provided.` },
      { id: "gm-jacket",   task: "Waterproof jacket / raincoat",                     detail: `<span class="text-rose-600 font-semibold">Missing = DISQUALIFIED.</span> Packable shell — Batur weather flips fast.` },
      { id: "gm-blanket",  task: "Emergency blanket",                                detail: `<span class="text-rose-600 font-semibold">Missing = DISQUALIFIED.</span> Foil space blanket, sealed in vest.` },
      { id: "gm-headlamp", task: "Headlamp with spare batteries",                    detail: `<span class="text-rose-600 font-semibold">Missing = DISQUALIFIED.</span> 300+ lumens. Start is 04:00 — you'll need it from km 0.` },
      { id: "gm-whistle",  task: "Whistle",                                          detail: `Mandatory.` },
      { id: "gm-money",    task: "Money (cash)",                                     detail: `Mandatory.` },
    ],
    strongly_recommended: [
      "Trekking poles (foldable, Z-pole) for Abang climb",
      "Buff (drench in water for heat)",
      "Sun hat / running cap",
      "Sunglasses",
      "Sunscreen (SPF 50, sweat-resistant)",
      "Anti-chafe (Body Glide / Squirrel's Nut Butter)",
      "Salt tabs (SaltStick or similar) — pre-count one per hour",
      "Caffeine gels x4-5 (Maurten 100 Caf, GU Roctane)",
      "Standard gels x10-12",
      "Real food: rice balls / bananas / boiled potatoes with salt",
      "Backup socks in drop bag (AS3 or AS4)",
      "Backup shirt in drop bag (AS4)",
      "Spare insoles (if blister-prone)",
    ],
    drop_bag_AS3: [
      "Sari Roti Cokelat x 3 (restock vest)",
      "Salt caps x 6 (restock vest)",
      "Caffeine gel x 1 (backup, if Coke at AS not enough)",
      "Pre-mixed 500ml Pocari (cold, in cooler if possible)",
      "Cap / buff (cool replacement)",
      "Sunscreen reapply",
    ],
    drop_bag_AS4: [
      "Sari Roti Cokelat x 4-6 (BIG restock — final personal fuel before AS7)",
      "Salt caps x 8 (restock vest)",
      "Caffeine gels x 2 (backup)",
      "Fresh socks",
      "Fresh shirt",
      "Backup headlamp + batteries",
      "Pre-mixed 500ml Pocari (cold)",
      "Vaseline / anti-chafe re-apply",
      "Spare insoles",
    ],
  },

  race_day_timeline: [
    { time: "Night before (sleep by 21:00)", actions: [
      "Lay out gear in start-line order. Pin bib to vest.",
      "Pre-fill bottles: 1× electrolyte, 1× water.",
      "Count gels into vest pockets (no fumbling at 4am).",
      "Charge watch to 100%. Headlamp to 100%. Phone to 100%.",
      "Verify course + PacePro loaded on watch (Navigate → Courses → BTR Ultra 60K).",
      "Carb-load dinner: rice + chicken + sweet potato. No new foods.",
      "Set 3 alarms. Lay out race kit on chair.",
    ]},
    { time: "02:30 — Wake", actions: [
      "Coffee + 500ml water + electrolyte.",
      "Easy breakfast 2h before start: oats + honey + banana, or rice + egg.",
      "Bathroom routine. Vaseline / Body Glide everywhere.",
      "Sunscreen on (yes, at 3am — you won't have time later).",
    ]},
    { time: "03:30 — Arrive start line", actions: [
      "Drop bags to designated AS3 / AS4 pile.",
      "Last-minute toilet.",
      "Start GPS lock on watch.",
      "Easy 5-min jog + dynamic stretches.",
      "Sip 200ml water. No more food.",
    ]},
    { time: "03:55 — Final check", actions: [
      "Headlamp on. Vest cinched. Poles deployed if using on climbs.",
      "Watch screen on Virtual Partner.",
      "Position: mid-pack. Do not start near the front.",
    ]},
    { time: "04:00 — GUN", actions: [
      "Start activity → load PacePro → Yes.",
      "Walk the first 200m to settle vest + watch.",
      "First 10km: HR below 145. If you can hold a conversation, pace is right.",
    ]},
    { time: "10:08 target — AS3 Gunung Abang (cutoff 12:00, +1h 52m cushion)", actions: [
      "In-and-out target: 12 min. Launchpad for AS4.",
      "Drop bag #1: restock salt caps, top up Sari Roti pieces, swap empty caffeine-gel pocket.",
      "Refill BOTH flasks with Pocari Sweat. Drain one before leaving.",
      "Caffeine starts here — 200ml Coca Cola. Eat sitting: banana + boiled potato + rice + chicken soto.",
    ]},
    { time: "13:48 target — AS4 Desa Terunyan (cutoff 15:00, +1h 12m cushion) — THE BIG ONE", actions: [
      "In-and-out target: 15 min. 'Fully re-fill logistic here.'",
      "Drop bag #2: fresh socks + shirt. Foot inspection. Tape any hot spots.",
      "Restock 4-6 more Sari Roti Cokelat into vest. Top up salt caps.",
      "Refill BOTH flasks with Pocari Sweat. 200ml Coca Cola.",
      "Sit-down meal: rice + chicken soup + banana + watermelon. Force it down.",
      "Mental reset — second half is more runnable.",
    ]},
    { time: "20:57 target — Finish (cutoff 23:00, +2h 03m cushion)", actions: [
      "Recovery: 500ml carb drink immediately.",
      "Find your finisher's food. Sit. Smile.",
    ]},
  ],

  pacing_rules: [
    { rule: "Walk anything >8% grade", why: "Running uphill on steep grades costs 3× the energy for only ~15% more speed. Power hike with poles." },
    { rule: "Don't chase Virtual Partner on climbs", why: "VP is flat 15:00/km. You'll be 'behind' on every climb. Trust PacePro on hills, trust VP cumulatively at aid stations." },
    { rule: "Eat every 30 min from the start", why: "Once you feel hungry / bonky, you're already 30 min behind. Set a watch alert if needed." },
    { rule: "Drink every 15-20 min", why: "Bali humidity is brutal. Dry mouth = already dehydrated." },
    { rule: "Heart rate cap: Z2 for first 30km", why: "Above LT1 early = glycogen crash by km 40. Slow is smooth, smooth is fast." },
    { rule: "Aid stations: 5 min max (except AS3, AS4)", why: "Standing around drops core temp and tightens legs. In-out fast." },
    { rule: "If something hurts, fix it NOW", why: "A hot spot at km 15 = bloody blister at km 30 = DNF at km 40. Take 2 min, tape it." },
    { rule: "Negative emotions = you're under-fueled", why: "Bonk presents as 'this is stupid, I want to quit'. Eat, drink, walk 5 min, reassess." },
    { rule: "After AS4 = you finish", why: "Past the cutoff window, every step is permission to send it. Mental gear shift." },
  ],

  warning_signs: [
    "Stop sweating in heat → urgent: shade, cool down, electrolytes, slow",
    "Goosebumps in 28°C heat → heat exhaustion onset, stop & cool",
    "Calf cramp → salt deficit + dehydration, immediate sodium + fluid",
    "Dark yellow / no urine for >3h → drink 500ml + salt",
    "Nausea blocking intake → switch to liquid carbs, smaller sips",
    "Dizziness on standing → BP / electrolyte issue, sit, salt, water",
    "Wheezing / chest tightness → altitude or asthma, slow, deep breaths",
  ],
};
