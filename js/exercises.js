/* ============================================================
   exercises.js — the movement library.

   Design note: with a 10 lb and a 36 lb kettlebell there is no
   "add 5 lb next week". So every strength movement carries a LADDER of
   variations ordered easiest -> hardest. Progression = climbing the
   ladder (leverage, unilateral, tempo, range of motion), with reps and
   density as the fine adjustment between rungs. That is how you keep
   getting stronger on fixed loads.
   ============================================================ */

export const EQUIPMENT = {
  bw:   { id: 'bw',   label: 'Bodyweight only' },
  kb10: { id: 'kb10', label: '10 lb kettlebell', lb: 10 },
  kb36: { id: 'kb36', label: '36 lb kettlebell', lb: 36 },
  bar:  { id: 'bar',  label: 'Pull-up bar / rig' },
  ruck: { id: 'ruck', label: 'Backpack / ruck' },
  band: { id: 'band', label: 'Resistance bands' },
  dbs:  { id: 'dbs',  label: 'Dumbbells' },
  gym:  { id: 'gym',  label: 'Full gym (barbell, rack)' },
};

export const PATTERNS = {
  push: 'Push', pull: 'Pull', squat: 'Squat', hinge: 'Hinge',
  core: 'Core', grip: 'Grip', carry: 'Carry', cond: 'Conditioning', mobility: 'Mobility',
};

