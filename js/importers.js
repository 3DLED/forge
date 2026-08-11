/* ============================================================
   importers.js — get Apple Watch / Strava runs in without retyping.

   Supported:
     - Strava bulk export  activities.csv   (whole history at once)
     - GPX files           (Strava/Apple Health single-activity export)
     - TCX files           (Garmin/Strava)
     - Apple Health        export.xml       (workout summaries only)

   All parsing is client-side. Nothing is uploaded anywhere.
   ============================================================ */

import { uid, isoDate, newSession } from './store.js';

/* ---------- CSV ---------- */

/** Quote-aware CSV parser — Strava descriptions contain commas and newlines. */
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

const M_PER_MI = 1609.344;

function findCol(headers, ...names) {
  const lower = headers.map(h => h.trim().toLowerCase());
  for (const n of names) {
    const i = lower.indexOf(n.toLowerCase());
    if (i !== -1) return i;
  }
  // fall back to a "contains" match
  for (const n of names) {
    const i = lower.findIndex(h => h.includes(n.toLowerCase()));
    if (i !== -1) return i;
  }
  return -1;
}

function mapActivityType(raw) {
  const t = String(raw || '').toLowerCase();
  if (t.includes('run') || t.includes('trail')) return 'run';
  if (t.includes('walk') || t.includes('hike')) return 'run';
  if (t.includes('ride') || t.includes('bike') || t.includes('cycl')) return 'other';
  if (t.includes('weight') || t.includes('strength')) return 'strength';
  if (t.includes('yoga') || t.includes('stretch')) return 'mobility';
  if (t.includes('workout') || t.includes('hiit') || t.includes('crossfit')) return 'conditioning';
  return 'other';
}

function toIsoFromAny(str) {
  if (!str) return null;
  // Strava uses "Aug 11, 2026, 6:14:03 AM"; Date handles it, but guard anyway.
  const d = new Date(str);
  if (!isNaN(d)) return isoDate(d);
  const m = String(str).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Parse Strava's activities.csv from a bulk export.
 * The file is inconsistent about units (km in one column, meters in
 * another depending on export vintage), so distance is sniffed per row.
 */
export function parseStravaCSV(text, { distanceUnit = 'auto' } = {}) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('That CSV looks empty.');

  const headers = rows[0];
  const iDate = findCol(headers, 'Activity Date', 'date');
  const iName = findCol(headers, 'Activity Name', 'name');
  const iType = findCol(headers, 'Activity Type', 'type');
  const iElapsed = findCol(headers, 'Elapsed Time', 'elapsed');
  const iMoving = findCol(headers, 'Moving Time', 'moving');
  const iDist = findCol(headers, 'Distance');
  const iHr = findCol(headers, 'Average Heart Rate', 'avg heart rate');
  const iElev = findCol(headers, 'Elevation Gain', 'total elevation gain');
  const iDesc = findCol(headers, 'Activity Description', 'description');

  if (iDate === -1) throw new Error('No "Activity Date" column — is this Strava\'s activities.csv?');

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const date = toIsoFromAny(row[iDate]);
    if (!date) continue;

    const typeRaw = iType !== -1 ? row[iType] : 'Run';
    const type = mapActivityType(typeRaw);

    let distanceMi = null;
    if (iDist !== -1) {
      const raw = parseFloat(String(row[iDist]).replace(/[^\d.]/g, ''));
      if (Number.isFinite(raw) && raw > 0) {
        // Strava's bulk export is metric regardless of display preference,
        // so km is the default read. A value over 500 can only be meters.
        // The caller can force a unit when the file came from elsewhere.
        if (distanceUnit === 'mi') distanceMi = raw;
        else if (distanceUnit === 'km') distanceMi = (raw * 1000) / M_PER_MI;
        else distanceMi = raw > 500 ? raw / M_PER_MI : (raw * 1000) / M_PER_MI;
      }
    }

    const durationSec = num(row[iMoving]) || num(row[iElapsed]) || null;
    const name = (iName !== -1 && row[iName]) ? row[iName] : `${typeRaw} — imported`;
    const avgHr = iHr !== -1 ? num(row[iHr]) : null;

    const sess = newSession({
      id: uid('s'),
      date,
      type,
      title: name,
      source: 'strava',
      notes: iDesc !== -1 ? (row[iDesc] || '') : '',
      durationMin: durationSec ? Math.round(durationSec / 60) : null,
      completedAt: new Date().toISOString(),
      startedAt: null,
      rpe: estimateRPE({ name, type: typeRaw, avgHr }),
      rpeEstimated: true,
    });

    if (type === 'run' && distanceMi) {
      sess.run = {
        kind: guessRunKind(name, typeRaw),
        distanceMi: +distanceMi.toFixed(2),
        durationSec: durationSec || null,
        avgHr,
        elevFt: iElev !== -1 ? metersToFeet(num(row[iElev])) : null,
        source: 'strava',
      };
    }
    out.push(sess);
  }

  if (!out.length) throw new Error('No activities found in that file.');
  return out;
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function metersToFeet(m) { return m == null ? null : Math.round(m * 3.28084); }

