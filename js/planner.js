/* ============================================================
   planner.js — builds a training block, not just a calendar.

   The thing mainstream apps get wrong: they treat running and lifting as
   separate programs. Here one engine schedules both, so hard runs and
   hard lifts never collide, and the weekly load ramps as a single number.

   Structure:
     - 3-weeks-up / 1-week-deload waves
     - phase derived from weeks remaining to the race (or "maintain" with
       no race on the calendar)
     - long run progressed ~10%/week off your actual baseline
     - grip + burpee work seeded into every week (your OCR priorities)
   ============================================================ */

import { uid, isoDate, addDays, startOfWeek, daysBetween, today } from './store.js';
import { getExercise, availableExercises, variationName, levelOf } from './exercises.js';

export const PHASES = {
  base:     { id: 'base',     label: 'Base',        note: 'Aerobic volume + movement quality. Build the engine and climb the strength ladders.' },
  build:    { id: 'build',    label: 'Build',       note: 'Intensity arrives: hills, intervals, and OCR-specific complexes.' },
  peak:     { id: 'peak',     label: 'Peak',        note: 'Race-specific. Heavy carries, burpee ladders, terrain running.' },
  taper:    { id: 'taper',    label: 'Taper',       note: 'Volume down sharply, intensity touches kept. Arrive fresh.' },
  maintain: { id: 'maintain', label: 'Maintain',    note: 'Year-round fitness. Rotating base and build waves, no race pressure.' },
  deload:   { id: 'deload',   label: 'Deload',      note: 'Planned easy week. This is where adaptation actually happens.' },
};

export const SESSION_TYPES = {
  run:          { id: 'run',          label: 'Run',           color: 'var(--c-run)' },
  strength:     { id: 'strength',     label: 'Strength',      color: 'var(--c-strength)' },
  calisthenics: { id: 'calisthenics', label: 'Calisthenics',  color: 'var(--c-grip)' },
  conditioning: { id: 'conditioning', label: 'Conditioning',  color: 'var(--c-cond)' },
  mobility:     { id: 'mobility',     label: 'Mobility',      color: 'var(--c-mobility)' },
  rest:         { id: 'rest',         label: 'Rest',          color: 'var(--c-rest)' },
  other:        { id: 'other',        label: 'Other',         color: 'var(--c-rest)' },
};

export function typeColor(type) {
  return (SESSION_TYPES[type] || SESSION_TYPES.other).color;
}

/* ---------- wave / phase logic ---------- */

/** 4-week waves: weeks 1-3 build, week 4 deloads. */
export function isDeloadWeek(weekIndex, totalWeeks) {
  // Never deload the final week of a raceless block — end on a strong note.
  if (weekIndex === totalWeeks - 1 && totalWeeks < 4) return false;
  return (weekIndex + 1) % 4 === 0;
}

/** Volume multiplier across a wave. Deloads pull back to ~65%. */
export function volumeMultiplier(weekIndex, totalWeeks) {
  if (isDeloadWeek(weekIndex, totalWeeks)) return 0.65;
  const posInWave = weekIndex % 4;      // 0,1,2
  return [1.0, 1.08, 1.16][posInWave] ?? 1.0;
}

/**
 * Phase for a given week. With a race date, phases are counted back from
 * race day so the taper always lands correctly regardless of block length.
 */
export function phaseFor(weekIndex, totalWeeks, weeksToRace = null) {
  if (isDeloadWeek(weekIndex, totalWeeks)) return PHASES.deload;
  if (weeksToRace == null) {
    // No race: alternate 4-week base and build waves to stay well-rounded.
    const wave = Math.floor(weekIndex / 4);
    return wave % 2 === 0 ? PHASES.base : PHASES.build;
  }
  const out = weeksToRace - weekIndex;   // weeks remaining at the start of this week
  if (out <= 1) return PHASES.taper;
  if (out <= 4) return PHASES.peak;
  if (out <= 10) return PHASES.build;
  return PHASES.base;
}

/* ---------- weekly day templates ---------- */

/**
 * Which day-of-week gets what. Index 0 = Monday.
 * Hard days are separated so a quality run never sits next to a heavy lift.
 */