/** unit: how a set is measured — reps, time (seconds), or distance (meters). */
const EX = [
  /* ---------------- PUSH ---------------- */
  {
    id: 'pushup', name: 'Push-up', pattern: 'push', unit: 'reps', equip: ['bw'], ocr: true,
    cues: 'Ribs down, glutes tight, elbows ~45°. Full lockout each rep.',
    ladder: [
      'Incline Push-up (hands on bench/counter)',
      'Knee Push-up',
      'Push-up',
      'Tempo Push-up (3s down, 1s pause)',
      'Feet-Elevated Push-up',
      'Archer Push-up',
      'One-Arm Eccentric Push-up (5s lower)',
    ],
  },
  {
    id: 'kb_press', name: 'KB Strict Press', pattern: 'push', unit: 'reps', equip: ['kb10', 'kb36'],
    cues: 'Brace hard, press the bell slightly back, finish with bicep by ear.',
    ladder: ['Two-Hand Press (10 lb)', 'Single-Arm Press (10 lb)', 'Single-Arm Press (36 lb)', 'Bottoms-Up Press (10 lb)', 'Half-Kneeling Press (36 lb)', 'Push Press → Slow Negative (36 lb)'],
  },
  {
    id: 'pike_pushup', name: 'Pike Push-up', pattern: 'push', unit: 'reps', equip: ['bw'],
    cues: 'Hips high, head travels between hands. Builds toward handstand pressing.',
    ladder: ['Pike Push-up', 'Feet-Elevated Pike Push-up', 'Deficit Pike Push-up', 'Wall Handstand Push-up (partial)', 'Wall Handstand Push-up'],
  },
  {
    id: 'dip', name: 'Bench / Chair Dip', pattern: 'push', unit: 'reps', equip: ['bw'],
    cues: 'Shoulders down and back, elbows straight back, stop at 90°.',
    ladder: ['Bent-Knee Bench Dip', 'Straight-Leg Bench Dip', 'Feet-Elevated Bench Dip', 'Weighted Bench Dip (36 lb on lap)'],
  },

  /* ---------------- PULL ---------------- */
  {
    id: 'pullup', name: 'Pull-up', pattern: 'pull', unit: 'reps', equip: ['bar'], ocr: true,
    cues: 'Dead hang start, chest to bar, controlled 2s lower. THE OCR movement.',
    ladder: ['Dead Hang', 'Scapular Pull-up', 'Negative Pull-up (5s lower)', 'Band-Assisted Pull-up', 'Pull-up', 'Chest-to-Bar Pull-up', 'Weighted Pull-up (10 lb)', 'Weighted Pull-up (36 lb)'],
  },
  {
    id: 'kb_row', name: 'KB Bent-Over Row', pattern: 'pull', unit: 'reps', equip: ['kb36', 'kb10'], ocr: true,
    cues: 'Flat back, pull to hip, pause 1s at the top. Your main pull without a bar.',
    ladder: ['Two-Hand Row (36 lb)', 'Single-Arm Row (36 lb)', 'Tempo Single-Arm Row (3s lower)', 'Single-Arm Row, 2s pause at top', 'Gorilla Row (alternating, 36 lb)'],
  },
  {
    id: 'inverted_row', name: 'Inverted Row (table / low bar)', pattern: 'pull', unit: 'reps', equip: ['bw'], ocr: true,
    cues: 'Under a sturdy table or low bar. Body rigid, chest to the edge.',
    ladder: ['Feet-Under Inverted Row', 'Feet-Forward Inverted Row', 'Feet-Elevated Inverted Row', 'Tempo Inverted Row (3s lower)', 'Archer Inverted Row'],
  },
  {
    id: 'kb_high_pull', name: 'KB High Pull', pattern: 'pull', unit: 'reps', equip: ['kb36'],
    cues: 'Hip snap first, elbow leads high and wide. Power + grip in one.',
    ladder: ['High Pull (10 lb)', 'High Pull (36 lb)', 'Single-Arm High Pull (36 lb)'],
  },

  /* ---------------- HINGE ---------------- */
  {
    id: 'kb_swing', name: 'KB Swing', pattern: 'hinge', unit: 'reps', equip: ['kb36', 'kb10'], ocr: true,
    cues: 'Hips snap, arms are ropes. Float to chest height. Best single carry-over to hill running.',
    ladder: ['Two-Hand Swing (10 lb)', 'Two-Hand Swing (36 lb)', 'Single-Arm Swing (36 lb)', 'Hand-to-Hand Swing (36 lb)', 'Heavy Density Swings (36 lb, EMOM)'],
  },
  {
    id: 'kb_deadlift', name: 'KB Deadlift', pattern: 'hinge', unit: 'reps', equip: ['kb36'],
    cues: 'Push the floor away, lock the hips, no rounding.',
    ladder: ['Two-Hand KB Deadlift (36 lb)', 'Suitcase Deadlift (36 lb)', 'Single-Leg RDL (10 lb)', 'Single-Leg RDL (36 lb)', 'Deficit Single-Leg RDL (36 lb)'],
  },
  {
    id: 'hip_thrust', name: 'Glute Bridge / Hip Thrust', pattern: 'hinge', unit: 'reps', equip: ['bw', 'kb36'],
    cues: 'Full lockout, 2s squeeze at the top. Posterior chain for climbs.',
    ladder: ['Glute Bridge', 'Single-Leg Glute Bridge', 'Shoulder-Elevated Hip Thrust', 'Weighted Hip Thrust (36 lb)', 'Single-Leg Weighted Hip Thrust (10 lb)'],
  },

  /* ---------------- SQUAT / LEGS ---------------- */
  {
    id: 'squat', name: 'Bodyweight / Goblet Squat', pattern: 'squat', unit: 'reps', equip: ['bw', 'kb36'],
    cues: 'Full depth, knees track toes, chest tall.',
    ladder: ['Bodyweight Squat', 'Tempo Squat (3s down)', 'Goblet Squat (10 lb)', 'Goblet Squat (36 lb)', 'Tempo Goblet Squat (36 lb, 3s down + 2s pause)', 'Cossack Squat'],
  },
  {
    id: 'split_squat', name: 'Split Squat / Lunge', pattern: 'squat', unit: 'reps', equip: ['bw', 'kb36'], ocr: true,
    cues: 'Per leg. Rear knee kisses the floor. Directly trains the Spartan hill climb.',
    ladder: ['Split Squat', 'Reverse Lunge', 'Walking Lunge', 'Bulgarian Split Squat', 'Goblet Bulgarian Split Squat (10 lb)', 'Goblet Bulgarian Split Squat (36 lb)'],
  },
  {
    id: 'step_up', name: 'Step-up', pattern: 'squat', unit: 'reps', equip: ['bw', 'kb36'], ocr: true,
    cues: 'Per leg. Drive through the whole foot, no push off the trailing leg.',
    ladder: ['Low Step-up', 'Knee-Height Step-up', 'Weighted Step-up (10 lb)', 'Weighted Step-up (36 lb)', 'Weighted Step-up, slow eccentric (36 lb)'],
  },
  {
    id: 'calf_raise', name: 'Calf Raise', pattern: 'squat', unit: 'reps', equip: ['bw', 'kb36'],
    cues: 'Full stretch at the bottom. Cheap insurance against Achilles issues when mileage climbs.',
    ladder: ['Two-Leg Calf Raise', 'Single-Leg Calf Raise', 'Deficit Single-Leg Calf Raise', 'Weighted Single-Leg Calf Raise (36 lb)'],
  },

  /* ---------------- GRIP (OCR priority) ---------------- */
  {
    id: 'dead_hang', name: 'Dead Hang', pattern: 'grip', unit: 'time', equip: ['bar'], ocr: true,
    cues: 'The #1 predictor of finishing a Spartan rig. Shoulders active, breathe.',
    ladder: ['Two-Hand Dead Hang', 'Towel-Over-Bar Hang', 'One-Arm Assisted Hang', 'Weighted Hang (10 lb)', 'One-Arm Hang'],
  },
  {
    id: 'kb_hold', name: 'KB Farmer Hold', pattern: 'grip', unit: 'time', equip: ['kb36', 'kb10'], ocr: true,
    cues: 'No bar needed. Stand tall, shoulders packed, crush the handle. Your bar-free grip builder.',
    ladder: ['Two-Bell Hold (10 + 36 lb)', 'Two-Hand Hold (36 lb)', 'Single-Arm Hold (36 lb)', 'Towel-Wrapped Hold (36 lb)', 'Towel-Wrapped Single-Arm Hold (36 lb)'],
  },
  {
    id: 'bottoms_up', name: 'Bottoms-Up KB Hold', pattern: 'grip', unit: 'time', equip: ['kb10', 'kb36'], ocr: true,
    cues: 'Bell inverted, handle crushed. Brutal grip + shoulder stability with light weight.',
    ladder: ['Bottoms-Up Rack Hold (10 lb)', 'Bottoms-Up Waiter Hold (10 lb)', 'Bottoms-Up Rack Hold (36 lb)', 'Bottoms-Up Walk (10 lb)', 'Bottoms-Up Walk (36 lb)'],
  },
  {
    id: 'plate_pinch', name: 'Pinch Grip Hold', pattern: 'grip', unit: 'time', equip: ['kb10', 'kb36'], ocr: true,
    cues: 'Pinch the flat of the bell — no handle. Trains the exact grip a Spartan monkey bar demands.',
    ladder: ['Two-Hand Pinch (10 lb)', 'Single-Hand Pinch (10 lb)', 'Two-Hand Pinch (36 lb)', 'Single-Hand Pinch (36 lb)'],
  },
  {
    id: 'towel_row', name: 'Towel Row / Towel Hang', pattern: 'grip', unit: 'reps', equip: ['bw', 'bar'], ocr: true,
    cues: 'Towel over a bar or table edge. Rope-climb specific grip.',
    ladder: ['Towel Inverted Row', 'Towel Hang (time)', 'Single-Towel Row', 'Towel Pull-up'],
  },

  /* ---------------- CARRY ---------------- */
  {
    id: 'farmer_carry', name: 'Farmer Carry', pattern: 'carry', unit: 'distance', equip: ['kb36', 'kb10'], ocr: true,
    cues: 'Measured in meters. Tall posture, no leaning. Bucket-carry simulator.',
    ladder: ['Two-Bell Carry (10 + 36 lb)', 'Two-Hand Carry (36 lb)', 'Suitcase Carry (36 lb)', 'Uphill Suitcase Carry (36 lb)', 'Towel-Grip Carry (36 lb)'],
  },
  {
    id: 'rack_carry', name: 'Front Rack / Bear Hug Carry', pattern: 'carry', unit: 'distance', equip: ['kb36'], ocr: true,
    cues: 'Bell hugged to chest — the Spartan sandbag position. Breathe against the load.',
    ladder: ['Bear Hug Carry (36 lb)', 'Single-Rack Carry (36 lb)', 'Uphill Bear Hug Carry (36 lb)', 'Overhead Carry (10 lb)'],
  },

  /* ---------------- CORE ---------------- */
  {
    id: 'plank', name: 'Plank', pattern: 'core', unit: 'time', equip: ['bw'],
    cues: 'Squeeze glutes, ribs down. Quality over minutes.',
    ladder: ['Knee Plank', 'Plank', 'Long-Lever Plank', 'Single-Arm Plank', 'Plank with KB Drag (36 lb)'],
  },
  {
    id: 'hollow', name: 'Hollow Body Hold', pattern: 'core', unit: 'time', equip: ['bw'], ocr: true,
    cues: 'Low back glued to the floor. Transfers straight to hanging and rig traverses.',
    ladder: ['Tuck Hollow', 'Single-Leg Hollow', 'Hollow Hold', 'Hollow Rock', 'Weighted Hollow Hold (10 lb)'],
  },
  {
    id: 'leg_raise', name: 'Leg Raise', pattern: 'core', unit: 'reps', equip: ['bw', 'bar'], ocr: true,
    cues: 'No swinging. Hanging version doubles as grip work.',
    ladder: ['Lying Knee Raise', 'Lying Leg Raise', 'Hanging Knee Raise', 'Hanging Leg Raise', 'Toes-to-Bar'],
  },
  {
    id: 'turkish_getup', name: 'Turkish Get-up', pattern: 'core', unit: 'reps', equip: ['kb10', 'kb36'],
    cues: 'Per side. Slow and deliberate — full-body stability and shoulder armor.',
    ladder: ['Half Get-up (10 lb)', 'Full Get-up (10 lb)', 'Half Get-up (36 lb)', 'Full Get-up (36 lb)'],
  },

  /* ---------------- CONDITIONING / OCR ---------------- */
  {
    id: 'burpee', name: 'Burpee', pattern: 'cond', unit: 'reps', equip: ['bw'], ocr: true,
    cues: 'Chest to ground, full stand, jump. The 30-rep Spartan penalty — train it until it is boring.',
    ladder: ['Step-Back Burpee', 'Burpee (no push-up)', 'Burpee', 'Chest-to-Ground Burpee', 'Burpee + Tuck Jump', 'Burpee Broad Jump'],
  },
  {
    id: 'bear_crawl', name: 'Bear Crawl', pattern: 'cond', unit: 'distance', equip: ['bw'], ocr: true,
    cues: 'Meters. Knees an inch off the floor, hips low — barbed-wire crawl prep.',
    ladder: ['Bear Crawl Forward', 'Bear Crawl Fwd/Back', 'Lateral Bear Crawl', 'Low Army Crawl', 'Weighted Bear Crawl (backpack)'],
  },
  {
    id: 'mountain_climber', name: 'Mountain Climber', pattern: 'cond', unit: 'reps', equip: ['bw'],
    cues: 'Hips level, fast feet.',
    ladder: ['Mountain Climber', 'Cross-Body Mountain Climber', 'Sliding Mountain Climber'],
  },
  {
    id: 'jump_squat', name: 'Jump Squat', pattern: 'cond', unit: 'reps', equip: ['bw'],
    cues: 'Land soft, absorb through the hips. Explosive power for walls.',
    ladder: ['Squat to Toes', 'Jump Squat', 'Split Jump', 'Broad Jump', 'Depth Jump'],
  },
  {
    id: 'kb_clean_press', name: 'KB Clean & Press Complex', pattern: 'cond', unit: 'reps', equip: ['kb36'], ocr: true,
    cues: 'Clean + press as one rep. Per side. Grip, lungs, and shoulders at once.',
    ladder: ['Clean & Press (10 lb)', 'Clean & Press (36 lb)', 'Clean, Squat & Press (36 lb)', 'Double-Rep Complex (36 lb)'],
  },
  {
    id: 'wall_climb', name: 'Wall Walk / Inverted Hold', pattern: 'cond', unit: 'reps', equip: ['bw'], ocr: true,
    cues: 'Feet up a wall toward a handstand. Overhead strength for wall traverses.',
    ladder: ['Downward Dog Hold', 'Partial Wall Walk', 'Full Wall Walk', 'Wall Walk + 10s Hold'],
  },

  /* ---------------- MOBILITY ---------------- */
  {
    id: 'hip_flow', name: 'Hip Mobility Flow', pattern: 'mobility', unit: 'time', equip: ['bw'],
    cues: '90/90, couch stretch, deep squat hold. Runners need this more than they think.',
    ladder: ['Hip Flow (5 min)', 'Hip Flow (10 min)'],
  },
  {
    id: 'shoulder_flow', name: 'Shoulder / T-Spine Flow', pattern: 'mobility', unit: 'time', equip: ['bw'],
    cues: 'Wall slides, thread the needle, band pull-aparts. Keeps overhead work healthy.',
    ladder: ['Shoulder Flow (5 min)', 'Shoulder Flow (10 min)'],
  },
  {
    id: 'ankle_calf', name: 'Ankle & Calf Care', pattern: 'mobility', unit: 'time', equip: ['bw'],
    cues: 'Calf raises off a step, ankle circles, banded dorsiflexion.',
    ladder: ['Ankle Care (5 min)'],
  },
];

