/* ============================================================
   store.js — all persistence lives here.
   Local-first: everything sits in localStorage under one key so a
   backup is a single JSON file you can drop in OneDrive. The shape is
   versioned and migrated on load, which is what makes cloud sync a
   drop-in replacement later rather than a rewrite.
   ============================================================ */

const KEY = 'forge.v1';
const SCHEMA_VERSION = 1;

/* ---------- id + date helpers ---------- */

export function uid(prefix = 'x') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Local-timezone YYYY-MM-DD. Never use toISOString() — it shifts the day. */
export function isoDate(d = new Date()) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
}

export function parseDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

/** Monday-start week containing `iso`. */
export function startOfWeek(iso) {
  const d = parseDate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return isoDate(d);
}

export function today() { return isoDate(new Date()); }

/* ---------- default state ---------- */

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    profile: {
      name: '',
      units: 'imperial',          // 'imperial' | 'metric'
      daysPerWeek: 4,
      equipment: ['bw', 'kb10', 'kb36'],
      // Baseline drives the very first plan. Updated as sessions land.
      baseline: {
        longRunMi: 6,             // longest comfortable run right now
        weeklyMi: 10,
        easyPace: '10:30',        // min/mi
        maxPushups: 20,
        maxPullups: 3,
        maxHangSec: 30,
        maxBurpees2min: 30,
      },
      // Per-exercise progression level, keyed by exercise id.
      levels: {},
      theme: 'dark',
      onboarded: false,
    },
    races: [],       // {id,name,type,date,distanceMi,obstacles,notes}
    blocks: [],      // {id,name,startDate,weeks,goal,raceId,daysPerWeek,createdAt}
    planned: [],     // {id,date,blockId,week,type,title,prescription,status,sessionId}
    sessions: [],    // logged work — see newSession()
    prs: {},         // {exerciseId: {value, unit, date, sessionId}}
    settings: {
      lastBackup: null,
      restTimerSec: 90,
      weekStart: 'mon',
    },
  };
}

/* ---------- load / save ---------- */

let state = null;
const listeners = new Set();

function migrate(raw) {
  const s = raw;
  if (!s.version) s.version = 1;
  // Future migrations chain here:
  // if (s.version === 1) { ...; s.version = 2; }
  const base = defaultState();
  // Shallow-merge top level and profile so new fields appear for old saves.
  const merged = { ...base, ...s };
  merged.profile = { ...base.profile, ...(s.profile || {}) };
  merged.profile.baseline = { ...base.profile.baseline, ...((s.profile || {}).baseline || {}) };
  merged.settings = { ...base.settings, ...(s.settings || {}) };
  merged.version = SCHEMA_VERSION;
  return merged;
}

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : defaultState();
  } catch (err) {
    console.error('Failed to read saved data, starting fresh:', err);
    state = defaultState();
  }
  return state;
}

export function get() { return load(); }

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Save failed:', err);
      notifyError('Storage full — export a backup and clear old data.');
    }
  }, 60);
  emit();
}