const TEMPLATES = {
  3: [
    { dow: 0, slot: 'strengthA' },
    { dow: 2, slot: 'runQuality' },
    { dow: 5, slot: 'runLong', finisher: true },
  ],
  4: [
    { dow: 0, slot: 'strengthA' },
    { dow: 1, slot: 'runEasy' },
    { dow: 3, slot: 'strengthB' },
    { dow: 5, slot: 'runLong', finisher: true },
  ],
  5: [
    { dow: 0, slot: 'strengthA' },
    { dow: 1, slot: 'runQuality' },
    { dow: 2, slot: 'mobility' },
    { dow: 3, slot: 'strengthB' },
    { dow: 5, slot: 'runLong', finisher: true },
  ],
  6: [
    { dow: 0, slot: 'strengthA' },
    { dow: 1, slot: 'runQuality' },
    { dow: 2, slot: 'calisthenics' },
    { dow: 3, slot: 'strengthB' },
    { dow: 4, slot: 'runEasy' },
    { dow: 5, slot: 'runLong', finisher: true },
  ],
};

/* ---------- rep / set schemes ---------- */

function scheme(phaseId) {
  switch (phaseId) {
    case 'base':   return { sets: 3, reps: [8, 12],  holdSec: 30, restSec: 75 };
    case 'build':  return { sets: 4, reps: [6, 10],  holdSec: 35, restSec: 90 };
    case 'peak':   return { sets: 4, reps: [5, 8],   holdSec: 45, restSec: 105 };
    case 'taper':  return { sets: 2, reps: [5, 6],   holdSec: 25, restSec: 90 };
    case 'deload': return { sets: 2, reps: [8, 10],  holdSec: 20, restSec: 60 };
    default:       return { sets: 3, reps: [8, 12],  holdSec: 30, restSec: 75 };
  }
}

/**
 * Rep target for a movement. For bodyweight staples we scale off the
 * user's tested max so the prescription is actually calibrated to them
 * rather than a generic "3x10".
 */
function repTarget(ex, sch, baseline, vol) {
  const mid = Math.round((sch.reps[0] + sch.reps[1]) / 2);
  const scaled = (max, pct) => Math.max(3, Math.round(max * pct * vol));

  if (ex.id === 'pushup' && baseline.maxPushups) return scaled(baseline.maxPushups, 0.55);
  if (ex.id === 'pullup' && baseline.maxPullups) return Math.max(2, Math.round(baseline.maxPullups * 0.6 * vol));
  if (ex.id === 'burpee') return Math.max(6, Math.round((baseline.maxBurpees2min || 30) * 0.35 * vol));
  if (ex.id === 'kb_swing') return Math.round(mid * 1.8 * vol);   // swings live at higher reps
  return Math.max(3, Math.round(mid * vol));
}

function holdTarget(ex, sch, baseline, vol) {
  if (ex.id === 'dead_hang' && baseline.maxHangSec) {
    return Math.max(10, Math.round(baseline.maxHangSec * 0.6 * vol));
  }
  return Math.max(10, Math.round(sch.holdSec * vol));
}

/* ---------- exercise selection ---------- */

/**
 * Deterministic rotation: same week always produces the same session
 * (so you can re-open the plan and see what you saw yesterday), but
 * consecutive weeks rotate variety in.
 */
function pick(pool, weekIndex, offset = 0) {
  if (!pool.length) return null;
  return pool[(weekIndex + offset) % pool.length];
}

function poolFor(pattern, equipment) {
  return availableExercises(equipment).filter(e => e.pattern === pattern);
}

function item(ex, { sets, reps, timeSec, distanceM, restSec, note }, levels) {
  if (!ex) return null;
  return {
    exerciseId: ex.id,
    name: ex.name,
    variation: variationName(ex, levels),
    unit: ex.unit,
    sets,
    reps: reps ?? null,
    timeSec: timeSec ?? null,
    distanceM: distanceM ?? null,
    restSec: restSec ?? 75,
    note: note ?? ex.cues,
  };
}

/**
 * Strength day. "A" leans push/hinge, "B" leans pull/squat — but both
 * always finish with grip work, because that is the OCR bottleneck.
 */
