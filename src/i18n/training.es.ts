/**
 * The training vocabulary in Spanish: muscles, kit, and movement patterns.
 *
 * Kept apart from `es.ts` because it is a different kind of thing. That file translates
 * sentences somebody wrote; this translates a closed vocabulary the app reasons about. The
 * English side of each entry is a stable key that appears in data rather than in a component,
 * so these change only when the domain gains a new term.
 *
 * Two conventions run through it:
 *
 * **Anatomy uses the words a lifter uses, not the words an anatomist does.** "Lats" is
 * "dorsales", not "músculo dorsal ancho". The catalogue mixes registers — it has both "lats"
 * and "latissimus dorsi" — and both land on the common name here, because the person reading
 * it is deciding what to train, not sitting an exam.
 *
 * **Kit keeps the name it is sold under.** A kettlebell is a kettlebell in a Spanish gym, and
 * "pesa rusa" is correct, older, and less likely to be what somebody is looking for. Where
 * both are current the common one wins.
 */

/**
 * Muscles, as the catalogue and the curated library name them.
 *
 * Seventy-six entries because the two sources disagree about register and both are kept: a
 * movement enriched from the catalogue says "pectorals" where an authored one says "chest".
 * Mapping them to one Spanish word each is the point.
 */
export const MUSCLES_ES: Record<string, string> = {
  abdominals: 'abdominales',
  abductors: 'abductores',
  abs: 'abdominales',
  adductors: 'aductores',
  'ankle stabilizers': 'estabilizadores del tobillo',
  ankles: 'tobillos',
  back: 'espalda',
  biceps: 'bíceps',
  brachialis: 'braquial',
  calves: 'pantorrillas',
  'cardiovascular system': 'sistema cardiovascular',
  chest: 'pecho',
  core: 'core',
  'deep cervical flexors': 'flexores cervicales profundos',
  deltoids: 'deltoides',
  delts: 'deltoides',
  'extensor digitorum longus': 'extensor largo de los dedos',
  'extensor hallucis longus': 'extensor largo del dedo gordo',
  feet: 'pies',
  'flexor digitorum longus': 'flexor largo de los dedos',
  'flexor hallucis longus': 'flexor largo del dedo gordo',
  forearms: 'antebrazos',
  gastrocnemius: 'gemelos',
  'gemellus superior/inferior': 'gémino superior e inferior',
  glutes: 'glúteos',
  'gluteus medius': 'glúteo medio',
  'gluteus medius (posterior fibers)': 'glúteo medio (fibras posteriores)',
  'gluteus minimus': 'glúteo menor',
  'grip muscles': 'músculos del agarre',
  groin: 'ingle',
  hamstrings: 'isquiotibiales',
  hands: 'manos',
  'hip flexors': 'flexores de la cadera',
  'inner thighs': 'cara interna del muslo',
  'latissimus dorsi': 'dorsales',
  lats: 'dorsales',
  'levator scapulae': 'elevador de la escápula',
  'longus capitis': 'largo de la cabeza',
  'longus colli': 'largo del cuello',
  'lower abs': 'abdominales inferiores',
  'lower back': 'zona lumbar',
  obliques: 'oblicuos',
  'obturator internus': 'obturador interno',
  'obturator internus/externus': 'obturador interno y externo',
  pectorals: 'pectorales',
  'peroneus brevis': 'peroneo corto',
  'peroneus longus': 'peroneo largo',
  'peroneus tertius': 'peroneo anterior',
  piriformis: 'piramidal',
  quadriceps: 'cuádriceps',
  quads: 'cuádriceps',
  'rear deltoids': 'deltoides posterior',
  rhomboids: 'romboides',
  'rotator cuff': 'manguito rotador',
  scalenes: 'escalenos',
  'semispinalis capitis': 'semiespinoso de la cabeza',
  'serratus anterior': 'serrato anterior',
  shins: 'espinillas',
  shoulders: 'hombros',
  soleus: 'sóleo',
  spine: 'columna',
  'splenius capitis': 'esplenio de la cabeza',
  'splenius cervicis': 'esplenio del cuello',
  sternocleidomastoid: 'esternocleidomastoideo',
  suboccipitals: 'suboccipitales',
  'tibialis anterior': 'tibial anterior',
  'tibialis posterior': 'tibial posterior',
  trapezius: 'trapecio',
  traps: 'trapecio',
  triceps: 'tríceps',
  'upper back': 'espalda alta',
  'upper chest': 'pecho superior',
  'upper trapezius': 'trapecio superior',
  'wrist extensors': 'extensores de la muñeca',
  'wrist flexors': 'flexores de la muñeca',
  wrists: 'muñecas',
};