/** Mutate then persist: update(s => { s.profile.name = 'x' }) */
export function update(fn) {
  load();
  fn(state);
  save();
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

let errorHandler = null;
export function onError(fn) { errorHandler = fn; }
function notifyError(msg) { if (errorHandler) errorHandler(msg); }

/* ---------- sessions ---------- */

export function newSession(partial = {}) {
  return {
    id: uid('s'),
    date: today(),
    type: 'strength',        // run | strength | calisthenics | conditioning | mobility | other
    title: '',
    plannedId: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMin: null,
    rpe: null,               // 1-10 session RPE
    notes: '',
    // strength / calisthenics
    entries: [],             // {id, exerciseId, name, unit, sets:[{reps,weight,timeSec,distanceM,done}]}
    // running
    run: null,               // {distanceMi, durationSec, avgHr, elevFt, kind, source}
    source: 'manual',        // manual | strava | gpx | tcx
    ...partial,
  };
}

export function addSession(session) {
  update(s => {
    s.sessions.push(session);
    s.sessions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  });
  recomputePRs();
  return session;
}

export function updateSession(id, fn) {
  update(s => {
    const sess = s.sessions.find(x => x.id === id);
    if (sess) fn(sess);
  });
  recomputePRs();
}

export function deleteSession(id) {
  update(s => {
    const sess = s.sessions.find(x => x.id === id);
    if (sess && sess.plannedId) {
      const p = s.planned.find(x => x.id === sess.plannedId);
      if (p) { p.status = 'planned'; p.sessionId = null; }
    }
    s.sessions = s.sessions.filter(x => x.id !== id);
  });
  recomputePRs();
}

export function getSession(id) { return load().sessions.find(x => x.id === id) || null; }

export function sessionsOn(iso) { return load().sessions.filter(s => s.date === iso); }

export function sessionsBetween(fromIso, toIso) {
  return load().sessions.filter(s => s.date >= fromIso && s.date <= toIso);
}

/* ---------- planned sessions ---------- */

export function plannedOn(iso) { return load().planned.filter(p => p.date === iso); }

export function plannedBetween(fromIso, toIso) {
  return load().planned
    .filter(p => p.date >= fromIso && p.date <= toIso)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getPlanned(id) { return load().planned.find(p => p.id === id) || null; }

export function updatePlanned(id, fn) {
  update(s => {
    const p = s.planned.find(x => x.id === id);
    if (p) fn(p);
  });
}

export function deletePlanned(id) {
  update(s => { s.planned = s.planned.filter(p => p.id !== id); });
}

/** Replace all planned sessions belonging to a block (used when regenerating). */
export function replaceBlockPlan(blockId, plannedList) {
  update(s => {
    // Keep anything already completed so history is never destroyed by a replan.
    const keep = s.planned.filter(p => p.blockId === blockId && p.status === 'done');
    const keepDates = new Set(keep.map(p => p.date + '|' + p.type));
    const fresh = plannedList.filter(p => !keepDates.has(p.date + '|' + p.type));
    s.planned = s.planned.filter(p => p.blockId !== blockId).concat(keep, fresh);
    s.planned.sort((a, b) => a.date.localeCompare(b.date));
  });
}

/* ---------- blocks & races ---------- */

export function activeBlock(onIso = today()) {
  const s = load();
  return s.blocks.find(b => {
    const end = addDays(b.startDate, b.weeks * 7 - 1);
    return onIso >= b.startDate && onIso <= end;
  }) || s.blocks[s.blocks.length - 1] || null;
}

export function nextRace(fromIso = today()) {
  return load().races
    .filter(r => r.date >= fromIso)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

/* ---------- PRs ---------- */

/**
 * Recompute personal records from the full session history.
 * Derived data — always rebuilt, never hand-edited, so it can't drift.
 */
export function recomputePRs() {
  const s = load();
  const prs = {};

  const bump = (key, value, unit, date, sessionId, label) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const cur = prs[key];
    if (!cur || value > cur.value) prs[key] = { value, unit, date, sessionId, label };
  };

  for (const sess of s.sessions) {
    for (const e of (sess.entries || [])) {
      for (const st of (e.sets || [])) {
        if (!st.done) continue;
        if (e.unit === 'reps') {
          // Weighted reps get an estimated 1RM (Epley); bodyweight tracks max reps.
          if (st.weight > 0 && st.reps > 0) {
            bump(`${e.exerciseId}:e1rm`, Math.round(st.weight * (1 + st.reps / 30)), 'lb', sess.date, sess.id, `${e.name} est. 1RM`);
          }
          bump(`${e.exerciseId}:reps`, st.reps, 'reps', sess.date, sess.id, `${e.name} max reps`);
        } else if (e.unit === 'time') {
          bump(`${e.exerciseId}:time`, st.timeSec, 'sec', sess.date, sess.id, `${e.name} max hold`);
        } else if (e.unit === 'distance') {
          bump(`${e.exerciseId}:dist`, st.distanceM, 'm', sess.date, sess.id, `${e.name} max distance`);
        }
      }
    }
    if (sess.run && sess.run.distanceMi > 0) {
      bump('run:longest', +sess.run.distanceMi.toFixed(2), 'mi', sess.date, sess.id, 'Longest run');
      // Best pace only counts at a distance where pace is meaningful.
      if (sess.run.durationSec > 0 && sess.run.distanceMi >= 1) {
        const pace = sess.run.durationSec / sess.run.distanceMi;
        const cur = prs['run:pace'];
        if (!cur || pace < cur.value) {
          prs['run:pace'] = { value: Math.round(pace), unit: 'sec/mi', date: sess.date, sessionId: sess.id, label: 'Best avg pace' };
        }
      }
    }
  }

  update(st => { st.prs = prs; });
  return prs;
}

export function getPR(key) { return load().prs[key] || null; }

/** Best previous result for an exercise, for the "last time" line while logging. */
export function lastPerformance(exerciseId, beforeSessionId = null) {
  const s = load();
  for (const sess of s.sessions) {
    if (beforeSessionId && sess.id === beforeSessionId) continue;
    const e = (sess.entries || []).find(x => x.exerciseId === exerciseId);
    if (e && (e.sets || []).some(st => st.done)) {
      return { date: sess.date, entry: e };
    }
  }
  return null;
}

/* ---------- backup / restore ---------- */

export function exportJSON() {
  const s = load();
  return JSON.stringify({ ...s, exportedAt: new Date().toISOString() }, null, 2);
}

export function downloadBackup() {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forge-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  update(s => { s.settings.lastBackup = new Date().toISOString(); });
}

/**
 * Restore from a backup file.
 * mode 'replace' wipes current data; 'merge' keeps both, preferring existing
 * records on id collision so a restore can't silently overwrite newer work.
 */
export function importJSON(text, mode = 'replace') {
  const incoming = migrate(JSON.parse(text));
  if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.sessions)) {
    throw new Error('That file does not look like a Forge backup.');
  }
  if (mode === 'replace') {
    state = incoming;
  } else {
    const cur = load();
    const mergeById = (a = [], b = []) => {
      const seen = new Set(a.map(x => x.id));
      return a.concat(b.filter(x => !seen.has(x.id)));
    };
    state = {
      ...cur,
      races: mergeById(cur.races, incoming.races),
      blocks: mergeById(cur.blocks, incoming.blocks),
      planned: mergeById(cur.planned, incoming.planned),
      sessions: mergeById(cur.sessions, incoming.sessions)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    };
  }
  save();
  recomputePRs();
  return state;
}