/* ---------- lookups ---------- */

export const ALL_EXERCISES = EX;
const BY_ID = new Map(EX.map(e => [e.id, e]));

export function getExercise(id) { return BY_ID.get(id) || null; }

/** Only movements the user can actually do with the gear they own. */
export function availableExercises(equipment = ['bw']) {
  const owned = new Set(equipment);
  return EX.filter(e => e.equip.some(q => owned.has(q)));
}

export function byPattern(pattern, equipment = ['bw']) {
  return availableExercises(equipment).filter(e => e.pattern === pattern);
}

export function ocrExercises(equipment = ['bw']) {
  return availableExercises(equipment).filter(e => e.ocr);
}

export function searchExercises(query, equipment = null) {
  const pool = equipment ? availableExercises(equipment) : EX;
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  return pool.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.pattern.toLowerCase().includes(q) ||
    e.ladder.some(l => l.toLowerCase().includes(q))
  );
}

/** Current rung on an exercise's ladder, clamped to a valid index. */
export function levelOf(exercise, levels = {}) {
  const raw = levels[exercise.id];
  const idx = Number.isInteger(raw) ? raw : 0;
  return Math.max(0, Math.min(idx, exercise.ladder.length - 1));
}

export function variationName(exercise, levels = {}) {
  return exercise.ladder[levelOf(exercise, levels)];
}