/**
 * Imported activities carry no perceived effort, and without one the whole
 * training-load metric reads zero. Estimate it from heart rate when the file
 * has it, otherwise from what the activity is called. Flagged as estimated
 * so it is never mistaken for something you actually reported.
 */
/** Classify an imported run from its title so History and charts stay useful. */
function guessRunKind(name = '', type = '') {
  const t = `${name} ${type}`.toLowerCase();
  if (/race|5k|10k|marathon|spartan/.test(t)) return 'race';
  if (/hill|repeat/.test(t)) return 'hills';
  if (/interval|track|speed|fartlek/.test(t)) return 'intervals';
  if (/tempo|threshold/.test(t)) return 'tempo';
  if (/trail/.test(t)) return 'trail';
  if (/long/.test(t)) return 'long';
  return 'easy';
}

function estimateRPE({ name = '', type = '', avgHr = null, kind = '' }) {
  if (Number.isFinite(avgHr) && avgHr > 80) {
    // Rough map off a ~185 bpm max: 130 -> 4, 150 -> 6, 170 -> 8.
    return Math.max(2, Math.min(10, Math.round((avgHr - 90) / 10)));
  }
  const text = `${name} ${type} ${kind}`.toLowerCase();
  if (/race|interval|repeat|tempo|threshold|hill|speed|track|fartlek/.test(text)) return 8;
  if (/long/.test(text)) return 6;
  if (/recovery|shakeout|easy|walk/.test(text)) return 3;
  if (/weight|strength|lift|crossfit|hiit/.test(text)) return 6;
  return 5;
}

/* ---------- GPX ---------- */

function haversineM(a, b) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function parseGPX(text, filename = '') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That GPX file could not be read.');

  const pts = [...doc.getElementsByTagName('trkpt')].map(p => ({
    lat: parseFloat(p.getAttribute('lat')),
    lon: parseFloat(p.getAttribute('lon')),
    ele: parseFloat(p.getElementsByTagName('ele')[0]?.textContent ?? 'NaN'),
    time: p.getElementsByTagName('time')[0]?.textContent || null,
  })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (!pts.length) throw new Error('No GPS track points found in that file.');

  let meters = 0, gainM = 0;
  for (let i = 1; i < pts.length; i++) {
    meters += haversineM(pts[i - 1], pts[i]);
    const d = pts[i].ele - pts[i - 1].ele;
    if (Number.isFinite(d) && d > 0) gainM += d;
  }

  const times = pts.map(p => p.time).filter(Boolean);
  const start = times.length ? new Date(times[0]) : null;
  const end = times.length ? new Date(times[times.length - 1]) : null;
  const durationSec = (start && end) ? Math.round((end - start) / 1000) : null;

  const name = doc.getElementsByTagName('name')[0]?.textContent
    || filename.replace(/\.gpx$/i, '')
    || 'Imported run';

  const sess = newSession({
    date: start ? isoDate(start) : isoDate(new Date()),
    type: 'run',
    title: name,
    source: 'gpx',
    durationMin: durationSec ? Math.round(durationSec / 60) : null,
    completedAt: new Date().toISOString(),
    startedAt: null,
    rpe: estimateRPE({ name }),
    rpeEstimated: true,
    run: {
      kind: guessRunKind(name),
      distanceMi: +(meters / M_PER_MI).toFixed(2),
      durationSec,
      avgHr: null,
      elevFt: metersToFeet(gainM),
      source: 'gpx',
    },
  });
  return [sess];
}

/* ---------- TCX ---------- */

