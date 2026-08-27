/**
 * The seeded exercise library.
 *
 * Grouped by movement pattern, and within each pattern ordered roughly easiest to hardest,
 * because that ordering *is* the progression ladder for anyone training without a rack full
 * of plates. Two fields carry most of the weight here:
 *
 * - `subs` — what to do instead when your equipment profile rules this out. This is what
 *   lets one plan survive the move from a full gym to a hotel room.
 * - `easier` / `harder` — how to progress when you cannot add load. Bodyweight and
 *   fixed-weight training advance by leverage, range, and stability, not by plates.
 *
 * Slugs are permanent: plan templates reference them, so renaming one orphans data.
 */

import { cardio, ex, mobility, type SeedExercise } from './define';

const LIBRARY: SeedExercise[] = [
  // -------------------------------------------------------------------------
  // Squat
  // -------------------------------------------------------------------------
  ex('air-squat', 'Air Squat', 'squat', ['bodyweight'], {
    harder: ['tempo-air-squat', 'goblet-squat', 'jump-squat'],
    subs: ['goblet-squat'],
  }),
  ex('tempo-air-squat', 'Tempo Air Squat (3-1-3)', 'squat', ['bodyweight'], {
    easier: ['air-squat'],
    harder: ['bulgarian-split-squat', 'pistol-squat'],
    notes: 'Three seconds down, one second pause, three seconds up. Load without weight.',
  }),
  ex('wall-sit', 'Wall Sit', 'squat', ['wall'], { hold: true, harder: ['single-leg-wall-sit'] }),
  ex('single-leg-wall-sit', 'Single-Leg Wall Sit', 'squat', ['wall'], {
    hold: true,
    unilateral: true,
    easier: ['wall-sit'],
  }),
  ex('jump-squat', 'Jump Squat', 'squat', ['bodyweight'], {
    easier: ['air-squat'],
    harder: ['box-jump'],
  }),
  ex('goblet-squat', 'Goblet Squat', 'squat', ['kettlebell'], {
    subs: ['db-goblet-squat', 'air-squat'],
    easier: ['air-squat'],
    harder: ['kb-front-squat', 'front-squat'],
  }),
  ex('db-goblet-squat', 'Dumbbell Goblet Squat', 'squat', ['dumbbell'], {
    subs: ['goblet-squat', 'air-squat'],
  }),
  ex('kb-front-squat', 'Double Kettlebell Front Squat', 'squat', ['kettlebell'], {
    subs: ['front-squat', 'goblet-squat'],
    easier: ['goblet-squat'],
    harder: ['front-squat'],
  }),
  ex('back-squat', 'Back Squat', 'squat', ['barbell', 'rack'], {
    subs: ['front-squat', 'goblet-squat', 'bulgarian-split-squat'],
    harder: ['pause-back-squat'],
  }),
  ex('pause-back-squat', 'Pause Back Squat', 'squat', ['barbell', 'rack'], {
    easier: ['back-squat'],
    subs: ['tempo-air-squat'],
  }),
  ex('front-squat', 'Front Squat', 'squat', ['barbell', 'rack'], {
    subs: ['kb-front-squat', 'goblet-squat'],
  }),
  ex('box-squat', 'Box Squat', 'squat', ['barbell', 'rack', 'box'], { subs: ['back-squat'] }),
  ex('smith-squat', 'Smith Machine Squat', 'squat', ['smithMachine'], { subs: ['back-squat'] }),
  ex('leg-press', 'Leg Press', 'squat', ['legPress'], { subs: ['back-squat', 'goblet-squat'] }),
  ex('leg-extension', 'Leg Extension', 'squat', ['legExtension'], {
    primary: ['quads'],
    secondary: [],
    subs: ['sissy-squat'],
  }),
  ex('sissy-squat', 'Sissy Squat', 'squat', ['bodyweight'], {
    primary: ['quads'],
    subs: ['leg-extension'],
  }),
  ex('split-squat', 'Split Squat', 'squat', ['bodyweight'], {
    unilateral: true,
    harder: ['bulgarian-split-squat', 'pistol-squat'],
  }),
  ex('pistol-squat', 'Pistol Squat', 'squat', ['bodyweight'], {
    unilateral: true,
    easier: ['assisted-pistol-squat', 'bulgarian-split-squat'],
    harder: ['weighted-pistol-squat'],
  }),
  ex('assisted-pistol-squat', 'Assisted Pistol Squat', 'squat', ['bodyweight'], {
    unilateral: true,
    harder: ['pistol-squat'],
    notes: 'Hold a doorframe or counter for balance, or sit back to a box.',
  }),
  ex('weighted-pistol-squat', 'Weighted Pistol Squat', 'squat', ['kettlebell'], {
    unilateral: true,
    easier: ['pistol-squat'],
  }),
  ex('shrimp-squat', 'Shrimp Squat', 'squat', ['bodyweight'], {
    unilateral: true,
    easier: ['bulgarian-split-squat'],
  }),

  // -------------------------------------------------------------------------
  // Hinge
  // -------------------------------------------------------------------------
  ex('glute-bridge', 'Glute Bridge', 'hinge', ['floor'], {
    harder: ['single-leg-glute-bridge', 'hip-thrust'],
  }),
  ex('single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'hinge', ['floor'], {
    unilateral: true,
    easier: ['glute-bridge'],
  }),
  ex('hip-thrust', 'Hip Thrust', 'hinge', ['barbell', 'bench'], {
    subs: ['glute-bridge', 'kb-hip-thrust'],
  }),
  ex('kb-hip-thrust', 'Kettlebell Hip Thrust', 'hinge', ['kettlebell'], {
    subs: ['hip-thrust', 'glute-bridge'],
  }),
  ex('kb-deadlift', 'Kettlebell Deadlift', 'hinge', ['kettlebell'], {
    subs: ['deadlift'],
    harder: ['single-leg-rdl', 'kb-swing'],
  }),
  ex('kb-swing', 'Kettlebell Swing', 'hinge', ['kettlebell'], {
    subs: ['db-swing', 'jump-squat'],
    easier: ['kb-deadlift'],
    harder: ['kb-single-arm-swing', 'kb-snatch'],
    notes: 'Hip snap, not a squat. The single best conditioning tool for one bell.',
  }),
  ex('kb-single-arm-swing', 'Single-Arm Kettlebell Swing', 'hinge', ['kettlebell'], {
    unilateral: true,
    easier: ['kb-swing'],
    harder: ['kb-snatch'],
  }),
  ex('db-swing', 'Dumbbell Swing', 'hinge', ['dumbbell'], { subs: ['kb-swing'] }),
  ex('kb-clean', 'Kettlebell Clean', 'hinge', ['kettlebell'], {
    unilateral: true,
    subs: ['power-clean'],
    harder: ['kb-snatch'],
  }),
  ex('kb-snatch', 'Kettlebell Snatch', 'hinge', ['kettlebell'], {
    unilateral: true,
    easier: ['kb-single-arm-swing', 'kb-clean'],
  }),
  ex('deadlift', 'Conventional Deadlift', 'hinge', ['barbell', 'plates'], {
    subs: ['trap-bar-deadlift', 'kb-deadlift'],
    harder: ['deficit-deadlift'],
  }),
  ex('deficit-deadlift', 'Deficit Deadlift', 'hinge', ['barbell', 'plates'], {
    easier: ['deadlift'],
  }),
  ex('sumo-deadlift', 'Sumo Deadlift', 'hinge', ['barbell', 'plates'], { subs: ['deadlift'] }),
  ex('trap-bar-deadlift', 'Trap Bar Deadlift', 'hinge', ['trapBar'], { subs: ['deadlift'] }),
  ex('romanian-deadlift', 'Romanian Deadlift', 'hinge', ['barbell'], {
    subs: ['db-romanian-deadlift', 'kb-romanian-deadlift'],
    harder: ['single-leg-rdl'],
  }),
  ex('db-romanian-deadlift', 'Dumbbell Romanian Deadlift', 'hinge', ['dumbbell'], {
    subs: ['romanian-deadlift', 'kb-romanian-deadlift'],
  }),
  ex('kb-romanian-deadlift', 'Kettlebell Romanian Deadlift', 'hinge', ['kettlebell'], {
    subs: ['romanian-deadlift'],
    harder: ['single-leg-rdl'],
  }),
  ex('single-leg-rdl', 'Single-Leg Romanian Deadlift', 'hinge', ['kettlebell'], {
    unilateral: true,
    subs: ['bodyweight-single-leg-rdl'],
    easier: ['bodyweight-single-leg-rdl'],
  }),
  ex('bodyweight-single-leg-rdl', 'Bodyweight Single-Leg RDL', 'hinge', ['bodyweight'], {
    unilateral: true,
    harder: ['single-leg-rdl'],
  }),
  ex('good-morning', 'Good Morning', 'hinge', ['barbell'], {
    subs: ['band-good-morning', 'romanian-deadlift'],
  }),
  ex('band-good-morning', 'Banded Good Morning', 'hinge', ['resistanceBand'], {
    subs: ['good-morning'],
  }),
  ex('back-extension', 'Back Extension', 'hinge', ['hyperextension'], {
    subs: ['superman-hold', 'reverse-hyper'],
  }),
  ex('reverse-hyper', 'Reverse Hyperextension', 'hinge', ['bench'], { subs: ['superman-hold'] }),
  ex('superman-hold', 'Superman Hold', 'hinge', ['floor'], { hold: true, subs: ['back-extension'] }),
  ex('nordic-curl', 'Nordic Hamstring Curl', 'hinge', ['floor'], {
    primary: ['hamstrings'],
    easier: ['band-nordic-curl'],
    subs: ['leg-curl'],
  }),
  ex('band-nordic-curl', 'Band-Assisted Nordic Curl', 'hinge', ['resistanceBand'], {
    primary: ['hamstrings'],
    harder: ['nordic-curl'],
  }),
  ex('leg-curl', 'Leg Curl', 'hinge', ['legCurl'], {
    primary: ['hamstrings'],
    subs: ['nordic-curl', 'slider-leg-curl'],
  }),
  ex('slider-leg-curl', 'Slider Hamstring Curl', 'hinge', ['floor'], {
    primary: ['hamstrings'],
    subs: ['leg-curl'],
    notes: 'Heels on towels or furniture sliders. Works on any smooth floor.',
  }),
  ex('ghr', 'Glute-Ham Raise', 'hinge', ['gluteHamRaise'], { subs: ['nordic-curl'] }),

  // -------------------------------------------------------------------------
  // Lunge
  // -------------------------------------------------------------------------
  ex('reverse-lunge', 'Reverse Lunge', 'lunge', ['bodyweight'], {
    unilateral: true,
    harder: ['kb-reverse-lunge', 'bulgarian-split-squat'],
    subs: ['forward-lunge'],
  }),
  ex('forward-lunge', 'Forward Lunge', 'lunge', ['bodyweight'], {
    unilateral: true,
    subs: ['reverse-lunge'],
  }),
  ex('walking-lunge', 'Walking Lunge', 'lunge', ['bodyweight'], {
    unilateral: true,
    harder: ['kb-walking-lunge'],
  }),
  ex('kb-walking-lunge', 'Kettlebell Walking Lunge', 'lunge', ['kettlebell'], {
    unilateral: true,
    easier: ['walking-lunge'],
    subs: ['db-walking-lunge'],
  }),
  ex('db-walking-lunge', 'Dumbbell Walking Lunge', 'lunge', ['dumbbell'], {
    unilateral: true,
    subs: ['kb-walking-lunge', 'walking-lunge'],
  }),
  ex('kb-reverse-lunge', 'Kettlebell Reverse Lunge', 'lunge', ['kettlebell'], {
    unilateral: true,
    easier: ['reverse-lunge'],
    harder: ['kb-front-rack-lunge'],
  }),
  ex('kb-front-rack-lunge', 'Front Rack Reverse Lunge', 'lunge', ['kettlebell'], {
    unilateral: true,
    easier: ['kb-reverse-lunge'],
  }),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'lunge', ['bodyweight', 'bench'], {
    unilateral: true,
    easier: ['split-squat'],
    harder: ['kb-bulgarian-split-squat'],
    notes: 'A chair, couch, or bed step works as the rear-foot elevation.',
  }),
  ex('kb-bulgarian-split-squat', 'Weighted Bulgarian Split Squat', 'lunge', ['kettlebell', 'bench'], {
    unilateral: true,
    easier: ['bulgarian-split-squat'],
  }),
  ex('step-up', 'Step-Up', 'lunge', ['box'], {
    unilateral: true,
    harder: ['kb-step-up', 'box-step-over'],
  }),
  ex('kb-step-up', 'Weighted Step-Up', 'lunge', ['kettlebell', 'box'], {
    unilateral: true,
    easier: ['step-up'],
  }),
  ex('box-step-over', 'Box Step-Over', 'lunge', ['box'], {
    unilateral: true,
    notes: 'Hyrox staple. Tall box, over the top, alternating.',
  }),
  ex('lateral-lunge', 'Lateral Lunge', 'lunge', ['bodyweight'], {
    unilateral: true,
    harder: ['cossack-squat'],
  }),
  ex('cossack-squat', 'Cossack Squat', 'lunge', ['bodyweight'], {
    unilateral: true,
    easier: ['lateral-lunge'],
  }),
  ex('jumping-lunge', 'Jumping Lunge', 'lunge', ['bodyweight'], {
    unilateral: true,
    easier: ['reverse-lunge'],
  }),

  // -------------------------------------------------------------------------
  // Horizontal push
  // -------------------------------------------------------------------------
  ex('incline-push-up', 'Incline Push-Up', 'pushHorizontal', ['bodyweight'], {
    harder: ['knee-push-up', 'push-up'],
    notes: 'Hands on a counter or stair. The regression that actually works.',
  }),
  ex('knee-push-up', 'Knee Push-Up', 'pushHorizontal', ['floor'], { harder: ['push-up'] }),
  ex('push-up', 'Push-Up', 'pushHorizontal', ['floor'], {
    easier: ['knee-push-up', 'incline-push-up'],
    harder: ['tempo-push-up', 'decline-push-up', 'diamond-push-up'],
    subs: ['bench-press', 'db-bench-press'],
  }),
  ex('tempo-push-up', 'Tempo Push-Up (3-1-3)', 'pushHorizontal', ['floor'], {
    easier: ['push-up'],
    harder: ['archer-push-up'],
  }),
  ex('decline-push-up', 'Decline Push-Up', 'pushHorizontal', ['floor', 'box'], {
    easier: ['push-up'],
    harder: ['pike-push-up'],
  }),
  ex('diamond-push-up', 'Diamond Push-Up', 'pushHorizontal', ['floor'], {
    easier: ['push-up'],
    primary: ['triceps', 'chest'],
  }),
  ex('archer-push-up', 'Archer Push-Up', 'pushHorizontal', ['floor'], {
    unilateral: true,
    easier: ['tempo-push-up'],
    harder: ['one-arm-push-up'],
  }),
  ex('pseudo-planche-push-up', 'Pseudo Planche Push-Up', 'pushHorizontal', ['floor'], {
    easier: ['push-up'],
    harder: ['one-arm-push-up'],
  }),
  ex('one-arm-push-up', 'One-Arm Push-Up', 'pushHorizontal', ['floor'], {
    unilateral: true,
    easier: ['archer-push-up'],
  }),
  ex('plyo-push-up', 'Plyometric Push-Up', 'pushHorizontal', ['floor'], { easier: ['push-up'] }),
  ex('bench-press', 'Bench Press', 'pushHorizontal', ['barbell', 'bench', 'rack'], {
    subs: ['db-bench-press', 'push-up'],
    harder: ['pause-bench-press'],
  }),
  ex('pause-bench-press', 'Pause Bench Press', 'pushHorizontal', ['barbell', 'bench', 'rack'], {
    easier: ['bench-press'],
  }),
  ex('incline-bench-press', 'Incline Bench Press', 'pushHorizontal', ['barbell', 'bench', 'rack'], {
    subs: ['db-incline-press', 'decline-push-up'],
  }),
  ex('db-bench-press', 'Dumbbell Bench Press', 'pushHorizontal', ['dumbbell', 'bench'], {
    subs: ['bench-press', 'kb-floor-press', 'push-up'],
  }),
  ex('db-incline-press', 'Dumbbell Incline Press', 'pushHorizontal', ['dumbbell', 'bench'], {
    subs: ['incline-bench-press'],
  }),
  ex('kb-floor-press', 'Kettlebell Floor Press', 'pushHorizontal', ['kettlebell', 'floor'], {
    subs: ['db-bench-press', 'push-up'],
    harder: ['kb-single-arm-floor-press'],
  }),
  ex('kb-single-arm-floor-press', 'Single-Arm Floor Press', 'pushHorizontal', ['kettlebell', 'floor'], {
    unilateral: true,
    easier: ['kb-floor-press'],
  }),
  ex('chest-press-machine', 'Chest Press Machine', 'pushHorizontal', ['chestPress'], {
    subs: ['bench-press', 'push-up'],
  }),
  ex('cable-fly', 'Cable Fly', 'pushHorizontal', ['cableMachine'], {
    primary: ['chest'],
    subs: ['band-chest-fly'],
  }),
  ex('band-chest-fly', 'Band Chest Fly', 'pushHorizontal', ['resistanceBand'], {
    primary: ['chest'],
    subs: ['cable-fly'],
  }),
  ex('band-chest-press', 'Band Chest Press', 'pushHorizontal', ['resistanceBand'], {
    subs: ['bench-press', 'push-up'],
  }),
  ex('dip', 'Dip', 'pushHorizontal', ['dipBars'], {
    easier: ['bench-dip', 'band-assisted-dip'],
    harder: ['weighted-dip', 'ring-dip'],
    subs: ['push-up'],
  }),
  ex('bench-dip', 'Bench Dip', 'pushHorizontal', ['bench'], {
    primary: ['triceps'],
    harder: ['dip'],
  }),
  ex('band-assisted-dip', 'Band-Assisted Dip', 'pushHorizontal', ['dipBars', 'resistanceBand'], {
    harder: ['dip'],
  }),
  ex('weighted-dip', 'Weighted Dip', 'pushHorizontal', ['dipBars', 'weightVest'], {
    easier: ['dip'],
  }),
  ex('ring-dip', 'Ring Dip', 'pushHorizontal', ['rings'], { easier: ['dip'] }),

  // -------------------------------------------------------------------------
  // Vertical push
  // -------------------------------------------------------------------------
  ex('pike-push-up', 'Pike Push-Up', 'pushVertical', ['floor'], {
    harder: ['elevated-pike-push-up'],
    subs: ['overhead-press', 'kb-press'],
  }),
  ex('elevated-pike-push-up', 'Elevated Pike Push-Up', 'pushVertical', ['floor', 'box'], {
    easier: ['pike-push-up'],
    harder: ['wall-handstand-push-up'],
  }),
  ex('wall-handstand-push-up', 'Wall Handstand Push-Up', 'pushVertical', ['wall'], {
    easier: ['elevated-pike-push-up'],
    harder: ['freestanding-handstand-push-up'],
  }),
  ex('freestanding-handstand-push-up', 'Freestanding Handstand Push-Up', 'pushVertical', ['floor'], {
    modality: 'skill',
    easier: ['wall-handstand-push-up'],
  }),
  ex('wall-handstand-hold', 'Wall Handstand Hold', 'pushVertical', ['wall'], {
    modality: 'skill',
    hold: true,
    harder: ['freestanding-handstand-hold'],
  }),
  ex('freestanding-handstand-hold', 'Freestanding Handstand Hold', 'pushVertical', ['floor'], {
    modality: 'skill',
    hold: true,
    easier: ['wall-handstand-hold'],
  }),
  ex('overhead-press', 'Overhead Press', 'pushVertical', ['barbell', 'rack'], {
    subs: ['db-shoulder-press', 'kb-press'],
    harder: ['push-press'],
  }),
  ex('push-press', 'Push Press', 'pushVertical', ['barbell', 'rack'], { easier: ['overhead-press'] }),
  ex('db-shoulder-press', 'Dumbbell Shoulder Press', 'pushVertical', ['dumbbell'], {
    subs: ['overhead-press', 'kb-press'],
  }),
  ex('arnold-press', 'Arnold Press', 'pushVertical', ['dumbbell'], { subs: ['db-shoulder-press'] }),
  ex('kb-press', 'Kettlebell Strict Press', 'pushVertical', ['kettlebell'], {
    unilateral: true,
    subs: ['overhead-press', 'pike-push-up'],
    harder: ['kb-push-press', 'kb-bottoms-up-press'],
  }),
  ex('kb-push-press', 'Kettlebell Push Press', 'pushVertical', ['kettlebell'], {
    unilateral: true,
    easier: ['kb-press'],
  }),
  ex('kb-bottoms-up-press', 'Bottoms-Up Kettlebell Press', 'pushVertical', ['kettlebell'], {
    unilateral: true,
    easier: ['kb-press'],
    notes: 'Brutal grip and shoulder-stability work with a light bell.',
  }),
  ex('landmine-press', 'Landmine Press', 'pushVertical', ['barbell'], {
    unilateral: true,
    subs: ['db-shoulder-press'],
  }),
  ex('band-overhead-press', 'Band Overhead Press', 'pushVertical', ['resistanceBand'], {
    subs: ['overhead-press', 'pike-push-up'],
  }),
  ex('lateral-raise', 'Lateral Raise', 'pushVertical', ['dumbbell'], {
    primary: ['shoulders'],
    secondary: [],
    subs: ['band-lateral-raise'],
  }),
  ex('band-lateral-raise', 'Band Lateral Raise', 'pushVertical', ['resistanceBand'], {
    primary: ['shoulders'],
    secondary: [],
    subs: ['lateral-raise'],
  }),

  // -------------------------------------------------------------------------
  // Horizontal pull
  // -------------------------------------------------------------------------
  ex('band-row', 'Band Row', 'pullHorizontal', ['resistanceBand'], {
    subs: ['barbell-row', 'inverted-row'],
    harder: ['inverted-row'],
  }),
  ex('table-row', 'Under-Table Row', 'pullHorizontal', ['floor'], {
    subs: ['inverted-row'],
    harder: ['inverted-row'],
    notes: 'A sturdy table is the no-equipment answer to horizontal pulling.',
  }),
  ex('inverted-row', 'Inverted Row', 'pullHorizontal', ['pullupBar'], {
    easier: ['table-row', 'band-row'],
    harder: ['feet-elevated-inverted-row', 'archer-row'],
    subs: ['barbell-row', 'db-row'],
  }),
  ex('feet-elevated-inverted-row', 'Feet-Elevated Inverted Row', 'pullHorizontal', ['pullupBar', 'box'], {
    easier: ['inverted-row'],
    harder: ['archer-row'],
  }),
  ex('archer-row', 'Archer Inverted Row', 'pullHorizontal', ['pullupBar'], {
    unilateral: true,
    easier: ['feet-elevated-inverted-row'],
  }),
  ex('ring-row', 'Ring Row', 'pullHorizontal', ['rings'], { subs: ['inverted-row'] }),
  ex('barbell-row', 'Barbell Row', 'pullHorizontal', ['barbell'], {
    subs: ['db-row', 'kb-row', 'inverted-row'],
    harder: ['pendlay-row'],
  }),
  ex('pendlay-row', 'Pendlay Row', 'pullHorizontal', ['barbell'], { easier: ['barbell-row'] }),
  ex('db-row', 'Dumbbell Row', 'pullHorizontal', ['dumbbell'], {
    unilateral: true,
    subs: ['kb-row', 'barbell-row'],
  }),
  ex('kb-row', 'Kettlebell Row', 'pullHorizontal', ['kettlebell'], {
    unilateral: true,
    subs: ['db-row', 'barbell-row'],
    harder: ['kb-gorilla-row', 'renegade-row'],
  }),
  ex('kb-gorilla-row', 'Gorilla Row', 'pullHorizontal', ['kettlebell'], {
    unilateral: true,
    easier: ['kb-row'],
  }),
  ex('renegade-row', 'Renegade Row', 'pullHorizontal', ['kettlebell', 'floor'], {
    unilateral: true,
    secondary: ['core', 'shoulders'],
    easier: ['kb-row'],
  }),
  ex('chest-supported-row', 'Chest-Supported Row', 'pullHorizontal', ['dumbbell', 'bench'], {
    subs: ['barbell-row', 'machine-row'],
  }),
  ex('seated-cable-row', 'Seated Cable Row', 'pullHorizontal', ['cableMachine'], {
    subs: ['barbell-row', 'band-row'],
  }),
  ex('machine-row', 'Machine Row', 'pullHorizontal', ['rowMachine'], { subs: ['barbell-row'] }),
  ex('face-pull', 'Face Pull', 'pullHorizontal', ['cableMachine'], {
    primary: ['rear delts', 'upper back'],
    subs: ['band-face-pull'],
  }),
  ex('band-face-pull', 'Band Face Pull', 'pullHorizontal', ['resistanceBand'], {
    primary: ['rear delts', 'upper back'],
    subs: ['face-pull'],
  }),
  ex('band-pull-apart', 'Band Pull-Apart', 'pullHorizontal', ['resistanceBand'], {
    primary: ['rear delts', 'upper back'],
  }),

  // -------------------------------------------------------------------------
  // Vertical pull
  // -------------------------------------------------------------------------
  ex('scapular-pull', 'Scapular Pull-Up', 'pullVertical', ['pullupBar'], {
    harder: ['negative-pull-up', 'pull-up'],
  }),
  ex('band-assisted-pull-up', 'Band-Assisted Pull-Up', 'pullVertical', ['pullupBar', 'resistanceBand'], {
    harder: ['pull-up'],
  }),
  ex('negative-pull-up', 'Negative Pull-Up', 'pullVertical', ['pullupBar'], {
    harder: ['pull-up'],
    notes: 'Jump to the top, lower for five seconds. The fastest route to a first pull-up.',
  }),
  ex('chin-up', 'Chin-Up', 'pullVertical', ['pullupBar'], {
    easier: ['negative-pull-up', 'band-assisted-pull-up'],
    harder: ['pull-up', 'weighted-chin-up'],
  }),
  ex('pull-up', 'Pull-Up', 'pullVertical', ['pullupBar'], {
    easier: ['chin-up', 'negative-pull-up', 'band-assisted-pull-up'],
    harder: ['weighted-pull-up', 'archer-pull-up', 'commando-pull-up'],
    subs: ['lat-pulldown', 'band-lat-pulldown'],
  }),
  ex('weighted-pull-up', 'Weighted Pull-Up', 'pullVertical', ['pullupBar', 'weightVest'], {
    easier: ['pull-up'],
    harder: ['muscle-up'],
  }),
  ex('weighted-chin-up', 'Weighted Chin-Up', 'pullVertical', ['pullupBar', 'weightVest'], {
    easier: ['chin-up'],
  }),
  ex('archer-pull-up', 'Archer Pull-Up', 'pullVertical', ['pullupBar'], {
    unilateral: true,
    easier: ['pull-up'],
  }),
  ex('commando-pull-up', 'Commando Pull-Up', 'pullVertical', ['pullupBar'], { easier: ['pull-up'] }),
  ex('muscle-up', 'Muscle-Up', 'pullVertical', ['pullupBar'], {
    modality: 'skill',
    easier: ['weighted-pull-up'],
  }),
  ex('lat-pulldown', 'Lat Pulldown', 'pullVertical', ['latPulldown'], {
    subs: ['pull-up', 'band-lat-pulldown'],
  }),
  ex('band-lat-pulldown', 'Band Lat Pulldown', 'pullVertical', ['resistanceBand'], {
    subs: ['lat-pulldown', 'pull-up'],
    notes: 'Anchor a band overhead. The only vertical pull available with no bar.',
  }),
  ex('kb-high-pull', 'Kettlebell High Pull', 'pullVertical', ['kettlebell'], {
    primary: ['upper back', 'traps'],
    subs: ['barbell-row'],
  }),
  ex('bicep-curl', 'Bicep Curl', 'pullVertical', ['dumbbell'], {
    primary: ['biceps'],
    secondary: ['forearms'],
    subs: ['kb-curl', 'band-curl'],
  }),
  ex('kb-curl', 'Kettlebell Curl', 'pullVertical', ['kettlebell'], {
    primary: ['biceps'],
    secondary: ['forearms'],
    subs: ['bicep-curl'],
  }),
  ex('band-curl', 'Band Curl', 'pullVertical', ['resistanceBand'], {
    primary: ['biceps'],
    secondary: ['forearms'],
    subs: ['bicep-curl'],
  }),

  // -------------------------------------------------------------------------
  // Carry and grip — the OCR and Hyrox backbone
  // -------------------------------------------------------------------------
  ex('farmers-carry', "Farmer's Carry", 'carry', ['kettlebell'], {
    subs: ['db-farmers-carry', 'bucket-carry'],
    harder: ['suitcase-carry', 'overhead-carry'],
  }),
  ex('db-farmers-carry', "Dumbbell Farmer's Carry", 'carry', ['dumbbell'], {
    subs: ['farmers-carry'],
  }),
  ex('suitcase-carry', 'Suitcase Carry', 'carry', ['kettlebell'], {
    unilateral: true,
    easier: ['farmers-carry'],
    notes: 'One bell only. The anti-lateral-flexion demand is the whole point.',
  }),
  ex('front-rack-carry', 'Front Rack Carry', 'carry', ['kettlebell'], { easier: ['farmers-carry'] }),
  ex('overhead-carry', 'Overhead Carry', 'carry', ['kettlebell'], { easier: ['front-rack-carry'] }),
  ex('bottoms-up-carry', 'Bottoms-Up Carry', 'carry', ['kettlebell'], {
    unilateral: true,
    notes: 'Grip work disguised as a carry. A light bell is plenty.',
  }),
  ex('sandbag-carry', 'Sandbag Carry', 'carry', ['sandbag'], {
    subs: ['bucket-carry', 'farmers-carry'],
  }),
  ex('bucket-carry', 'Bucket Carry', 'carry', ['sandbag'], {
    subs: ['farmers-carry'],
    notes: 'Spartan obstacle. A five-gallon bucket of gravel is the honest rehearsal.',
  }),
  ex('sled-push', 'Sled Push', 'carry', ['sled'], { subs: ['hill-sprint'] }),
  ex('sled-pull', 'Sled Pull', 'carry', ['sled'], { subs: ['band-row'] }),
  ex('dead-hang', 'Dead Hang', 'carry', ['pullupBar'], {
    hold: true,
    metrics: ['timeSec', 'rpe'],
    primary: ['forearms', 'lats'],
    harder: ['single-arm-hang', 'towel-hang'],
    subs: ['plate-pinch'],
    notes: 'The single best predictor of holding on to an obstacle.',
  }),
  ex('towel-hang', 'Towel Hang', 'carry', ['pullupBar'], {
    hold: true,
    metrics: ['timeSec', 'rpe'],
    primary: ['forearms'],
    easier: ['dead-hang'],
  }),
  ex('single-arm-hang', 'Single-Arm Hang', 'carry', ['pullupBar'], {
    hold: true,
    unilateral: true,
    metrics: ['timeSec', 'rpe'],
    primary: ['forearms'],
    easier: ['dead-hang'],
  }),
  ex('plate-pinch', 'Plate Pinch Hold', 'carry', ['plates'], {
    hold: true,
    primary: ['forearms'],
    subs: ['dead-hang', 'bottoms-up-carry'],
  }),
  ex('rope-climb', 'Rope Climb', 'carry', ['ropeClimb'], {
    modality: 'skill',
    metrics: ['reps', 'rpe'],
    primary: ['lats', 'forearms'],
    subs: ['pull-up', 'towel-hang'],
  }),
  ex('monkey-bars', 'Monkey Bars / Rig Traverse', 'carry', ['pullupBar'], {
    modality: 'skill',
    metrics: ['distanceM', 'timeSec', 'rpe'],
    primary: ['forearms', 'lats'],
    subs: ['dead-hang'],
  }),

  // -------------------------------------------------------------------------
  // Core
  // -------------------------------------------------------------------------
  ex('plank', 'Plank', 'core', ['floor'], {
    hold: true,
    harder: ['long-lever-plank', 'side-plank'],
  }),
  ex('long-lever-plank', 'Long-Lever Plank', 'core', ['floor'], { hold: true, easier: ['plank'] }),
  ex('side-plank', 'Side Plank', 'core', ['floor'], { hold: true, unilateral: true }),
  ex('hollow-hold', 'Hollow Body Hold', 'core', ['floor'], {
    hold: true,
    easier: ['dead-bug'],
    harder: ['hollow-rock'],
  }),
  ex('hollow-rock', 'Hollow Rock', 'core', ['floor'], { easier: ['hollow-hold'] }),
  ex('dead-bug', 'Dead Bug', 'core', ['floor'], { harder: ['hollow-hold'] }),
  ex('bird-dog', 'Bird Dog', 'core', ['floor'], { unilateral: true }),
  ex('sit-up', 'Sit-Up', 'core', ['floor'], { harder: ['v-up', 'weighted-sit-up'] }),
  ex('weighted-sit-up', 'Weighted Sit-Up', 'core', ['floor', 'kettlebell'], { easier: ['sit-up'] }),
  ex('v-up', 'V-Up', 'core', ['floor'], { easier: ['sit-up'] }),
  ex('bicycle-crunch', 'Bicycle Crunch', 'core', ['floor'], {}),
  ex('russian-twist', 'Russian Twist', 'core', ['floor'], { harder: ['weighted-russian-twist'] }),
  ex('weighted-russian-twist', 'Weighted Russian Twist', 'core', ['kettlebell', 'floor'], {
    easier: ['russian-twist'],
  }),
  ex('mountain-climber', 'Mountain Climber', 'core', ['floor'], {
    secondary: ['shoulders', 'cardiovascular'],
  }),
  ex('ab-wheel', 'Ab Wheel Rollout', 'core', ['abWheel'], {
    subs: ['long-lever-plank'],
    easier: ['plank'],
  }),
  ex('hanging-knee-raise', 'Hanging Knee Raise', 'core', ['pullupBar'], {
    harder: ['hanging-leg-raise', 'toes-to-bar'],
    subs: ['lying-leg-raise'],
  }),
  ex('hanging-leg-raise', 'Hanging Leg Raise', 'core', ['pullupBar'], {
    easier: ['hanging-knee-raise'],
    harder: ['toes-to-bar'],
  }),
  ex('toes-to-bar', 'Toes to Bar', 'core', ['pullupBar'], { easier: ['hanging-leg-raise'] }),
  ex('lying-leg-raise', 'Lying Leg Raise', 'core', ['floor'], {
    harder: ['hanging-knee-raise'],
    subs: ['hanging-knee-raise'],
  }),
  ex('l-sit', 'L-Sit', 'core', ['floor'], { hold: true, modality: 'skill', easier: ['hollow-hold'] }),
  ex('pallof-press', 'Pallof Press', 'core', ['resistanceBand'], {
    unilateral: true,
    subs: ['side-plank'],
  }),
  ex('kb-windmill', 'Kettlebell Windmill', 'core', ['kettlebell'], {
    unilateral: true,
    secondary: ['shoulders', 'hamstrings'],
  }),
  ex('turkish-get-up', 'Turkish Get-Up', 'fullBody', ['kettlebell'], {
    unilateral: true,
    notes: 'Five minutes of get-ups is a full-body session when you own one bell.',
  }),

  // -------------------------------------------------------------------------
  // Full body and conditioning
  // -------------------------------------------------------------------------
  ex('burpee', 'Burpee', 'fullBody', ['floor'], {
    easier: ['squat-thrust'],
    harder: ['burpee-broad-jump', 'burpee-pull-up'],
    notes: 'The OCR tax. Every failed obstacle costs 30 of these.',
  }),
  ex('squat-thrust', 'Squat Thrust (No Push-Up)', 'fullBody', ['floor'], { harder: ['burpee'] }),
  ex('burpee-broad-jump', 'Burpee Broad Jump', 'fullBody', ['floor'], { easier: ['burpee'] }),
  ex('burpee-pull-up', 'Burpee Pull-Up', 'fullBody', ['floor', 'pullupBar'], { easier: ['burpee'] }),
  ex('bear-crawl', 'Bear Crawl', 'fullBody', ['floor'], {
    metrics: ['distanceM', 'timeSec', 'rpe'],
  }),
  ex('box-jump', 'Box Jump', 'fullBody', ['box'], { easier: ['jump-squat'], subs: ['jump-squat'] }),
  ex('broad-jump', 'Broad Jump', 'fullBody', ['floor'], {}),
  ex('thruster', 'Barbell Thruster', 'fullBody', ['barbell'], { subs: ['kb-thruster'] }),
  ex('kb-thruster', 'Kettlebell Thruster', 'fullBody', ['kettlebell'], {
    subs: ['thruster', 'burpee'],
  }),
  ex('devils-press', "Devil's Press", 'fullBody', ['kettlebell'], {
    easier: ['kb-thruster'],
    notes: 'Burpee into a snatch. Miserable, and extremely effective with one bell.',
  }),
  ex('man-maker', 'Man Maker', 'fullBody', ['dumbbell'], { subs: ['devils-press'] }),
  ex('wall-ball', 'Wall Ball', 'fullBody', ['wallBall', 'wall'], { subs: ['kb-thruster'] }),
  ex('slam-ball', 'Slam Ball', 'fullBody', ['slamBall'], { subs: ['kb-swing'] }),
  ex('battle-ropes', 'Battle Ropes', 'fullBody', ['battleRopes'], {
    metrics: ['timeSec', 'rpe'],
    subs: ['kb-swing'],
  }),
  ex('jump-rope', 'Jump Rope', 'fullBody', ['jumpRope'], {
    metrics: ['timeSec', 'reps', 'rpe'],
    harder: ['double-unders'],
  }),
  ex('double-unders', 'Double Unders', 'fullBody', ['jumpRope'], {
    modality: 'skill',
    metrics: ['reps', 'timeSec', 'rpe'],
    easier: ['jump-rope'],
  }),
  ex('kb-complex', 'Kettlebell Complex', 'fullBody', ['kettlebell'], {
    metrics: ['weightKg', 'rounds', 'timeSec', 'rpe'],
    notes: 'Clean, press, squat, row, swing without setting the bell down.',
  }),

  // Timed conditioning blocks. These are containers rather than movements — what the rounds
  // consisted of goes in the set's notes — but modelling them as ordinary library entries
  // means rounds get history, personal bests, and charts for free.
  ex('amrap', 'AMRAP Block', 'fullBody', ['bodyweight'], {
    metrics: ['rounds', 'timeSec', 'rpe'],
    notes: 'As many rounds as possible inside a time cap.',
  }),
  ex('emom', 'EMOM Block', 'fullBody', ['bodyweight'], {
    metrics: ['rounds', 'timeSec', 'rpe'],
    notes: 'Every minute on the minute. The rest is whatever the minute leaves you.',
  }),
  ex('for-time', 'For Time', 'fullBody', ['bodyweight'], {
    metrics: ['rounds', 'timeSec', 'rpe'],
    notes: 'Fixed work, clock running. The score is the time.',
  }),

  // -------------------------------------------------------------------------
  // Running and other cardio
  // -------------------------------------------------------------------------
  cardio('easy-run', 'Easy Run', ['road'], {
    notes: 'Conversational. Most of your weekly mileage belongs here.',
  }),
  cardio('recovery-run', 'Recovery Run', ['road'], {}),
  cardio('long-run', 'Long Run', ['road'], {
    notes: 'The single most important session in any distance plan.',
  }),
  cardio('tempo-run', 'Tempo Run', ['road'], {
    notes: 'Comfortably hard, roughly one-hour race effort.',
  }),
  cardio('interval-run', 'Interval Run', ['track'], {}),
  cardio('hill-sprint', 'Hill Sprints', ['hill'], {}),
  cardio('hill-repeats', 'Hill Repeats', ['hill'], {}),
  cardio('race-pace-run', 'Race-Pace Run', ['road'], {}),
  cardio('progression-run', 'Progression Run', ['road'], {}),
  cardio('trail-run', 'Trail Run', ['trail'], {
    notes: 'Where OCR fitness actually gets built — uneven ground and real vert.',
  }),
  cardio('treadmill-run', 'Treadmill Run', ['treadmill'], { subs: ['easy-run'] }),
  cardio('sprint', 'Sprints', ['track'], {}),
  cardio('walk', 'Walk', ['road'], {}),
  cardio('incline-walk', 'Incline Walk', ['treadmill'], { subs: ['hill-repeats'] }),
  cardio('ruck', 'Ruck', ['trail', 'weightVest'], {
    metrics: ['weightKg', 'distanceM', 'timeSec', 'rpe'],
  }),
  cardio('stair-climb', 'Stair Climb', ['stairs'], {}),
  cardio('row-erg', 'Rowing Machine', ['rowErg'], {}),
  cardio('ski-erg', 'SkiErg', ['skiErg'], {}),
  cardio('bike-erg', 'Stationary Bike', ['bikeErg'], {}),
  cardio('air-bike', 'Air Bike', ['airBike'], {}),
  cardio('swim', 'Swim', ['pool'], {}),
  cardio('open-water-swim', 'Open Water Swim', ['openWater'], {}),

  // -------------------------------------------------------------------------
  // Mobility
  // -------------------------------------------------------------------------
  mobility('couch-stretch', 'Couch Stretch', ['floor', 'wall'], { unilateral: true }),
  mobility('hip-flexor-stretch', 'Kneeling Hip Flexor Stretch', ['floor'], { unilateral: true }),
  mobility('hamstring-stretch', 'Hamstring Stretch', ['floor'], { unilateral: true }),
  mobility('pigeon-pose', 'Pigeon Pose', ['floor'], { unilateral: true }),
  mobility('ninety-ninety', '90/90 Hip Switch', ['floor'], {}),
  mobility('worlds-greatest-stretch', "World's Greatest Stretch", ['floor'], { unilateral: true }),
  mobility('cat-cow', 'Cat-Cow', ['floor'], {}),
  mobility('thoracic-rotation', 'Thoracic Rotation', ['floor'], { unilateral: true }),
  mobility('downward-dog', 'Downward Dog', ['floor'], {}),
  mobility('shoulder-dislocate', 'Shoulder Dislocate', ['resistanceBand'], {}),
  mobility('ankle-mobilization', 'Ankle Mobilization', ['wall'], { unilateral: true }),
  mobility('calf-stretch', 'Calf Stretch', ['wall'], { unilateral: true }),
  mobility('foam-roll-quads', 'Foam Roll — Quads', ['floor'], {}),
  mobility('foam-roll-back', 'Foam Roll — Upper Back', ['floor'], {}),
];