export function resetAll() {
  state = defaultState();
  save();
}

/* ---------- stats used across views ---------- */

export function weeklyStats(weekStartIso) {
  const end = addDays(weekStartIso, 6);
  const sessions = sessionsBetween(weekStartIso, end);
  let miles = 0, runSec = 0, strengthSets = 0, sessionCount = sessions.length, load = 0;
  const byType = {};

  for (const s of sessions) {
    byType[s.type] = (byType[s.type] || 0) + 1;
    if (s.run) { miles += s.run.distanceMi || 0; runSec += s.run.durationSec || 0; }
    for (const e of (s.entries || [])) {
      strengthSets += (e.sets || []).filter(st => st.done).length;
    }
    // Session load = duration x RPE, the standard sRPE training-load proxy.
    if (s.durationMin && s.rpe) load += s.durationMin * s.rpe;
  }

  const planned = plannedBetween(weekStartIso, end);
  const done = planned.filter(p => p.status === 'done').length;

  return {
    weekStart: weekStartIso,
    miles: +miles.toFixed(2),
    runSec,
    strengthSets,
    sessionCount,
    load: Math.round(load),
    byType,
    plannedCount: planned.length,
    doneCount: done,
    adherence: planned.length ? Math.round((done / planned.length) * 100) : null,
  };
}

/** sRPE load for the last N weeks — the input to acute:chronic ratio. */
export function loadSeries(weeks = 12, endIso = today()) {
  const out = [];
  let ws = startOfWeek(endIso);
  for (let i = 0; i < weeks; i++) {
    out.unshift(weeklyStats(ws));
    ws = addDays(ws, -7);
  }
  return out;
}

/**
 * Acute:chronic workload ratio — this week's load vs the 4-week average.
 * Sports-science rule of thumb: above ~1.5 is a ramp associated with
 * elevated injury risk. Advisory only, not a diagnosis.
 */
export function acuteChronic(endIso = today()) {
  const series = loadSeries(5, endIso);
  const acute = series[series.length - 1].load;
  const priors = series.slice(0, 4).map(w => w.load).filter(v => v > 0);
  if (!priors.length || !acute) return null;
  const chronic = priors.reduce((a, b) => a + b, 0) / priors.length;
  if (!chronic) return null;
  return +(acute / chronic).toFixed(2);
}

export function streak() {
  const s = load();
  if (!s.sessions.length) return 0;
  const dates = new Set(s.sessions.map(x => x.date));
  let count = 0;
  let cur = today();
  // Today not being logged yet shouldn't break a live streak.
  if (!dates.has(cur)) cur = addDays(cur, -1);
  while (dates.has(cur)) { count++; cur = addDays(cur, -1); }
  return count;
}