export function canLevelUp(exercise, levels = {}) {
  return levelOf(exercise, levels) < exercise.ladder.length - 1;
}

/* ---------- starting calibration ---------- */

/**
 * Pick a sensible starting rung for every movement from the user's tested
 * baseline. Without this, someone who has run a half marathon and does 30
 * push-ups gets prescribed knee planks and 10 lb swings on day one — which
 * is the fastest way to make a plan feel worthless.
 *
 * Only fills in movements that have no level yet, so a rung you set by
 * hand is never overwritten.
 */
export function seedLevels(baseline = {}, equipment = ['bw'], existing = {}) {
  const owned = new Set(equipment);
  const heavy = owned.has('kb36');
  const bar = owned.has('bar');

  const pushups = baseline.maxPushups ?? 15;
  const pullups = baseline.maxPullups ?? 0;
  const hang = baseline.maxHangSec ?? 20;
  const burpees = baseline.maxBurpees2min ?? 25;
  const runner = (baseline.longRunMi ?? 0) >= 5;

  // Where a number lands in a set of thresholds -> rung index.
  const band = (value, thresholds) => thresholds.filter(t => value >= t).length;

  const seeds = {
    // ladder: incline, knee, standard, tempo, feet-elevated, archer, one-arm
    pushup: band(pushups, [5, 12, 25, 40, 60, 85]),
    pike_pushup: pushups >= 25 ? 1 : 0,
    dip: pushups >= 25 ? 1 : 0,

    // ladder: hang, scap, negative, band-assisted, pull-up, C2B, wtd, wtd36
    pullup: bar ? band(pullups, [1, 1, 3, 6, 10, 15]) : 0,
    inverted_row: 1,
    kb_row: heavy ? 1 : 0,
    kb_high_pull: heavy ? 1 : 0,
    towel_row: 0,

    kb_swing: heavy ? 1 : 0,
    kb_deadlift: heavy ? 1 : 0,
    hip_thrust: 1,

    squat: heavy ? 3 : 1,
    split_squat: runner ? 2 : 1,
    step_up: runner ? 1 : 0,
    calf_raise: runner ? 1 : 0,

    kb_press: heavy ? (pushups >= 25 ? 2 : 1) : 0,
    turkish_getup: 1,

    // ladder: two-hand hang, towel, one-arm assisted, weighted, one-arm
    dead_hang: bar ? band(hang, [30, 60, 90, 120]) : 0,
    kb_hold: heavy ? 1 : 0,
    bottoms_up: 0,
    plate_pinch: 0,

    farmer_carry: heavy ? 1 : 0,
    rack_carry: 0,

    plank: 1,
    hollow: pushups >= 20 ? 2 : 1,
    leg_raise: 1,

    // ladder: step-back, no-push-up, standard, chest-to-ground, +tuck, broad
    burpee: band(burpees, [15, 25, 40, 55, 70]),
    bear_crawl: 0,
    mountain_climber: 0,
    jump_squat: runner ? 1 : 0,
    kb_clean_press: heavy ? 1 : 0,
    wall_climb: pushups >= 25 ? 1 : 0,
  };

  const out = { ...existing };
  for (const ex of EX) {
    if (Number.isInteger(out[ex.id])) continue;         // respect manual choices
    const want = seeds[ex.id] ?? 0;
    out[ex.id] = Math.max(0, Math.min(want, ex.ladder.length - 1));
  }
  return out;
}

/**
 * Highest-leverage gear gap for this user's goals.
 * Called out in the UI because with no bar, hanging — the single best
 * predictor of rig success — simply cannot be trained directly.
 */
export function equipmentGap(equipment = []) {
  const owned = new Set(equipment);
  if (!owned.has('bar')) {
    return {
      item: 'Pull-up bar',
      why: 'Hanging and pull-ups are the strongest predictors of finishing a Spartan rig, and there is no true substitute. A doorway bar (~$25) or any park/playground bar unlocks 6 more movements.',
      workaround: 'Until then: KB farmer holds, towel-wrapped holds, pinch grip, and inverted rows under a sturdy table cover most of it.',
    };
  }
  return null;
}