/** Fast lookup by slug, used everywhere a prescription resolves a movement. */
/**
 * The staples, kept as one list rather than a flag scattered through 230 entries so the
 * curation can actually be reviewed and argued with.
 *
 * The test for inclusion is not "is this a good exercise" but "would burying this under an
 * alphabetical sort be surprising". A bench press ranks; a bench dip does not.
 */
const COMMON_SLUGS = new Set([
  // Weights — the movements most programs are built from
  'back-squat', 'front-squat', 'goblet-squat', 'leg-press',
  'deadlift', 'romanian-deadlift', 'kb-swing', 'hip-thrust',
  'bench-press', 'db-bench-press', 'incline-bench-press',
  'overhead-press', 'db-shoulder-press', 'kb-press', 'lateral-raise',
  'barbell-row', 'db-row', 'lat-pulldown', 'seated-cable-row',
  'bulgarian-split-squat', 'kb-walking-lunge', 'farmers-carry',
  'bicep-curl', 'leg-curl', 'turkish-get-up',

  // Calisthenics — what you reach for with a floor and a bar
  'push-up', 'incline-push-up', 'knee-push-up', 'pike-push-up', 'dip',
  'pull-up', 'chin-up', 'inverted-row', 'negative-pull-up', 'dead-hang',
  'air-squat', 'reverse-lunge', 'walking-lunge', 'step-up', 'glute-bridge',
  'plank', 'side-plank', 'hollow-hold', 'sit-up', 'hanging-knee-raise',
  'mountain-climber', 'burpee', 'bear-crawl', 'box-jump', 'wall-sit',

  // Cardio
  'easy-run', 'long-run', 'tempo-run', 'interval-run', 'recovery-run',
  'trail-run', 'treadmill-run', 'hill-repeats', 'walk', 'ruck',
  'row-erg', 'bike-erg', 'ski-erg', 'swim', 'stair-climb',

  // Conditioning containers and skills
  'amrap', 'emom', 'for-time', 'jump-rope', 'double-unders', 'wall-ball',

  // Mobility
  'couch-stretch', 'hamstring-stretch', 'hip-flexor-stretch', 'cat-cow',
  'downward-dog', 'worlds-greatest-stretch', 'pigeon-pose', 'calf-stretch',
]);

