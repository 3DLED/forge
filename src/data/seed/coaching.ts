/**
 * How to perform each movement.
 *
 * Written for this app rather than sourced from anywhere. That is not incidental: every free
 * exercise-image and description set worth having turns out to be either of unknown
 * provenance or licensed per-project, and this app is meant to ship publicly. Original text
 * has no such problem, and it costs nothing to store or serve offline.
 *
 * Three fields, because three is what you can read while holding a kettlebell:
 *
 * - `setup` — where you and the equipment start. Almost every failed rep starts here.
 * - `cues` — two or three imperatives in the order they happen, not a description of the
 *   movement. "Drive your elbows forward" beats "the elbows travel forward".
 * - `fault` — the one thing that most often goes wrong. Naming it is worth more than another
 *   correct instruction, because you cannot fix an error you have not noticed.
 *
 * Deliberately not stored in the database. This is static reference material that no user
 * edits, so it is looked up from here at render time — no migration, no per-record bloat, and
 * no sync to push when a cue is reworded.
 *
 * Cues are pipe-separated in the source purely to keep 200-odd entries readable; they are
 * split into an array on the way out.
 */

export interface Coaching {
  setup: string;
  cues: string[];
  fault: string;
}

/** [setup, pipe-separated cues, common fault] */
type Raw = [string, string, string];