export function parseTCX(text, filename = '') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That TCX file could not be read.');

  const activities = [...doc.getElementsByTagName('Activity')];
  if (!activities.length) throw new Error('No activities found in that TCX file.');

  return activities.map(act => {
    const sport = act.getAttribute('Sport') || 'Running';
    const laps = [...act.getElementsByTagName('Lap')];
    let meters = 0, sec = 0, hrSum = 0, hrCount = 0;

    for (const lap of laps) {
      meters += parseFloat(lap.getElementsByTagName('DistanceMeters')[0]?.textContent || '0') || 0;
      sec += parseFloat(lap.getElementsByTagName('TotalTimeSeconds')[0]?.textContent || '0') || 0;
      const hr = parseFloat(lap.getElementsByTagName('AverageHeartRateBpm')[0]
        ?.getElementsByTagName('Value')[0]?.textContent || 'NaN');
      if (Number.isFinite(hr)) { hrSum += hr; hrCount++; }
    }

    const idStr = act.getElementsByTagName('Id')[0]?.textContent;
    const start = idStr ? new Date(idStr) : new Date();

    const avgHr = hrCount ? Math.round(hrSum / hrCount) : null;
    return newSession({
      date: isoDate(start),
      type: mapActivityType(sport),
      title: `${sport} — imported`,
      source: 'tcx',
      durationMin: sec ? Math.round(sec / 60) : null,
      completedAt: new Date().toISOString(),
      startedAt: null,
      rpe: estimateRPE({ name: sport, type: sport, avgHr }),
      rpeEstimated: true,
      run: meters > 0 ? {
        kind: guessRunKind(sport),
        distanceMi: +(meters / M_PER_MI).toFixed(2),
        durationSec: Math.round(sec),
        avgHr,
        elevFt: null,
        source: 'tcx',
      } : null,
    });
  });
}

/* ---------- Apple Health export.xml ---------- */

/**
 * Apple Health exports are enormous (often 100+ MB) and DOM-parsing one
 * will hang a phone. We scan for <Workout> elements with a regex instead,
 * which keeps memory flat and is plenty for summary data.
 */
export function parseAppleHealth(text) {
  const out = [];
  const re = /<Workout\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const attrs = {};
    for (const a of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1]] = a[2];

    const typeRaw = (attrs.workoutActivityType || '').replace('HKWorkoutActivityType', '');
    const start = attrs.startDate ? new Date(attrs.startDate.replace(' ', 'T')) : null;
    if (!start || isNaN(start)) continue;

    const durMin = parseFloat(attrs.duration || '0') || null;
    const distVal = parseFloat(attrs.totalDistance || '0') || 0;
    const distUnit = attrs.totalDistanceUnit || 'mi';
    const distanceMi = distUnit === 'km' ? distVal * 0.621371 : distVal;

    const type = mapActivityType(typeRaw);
    out.push(newSession({
      date: isoDate(start),
      type,
      title: `${typeRaw || 'Workout'} — Apple Health`,
      source: 'applehealth',
      durationMin: durMin ? Math.round(durMin) : null,
      completedAt: new Date().toISOString(),
      startedAt: null,
      rpe: estimateRPE({ name: typeRaw, type: typeRaw }),
      rpeEstimated: true,
      run: (type === 'run' && distanceMi > 0) ? {
        kind: guessRunKind(typeRaw),
        distanceMi: +distanceMi.toFixed(2),
        durationSec: durMin ? Math.round(durMin * 60) : null,
        avgHr: null,
        elevFt: null,
        source: 'applehealth',
      } : null,
    }));
  }
  if (!out.length) throw new Error('No workouts found. Make sure this is export.xml from Apple Health.');
  return out;
}

/* ---------- dispatcher ---------- */

/** Route a dropped/selected file to the right parser by extension + sniffing. */
export async function importFile(file, opts = {}) {
  const text = await file.text();
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) return parseStravaCSV(text, opts);
  if (name.endsWith('.gpx')) return parseGPX(text, file.name);
  if (name.endsWith('.tcx')) return parseTCX(text, file.name);
  if (name.endsWith('.xml')) {
    if (text.includes('<Workout')) return parseAppleHealth(text);
    if (text.includes('<trkpt')) return parseGPX(text, file.name);
    if (text.includes('<Activity')) return parseTCX(text, file.name);
  }
  if (name.endsWith('.fit')) {
    throw new Error('.FIT files are binary and not supported yet — export as GPX or TCX instead, or use Strava\'s activities.csv.');
  }
  throw new Error(`Unrecognized file type: ${file.name}`);
}

/** Skip anything we already have — same date, type, and distance. */
export function dedupe(incoming, existing) {
  const key = s => `${s.date}|${s.type}|${s.run ? s.run.distanceMi.toFixed(2) : (s.durationMin || 0)}`;
  const have = new Set(existing.map(key));
  const fresh = [];
  let skipped = 0;
  for (const s of incoming) {
    if (have.has(key(s))) { skipped++; continue; }
    have.add(key(s));
    fresh.push(s);
  }
  return { fresh, skipped };
}
