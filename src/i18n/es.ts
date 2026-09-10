/**
 * Spanish, keyed on the English it replaces.
 *
 * Neutral Latin American rather than Castilian, matching the run voice in `domain/lang`.
 * Nothing here is region-specific enough to be wrong in Spain; the choice shows up in the
 * speech tag, not in the words.
 *
 * Ordered by where the text appears rather than alphabetically, because translating a screen
 * means reading its strings together — "Start" and "Continue" are the same button in two
 * states, and a list sorted by first letter puts them nowhere near each other.
 *
 * A key with no entry falls back to its English, so this file is always safe to be behind.
 * `npm run copy:check` reports which keys the source asks for and this does not answer, and
 * which entries here no longer match anything.
 */

export const ES: Record<string, string> = {
  // --- shared, across screens ------------------------------------------------
  Today: 'Hoy',
  Yesterday: 'Ayer',
  Start: 'Comenzar',
  Continue: 'Continuar',
  min: 'min',
  load: 'carga',
  'In progress': 'En curso',

  // --- today -----------------------------------------------------------------
  'This week': 'Esta semana',
  'Tap for the week': 'Toca para ver la semana',
  "Show this week's workouts": 'Ver los entrenamientos de esta semana',
  'Planned for today': 'Planeado para hoy',
  "Today's sessions": 'Sesiones de hoy',
  'Nothing logged today.': 'Nada registrado hoy.',
  'Training as': 'Entrenando como',
  'no equipment set': 'sin equipo definido',
  'Start a workout': 'Comenzar un entrenamiento',
  'Start a separate workout': 'Comenzar otro entrenamiento',
  'Log a run': 'Registrar una carrera',

  // --- the run screen --------------------------------------------------------
  'Run alerts': 'Avisos de carrera',
  Close: 'Cerrar',
  'Start run': 'Comenzar carrera',
  Pause: 'Pausar',
  Resume: 'Reanudar',
  Finish: 'Terminar',
  Discard: 'Descartar',
  'Save to workout': 'Guardar en el entrenamiento',
  'to go': 'restante',
  // Lower case: these sit under the big numbers as labels, not as headings.
  distance: 'distancia',
  time: 'tiempo',
  average: 'promedio',
  stopped: 'detenido',
  'per mile': 'por milla',
  'per kilometre': 'por kilómetro',
  'Cues will appear here as they are said.': 'Los avisos aparecerán aquí a medida que se digan.',
  'Waiting for a decent fix. Under trees or between tall buildings this can take a minute.':
    'Esperando una señal decente. Bajo árboles o entre edificios altos esto puede tardar un minuto.',

  // Session names, which are written into the record and then read back for years. Kept in
  // step with `defaultSessionName`.
  'Morning session': 'Sesión de la mañana',
  'Midday session': 'Sesión del mediodía',
  'Evening session': 'Sesión de la tarde',
  'Late session': 'Sesión nocturna',
};