/**
 * Isolation, prep, and top-up work.
 *
 * Used only for ordering a suggested session: these come after the movement that the session
 * is actually about. A curl is a fine exercise and a bad thing to open an upper day with.
 *
 * Core is deliberately sparse here — in a core section everything is isolation, so flagging
 * it all would say nothing. Only the rehab-and-prep end of it is marked.
 */
const ACCESSORY_SLUGS = new Set([
  // Arms and delts
  'bicep-curl', 'kb-curl', 'band-curl',
  'lateral-raise', 'band-lateral-raise',
  'bench-dip',

  // Chest and back isolation
  'cable-fly', 'band-chest-fly',
  'face-pull', 'band-face-pull', 'band-pull-apart',

  // Legs isolation
  'leg-extension', 'leg-curl', 'slider-leg-curl', 'sissy-squat',
  'glute-bridge', 'single-leg-glute-bridge',

  // Posterior chain support
  'back-extension', 'reverse-hyper', 'superman-hold', 'band-good-morning',

  // Grip and shoulder prep
  'dead-hang', 'single-arm-hang', 'towel-hang', 'plate-pinch', 'scapular-pull',

  // Core prep / anti-rotation
  'bird-dog', 'dead-bug', 'pallof-press', 'kb-windmill',
]);

export const SEED_EXERCISES: SeedExercise[] = LIBRARY.map((exercise) => ({
  ...exercise,
  common: COMMON_SLUGS.has(exercise.slug),
  isAccessory: ACCESSORY_SLUGS.has(exercise.slug),
}));

export const SEED_EXERCISE_BY_SLUG = new Map(SEED_EXERCISES.map((e) => [e.slug, e]));