function buildStrength(variant, ctx) {
  const { phase, weekIndex, equipment, levels, baseline, vol } = ctx;
  const sch = scheme(phase.id);
  const isA = variant === 'A';

  const primary = isA
    ? [poolFor('hinge', equipment), poolFor('push', equipment)]
    : [poolFor('squat', equipment), poolFor('pull', equipment)];
  const secondary = isA
    ? [poolFor('squat', equipment), poolFor('pull', equipment)]
    : [poolFor('push', equipment), poolFor('hinge', equipment)];

  const main = [];
  primary.forEach((pool, i) => {
    const ex = pick(pool, weekIndex, i);
    if (!ex) return;
    main.push(item(ex, {
      sets: sch.sets,
      reps: ex.unit === 'reps' ? repTarget(ex, sch, baseline, vol) : null,
      timeSec: ex.unit === 'time' ? holdTarget(ex, sch, baseline, vol) : null,
      distanceM: ex.unit === 'distance' ? Math.round(30 * vol) : null,
      restSec: sch.restSec,
    }, levels));
  });

  const accessory = [];
  secondary.forEach((pool, i) => {
    const ex = pick(pool, weekIndex, i + 2);
    if (!ex) return;
    accessory.push(item(ex, {
      sets: Math.max(2, sch.sets - 1),
      reps: ex.unit === 'reps' ? repTarget(ex, sch, baseline, vol) : null,
      timeSec: ex.unit === 'time' ? holdTarget(ex, sch, baseline, vol) : null,
      distanceM: ex.unit === 'distance' ? Math.round(25 * vol) : null,
      restSec: 60,
    }, levels));
  });

  const coreEx = pick(poolFor('core', equipment), weekIndex, isA ? 0 : 1);
  if (coreEx) {
    accessory.push(item(coreEx, {
      sets: 3,
      reps: coreEx.unit === 'reps' ? repTarget(coreEx, sch, baseline, vol) : null,
      timeSec: coreEx.unit === 'time' ? holdTarget(coreEx, sch, baseline, vol) : null,
      restSec: 45,
    }, levels));
  }

  // Grip finisher — every single strength day.
  const gripPool = poolFor('grip', equipment);
  const gripEx = pick(gripPool, weekIndex, isA ? 0 : 2);
  const carryEx = pick(poolFor('carry', equipment), weekIndex, isA ? 1 : 0);
  const finisher = [];
  if (gripEx) {
    finisher.push(item(gripEx, {
      sets: 4,
      reps: gripEx.unit === 'reps' ? repTarget(gripEx, sch, baseline, vol) : null,
      timeSec: gripEx.unit === 'time' ? holdTarget(gripEx, sch, baseline, vol) : null,
      restSec: 60,
      note: 'Grip is the #1 rig failure point. Stop 2-3 seconds before total failure.',
    }, levels));
  }
  if (carryEx && phase.id !== 'deload' && phase.id !== 'taper') {
    finisher.push(item(carryEx, {
      sets: 3,
      distanceM: Math.round(40 * vol),
      restSec: 75,
    }, levels));
  }

  const blocks = [
    { label: 'Main', items: main.filter(Boolean) },
    { label: 'Accessory', items: accessory.filter(Boolean) },
    { label: 'Grip & Carry Finisher', items: finisher.filter(Boolean) },
  ].filter(b => b.items.length);

  const estMin = 12 + blocks.reduce((t, b) =>
    t + b.items.reduce((s, i) => s + i.sets * ((i.restSec + 40) / 60), 0), 0);

  return {
    type: 'strength',
    title: `Strength ${variant} — ${phase.label}`,
    summary: isA ? 'Hinge + push focus, grip finisher' : 'Squat + pull focus, grip finisher',
    blocks,
    estMin: Math.round(estMin),
  };
}