/** The built-in kit, keyed on the English label rather than the tag. */
export const EQUIPMENT_ES: Record<string, string> = {
  Bodyweight: 'Peso corporal',
  'Floor space': 'Espacio en el suelo',
  'A wall': 'Una pared',
  Stairs: 'Escaleras',
  Barbell: 'Barra',
  Plates: 'Discos',
  'Squat rack': 'Rack de sentadillas',
  Bench: 'Banco',
  Dumbbells: 'Mancuernas',
  Kettlebells: 'Kettlebells',
  'Trap bar': 'Barra hexagonal',
  'Pull-up bar': 'Barra de dominadas',
  'Dip bars': 'Barras de fondos',
  'Gymnastic rings': 'Anillas',
  'Suspension trainer': 'Entrenador de suspensión',
  'Climbing rope': 'Cuerda de trepar',
  'Cable machine': 'Máquina de poleas',
  'Lat pulldown': 'Jalón al pecho',
  'Leg press': 'Prensa de piernas',
  'Leg curl': 'Curl femoral',
  'Leg extension': 'Extensión de piernas',
  'Chest press': 'Press de pecho',
  'Row machine': 'Máquina de remo',
  'Smith machine': 'Máquina Smith',
  Hyperextension: 'Banco de hiperextensiones',
  'Glute-ham raise': 'Banco de femorales',
  'Weight machine': 'Máquina de pesas',
  Elliptical: 'Elíptica',
  Rower: 'Remoergómetro',
  SkiErg: 'SkiErg',
  'Bike erg': 'Bicicleta estática',
  'Air bike': 'Air bike',
  Treadmill: 'Cinta de correr',
  Sled: 'Trineo',
  'Jump rope': 'Cuerda de saltar',
  Rebounder: 'Cama elástica',
  Box: 'Cajón',
  'Medicine ball': 'Balón medicinal',
  'Slam ball': 'Balón de golpeo',
  'Wall ball': 'Balón de pared',
  Sandbag: 'Saco de arena',
  'Battle ropes': 'Cuerdas de batalla',
  'Resistance band': 'Banda elástica',
  'Mini band': 'Mini banda',
  'Ab wheel': 'Rueda abdominal',
  'Grip trainer': 'Entrenador de agarre',
  'Weight vest': 'Chaleco lastrado',
  'Stability ball': 'Fitball',
  'Bosu ball': 'Bosu',
  'Foam roller': 'Rodillo de espuma',
  Tire: 'Neumático',
  Sledgehammer: 'Mazo',
  Road: 'Asfalto',
  Trail: 'Sendero',
  Track: 'Pista',
  Hill: 'Cuesta',
  Pool: 'Piscina',
  'Open water': 'Aguas abiertas',
};

/**
 * Movement patterns, which name what the body is doing.
 *
 * Shown as filters and as the heading a movement files under. Kept literal rather than
 * idiomatic: "empuje horizontal" is what a Spanish-speaking coach writes, and it is the same
 * split the English makes.
 */
export const PATTERNS_ES: Record<string, string> = {
  squat: 'sentadilla',
  hinge: 'bisagra de cadera',
  lunge: 'zancada',
  pushHorizontal: 'empuje horizontal',
  pushVertical: 'empuje vertical',
  pullHorizontal: 'tracción horizontal',
  pullVertical: 'tracción vertical',
  core: 'core',
  carry: 'acarreo',
  gait: 'locomoción',
  fullBody: 'cuerpo completo',
};

/** What a movement is measured in. */
export const MODALITIES_ES: Record<string, string> = {
  strength: 'fuerza',
  cardio: 'cardio',
  mobility: 'movilidad',
};