const RAW: Record<string, Raw> = {
  // --- squat ---------------------------------------------------------------
  'air-squat': [
    'Feet about shoulder width, toes turned out a little.',
    'Send your hips back and down|Keep your whole foot planted|Stand tall and squeeze your glutes',
    'Knees collapsing inward on the way up. Push them out over your toes.',
  ],
  'tempo-air-squat': [
    'Same stance as an air squat, but you are buying time under tension instead of load.',
    'Three seconds down|Pause one second at the bottom|Three seconds back up',
    'Rushing the last rep. If the tempo breaks, the set is over.',
  ],
  'wall-sit': [
    'Back flat against a wall, feet forward far enough that your knees finish at 90 degrees.',
    'Slide down until your thighs are parallel|Keep your back in contact with the wall|Breathe normally',
    'Creeping upward as it burns. Pick a spot on the wall and hold it.',
  ],
  'single-leg-wall-sit': [
    'A wall sit, then lift one foot off the floor.',
    'Set the wall sit first|Extend one leg out|Hold, then swap sides',
    'Letting the hips rotate toward the working side.',
  ],
  'jump-squat': [
    'Feet shoulder width, arms free to swing.',
    'Dip to a quarter squat|Jump as high as you can|Land soft, absorb into the next rep',
    'Landing stiff-legged. The landing should be quieter than the jump.',
  ],
  'goblet-squat': [
    'Hold a kettlebell by the horns at chest height, elbows tucked in.',
    'Keep the bell against your chest|Squat between your knees|Drive up through your midfoot',
    'Letting the bell drift away from your chest, which pulls you forward.',
  ],
  'db-goblet-squat': [
    'Cup one end of a dumbbell vertically against your chest.',
    'Elbows in and under the weight|Sit down between your knees|Stand and squeeze',
    'Gripping too low, so the dumbbell tips away from you.',
  ],
  'kb-front-squat': [
    'Two kettlebells racked on the shoulders, bells resting on the forearms.',
    'Elbows tight to your ribs|Sit straight down|Keep your chest up as you stand',
    'Elbows drifting out, which dumps the bells forward.',
  ],
  'back-squat': [
    'Bar across the upper back, feet shoulder width, brace before you unrack.',
    'Big breath into your belly|Hips back and down together|Drive the floor away',
    'Hips shooting up first, turning the squat into a good morning.',
  ],
  'pause-back-squat': [
    'A back squat with a dead stop at the bottom.',
    'Descend under control|Hold two or three seconds without relaxing|Drive up from a stop',
    'Sinking and bouncing during the pause instead of staying rigid.',
  ],
  'front-squat': [
    'Bar in the front rack across the shoulders, elbows high, fingertips under the bar.',
    'Point your elbows forward and up|Sit straight down|Keep your torso vertical',
    'Elbows dropping on the way up, which rounds you forward and dumps the bar.',
  ],
  'box-squat': [
    'Box or bench set so your thighs land parallel or just below.',
    'Sit back onto the box|Pause without rocking|Drive up without leaning forward',
    'Flopping onto the box rather than sitting under control.',
  ],
  'smith-squat': [
    'Bar on the shoulders, feet slightly ahead of the bar path.',
    'Unrack and set your brace|Descend to parallel|Push through your midfoot',
    'Feet placed too far forward, turning it into a leg press for your lower back.',
  ],
  'leg-press': [
    'Feet shoulder width on the platform, back and hips flat against the pad.',
    'Lower until your knees reach 90 degrees|Keep your lower back on the pad|Press without locking out hard',
    'Letting the hips curl off the pad at the bottom to chase more range.',
  ],
  'leg-extension': [
    'Knees at the pivot of the machine, pad across the lower shin.',
    'Extend smoothly to straight|Pause a beat at the top|Lower under control',
    'Kicking the weight up with momentum, then dropping it.',
  ],
  'sissy-squat': [
    'Standing tall, hold something for balance, rise onto the balls of your feet.',
    'Drive your knees forward|Lean your torso back to stay in line with your thighs|Come back up',
    'Bending at the hips. From knee to shoulder should stay one straight line.',
  ],
  'split-squat': [
    'One foot forward, one back, feet about hip width apart side to side.',
    'Drop the back knee straight down|Keep most of your weight on the front foot|Stand without stepping',
    'Standing on a tightrope. Widen your stance and balance stops being the limit.',
  ],
  'assisted-pistol-squat': [
    'Stand on one leg holding a doorframe, rings, or a post.',
    'Use your hands only as much as needed|Sit back and down slowly|Pull lightly to help yourself up',
    'Hauling yourself up with your arms. Let the leg do what it can first.',
  ],
  'shrimp-squat': [
    'Stand on one leg, hold the other foot behind you.',
    'Lower until the trailing knee touches down|Keep your chest up|Stand without letting the knee cave',
    'Rushing the descent so the back knee crashes into the floor.',
  ],
  'pistol-squat': [
    'Stand on one leg, other leg extended in front, arms out for balance.',
    'Sit back and down slowly|Keep the free heel off the floor|Stand all the way up',
    'The heel of the standing foot lifting. Work on ankle range if it will not stay down.',
  ],
  'weighted-pistol-squat': [
    'A pistol squat holding a kettlebell or plate at your chest.',
    'Let the weight counterbalance you forward|Descend under control|Stand and reset each rep',
    'Adding load before the bodyweight version is genuinely clean.',
  ],

  // --- hinge ---------------------------------------------------------------
  'glute-bridge': [
    'Lying on your back, knees bent, heels close to your hips.',
    'Push through your heels|Lift until your hips are level with your knees|Squeeze hard at the top',
    'Arching your lower back to get higher instead of using the glutes.',
  ],
  'single-leg-glute-bridge': [
    'A glute bridge with one foot off the floor.',
    'Drive through the planted heel|Keep your hips level|Lower without dropping the free side',
    'Letting the free hip sag, which turns it into a side bend.',
  ],
  'hip-thrust': [
    'Upper back against a bench, bar or weight across the hips, feet flat.',
    'Tuck your chin and ribs down|Drive through your heels|Hold the lockout a full second',
    'Hyperextending the lower back at the top instead of finishing with the glutes.',
  ],
  'kb-hip-thrust': [
    'Upper back on a bench, kettlebell resting across the hips.',
    'Steady the bell with both hands|Drive up until your torso is level|Lower under control',
    'Letting the bell slide toward your stomach as you lift.',
  ],
  'kb-deadlift': [
    'Kettlebell on the floor between your feet, feet hip width.',
    'Push your hips back to reach it|Flatten your back before you pull|Stand by driving your hips forward',
    'Squatting down to the bell rather than hinging back to it.',
  ],
  'deadlift': [
    'Bar over midfoot, feet hip width, shins close to the bar.',
    'Take the slack out before you pull|Push the floor away|Finish standing tall, not leaning back',
    'Hips rising before the bar moves, which leaves your back to do the work.',
  ],
  'sumo-deadlift': [
    'Wide stance, toes turned out, hands inside your knees.',
    'Open your knees out over your toes|Drop your hips and chest up|Push the floor apart as you stand',
    'Setting the hips too high, which makes it a stiff-legged pull from a wide stance.',
  ],
  'trap-bar-deadlift': [
    'Stand inside the trap bar, feet hip width, handles beside you.',
    'Hinge down and grip the middle of the handles|Chest up, slack out|Stand by pushing the floor away',
    'Yanking the bar off the floor, which lets it tip forward or back.',
  ],
  'deficit-deadlift': [
    'Stand on a plate or low platform so the bar starts lower than usual.',
    'Set your back before you pull, it is harder from here|Push the floor away|Do not chase weight you cannot hold position with',
    'Using the same load as a floor pull and rounding to reach the bar.',
  ],
  'romanian-deadlift': [
    'Standing tall with the bar at your hips, knees softly bent.',
    'Push your hips straight back|Slide the bar down your thighs|Stop when your hamstrings stop you',
    'Turning it into a squat. The knees barely move on an RDL.',
  ],
  'db-romanian-deadlift': [
    'Dumbbells in front of your thighs, knees soft.',
    'Hips back, weights close to your legs|Lower until you feel your hamstrings load|Stand by driving the hips forward',
    'Letting the dumbbells drift forward, which loads your lower back instead.',
  ],
  'kb-romanian-deadlift': [
    'Kettlebell held in both hands at your hips.',
    'Hinge back, bell tracking your thighs|Flat back throughout|Squeeze the glutes to stand',
    'Rounding at the bottom to reach lower than your hamstrings allow.',
  ],
  'single-leg-rdl': [
    'Stand on one leg, weight in the opposite hand, other leg free.',
    'Hinge forward as the back leg counterbalances|Keep hips square to the floor|Return to standing under control',
    'Letting the hip of the free leg open toward the ceiling.',
  ],
  'bodyweight-single-leg-rdl': [
    'Stand on one leg, arms out, other leg straight behind.',
    'Hinge until your torso and back leg form one line|Keep hips level|Come back up slowly',
    'Bending the standing knee to make balance easier.',
  ],
  'good-morning': [
    'Bar on the upper back, feet hip width, knees soft.',
    'Push your hips back|Let your chest travel toward the floor|Stop before your back rounds',
    'Going deeper than your hamstrings allow, which is where backs get hurt.',
  ],
  'band-good-morning': [
    'Band under both feet, looped behind your neck.',
    'Hips back against the band|Keep the back flat|Stand and let the band pull you upright slowly',
    'Letting the band snap you up rather than controlling the return.',
  ],
  'kb-swing': [
    'Kettlebell a forearm ahead of you on the floor, feet slightly wider than hips.',
    'Hike the bell back between your legs|Snap your hips forward hard|Let the bell float, do not lift it',
    'Squatting and lifting with the arms. The bell is thrown by the hips.',
  ],
  'db-swing': [
    'Dumbbell held vertically by one end, both hands on the handle.',
    'Hike it back between your legs|Drive the hips forward|Let it swing to chest height',
    'Rounding the back on the backswing to get more range.',
  ],
  'kb-single-arm-swing': [
    'One hand on the bell, the other free.',
    'Hike back with a flat back|Snap the hips|Keep your shoulder packed as the bell rises',
    'Letting the torso rotate toward the working arm.',
  ],
  'kb-clean': [
    'Kettlebell between your feet, one hand on the handle.',
    'Hike it back like a swing|Pull the bell close and rotate your hand around it|Catch it softly in the rack',
    'Letting the bell flip over and bang the forearm. Guide it, do not throw it.',
  ],
  'kb-snatch': [
    'Kettlebell between your feet, one hand on the handle.',
    'Hike and snap the hips|Pull high and punch your hand through|Catch overhead with a locked elbow',
    'Catching with a bent arm, which lets the bell crash onto the wrist.',
  ],
  'nordic-curl': [
    'Kneel with your ankles anchored, torso upright, hips extended.',
    'Lower as slowly as you can|Keep hips straight, not folded|Catch yourself and push back up',
    'Bending at the hips to shorten the lever. Stay in one line from knee to head.',
  ],
  'band-nordic-curl': [
    'Same as a Nordic curl, with a band anchored above to take some weight.',
    'Set the band across your chest|Lower under control|Let the band help only at the bottom',
    'Using so much assistance the hamstrings never get loaded.',
  ],
  'ghr': [
    'Feet secured, pads at the thighs, body upright.',
    'Lower under control to horizontal|Curl yourself back up with the hamstrings|Keep hips extended throughout',
    'Piking at the hips to make the return easier.',
  ],
  'leg-curl': [
    'Pad just above your heels, knees at the machine pivot.',
    'Curl smoothly to full flexion|Squeeze at the top|Lower slower than you lifted',
    'Lifting the hips off the pad to move more weight.',
  ],
  'slider-leg-curl': [
    'Lying on your back, heels on sliders or a towel, hips lifted.',
    'Hold your hips high|Slide your heels away slowly|Pull them back in without dropping the hips',
    'Letting the hips sag as the legs extend.',
  ],
  'back-extension': [
    'Hips on the pad, feet secured, body straight.',
    'Hinge down at the hips|Come up until your body is in line|Do not arch past straight',
    'Cranking into hyperextension at the top.',
  ],
  'reverse-hyper': [
    'Torso supported, hips at the edge, legs hanging.',
    'Raise your legs to level with your torso|Squeeze the glutes|Lower slowly',
    'Swinging the legs and letting momentum do the work.',
  ],
  'superman-hold': [
    'Face down, arms extended overhead.',
    'Lift arms, chest and legs together|Hold and breathe|Keep your neck neutral',
    'Craning the head back to lift higher.',
  ],
  // --- lunge ---------------------------------------------------------------
  'forward-lunge': [
    'Standing tall, feet hip width.',
    'Step forward and drop the back knee|Keep your torso upright|Push off the front heel to return',
    'Stepping too short, which drives the front knee far past the toes.',
  ],
  'reverse-lunge': [
    'Standing tall, hands on hips or holding a weight.',
    'Step back and lower the trailing knee|Keep your weight on the front foot|Drive through the front heel to stand',
    'Leaning forward over the front leg instead of staying stacked.',
  ],
  'walking-lunge': [
    'Clear space ahead of you, feet hip width.',
    'Step out and drop the back knee|Stand and bring the back foot through|Alternate without pausing',
    'Narrowing to a single line, which makes every rep a balance test.',
  ],
  'db-walking-lunge': [
    'A dumbbell in each hand, arms relaxed at your sides.',
    'Let the weights hang, do not swing them|Step and lower under control|Drive up through the front heel',
    'Using the dumbbells for momentum on the way up.',
  ],
  'kb-walking-lunge': [
    'Kettlebells racked on the shoulders or hanging at your sides.',
    'Keep your ribs down|Step and lower|Stand tall between reps',
    'Letting the racked bells pull you into a forward lean.',
  ],
  'kb-reverse-lunge': [
    'Kettlebell held at the chest or hanging on one side.',
    'Step back under control|Touch the knee down lightly|Drive through the front heel',
    'Dropping the back knee hard onto the floor.',
  ],
  'kb-front-rack-lunge': [
    'One or two kettlebells racked on the shoulders.',
    'Elbows down, ribs down|Step back and lower|Stand without letting the bells drift forward',
    'Letting the rack collapse, which rounds the upper back.',
  ],
  'step-up': [
    'Box or bench at about knee height.',
    'Place your whole foot on the box|Drive through the top heel|Lower slowly instead of dropping',
    'Pushing off the bottom foot. The top leg should do the work.',
  ],
  'kb-step-up': [
    'A step-up holding kettlebells or dumbbells.',
    'Full foot on the box|Stand without pushing off the trailing leg|Control the way down',
    'Choosing a box so high the hip has to hike to reach it.',
  ],
  'box-step-over': [
    'A box roughly knee height, stepping over rather than back down.',
    'Step up and over|Land softly on the far side|Turn and repeat',
    'Jumping down off the box and pounding the knees.',
  ],
  'bulgarian-split-squat': [
    'Rear foot on a bench, front foot far enough forward to stay stacked.',
    'Drop straight down|Keep your weight on the front heel|Stand without leaning',
    'Front foot too close, which jams the knee and takes the glute out of it.',
  ],
  'kb-bulgarian-split-squat': [
    'A Bulgarian split squat holding weight at your sides or in the rack.',
    'Set the front foot before you load up|Descend under control|Drive up through the front heel',
    'Adding weight before you can balance the bodyweight version.',
  ],
  'lateral-lunge': [
    'Feet together, toes forward.',
    'Step wide to one side|Sit back into that hip, other leg straight|Push back to centre',
    'Letting the stepping knee travel inward over the arch.',
  ],
  'cossack-squat': [
    'Wide stance, toes turned out slightly.',
    'Shift into one hip and sink|Keep the other leg straight, toes up|Push back across to the other side',
    'Letting the heel of the working leg lift as you drop.',
  ],
  'jumping-lunge': [
    'Split stance, arms free.',
    'Drop into the lunge|Jump and switch legs in the air|Land soft and absorb',
    'Landing with a straight front leg, which takes the impact through the knee.',
  ],

  // --- push, horizontal ----------------------------------------------------
  'incline-push-up': [
    'Hands on a counter, bench, or stair. Higher is easier.',
    'Hands under your shoulders|Lower your chest to the surface|Push away and hold a straight line',
    'Letting the hips sag. Squeeze the glutes and it stays a plank.',
  ],
  'knee-push-up': [
    'Knees down, ankles crossed, hands under the shoulders.',
    'Keep a straight line from knee to head|Lower your chest toward the floor|Push away',
    'Bending at the hips so only the upper body moves.',
  ],
  'push-up': [
    'Hands under your shoulders, body in one line from heel to head.',
    'Squeeze glutes and brace|Lower until your chest is near the floor|Push away, elbows about 45 degrees',
    'Elbows flaring to 90 degrees, which is what makes shoulders ache.',
  ],
  'tempo-push-up': [
    'A push-up done deliberately slowly.',
    'Three seconds down|One second at the bottom without resting|Three seconds up',
    'Losing the plank on the last rep as fatigue arrives.',
  ],
  'decline-push-up': [
    'Feet elevated on a box or bench, hands on the floor.',
    'Set the plank before you lower|Chest toward the floor|Push away without piking',
    'Hips rising to take load off, which turns it into a pike push-up.',
  ],
  'diamond-push-up': [
    'Hands together under the chest, index fingers and thumbs touching.',
    'Keep your elbows close to your ribs|Lower your chest to your hands|Push away',
    'Flaring the elbows, which loses the triceps emphasis entirely.',
  ],
  'archer-push-up': [
    'Wide hand position, body in a plank.',
    'Lower toward one hand|Keep the other arm straight and sliding|Push back to centre',
    'Letting the straight arm bend, which makes it an ordinary wide push-up.',
  ],
  'one-arm-push-up': [
    'One hand under the chest, feet wide for stability, other arm behind your back.',
    'Brace hard against rotation|Lower under control|Push away without twisting',
    'Attempting it before archer push-ups are comfortable.',
  ],
  'pseudo-planche-push-up': [
    'Hands beside your waist, fingers turned slightly out, shoulders leaning forward past the hands.',
    'Lean forward and hold that lean|Lower with elbows tight to the body|Push while keeping the lean',
    'Letting the shoulders drift back over the hands, which removes the whole point.',
  ],
  'plyo-push-up': [
    'Standard push-up position on a forgiving surface.',
    'Lower under control|Push hard enough that your hands leave the floor|Land soft and absorb',
    'Collapsing on landing rather than catching with bent arms.',
  ],
  'bench-dip': [
    'Hands on a bench behind you, legs out in front.',
    'Keep your back close to the bench|Lower until your elbows reach 90 degrees|Press back up',
    'Drifting away from the bench, which puts the shoulder in a bad spot.',
  ],
  'dip': [
    'Support yourself on parallel bars, arms locked, shoulders pulled down.',
    'Lean slightly forward|Lower until your shoulders are level with your elbows|Press to a full lockout',
    'Going deeper than your shoulders can control, chasing range you do not own.',
  ],
  'band-assisted-dip': [
    'Band looped over the bars, knees or feet resting in it.',
    'Set your shoulders down before you descend|Lower under control|Let the band help only at the bottom',
    'So much assistance that the top half goes untrained.',
  ],
  'ring-dip': [
    'Rings at hip height, arms locked, rings turned out at the top.',
    'Fight the rings for stability|Lower slowly|Press up and turn the rings out again',
    'Letting the rings drift wide, which is where shoulders get strained.',
  ],
  'weighted-dip': [
    'A dip with a belt, vest, or dumbbell between the feet.',
    'Own the bodyweight version first|Lower under control|Press to lockout',
    'Adding load and losing depth at the same time.',
  ],
  'bench-press': [
    'Eyes under the bar, feet planted, shoulder blades pulled back and down.',
    'Set your back and keep it set|Lower to the lower chest|Press back over your shoulders',
    'Letting the shoulder blades come unglued, which loses all stability.',
  ],
  'pause-bench-press': [
    'A bench press with a dead stop on the chest.',
    'Lower under control|Hold one or two seconds without sinking|Press from a stop',
    'Relaxing during the pause, then heaving off the chest.',
  ],
  'incline-bench-press': [
    'Bench at about 30 degrees, otherwise set up like a flat press.',
    'Shoulder blades back and down|Lower to the upper chest|Press up and slightly back',
    'Setting the bench too steep, which makes it a shoulder press.',
  ],
  'db-bench-press': [
    'Dumbbells at chest level, feet planted, back set.',
    'Keep your wrists stacked over your elbows|Lower until you feel a stretch|Press without clanging them together',
    'Lowering past what the shoulder can control, since dumbbells let you.',
  ],
  'db-incline-press': [
    'Bench at about 30 degrees, dumbbells at the shoulders.',
    'Back set against the bench|Lower to the upper chest|Press up over your shoulders',
    'Arching hard off the bench to move more weight.',
  ],
  'kb-floor-press': [
    'Lying on the floor, kettlebells at the shoulders, elbows resting down.',
    'Press straight up|Pause when the triceps touch the floor|Keep your wrists straight',
    'Bouncing the elbows off the floor between reps.',
  ],
  'kb-single-arm-floor-press': [
    'One kettlebell, lying on the floor, free hand out for balance.',
    'Brace against rotation|Press straight up|Lower until the triceps touches down',
    'Letting the torso twist toward the pressing side.',
  ],
  'band-chest-press': [
    'Band anchored behind you at chest height, one end in each hand.',
    'Step forward to take up the slack|Press forward and slightly together|Return under control',
    'Letting the band snap your hands back.',
  ],
  'chest-press-machine': [
    'Handles at chest height, back flat against the pad.',
    'Set the seat so the handles start at chest level|Press forward|Return under control',
    'Setting the seat too low, which turns it into an incline press.',
  ],
  'cable-fly': [
    'Cables set high or mid, one handle in each hand, one foot forward.',
    'Soft bend in the elbows, held throughout|Bring your hands together in an arc|Open slowly',
    'Bending and straightening the arms, which makes it a press.',
  ],
  'band-chest-fly': [
    'Band anchored behind you, one end in each hand, arms out wide.',
    'Keep a fixed soft elbow|Sweep your hands together|Let the band open you slowly',
    'Pressing instead of hugging.',
  ],
  // --- push, vertical ------------------------------------------------------
  'overhead-press': [
    'Bar at the collarbone, feet hip width, glutes and abs tight.',
    'Move your head back out of the way|Press straight up|Finish with the bar over your ears',
    'Leaning back to clear your chin instead of moving your head.',
  ],
  'push-press': [
    'Same rack position as an overhead press, knees soft.',
    'Dip a few inches, straight down|Drive up hard with the legs|Punch the bar to lockout',
    'Dipping forward instead of straight down, which throws the bar out front.',
  ],
  'db-shoulder-press': [
    'Dumbbells at shoulder height, palms forward, ribs down.',
    'Brace so you do not arch|Press up and slightly together|Lower to the shoulders under control',
    'Turning it into a standing incline press by arching the lower back.',
  ],
  'arnold-press': [
    'Dumbbells at chest height, palms facing you.',
    'Rotate the palms out as you press|Finish with palms forward overhead|Reverse the rotation on the way down',
    'Rotating after the press rather than during it.',
  ],
  'kb-press': [
    'Kettlebell racked on the shoulder, bell on the forearm, elbow tucked.',
    'Squeeze the glutes and brace|Press up, letting the bell rotate around the wrist|Lock out with the bell behind the wrist',
    'Pressing with the bell hanging off the front of the wrist.',
  ],
  'kb-push-press': [
    'Kettlebell in the rack, knees soft.',
    'Short dip straight down|Drive with the legs|Punch under and lock the arm out',
    'Pressing with the arm before the leg drive has finished.',
  ],
  'kb-bottoms-up-press': [
    'Kettlebell held upside down, handle gripped hard, bell balanced above.',
    'Crush the handle|Press slowly and keep the bell vertical|Lower with the same control',
    'Going too heavy. This is a grip and stability drill first.',
  ],
  'band-overhead-press': [
    'Stand on the band, handles at shoulder height.',
    'Ribs down, glutes tight|Press straight overhead|Resist on the way down',
    'Letting the band pull your arms down fast.',
  ],
  'landmine-press': [
    'One end of a barbell in a corner or landmine, other end at your shoulder.',
    'Stagger your stance|Press up and forward along the bar path|Return to the shoulder',
    'Fighting the arc. The bar wants to travel forward as well as up.',
  ],
  'lateral-raise': [
    'Dumbbells at your sides, slight bend in the elbows.',
    'Lead with your elbows|Raise to shoulder height, no higher|Lower slowly',
    'Swinging the weights up with the hips.',
  ],
  'band-lateral-raise': [
    'Stand on the band, one handle in each hand.',
    'Soft elbows, held throughout|Raise out to shoulder height|Resist the return',
    'Shrugging the traps up instead of raising with the delts.',
  ],
  'pike-push-up': [
    'Hands and feet on the floor, hips high, body in an inverted V.',
    'Walk your feet in until your torso is steep|Lower the crown of your head toward the floor|Press back up',
    'Doing a normal push-up with a slight pike. Get the hips genuinely high.',
  ],
  'elevated-pike-push-up': [
    'Feet on a box, hips stacked high over your shoulders.',
    'Get as vertical as you can|Lower your head toward the floor|Press to a full lockout',
    'Letting the hips drop forward as you press.',
  ],
  'wall-handstand-hold': [
    'Facing the wall or back to it, hands about a hand-span from the base.',
    'Walk up until your body is straight|Squeeze glutes and ribs|Push the floor away through your shoulders',
    'Arching the lower back into a banana shape.',
  ],
  'wall-handstand-push-up': [
    'A wall handstand, hands slightly wider than shoulders.',
    'Lower until your head lightly touches|Keep your elbows tracking forward|Press back to lockout',
    'Bailing halfway. Start with negatives if the press is not there.',
  ],
  'freestanding-handstand-hold': [
    'Open floor with space to bail, hands shoulder width.',
    'Kick up gently and find balance in your fingers|Stack shoulders over hands|Breathe',
    'Kicking up too hard and going straight over.',
  ],
  'freestanding-handstand-push-up': [
    'A stable freestanding handstand before you add the press.',
    'Lower under full control|Keep the line as you descend|Press without losing balance',
    'Attempting it before a thirty-second freestanding hold is easy.',
  ],

  // --- pull, horizontal ----------------------------------------------------
  'table-row': [
    'Lie under a sturdy table, grip the edge, heels on the floor.',
    'Squeeze your glutes into a plank|Pull your chest to the edge|Lower slowly',
    'Letting the hips drop first so only the arms move.',
  ],
  'band-row': [
    'Band anchored in front at chest height, one end in each hand.',
    'Step back to take the slack out|Pull your elbows past your ribs|Let it return under control',
    'Shrugging the shoulders up toward the ears.',
  ],
  'inverted-row': [
    'Bar at hip height, hang underneath, heels on the floor.',
    'Body in one straight line|Pull your chest to the bar|Lower until your arms are straight',
    'Piking at the hips to shorten the distance.',
  ],
  'feet-elevated-inverted-row': [
    'An inverted row with your feet up on a box.',
    'Set the plank before you pull|Chest to the bar|Full extension at the bottom',
    'Bending at the hips as the set gets hard.',
  ],
  'ring-row': [
    'Rings at hip height, body angled underneath.',
    'Keep the rings stable, do not let them wobble|Pull the rings to your ribs|Lower with control',
    'Letting the elbows flare wide, which turns it into a face pull.',
  ],
  'archer-row': [
    'Inverted row setup with a wide grip.',
    'Pull toward one hand|Keep the other arm straight along the bar|Return to centre',
    'Bending the reaching arm, which shares the load again.',
  ],
  'barbell-row': [
    'Bar at your shins, hinge to about 45 degrees, flat back.',
    'Set your torso angle and keep it|Pull the bar to your lower ribs|Lower without standing up',
    'Standing up a little with every rep to help the pull.',
  ],
  'pendlay-row': [
    'Bar on the floor, torso roughly parallel, flat back.',
    'Pull explosively to the ribs|Return the bar all the way to the floor|Reset before the next rep',
    'Turning it into a bent row by never letting the bar settle.',
  ],
  'db-row': [
    'One hand and knee on a bench, other foot planted, dumbbell hanging.',
    'Flat back, shoulders square|Pull the dumbbell to your hip|Lower to a full stretch',
    'Twisting the torso to lift more weight.',
  ],
  'kb-row': [
    'Hinge forward, one hand braced, kettlebell hanging.',
    'Keep your back flat|Pull the bell to your hip|Let it hang fully at the bottom',
    'Rowing to the chest instead of the hip, which loses the lat.',
  ],
  'kb-gorilla-row': [
    'Two kettlebells on the floor between your feet, hinged forward.',
    'Brace on the non-working bell|Row one bell to the hip|Alternate without twisting',
    'Rotating the hips with each pull.',
  ],
  'renegade-row': [
    'Push-up position with a hand on each kettlebell, feet wide.',
    'Squeeze your glutes and widen your feet|Row one bell without turning|Set it down and swap',
    'The hips rocking side to side with every row.',
  ],
  'chest-supported-row': [
    'Chest against an inclined pad, weights hanging.',
    'Let your chest stay on the pad|Pull your elbows back past your ribs|Lower to a full stretch',
    'Peeling off the pad to cheat the last reps.',
  ],
  'machine-row': [
    'Chest on the pad, feet planted, handles at arms length.',
    'Set the seat so the handles are at chest height|Pull to your ribs|Return to a full stretch',
    'Leaning back to move the stack.',
  ],
  'seated-cable-row': [
    'Seated with feet on the platform, knees soft, back upright.',
    'Start from a full stretch|Pull to your stomach, elbows close|Return without rounding forward',
    'Rowing with the lower back by swinging back and forth.',
  ],
  'face-pull': [
    'Cable set at face height, rope handle, arms extended.',
    'Pull the rope toward your forehead|Split your hands apart at the end|Return slowly',
    'Pulling to the chest, which trains the wrong thing entirely.',
  ],
  'band-face-pull': [
    'Band anchored at face height, one end in each hand.',
    'Pull toward your face with high elbows|Separate your hands at the finish|Control the return',
    'Dropping the elbows and turning it into a row.',
  ],
  'band-pull-apart': [
    'Band held in front at chest height, arms straight.',
    'Keep your arms straight|Pull the band apart until it touches your chest|Return slowly',
    'Bending the elbows as it gets hard.',
  ],

  // --- pull, vertical ------------------------------------------------------
  'scapular-pull': [
    'Hang from a bar with straight arms.',
    'Keep your arms locked|Pull your shoulder blades down and back|Lower back to a full hang',
    'Bending the elbows. This is shoulder blades only.',
  ],
  'negative-pull-up': [
    'Jump or step to the top of a pull-up, chin over the bar.',
    'Start with your chest at the bar|Lower as slowly as you can|Reset and repeat',
    'Dropping through the last half rather than fighting all the way down.',
  ],
  'band-assisted-pull-up': [
    'Band over the bar, one knee or foot in the loop.',
    'Set your shoulders down before you pull|Pull your chest toward the bar|Lower under control',
    'A band so thick the top of the rep does nothing.',
  ],
  'pull-up': [
    'Overhand grip, slightly wider than shoulders, hanging with straight arms.',
    'Pull your shoulder blades down first|Drive your elbows to your ribs|Chin over the bar, then lower fully',
    'Kipping without meaning to. If the hips swing, the set is over.',
  ],
  'chin-up': [
    'Underhand grip, about shoulder width, full hang.',
    'Set the shoulders down|Pull your chest toward the bar|Lower to straight arms',
    'Stopping short at the bottom and never getting a full hang.',
  ],
  'commando-pull-up': [
    'Grip the bar with hands together, one in front of the other, body to one side.',
    'Pull your head to one side of the bar|Alternate sides each rep|Lower under control',
    'Swinging sideways rather than pulling.',
  ],
  'archer-pull-up': [
    'Wide grip, full hang.',
    'Pull toward one hand|Keep the other arm straight along the bar|Lower and alternate',
    'Bending the straight arm, which makes it a wide pull-up.',
  ],
  'weighted-pull-up': [
    'A pull-up with a belt, vest, or dumbbell between the feet.',
    'Own strict reps first|Full hang at the bottom|Chin clearly over the bar',
    'Adding weight and quietly losing range.',
  ],
  'weighted-chin-up': [
    'A chin-up with added load.',
    'Set the shoulders before you pull|Chest toward the bar|Lower to a full hang',
    'Cutting the bottom of the rep short as the weight climbs.',
  ],
  'muscle-up': [
    'False grip on rings or a bar, full hang.',
    'Pull explosively past your chest|Turn your wrists over as you transition|Press to a lockout',
    'Chasing it with a huge kip before the strict pull is there.',
  ],
  'lat-pulldown': [
    'Thighs under the pads, grip slightly wider than shoulders.',
    'Lean back a few degrees and stay there|Pull the bar to your collarbone|Return to a full stretch',
    'Rocking back and forth to move the stack.',
  ],
  'band-lat-pulldown': [
    'Band anchored overhead, one end in each hand, kneeling or standing.',
    'Start with arms extended|Pull your elbows down to your ribs|Let it return slowly',
    'Leaning back so far it becomes a row.',
  ],
  'bicep-curl': [
    'Dumbbells at your sides, palms forward, elbows at your ribs.',
    'Keep your elbows pinned|Curl without moving the shoulder|Lower slowly to straight',
    'Swinging the weight up with the lower back.',
  ],
  'kb-curl': [
    'Kettlebell in each hand, bells hanging below the handles.',
    'Elbows tight to your sides|Curl and let the bell settle on the forearm|Lower under control',
    'Letting the bell swing forward and drag the elbow with it.',
  ],
  'band-curl': [
    'Stand on the band, one end in each hand, palms forward.',
    'Elbows pinned at your ribs|Curl against increasing tension|Resist all the way down',
    'Letting the band snap the arms straight.',
  ],
  'kb-high-pull': [
    'Kettlebell between your feet, one hand on the handle.',
    'Hike and snap the hips like a swing|Pull the elbow high and back|Let the bell drop into the next swing',
    'Pulling with the arm before the hips have finished.',
  ],

  // --- core ----------------------------------------------------------------
  'plank': [
    'Forearms under your shoulders, feet hip width, body in one line.',
    'Squeeze your glutes|Tuck your ribs down toward your hips|Breathe without letting the hips drop',
    'Sagging at the hips, which loads the lower back instead of the abs.',
  ],
  'long-lever-plank': [
    'A plank with your elbows moved forward, further from your feet.',
    'Move the elbows out only as far as you can hold|Ribs down, glutes tight|Hold and breathe',
    'Reaching so far forward the lower back gives out immediately.',
  ],
  'side-plank': [
    'On one forearm, feet stacked or staggered, hips lifted.',
    'Stack your shoulder over your elbow|Push your hip to the ceiling|Hold without rotating',
    'Letting the top shoulder roll forward.',
  ],
  'dead-bug': [
    'On your back, arms up, knees over hips at 90 degrees.',
    'Press your lower back into the floor|Extend the opposite arm and leg|Return without letting the back arch',
    'The lower back lifting off the floor as the leg extends.',
  ],
  'bird-dog': [
    'On hands and knees, hands under shoulders, knees under hips.',
    'Extend the opposite arm and leg|Keep your hips level|Return under control',
    'Rotating the hips open toward the lifted leg.',
  ],
  'sit-up': [
    'On your back, knees bent, feet flat.',
    'Curl up one vertebra at a time|Reach past your knees|Lower with the same control',
    'Yanking on the back of your head with your hands.',
  ],
  'weighted-sit-up': [
    'A sit-up holding a plate or kettlebell at your chest.',
    'Hold the weight against your chest|Curl up smoothly|Lower slowly',
    'Using the weight for momentum on the way up.',
  ],
  'v-up': [
    'On your back, arms overhead, legs straight.',
    'Lift arms and legs together|Reach for your toes|Lower without touching down',
    'Bending the knees to make the fold easier.',
  ],
  'hollow-hold': [
    'On your back, lower back pressed flat, arms and legs extended.',
    'Press your lower back into the floor first|Lift shoulders and legs|Hold the shape and breathe',
    'Letting the lower back arch, which is the one thing the hold exists to prevent.',
  ],
  'hollow-rock': [
    'A hollow hold position, rocking from shoulders to hips.',
    'Set the hollow shape and lock it|Rock from the shoulders, not the hips|Keep the shape the whole time',
    'Breaking at the hips and pumping the legs instead of rocking as one piece.',
  ],
  'lying-leg-raise': [
    'On your back, hands under your hips or at your sides, legs straight.',
    'Press your lower back down|Lift your legs to vertical|Lower slowly without arching',
    'Letting the lower back peel off the floor at the bottom.',
  ],
  'hanging-knee-raise': [
    'Hang from a bar, shoulders active, legs together.',
    'Stop the swing first|Curl your knees toward your chest|Lower under control',
    'Swinging the knees up with momentum.',
  ],
  'hanging-leg-raise': [
    'Hang from a bar with straight legs.',
    'Keep the legs straight|Raise until your feet are at bar height if you can|Lower slowly',
    'Kipping into the raise, which trains nothing but the swing.',
  ],
  'toes-to-bar': [
    'Hang from a bar, shoulders engaged.',
    'Push down on the bar as you fold|Bring your toes to the bar|Control the return to a hollow',
    'Letting the return turn into an uncontrolled swing.',
  ],
  'l-sit': [
    'Hands on parallettes, blocks, or the floor, legs straight in front.',
    'Push the floor away and depress your shoulders|Lift your legs to horizontal|Hold and breathe',
    'Shrugging up instead of pushing down through the shoulders.',
  ],
  'ab-wheel': [
    'Kneeling, wheel under your shoulders.',
    'Tuck your ribs and squeeze your glutes|Roll out only as far as you can hold the position|Pull back with your abs',
    'Rolling further than you can control and arching the lower back.',
  ],
  'bicycle-crunch': [
    'On your back, hands light behind your head, knees up.',
    'Bring the opposite elbow and knee together|Extend the other leg long|Alternate slowly',
    'Racing through it and pulling on your neck.',
  ],
  'russian-twist': [
    'Seated, knees bent, torso leaning back to about 45 degrees.',
    'Hold the lean|Rotate your shoulders, not just your arms|Touch down each side',
    'Waving the hands side to side while the torso stays still.',
  ],
  'weighted-russian-twist': [
    'A Russian twist holding a plate, ball, or kettlebell.',
    'Keep the weight close to your chest|Rotate from the ribs|Control both directions',
    'Letting the weight swing and drag you around.',
  ],
  'mountain-climber': [
    'Push-up position, hands under shoulders.',
    'Hold a rigid plank|Drive one knee toward your chest|Alternate quickly without bouncing the hips',
    'Letting the hips rise into a pike as you speed up.',
  ],
  'pallof-press': [
    'Side on to a cable or band at chest height, hands at your sternum.',
    'Step out to load the band|Press your hands straight out|Resist the pull to rotate',
    'Letting the torso turn toward the anchor as you press.',
  ],
  'kb-windmill': [
    'Kettlebell locked out overhead, feet turned away from it.',
    'Keep your eyes on the bell|Push your hip out and hinge sideways|Stand back up without bending the arm',
    'Bending the supporting knee, which turns it into a side lunge.',
  ],
  // --- carry and grip ------------------------------------------------------
  'suitcase-carry': [
    'One weight in one hand, nothing in the other.',
    'Stand tall and do not lean away|Walk with even steps|Keep both shoulders level',
    'Leaning toward the free side to counterbalance. Let the obliques do it.',
  ],
  'front-rack-carry': [
    'One or two kettlebells racked at the shoulders.',
    'Ribs down, elbows down|Breathe shallow and walk|Keep your torso upright',
    'Letting the bells pull you into an arched back.',
  ],
  'overhead-carry': [
    'Weight locked out overhead, arm straight, shoulder packed.',
    'Lock the elbow and keep it locked|Ribs down|Walk with control, not speed',
    'Letting the arm drift behind your head and arching to hold it there.',
  ],
  'farmers-carry': [
    'A heavy weight in each hand, arms hanging.',
    'Stand tall, shoulders back|Take short, quick steps|Set them down before your grip fails',
    'Shuffling with long strides, which makes the load swing.',
  ],
  'db-farmers-carry': [
    'A dumbbell in each hand at your sides.',
    'Squeeze the handles hard|Walk tall with short steps|Put them down under control',
    'Letting the shoulders round forward under the load.',
  ],
  'sandbag-carry': [
    'Sandbag hugged to the chest or on one shoulder.',
    'Pull it tight into your body|Keep your chest up|Breathe as best you can',
    'Letting it sag away from your chest, which doubles the effort.',
  ],
  'bucket-carry': [
    'A loaded bucket in each hand or hugged in front.',
    'Expect the load to slosh and move|Brace and walk steady|Set down before you lose grip',
    'Rushing, which makes the contents swing and pull you around.',
  ],
  'bottoms-up-carry': [
    'Kettlebell upside down in the rack, handle crushed.',
    'Grip as hard as you can|Keep the bell vertical|Walk slowly and deliberately',
    'Going heavy. Balance fails long before strength does.',
  ],
  'sled-push': [
    'Hands high or low on the sled, arms straight, body leaning in.',
    'Lean into it with a straight line from heel to head|Drive with short, powerful steps|Keep the sled moving',
    'Standing too upright, which turns it into a shoving match.',
  ],
  'sled-pull': [
    'Strap or handles in hand, facing away or toward the sled.',
    'Set your feet and lean back|Pull with the legs, not the arms|Keep tension the whole way',
    'Jerking the sled into motion instead of pulling steadily.',
  ],
  'dead-hang': [
    'Hang from a bar, arms straight, feet off the floor.',
    'Let the shoulders relax up at first|Then pull them down and hold|Breathe',
    'Bailing at the first sign of discomfort. Grip endurance is the point.',
  ],
  'single-arm-hang': [
    'Hang from one arm, shoulder engaged, other hand free.',
    'Pull the working shoulder down and back|Resist the spin|Swap sides evenly',
    'Hanging entirely passively from a loose shoulder.',
  ],
  'towel-hang': [
    'A towel over the bar, one end in each hand.',
    'Crush the towel|Keep the shoulders active|Hold until the grip genuinely goes',
    'A towel so thick you cannot close your hand around it.',
  ],
  'plate-pinch': [
    'Two smooth plates pinched together between fingers and thumb.',
    'Pinch hard from the start|Stand tall and hold|Set them down, do not drop them on your feet',
    'Letting the plates rest on your fingers rather than being pinched.',
  ],
  'monkey-bars': [
    'Hang from the first rung, shoulders engaged.',
    'Build a small swing|Release and reach at the front of the swing|Keep moving, do not hang still',
    'Stopping between rungs, which burns the grip for nothing.',
  ],
  'rope-climb': [
    'Rope in both hands overhead, feet ready to clamp.',
    'Pull with the arms and trap the rope with your feet|Stand up on the foot lock|Reach and repeat',
    'Climbing arms-only, which drains the grip within a few metres.',
  ],

  // --- full body -----------------------------------------------------------
  'burpee': [
    'Standing, space to lie down in front of you.',
    'Drop your hands down and kick back|Chest to the floor|Jump the feet in and jump up',
    'Snaking up chest-first, which skips the push-up entirely.',
  ],
  'squat-thrust': [
    'Standing, hands ready to reach the floor.',
    'Hands down, feet back to a plank|Jump the feet back in|Stand up without a push-up',
    'Letting the hips pike up in the plank position.',
  ],
  'burpee-broad-jump': [
    'Standing, with clear space ahead of you.',
    'Complete the burpee|Instead of a vertical jump, jump forward|Land soft and go again',
    'Landing stiff on a long jump, rep after rep.',
  ],
  'burpee-pull-up': [
    'Standing under a pull-up bar.',
    'Burpee on the floor|Jump straight into the bar|Pull to chin over the bar',
    'Using so much jump that the pull-up disappears.',
  ],
  'bear-crawl': [
    'Hands and feet on the floor, knees an inch off the ground.',
    'Keep your knees low and hips level|Move the opposite hand and foot together|Do not let the hips sway',
    'Hips swinging side to side, which is what makes it look easy and feel useless.',
  ],
  'box-jump': [
    'Box at a height you can land on with confidence, feet hip width.',
    'Dip and swing your arms|Jump and land softly in a quarter squat|Step down, do not jump down',
    'Chasing height you cannot land cleanly. Shins meet boxes hard.',
  ],
  'broad-jump': [
    'Standing, clear space ahead, feet hip width.',
    'Dip and swing your arms back|Jump forward as far as you can|Land soft with bent knees',
    'Landing with straight legs, which sends the force into the knees.',
  ],
  'jump-rope': [
    'Rope handles at your hips, elbows close to your ribs.',
    'Turn the rope with your wrists, not your arms|Small bounces on the balls of your feet|Stay relaxed',
    'Jumping far too high and tiring out in thirty seconds.',
  ],
  'double-unders': [
    'Slightly longer rope, wrists relaxed, elbows in.',
    'Jump a little higher than a single|Turn the wrists faster, not the arms|Keep the rhythm even',
    'Piking the legs up to buy time instead of turning the rope faster.',
  ],
  'thruster': [
    'Bar in the front rack, feet shoulder width.',
    'Squat to full depth|Drive up and let the bar continue overhead|Finish with the bar over your ears',
    'Pausing between the squat and the press. It is one movement.',
  ],
  'kb-thruster': [
    'One or two kettlebells racked on the shoulders.',
    'Squat with the bells in the rack|Drive up and press overhead in one motion|Return to the rack, then squat again',
    'Letting the elbows drop out of the rack at the bottom.',
  ],
  'wall-ball': [
    'Ball at your chest, standing an arms length from the wall.',
    'Squat to depth with the ball at your chest|Drive up and throw at the target|Catch it and go straight down',
    'Throwing from a half squat to save energy.',
  ],
  'slam-ball': [
    'Ball at your feet, stance about hip width.',
    'Lift overhead with the hips|Slam down hard through your whole body|Pick it up and repeat',
    'Slamming with the arms only and leaving the hips out.',
  ],
  'battle-ropes': [
    'One rope end in each hand, knees soft, hips back slightly.',
    'Stay in an athletic stance|Drive the waves from your hips and shoulders|Keep the rhythm for the full interval',
    'Standing upright and flapping with the arms alone.',
  ],
  'man-maker': [
    'A dumbbell in each hand, standing.',
    'Burpee down onto the dumbbells|Row each side in the plank|Stand and press overhead',
    'Rushing the rows and rotating the hips with each pull.',
  ],
  'kb-complex': [
    'One or two kettlebells, chosen for the weakest movement in the chain.',
    'Move through the sequence without setting the bell down|Keep form on the last movement as good as the first|Rest only when the chain is done',
    'Loading for the swing, then failing the press.',
  ],
  'turkish-get-up': [
    'On your back, kettlebell locked out over one shoulder, same-side knee bent.',
    'Eyes on the bell the whole way up|Roll to your elbow, then your hand, then bridge|Sweep the leg through and stand',
    'Rushing. Every step should be a position you could hold.',
  ],
  'devils-press': [
    'A dumbbell in each hand, standing.',
    'Burpee down with the dumbbells|From the floor, swing them between your legs|Snatch both overhead in one motion',
    'Trying to curl the dumbbells up rather than swinging them.',
  ],

  // --- cardio --------------------------------------------------------------
  'easy-run': [
    'Flat or rolling ground, whatever shoes you run in.',
    'Run at a pace you could hold a conversation at|Keep your cadence quick and light|Finish feeling like you could go further',
    'Running easy days too hard, which is the most common training error there is.',
  ],
  'recovery-run': [
    'Flat ground, the day after something hard.',
    'Slower than easy, deliberately|Short and gentle|Stop before it becomes a workout',
    'Turning it into an easy run because you feel good.',
  ],
  'long-run': [
    'A route you can refuel and rehydrate on.',
    'Start slower than feels necessary|Hold an easy effort throughout|Eat and drink before you need to',
    'Going out at goal pace and walking the last few miles.',
  ],
  'tempo-run': [
    'Warm up first, then flat ground or a track.',
    'Settle into a comfortably hard effort|You should manage short sentences, not conversation|Hold it steady rather than surging',
    'Drifting into race effort, which turns a tempo into a hard workout you need days to recover from.',
  ],
  'race-pace-run': [
    'Warmed up, on terrain like your event.',
    'Lock into your goal pace early|Practise your fuelling and gear|Stop while it still feels controlled',
    'Racing the workout and arriving at the start line already tired.',
  ],
  'progression-run': [
    'A route you can pick up the pace on safely.',
    'Start easy for the first third|Lift to steady in the middle|Finish at tempo effort',
    'Starting too fast, leaving nothing to progress into.',
  ],
  'interval-run': [
    'Track, flat path, or a measured stretch of road.',
    'Warm up properly, this is the hard one|Hold the same pace across every rep|Jog or walk the recovery, do not stop dead',
    'Going out too hard on the first rep and fading through the set.',
  ],
  'sprint': [
    'Flat, even surface with plenty of run-off. Warm up thoroughly.',
    'Build over the first few strides|Run tall and relaxed at full speed|Decelerate gradually',
    'Sprinting cold. This is where hamstrings go.',
  ],
  'hill-repeats': [
    'A hill with a consistent gradient, warmed up.',
    'Run up at a hard but even effort|Drive your arms|Jog down easy as the recovery',
    'Attacking the first rep and jogging the rest.',
  ],
  'hill-sprint': [
    'A steep short hill, thoroughly warmed up.',
    'Maximum effort from the bottom|Stay tall, drive the knees|Walk all the way down to recover',
    'Cutting the recovery short, which makes them tempo reps instead of sprints.',
  ],
  'trail-run': [
    'Trail shoes, and more time than the same distance on road.',
    'Run by effort, not pace|Shorten your stride on climbs|Look a few steps ahead, not at your feet',
    'Chasing road pace on trail and rolling an ankle for it.',
  ],
  'treadmill-run': [
    'Belt at a 1 percent incline to approximate outdoor effort.',
    'Set the pace and let it hold you there|Run in the middle of the belt|Do not hold the rails',
    'Holding on, which changes the mechanics and flatters the effort.',
  ],
  'incline-walk': [
    'Treadmill at a steep incline, or a long hill.',
    'Walk without holding on|Let your heart rate do the work|Keep your posture upright',
    'Gripping the handrails, which removes most of the effort.',
  ],
  'walk': [
    'Anywhere.',
    'Walk at a purposeful pace|Stay relaxed|Use it as recovery, not training',
    'Nothing much. It is a walk.',
  ],
  'ruck': [
    'Weighted pack sitting high and tight on your back.',
    'Tighten the straps so it does not bounce|Walk tall, do not lean forward|Build weight and distance slowly',
    'Adding weight and distance in the same week.',
  ],
  'row-erg': [
    'Feet strapped, damper around 4 or 5, handle in both hands.',
    'Drive with the legs first|Then swing the back, then pull the arms|Reverse that order on the recovery',
    'Pulling with the arms first, which wastes most of the stroke.',
  ],
  'ski-erg': [
    'Handles overhead, feet planted about hip width.',
    'Pull down by hinging at the hips|Finish the pull past your hips|Rise and reach up again',
    'Pulling with the arms alone instead of hinging.',
  ],
  'bike-erg': [
    'Seat height set so your knee stays slightly bent at the bottom.',
    'Keep your cadence smooth|Sit still, do not rock|Work by effort or watts, not by how it looks',
    'A seat set too low, which grinds the knees over a long session.',
  ],
  'air-bike': [
    'Seat set so your legs almost straighten, hands on the moving handles.',
    'Push and pull with the arms as well as the legs|Settle into a rhythm you can hold|Expect it to hurt more than it looks',
    'Sprinting the first ten seconds of a long interval.',
  ],
  'stair-climb': [
    'A stairwell or a stepper machine.',
    'Whole foot on each step|Drive through the heel|Keep your posture tall',
    'Leaning hard on the rails on a machine.',
  ],
  'swim': [
    'Pool, goggles, and a plan for the set.',
    'Breathe on a regular rhythm|Reach long on each stroke|Kick from the hips, not the knees',
    'Swimming hard with poor technique, which just makes you tired.',
  ],
  'open-water-swim': [
    'Open water, a bright cap, and never alone.',
    'Sight forward every few strokes|Expect the cold to shorten your breath at first|Swim wide of other people',
    'Going out in conditions or temperature you have not built up to.',
  ],

  // --- mobility ------------------------------------------------------------
  'cat-cow': [
    'On hands and knees, hands under shoulders, knees under hips.',
    'Round your back and tuck your chin|Then arch and lift your chest|Move slowly with your breath',
    'Rushing through it. This is a slow movement.',
  ],
  'downward-dog': [
    'From hands and knees, tuck your toes and lift your hips.',
    'Push the floor away and lift the hips high|Let the heels reach toward the floor|Bend one knee at a time if the calves are tight',
    'Rounding the back to force the heels down.',
  ],
  'couch-stretch': [
    'Back foot up against a wall or couch, front foot planted, kneeling.',
    'Squeeze the glute of the back leg|Bring your torso upright slowly|Breathe and hold',
    'Arching the lower back to get more upright, which fakes the range.',
  ],
  'hip-flexor-stretch': [
    'Half-kneeling, back knee down, front foot flat.',
    'Tuck your pelvis under|Squeeze the back glute|Shift forward only after those two',
    'Lunging forward first, which stretches the knee rather than the hip.',
  ],
  'hamstring-stretch': [
    'Seated or standing, one leg extended, toes up.',
    'Hinge from the hips, not the spine|Keep the back flat|Hold where you feel a stretch, not pain',
    'Rounding the back to reach the toes.',
  ],
  'calf-stretch': [
    'Hands on a wall, one foot back, heel down.',
    'Keep the back heel planted|Lean in with a straight back leg|Then bend that knee to reach the lower calf',
    'Letting the back heel lift, which stretches nothing.',
  ],
  'pigeon-pose': [
    'Front shin angled across in front of you, back leg extended behind.',
    'Square your hips toward the floor|Support yourself on your hands or a block|Fold forward only as far as is comfortable',
    'Letting the hips twist open, which moves the stretch out of the glute.',
  ],
  'ninety-ninety': [
    'Seated with one leg bent 90 degrees in front, the other 90 degrees to the side.',
    'Sit tall over your hips|Rotate slowly to switch sides|Use your hands as needed',
    'Slumping backward, which closes the hips off.',
  ],
  'thoracic-rotation': [
    'Side lying or on hands and knees, one hand behind your head.',
    'Rotate from the upper back|Follow your elbow with your eyes|Keep the hips still',
    'Rotating from the lower back instead of the ribs.',
  ],
  'shoulder-dislocate': [
    'A band, strap, or broomstick held wide in both hands.',
    'Start much wider than feels necessary|Take it overhead and behind with straight arms|Narrow the grip only over weeks',
    'Gripping too narrow and forcing the shoulder through.',
  ],
  'ankle-mobilization': [
    'Half kneeling with the front foot flat, knee over the toes.',
    'Drive the knee forward over the toes|Keep the heel down|Hold, then rock back',
    'Letting the heel lift, which is the whole thing you are trying to change.',
  ],
  'foam-roll-quads': [
    'Face down with the roller under one thigh.',
    'Move slowly, an inch at a time|Pause where it is tender and breathe|Do not roll over the knee',
    'Rolling fast back and forth, which does very little.',
  ],
  'worlds-greatest-stretch': [
    'Deep lunge with the front foot flat and both hands on the floor inside it.',
    'Drop the back knee or keep it lifted|Rotate and reach one arm to the ceiling|Follow your hand with your eyes, then swap',
    'Rushing through it as a warm-up formality rather than reaching the end range.',
  ],
  'foam-roll-back': [
    'Roller across the upper back, hips off the floor or down.',
    'Stay above the lower ribs|Roll slowly and pause on tight spots|Support your head with your hands',
    'Rolling the lower back, which is not what the roller is for.',
  ],
};

/**
 * How to perform a movement, when the library has been written up for it. Custom exercises
 * and anything not yet covered simply return nothing, and the interface leaves the section out.
 */
export function coachingFor(slug: string): Coaching | undefined {
  const raw = RAW[slug];
  if (!raw) return undefined;
  return { setup: raw[0], cues: raw[1].split('|'), fault: raw[2] };
}

/** For the dev-time integrity check — which slugs have been written up. */
export const COACHED_SLUGS = new Set(Object.keys(RAW));

export { RAW as COACHING_RAW };