/** Conditioning finisher attached to the long run in build/peak weeks. */
function buildFinisher(ctx) {
  const { phase, weekIndex, equipment, levels, baseline, vol } = ctx;
  if (phase.id === 'deload' || phase.id === 'taper') return null;

  const burpee = getExercise('burpee');
  const reps = repTarget(burpee, scheme(phase.id), baseline, vol);
  const rounds = phase.id === 'peak' ? 5 : 4;

  const condPool = poolFor('cond', equipment).filter(e => e.id !== 'burpee');
  const partner = pick(condPool, weekIndex, 1);

  const items = [
    item(burpee, { sets: rounds, reps, restSec: 60, note: 'Race pace: steady, not sprinting. Chest to ground every rep.' }, levels),
  ];
  if (partner) {
    items.push(item(partner, {
      sets: rounds,
      reps: partner.unit === 'reps' ? Math.round(12 * vol) : null,
      distanceM: partner.unit === 'distance' ? Math.round(20 * vol) : null,
      restSec: 60,
    }, levels));
  }

  return {
    label: `OCR Finisher — ${rounds} rounds`,
    items: items.filter(Boolean),
    note: 'Run first, then this. Training burpees on tired legs is the whole point.',
  };
}

/* ---------- run prescriptions ---------- */

function buildRun(kind, ctx) {
  const { phase, weekIndex, baseline, vol, longRunMi } = ctx;
  const easyPace = baseline.easyPace || '10:30';

  if (kind === 'runLong') {
    const mi = Math.max(2, +(longRunMi).toFixed(1));
    const finisher = buildFinisher(ctx);
    const terrain = (phase.id === 'peak' || phase.id === 'build')
      ? 'Trail or hilly route if you can — Spartan courses are never flat.'
      : 'Flat and conversational is fine.';
    return {
      type: 'run',
      title: `Long Run — ${mi} mi`,
      summary: `${mi} mi easy${finisher ? ' + OCR finisher' : ''}`,
      run: {
        kind: 'long',
        distanceMi: mi,
        targetPace: easyPace,
        rpe: 4,
        note: `Conversational the whole way (RPE 3-4). ${terrain}`,
      },
      blocks: finisher ? [finisher] : [],
      estMin: Math.round(mi * paceToMin(easyPace) + (finisher ? 12 : 0)),
    };
  }

  if (kind === 'runEasy') {
    const min = Math.round(Math.max(25, Math.min(55, longRunMi * 4.5)) * (phase.id === 'deload' ? 0.7 : 1));
    return {
      type: 'run',
      title: `Easy Run — ${min} min`,
      summary: `${min} min recovery pace`,
      run: {
        kind: 'easy',
        durationMin: min,
        targetPace: easyPace,
        rpe: 3,
        note: 'Nose-breathing pace. If you cannot hold a conversation, slow down. This run is not supposed to be hard.',
      },
      blocks: [],
      estMin: min,
    };
  }

  // Quality run — hills in build/peak (OCR-specific), intervals otherwise.
  const useHills = phase.id === 'build' || phase.id === 'peak';
  if (phase.id === 'deload' || phase.id === 'taper') {
    return {
      type: 'run',
      title: 'Easy Run + Strides',
      summary: '25-30 min easy + 4 x 20s strides',
      run: {
        kind: 'easy',
        durationMin: 28,
        targetPace: easyPace,
        rpe: 3,
        note: 'Easy running, then 4 x 20s relaxed strides with full recovery. Keeps the legs sharp without adding fatigue.',
      },
      blocks: [],
      estMin: 32,
    };
  }

  if (useHills) {
    const reps = Math.max(5, Math.round(8 * vol));
    return {
      type: 'run',
      title: `Hill Repeats — ${reps} x 45s`,
      summary: `${reps} x 45s uphill hard, jog down`,
      run: {
        kind: 'hills',
        durationMin: 15 + reps * 3,
        rpe: 8,
        intervals: `${reps} x 45s uphill @ RPE 8, jog down to recover`,
        note: '10 min easy warm-up. Drive the knees, short powerful steps, stay tall. Cool down 10 min. This is the most Spartan-specific run you will do.',
      },
      blocks: [],
      estMin: 20 + reps * 3,
    };
  }

  const reps = Math.max(4, Math.round(6 * vol));
  return {
    type: 'run',
    title: `Intervals — ${reps} x 400m`,
    summary: `${reps} x 400m @ 5k effort`,
    run: {
      kind: 'intervals',
      durationMin: 15 + reps * 4,
      rpe: 8,
      intervals: `${reps} x 400m @ 5k effort, 90s jog recovery`,
      note: '10 min easy warm-up first. Even splits — the last rep should look like the first. 10 min cool-down.',
    },
    blocks: [],
    estMin: 20 + reps * 4,
  };
}

function paceToMin(pace) {
  const [m, s] = String(pace).split(':').map(Number);
  return (m || 10) + (s || 0) / 60;
}

/* ---------- calisthenics & mobility days ---------- */

function buildCalisthenics(ctx) {
  const { phase, weekIndex, equipment, levels, baseline, vol } = ctx;
  const sch = scheme(phase.id);
  const picks = ['pull', 'push', 'core', 'grip']
    .map((p, i) => pick(poolFor(p, equipment).filter(e => e.equip.includes('bw') || e.equip.includes('bar')), weekIndex, i))
    .filter(Boolean);

  const items = picks.map(ex => item(ex, {
    sets: 3,
    reps: ex.unit === 'reps' ? repTarget(ex, sch, baseline, vol) : null,
    timeSec: ex.unit === 'time' ? holdTarget(ex, sch, baseline, vol) : null,
    distanceM: ex.unit === 'distance' ? 25 : null,
    restSec: 60,
  }, levels));

  return {
    type: 'calisthenics',
    title: 'Calisthenics Circuit',
    summary: 'Bodyweight circuit, 3 rounds',
    blocks: [{ label: 'Circuit — 3 rounds, minimal rest between movements', items }],
    estMin: 30,
  };
}

function buildMobility(ctx) {
  const { equipment, levels, weekIndex } = ctx;
  const pool = poolFor('mobility', equipment);
  const items = pool.map(ex => item(ex, { sets: 1, timeSec: 300, restSec: 0 }, levels));
  return {
    type: 'mobility',
    title: 'Mobility & Recovery',
    summary: '15-20 min flow',
    blocks: [{ label: 'Flow', items }],
    estMin: 18,
  };
}

/* ---------- the main entry point ---------- */

/**
 * Generate a full training block.
 * @returns {{block:object, planned:object[]}}
 */
export function generateBlock({
  name,
  startDate = today(),
  weeks = 8,
  daysPerWeek = 4,
  goal = 'spartan',
  raceId = null,
  raceDate = null,
  baseline,
  equipment = ['bw', 'kb10', 'kb36'],
  levels = {},
}) {
  const blockId = uid('b');
  const firstMonday = startOfWeek(startDate);

  // If a race is set, size the block to land exactly on race week.
  let totalWeeks = weeks;
  let weeksToRace = null;
  if (raceDate) {
    const w = Math.ceil((daysBetween(firstMonday, raceDate) + 1) / 7);
    if (w > 0) { totalWeeks = Math.max(1, w); weeksToRace = w; }
  }

  const template = TEMPLATES[daysPerWeek] || TEMPLATES[4];
  const planned = [];

  // Long run progresses ~10%/week off the current baseline, with deload
  // pullbacks, capped so it never outruns what the body has adapted to.
  let longRunMi = Math.max(2, baseline.longRunMi || 5);
  const longRunCap = goal === 'spartan'
    ? Math.max(8, (baseline.longRunMi || 5) * 2.2)   // OCR rarely needs marathon volume
    : Math.max(13.1, (baseline.longRunMi || 5) * 2.6);

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDays(firstMonday, w * 7);
    const remaining = weeksToRace != null ? weeksToRace - w : null;
    const phase = phaseFor(w, totalWeeks, weeksToRace);
    const vol = volumeMultiplier(w, totalWeeks);
    const deload = isDeloadWeek(w, totalWeeks);

    const thisWeekLong = deload
      ? Math.max(2, longRunMi * 0.7)
      : (phase.id === 'taper' ? Math.max(2, longRunMi * 0.5) : longRunMi);

    const ctx = { phase, weekIndex: w, equipment, levels, baseline, vol, longRunMi: thisWeekLong, goal };

    for (const slot of template) {
      const date = addDays(weekStart, slot.dow);
      let spec;
      switch (slot.slot) {
        case 'strengthA':    spec = buildStrength('A', ctx); break;
        case 'strengthB':    spec = buildStrength('B', ctx); break;
        case 'calisthenics': spec = buildCalisthenics(ctx); break;
        case 'mobility':     spec = buildMobility(ctx); break;
        case 'runLong':
        case 'runEasy':
        case 'runQuality':   spec = buildRun(slot.slot, ctx); break;
        default: continue;
      }

      planned.push({
        id: uid('p'),
        blockId,
        date,
        week: w + 1,
        phase: phase.id,
        type: spec.type,
        title: spec.title,
        prescription: {
          summary: spec.summary,
          blocks: spec.blocks || [],
          run: spec.run || null,
          estMin: spec.estMin,
          phaseNote: phase.note,
          deload,
        },
        status: 'planned',
        sessionId: null,
      });
    }

    // Race day itself gets its own entry.
    if (remaining === 1 && raceDate) {
      planned.push({
        id: uid('p'),
        blockId,
        date: raceDate,
        week: w + 1,
        phase: 'race',
        type: 'other',
        title: '🏁 RACE DAY',
        prescription: {
          summary: 'Go get it.',
          blocks: [],
          run: null,
          estMin: 120,
          phaseNote: 'Everything is already in the bank. Eat what you practiced, start conservative, and save something for the last mile.',
          deload: false,
        },
        status: 'planned',
        sessionId: null,
      });
    }

    if (!deload && phase.id !== 'taper' && longRunMi < longRunCap) {
      longRunMi = Math.min(longRunCap, longRunMi * 1.1);
    }
  }

  const block = {
    id: blockId,
    name: name || defaultBlockName(goal, raceDate),
    startDate: firstMonday,
    weeks: totalWeeks,
    goal,
    raceId,
    raceDate,
    daysPerWeek,
    createdAt: new Date().toISOString(),
  };

  return { block, planned };
}

function defaultBlockName(goal, raceDate) {
  if (raceDate) return `Race Block — ${raceDate}`;
  return goal === 'spartan' ? 'Year-Round OCR Base' : 'Training Block';
}

/* ---------- turning a plan into a loggable session ---------- */

/**
 * Convert a planned session's prescription into pre-filled log entries,
 * so opening a workout means tapping through sets, not typing them out.
 */
/**
 * Which variation to actually show for a prescribed item.
 * Resolved from your CURRENT rung rather than the one frozen in at plan
 * creation, so leveling up in week 2 updates the rest of the block.
 */
export function resolveVariation(item, levels = {}) {
  const ex = getExercise(item.exerciseId);
  return ex ? variationName(ex, levels) : item.variation;
}

export function prescriptionToEntries(planned, levels = {}) {
  const entries = [];
  for (const block of (planned.prescription?.blocks || [])) {
    for (const it of block.items) {
      entries.push({
        id: uid('e'),
        exerciseId: it.exerciseId,
        name: it.name,
        variation: resolveVariation(it, levels),
        unit: it.unit,
        targetNote: describeTarget(it),
        // The prescription is kept separately from the logged sets. Editing
        // set 1 must not erase what you were actually asked to do.
        target: { reps: it.reps ?? null, timeSec: it.timeSec ?? null, distanceM: it.distanceM ?? null },
        sets: Array.from({ length: it.sets }, () => ({
          reps: it.reps ?? null,
          weight: null,
          timeSec: it.timeSec ?? null,
          distanceM: it.distanceM ?? null,
          done: false,
        })),
      });
    }
  }
  return entries;
}

export function describeTarget(it) {
  if (it.unit === 'time') return `${it.sets} x ${it.timeSec}s`;
  if (it.unit === 'distance') return `${it.sets} x ${it.distanceM}m`;
  return `${it.sets} x ${it.reps}`;
}

/**
 * Suggest a ladder promotion when the last session cleared every
 * prescribed set with room to spare. This is how progression happens
 * when you cannot add weight.
 */
export function shouldLevelUp(entry) {
  const done = (entry.sets || []).filter(s => s.done);
  if (done.length < entry.sets.length || done.length < 2) return false;

  // Only prescribed work can earn a promotion — an exercise you added
  // freehand has no target to have beaten.
  const target = entry.target;
  if (!target) return false;

  if (entry.unit === 'reps' && target.reps) {
    return done.every(s => (s.reps || 0) >= target.reps + 2);
  }
  if (entry.unit === 'time' && target.timeSec) {
    return done.every(s => (s.timeSec || 0) >= target.timeSec + 8);
  }
  return false;
}
