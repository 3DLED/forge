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
 *
 * Training vocabulary is the part worth arguing about. Where a Spanish-speaking lifter would
 * reach for the English word — AMRAP, EMOM, kettlebell — it stays in English, because
 * translating it would be more faithful and less useful.
 */

export const ES: Record<string, string> = {
  // --- shared, across screens ------------------------------------------------
  Today: 'Hoy',
  Yesterday: 'Ayer',
  Tomorrow: 'Mañana',
  Start: 'Comenzar',
  Continue: 'Continuar',
  Back: 'Atrás',
  Save: 'Guardar',
  Cancel: 'Cancelar',
  Done: 'Listo',
  Delete: 'Eliminar',
  Edit: 'Editar',
  Add: 'Añadir',
  Remove: 'Quitar',
  Rename: 'Renombrar',
  Close: 'Cerrar',
  Clear: 'Limpiar',
  Dismiss: 'Descartar',
  Use: 'Usar',
  Move: 'Mover',
  Name: 'Nombre',
  Reps: 'Repeticiones',
  Seconds: 'Segundos',
  Rest: 'Descanso',
  When: 'Cuándo',
  From: 'Desde',
  Until: 'Hasta',
  Reason: 'Motivo',
  Notes: 'Notas',
  Note: 'Nota',
  Time: 'Tiempo',
  Duration: 'Duración',
  Effort: 'Esfuerzo',
  Goal: 'Objetivo',
  Session: 'Sesión',
  Round: 'Ronda',
  Rounds: 'Rondas',
  Interval: 'Intervalo',
  Current: 'Actual',
  Active: 'Activo',
  Logged: 'Registrado',
  Planned: 'Planeado',
  Skip: 'Omitir',
  Skipped: 'Omitido',
  Reset: 'Reiniciar',
  Sound: 'Sonido',
  Swap: 'Cambiar',
  Using: 'Usando',
  Yours: 'Tuyos',
  Off: 'Apagado',
  On: 'Encendido',
  min: 'min',
  load: 'carga',
  'In progress': 'En curso',
  'Load more': 'Cargar más',
  'Not set': 'Sin definir',
  planned: 'planeado',
  Saved: 'Guardado',

  // --- the rows under More, which say what each screen currently holds ---------
  'Pounds and miles': 'Libras y millas',
  'Kilograms and kilometres': 'Kilogramos y kilómetros',
  'try the other directions': 'prueba las otras direcciones',
  'add your own': 'añade los tuyos',
  'of them yours': 'de ellos tuyos',
  'of your own — build, share, import': 'propios — crea, comparte, importa',
  'share, import, tidy up': 'comparte, importa, ordena',
  'due a retest': 'pendientes de volver a probar',
  resting: 'en reposo',
  'the load in every push-up': 'la carga en cada flexión',
  'Build your own week, or open a plan someone sent':
    'Crea tu propia semana, o abre un plan que te hayan enviado',
  'Workouts you have named come back here':
    'Los entrenamientos a los que pusiste nombre vuelven aquí',
  'Measure a max, and program from a number instead of a guess':
    'Mide un máximo, y programa desde un número en vez de una suposición',
  'Log something that hurts and the sessions that load it step aside':
    'Registra algo que duela y las sesiones que lo carguen se apartan',
  'Not set — bodyweight sets count as no work without it':
    'Sin definir — las series con peso corporal cuentan como cero trabajo sin esto',
  'Everything lives in this browser on this device. Nothing is uploaded, and no account exists — which also means a cleared browser takes your history with it. Export regularly and keep the file somewhere that syncs.':
    'Todo vive en este navegador en este dispositivo. Nada se sube, y no existe ninguna cuenta — lo que también significa que borrar el navegador se lleva tu historial. Exporta con regularidad y guarda el archivo en algún sitio que se sincronice.',

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

  // Session names, which are written into the record and then read back for years. Kept in
  // step with `defaultSessionName`.
  'Morning session': 'Sesión de la mañana',
  'Midday session': 'Sesión del mediodía',
  'Evening session': 'Sesión de la tarde',
  'Late session': 'Sesión nocturna',

  // --- the run screen --------------------------------------------------------
  'Run alerts': 'Avisos de carrera',
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

  // --- run settings ----------------------------------------------------------
  Voice: 'Voz',
  Splits: 'Parciales',
  Silent: 'Silencioso',
  'Speak cues': 'Decir avisos en voz alta',
  'Pace alerts': 'Avisos de ritmo',
  'Each rep': 'Cada repetición',
  'Jog between': 'Trotar entre',
  'Say something once I am off by': 'Avisarme cuando me desvíe',
  'Minutes and seconds, like 8:30': 'Minutos y segundos, como 8:30',
  'Nothing spoken': 'Nada hablado',
  'pace alerts': 'avisos de ritmo',
  // The split intervals, whose English labels are the keys in `domain/pace`.
  'Every quarter mile': 'Cada cuarto de milla',
  'Every half mile': 'Cada media milla',
  'Every mile': 'Cada milla',
  'Every half kilometre': 'Cada medio kilómetro',
  'Every kilometre': 'Cada kilómetro',
  ', with the pace for that piece alone and how it compares to your target. Distance rather than a timer, so standing at a crossing does not count.':
    ', con el ritmo de ese tramo por sí solo y cómo se compara con tu objetivo. Distancia en vez de cronómetro, así que esperar en un cruce no cuenta.',

  // --- logging a session -----------------------------------------------------
  'Add a movement, or start an AMRAP or EMOM block.':
    'Añade un movimiento, o comienza un bloque AMRAP o EMOM.',
  'Anything worth remembering next time…': 'Algo que valga la pena recordar la próxima vez…',
  'Felt flat, humid, new shoes…': 'Me sentí pesado, húmedo, zapatos nuevos…',
  'Back to today': 'Volver a hoy',
  'Cindy, Tuesday burner…': 'Cindy, quemador del martes…',
  'Discard session': 'Descartar sesión',
  'Discard this session?': '¿Descartar esta sesión?',
  'Duration in minutes': 'Duración en minutos',
  'Each round': 'Cada ronda',
  'Edit timed workout': 'Editar entrenamiento por tiempo',
  'Editing a finished workout. Changes save as you make them.':
    'Editando un entrenamiento terminado. Los cambios se guardan al hacerlos.',
  'How did it feel?': '¿Cómo se sintió?',
  'Name it': 'Ponle nombre',
  'Name this workout': 'Nombra este entrenamiento',
  'Save this workout': 'Guardar este entrenamiento',
  'Session name': 'Nombre de la sesión',
  'That session is gone.': 'Esa sesión ya no existe.',
  'Ungroup block': 'Desagrupar bloque',
  'Worth doing before you save': 'Vale la pena hacerlo antes de guardar',
  'Open the full timer': 'Abrir el cronómetro completo',
  'Record a completed round': 'Registrar una ronda completada',
  'Undo round': 'Deshacer ronda',
  'Time this hold': 'Cronometrar este sostenido',

  // --- picking a movement ----------------------------------------------------
  All: 'Todos',
  Common: 'Comunes',
  'Add exercise': 'Añadir ejercicio',
  'Add anyway': 'Añadir de todos modos',
  'Everything else': 'Todo lo demás',
  'You train these': 'Ya entrenas estos',
  'Search movements, muscles, patterns…': 'Buscar movimientos, músculos, patrones…',
  'Swap for another version': 'Cambiar por otra versión',
  'Swap for an easier or harder version': 'Cambiar por una versión más fácil o más difícil',

  // --- what a movement is ----------------------------------------------------
  'How to do it': 'Cómo hacerlo',
  'Set up': 'Preparación',
  Needs: 'Necesita',
  Trains: 'Trabaja',
  also: 'también',
  'Watch for': 'Cuidado con',
  'Shown with a dumbbell': 'Se muestra con una mancuerna',
  'Shown with a resistance band': 'Se muestra con una banda elástica',
  'if your equipment changes.': 'si cambia tu equipo.',

  // --- suggesting a workout --------------------------------------------------
  Train: 'Entrenar',
  'Full body': 'Cuerpo completo',
  'Suggest a workout': 'Sugerir un entrenamiento',
  'Drop this movement': 'Quitar este movimiento',
  'Nothing available for that combination.': 'No hay nada disponible para esa combinación.',
  'Try another region, or add equipment for this session.':
    'Prueba otra zona, o añade equipo para esta sesión.',
  'Your saved sessions': 'Tus sesiones guardadas',
  'Your saved workouts': 'Tus entrenamientos guardados',
  'Your saved timed workouts': 'Tus entrenamientos por tiempo guardados',
  'Or build a new one': 'O crea uno nuevo',
  'Nothing saved yet.': 'Nada guardado aún.',
  'Run it again': 'Hacerlo de nuevo',
  'Straight sets': 'Series directas',
  Timed: 'Por tiempo',

  // --- equipment for one session ---------------------------------------------
  'Equipment for this workout': 'Equipo para este entrenamiento',
  'Nothing but bodyweight': 'Solo peso corporal',
  'Start from a profile': 'Partir de un perfil',
  'Use for this workout': 'Usar para este entrenamiento',
  'Use my default': 'Usar mi predeterminado',

  // --- testing a movement ----------------------------------------------------
  'Lay out the test': 'Prepara la prueba',
  'How many did you get?': '¿Cuántas lograste?',
  'What can you do for three?': '¿Cuánto puedes hacer para tres?',
  'Reps completed': 'Repeticiones completadas',
  'Recently tested': 'Probado recientemente',
  'Record it': 'Registrarlo',
  'Use it': 'Usarlo',
  'Use a different weight': 'Usar otro peso',
  'No attempt was completed, so there is nothing to record. Nothing is saved.':
    'No se completó ningún intento, así que no hay nada que registrar. No se guarda nada.',
  Due: 'Pendiente',
  Tests: 'Pruebas',
  'Just tested': 'Recién probado',
  'Test a movement': 'Probar un movimiento',
  'Test it again': 'Probarlo de nuevo',
  'Nothing measured yet.': 'Aún no hay mediciones.',
  'Remove this result': 'Quitar este resultado',
  'Remove this result?': '¿Quitar este resultado?',
  'Enter a max I already know': 'Introducir un máximo que ya conozco',

  // --- a max you already know ------------------------------------------------
  'The lift': 'El levantamiento',
  'Your best set': 'Tu mejor serie',
  'Your best hold': 'Tu mejor sostenido',
  'Works out at': 'Equivale a',
  'A single, a triple, whatever you know it as. One rep means you are giving a true max.':
    'Una repetición, una triple, como lo conozcas. Una repetición significa que estás dando un máximo real.',
  'The longest you can hold the position before it breaks down.':
    'Lo máximo que puedes mantener la posición antes de que se rompa.',

  // --- more, and the things under it -----------------------------------------
  More: 'Más',
  Plans: 'Planes',
  Settings: 'Ajustes',
  Appearance: 'Apariencia',
  Equipment: 'Equipo',
  Movements: 'Movimientos',
  // The library's own categories, whose English labels are keys in domain/categories.
  Weights: 'Pesas',
  Calisthenics: 'Calistenia',
  Cardio: 'Cardio',
  Skill: 'Técnica',
  Mobility: 'Movilidad',
  // Difficulty bands and body regions, same arrangement: English key, Spanish shown.
  Beginner: 'Principiante',
  Intermediate: 'Intermedio',
  Advanced: 'Avanzado',
  'Upper body': 'Tren superior',
  'Lower body': 'Tren inferior',
  Core: 'Core',
  Conditioning: 'Acondicionamiento',
  Injuries: 'Lesiones',
  'Saved workouts': 'Entrenamientos guardados',
  'Your data': 'Tus datos',
  'Export backup': 'Exportar copia de seguridad',
  'Could not save the file.': 'No se pudo guardar el archivo.',

  'Left open. Open it to finish or discard it.':
    'Quedó abierta. Ábrela para terminarla o descartarla.',

  // --- apple health -------------------------------------------------------------
  'Apple Health': 'Apple Salud',
  'Not connected': 'Sin conectar',
  'Heart rate from your watch': 'Frecuencia cardíaca de tu reloj',
  'Heart rate': 'Frecuencia cardíaca',
  'Read from Health': 'Leer de Salud',
  'Leave it alone': 'No usarlo',
  'Catch up': 'Ponerse al día',
  'Check for new workouts': 'Buscar entrenamientos nuevos',
  'Checking…': 'Comprobando…',
  'matched to a workout on your watch.': 'emparejadas con un entrenamiento de tu reloj.',
  'Nothing new lined up. A workout has to have been recorded on the watch at the same time.':
    'No ha cuadrado nada nuevo. El reloj tiene que haber grabado un entrenamiento a la vez.',
  'Apple Health needs the installed app on an iPhone. A browser cannot reach it.':
    'Apple Salud necesita la app instalada en un iPhone. Un navegador no puede acceder.',
  'This device has no Health store to read from.':
    'Este dispositivo no tiene un almacén de Salud del que leer.',
  'Forge matches each session you log against the workouts your watch recorded, and takes the average and peak heart rate from whichever one covers the same stretch of time. It reads only, and writes nothing back to Health.':
    'Forge compara cada sesión que registras con los entrenamientos que grabó tu reloj, y toma la frecuencia cardíaca media y máxima del que cubre el mismo tramo de tiempo. Solo lee: no escribe nada en Salud.',
  'A watch usually syncs a few minutes after you finish, so a session logged just now often has no heart rate yet. This looks again over the last fortnight and fills in what it finds.':
    'Un reloj suele sincronizarse unos minutos después de terminar, así que una sesión recién registrada a menudo aún no tiene frecuencia cardíaca. Esto vuelve a mirar las dos últimas semanas y rellena lo que encuentra.',
  'Running heart rate': 'Frecuencia cardíaca corriendo',
  'Workout heart rate': 'Frecuencia cardíaca entrenando',
  bpm: 'ppm',

  // --- reminders ---------------------------------------------------------------
  Reminders: 'Avisos',
  'Planned sessions': 'Sesiones planificadas',
  'Planned sessions at': 'Sesiones planificadas a las',
  'rest timer': 'temporizador de descanso',
  Nothing: 'Nada',
  At: 'A las',
  'Remind me': 'Avisarme',
  'No reminder': 'Sin aviso',
  'Rest timer': 'Temporizador de descanso',
  'Tell me': 'Avisarme',
  'Stay quiet': 'En silencio',
  'One notification on the morning of any day with something planned, naming the session. Days you have already finished or skipped say nothing.':
    'Un aviso por la mañana en cualquier día que tenga algo planificado, con el nombre de la sesión. Los días que ya has completado u omitido no dicen nada.',
  'Early enough to change the shape of the day, rather than to tell you what you have already missed.':
    'Lo bastante temprano como para cambiar la forma del día, en vez de contarte lo que ya te has perdido.',
  'The beep needs the screen awake and the app in front of you, which between sets it usually is not. This is the same cue, delivered by the phone instead.':
    'El pitido necesita la pantalla encendida y la app delante de ti, cosa que entre series casi nunca pasa. Este es el mismo aviso, pero lo da el teléfono.',
  'Reminders need the installed app. A browser can only notify you while it is open, which is the one time you do not need telling.':
    'Los avisos necesitan la app instalada. Un navegador solo puede avisarte mientras está abierto, que es justo cuando no hace falta.',
  'Notifications are switched off for Hybrid Forge. Turn them back on in your phone settings and these will start working.':
    'Las notificaciones están desactivadas para Hybrid Forge. Vuelve a activarlas en los ajustes del teléfono y esto empezará a funcionar.',
  'Training today': 'Entrenamiento hoy',
  'Something is planned for today.': 'Hay algo planificado para hoy.',
  'Rest done': 'Descanso terminado',
  'Up next': 'A continuación',
  'Back to it.': 'De vuelta al trabajo.',

  // --- when something threw ---------------------------------------------------
  'Hybrid Forge hit a problem': 'Hybrid Forge ha tenido un problema',
  'This screen hit a problem': 'Esta pantalla ha tenido un problema',
  'Your training data is safe — this is a display problem, and nothing was deleted.':
    'Tus datos de entrenamiento están a salvo: es un problema de visualización y no se ha borrado nada.',
  'Reload the app': 'Recargar la aplicación',
  'Try this screen again': 'Reintentar esta pantalla',
  'Show details': 'Ver detalles',
  'Hide details': 'Ocultar detalles',
  'Saving…': 'Guardando…',
  'Restore backup': 'Restaurar copia de seguridad',
  'Restore from backup': 'Restaurar desde copia de seguridad',
  Restoring: 'Restaurando',
  'Merge (recommended)': 'Combinar (recomendado)',
  'Replace everything': 'Reemplazar todo',
  'Erase all data': 'Borrar todos los datos',
  'Start over': 'Empezar de nuevo',
  // The font-size sample. It is letterforms, not a word.
  Aa: 'Aa',

  // --- settings --------------------------------------------------------------
  Language: 'Idioma',
  Units: 'Unidades',
  'Training for': 'Entrenando para',
  'Training max': 'Máximo de entrenamiento',
  'Week starts on': 'La semana empieza el',
  'Weekly availability': 'Disponibilidad semanal',
  'Effort per set': 'Esfuerzo por serie',
  'Every set': 'Cada serie',
  'Once per session': 'Una vez por sesión',
  'See what would move': 'Ver qué cambiaría',
  'Fit the plan to your week': 'Ajustar el plan a tu semana',
  'Leave the plan alone': 'Dejar el plan como está',

  // --- bodyweight ------------------------------------------------------------
  Bodyweight: 'Peso corporal',
  Trend: 'Tendencia',
  'Log today': 'Registrar hoy',
  'No weigh-ins yet.': 'Aún no hay pesajes.',
  'Delete this weigh-in?': '¿Eliminar este pesaje?',
  'Once a week is plenty. Daily readings mostly measure lunch.':
    'Una vez por semana es suficiente. Las lecturas diarias miden sobre todo el almuerzo.',

  // --- equipment -------------------------------------------------------------
  Profiles: 'Perfiles',
  'Add a piece of kit': 'Añadir un equipo',
  'New equipment profile': 'Nuevo perfil de equipo',
  'Equipment name': 'Nombre del equipo',
  'Save kit': 'Guardar equipo',
  'What is it': 'Qué es',
  'Where it belongs': 'Dónde va',
  'Rebounder, macebell, sledgehammer…': 'Cama elástica, macebell, mazo…',
  'Biggest gaps': 'Mayores carencias',
  'What one more piece of kit would unlock, on top of this profile.':
    'Lo que desbloquearía un equipo más, además de este perfil.',
  Barbell: 'Barra',
  'The bar': 'La barra',
  'Plates, in pairs': 'Discos, en pares',
  'Weights you own': 'Pesos que tienes',

  // --- editing a movement ----------------------------------------------------
  'Movement name': 'Nombre del movimiento',
  'Bulgarian bag spin': 'Giro con bolsa búlgara',
  'How it moves': 'Cómo se mueve',
  'How hard': 'Qué tan difícil',
  'Files as': 'Se clasifica como',
  'What it needs': 'Qué necesita',
  'What it records': 'Qué registra',
  'What it trains': 'Qué trabaja',
  'Muscles trained': 'Músculos trabajados',
  'shoulders, core': 'hombros, core',
  'Where you and the kit start. Optional.': 'Dónde empiezan tú y el equipo. Opcional.',
  'The one thing that usually goes wrong. Optional.': 'Lo que suele salir mal. Opcional.',
  'Everything selected has to be in an equipment profile for this to be offered there.':
    'Todo lo seleccionado debe estar en un perfil de equipo para que esto se ofrezca ahí.',
  'Built in': 'Incluidos',
  'Search movements': 'Buscar movimientos',
  'Add a movement': 'Añadir un movimiento',

  // --- injuries --------------------------------------------------------------
  'Log an injury': 'Registrar una lesión',
  'What hurts': 'Qué duele',
  'What hurts, in your words': 'Qué duele, en tus palabras',
  'Left shoulder': 'Hombro izquierdo',
  'How bad': 'Qué tan grave',
  'How it happened': 'Cómo ocurrió',
  'Optional — third set of overhead press': 'Opcional — tercera serie de press militar',
  'Rest until': 'Descansar hasta',
  Healed: 'Sanado',
  'Healed already?': '¿Ya está sanado?',
  'Mark it healed': 'Marcar como sanado',
  'Nothing logged.': 'Nada registrado.',
  'Remove from the log': 'Quitar del registro',
  'Remove this from the log?': '¿Quitar esto del registro?',

  // --- importing -------------------------------------------------------------
  'Choose a file': 'Elegir un archivo',
  'What is in it': 'Qué contiene',
  'Plan start date': 'Fecha de inicio del plan',
  'Start it on': 'Comenzarlo el',
  'They will be added so this works. Anything you already have is left alone.':
    'Se añadirán para que esto funcione. Lo que ya tienes se queda igual.',

  // --- the plan --------------------------------------------------------------
  Plan: 'Plan',
  Dates: 'Fechas',
  Started: 'Comenzó',
  Ends: 'Termina',
  'Keeping up': 'Al día',
  'End plan': 'Terminar plan',
  'End this plan': 'Terminar este plan',
  'Built by you': 'Creados por ti',
  'Currently active': 'Activo ahora',
  'Yours, not running': 'Tuyos, sin ejecutar',
  'No plans of your own yet.': 'Aún no tienes planes propios.',
  'Next month': 'Mes siguiente',
  'Previous month': 'Mes anterior',
  'Swipe the calendar to change month.': 'Desliza el calendario para cambiar de mes.',
  'Or tap any day to add a single session.': 'O toca cualquier día para añadir una sola sesión.',

  // --- applying a plan -------------------------------------------------------
  "What you'll get": 'Lo que obtendrás',
  'Start date': 'Fecha de inicio',
  'Race date': 'Fecha de la carrera',
  'Race day': 'Día de la carrera',
  'Testing days': 'Días de prueba',
  'How many weeks to lay down': 'Cuántas semanas establecer',
  'Already planned': 'Ya planeado',
  "Couldn't be scheduled": 'No se pudo programar',
  'Swapped for your equipment': 'Cambiado por tu equipo',
  'No substitute': 'Sin sustituto',
  'Heads up': 'Atención',
  'Optional. Without it the plan is generated exactly as written.':
    'Opcional. Sin ella el plan se genera exactamente como está escrito.',
  'This plan has no end. Lay down a stretch now and extend it whenever you like.':
    'Este plan no tiene fin. Establece un tramo ahora y extiéndelo cuando quieras.',

  // --- one day in the plan ---------------------------------------------------
  'Add a session': 'Añadir una sesión',
  'From the library': 'De la biblioteca',
  'Search workouts…': 'Buscar entrenamientos…',
  'Move to date': 'Mover a la fecha',
  'Rest day': 'Día de descanso',
  'Block this day out': 'Bloquear este día',
  'Un-skip': 'Deshacer omisión',
  'Nothing scheduled or logged on this day.': 'Nada programado ni registrado este día.',

  // --- blocking out a stretch ------------------------------------------------
  'Last day to block': 'Último día a bloquear',
  'Reason (optional)': 'Motivo (opcional)',
  'Travel, rest, work…': 'Viaje, descanso, trabajo…',
  'Nothing new gets scheduled in a blocked stretch, and applying a plan routes around it.':
    'No se programa nada nuevo en un tramo bloqueado, y aplicar un plan lo rodea.',

  // --- building a plan -------------------------------------------------------
  'Plan name': 'Nombre del plan',
  'Winter base': 'Base de invierno',
  'What it is for': 'Para qué es',
  'How long': 'Cuánto tiempo',
  'For about': 'Durante unos',
  'Your week': 'Tu semana',
  'Search sessions': 'Buscar sesiones',
  'Decide on the day': 'Decidir el mismo día',
  'Filled in when the day arrives, from your kit and what you have been training.':
    'Se completa cuando llega el día, con tu equipo y lo que has estado entrenando.',
  'This repeats. The weights climb from what you actually lift, not from the plan.':
    'Esto se repite. Los pesos suben desde lo que realmente levantas, no desde el plan.',

  // --- the ramp editor -------------------------------------------------------
  'Week 1': 'Semana 1',
  'Start at': 'Empezar en',
  'Starting value': 'Valor inicial',
  'Grows each week': 'Crece cada semana',
  'By how much': 'Cuánto',
  'Stop at': 'Detenerse en',
  'Maximum value': 'Valor máximo',
  'Turn off': 'Desactivar',
  'no limit': 'sin límite',
  'Where the build-up levels off. Without one it keeps climbing for the whole plan.':
    'Donde la progresión se estabiliza. Sin esto sigue subiendo durante todo el plan.',

  // --- history and progress --------------------------------------------------
  History: 'Historial',
  Progress: 'Progreso',
  'No sessions yet.': 'Aún no hay sesiones.',
  'Everything you log shows up here, newest first.':
    'Todo lo que registras aparece aquí, lo más reciente primero.',
  'Personal bests': 'Récords personales',
  'Training load': 'Carga de entrenamiento',
  '4-wk avg': 'media de 4 sem',
  'Weekly volume': 'Volumen semanal',
  'Weekly distance': 'Distancia semanal',
  Pace: 'Ritmo',
  'Mileage on its own, against its own four-week average. Training load mixes running into lifting, which can hold the combined figure flat while the miles underneath it double — and it is the miles that break bone. Lungs adapt in weeks, tendon and bone over months, so the week that felt fine is the one to watch.':
    'El kilometraje por su cuenta, frente a su propia media de cuatro semanas. La carga de entrenamiento mezcla correr con levantar, lo que puede mantener plana la cifra combinada mientras los kilómetros de debajo se duplican, y son los kilómetros los que rompen el hueso. Los pulmones se adaptan en semanas; el tendón y el hueso, en meses. Por eso la semana que te pareció llevadera es la que hay que vigilar.',
  'Average pace across every run that week, weighted by distance, so a long run counts for more than a shakeout. Taller is faster, and the axis starts just below your slowest week rather than at a standstill. Walks, rucks, rows and rides are left out — averaging them into a running pace describes none of them.':
    'El ritmo medio de todas las carreras de esa semana, ponderado por distancia, para que una tirada larga pese más que un trote suave. Más alto es más rápido, y el eje empieza justo por debajo de tu semana más lenta, no en parado. Las caminatas, las marchas con mochila, el remo y la bici quedan fuera: promediarlos dentro de un ritmo de carrera no describe a ninguno.',
  Consistency: 'Constancia',
  Completed: 'Completadas',
  Extra: 'Extra',
  Missed: 'Perdidas',
  'of what was due': 'de lo que tocaba',
  'Plan slots whose day has come, and what became of them. A skipped session counts against the figure, because deciding not to train is something that happened to the plan. Sessions no plan asked for are counted apart — they are training, but they are not evidence the plan is being followed.':
    'Las sesiones del plan cuyo día ya llegó, y en qué quedaron. Una sesión omitida cuenta en contra, porque decidir no entrenar es algo que le pasó al plan. Las sesiones que ningún plan pedía se cuentan aparte: son entrenamiento, pero no son prueba de que el plan se esté cumpliendo.',
  Easy: 'Fácil',
  Moderate: 'Moderado',
  Hard: 'Duro',
  easy: 'fácil',
  'Minutes, by how hard they were. Most weeks want to be mostly easy with a little genuinely hard — it is the middle that quietly eats a training block, tiring enough to need recovering from and not hard enough to change anything.':
    'Minutos, según lo duros que fueron. La mayoría de las semanas deberían ser sobre todo fáciles con algo de trabajo realmente duro; es la zona intermedia la que se come un bloque de entrenamiento sin que lo notes, lo bastante cansada como para necesitar recuperación y no lo bastante dura como para cambiar nada.',
  'Movement balance': 'Equilibrio de movimientos',
  'push per pull': 'empuje por tracción',
  'Bars are sets, because sets are the one measure that compares across patterns — a hinge outweighs an overhead press whatever you do, so the tonnage beside each row only means something against the same pattern a month ago. Read the bottom of the list, not the top. Running is left out; its volume is distance.':
    'Las barras son series, porque las series son la única medida que se puede comparar entre patrones: una bisagra mueve más peso que un empuje vertical hagas lo que hagas, así que el tonelaje junto a cada fila solo significa algo frente al mismo patrón hace un mes. Lee el final de la lista, no el principio. Correr queda fuera; su volumen es distancia.',
  'Log your bodyweight': 'Registra tu peso corporal',
  'Nothing to chart yet.': 'Aún no hay nada que graficar.',
  'Complete some sets and PRs land here.': 'Completa algunas series y los récords aparecerán aquí.',
  'Nothing recorded for this movement yet.': 'Aún no hay nada registrado para este movimiento.',

  // --- named in the domain, shown on screen -----------------------------------
  //
  // These are labels on domain constants rather than copy sitting in a component: a
  // training goal and an injury severity are things the app reasons about, and their
  // English name is the stable key the rest of the code matches on.
  'Get stronger': 'Ponerse más fuerte',
  'Build muscle': 'Ganar músculo',
  'Build strength': 'Ganar fuerza',
  'Build endurance': 'Ganar resistencia',
  'Lose fat': 'Perder grasa',
  'General fitness': 'Forma física general',
  Twinge: 'Molestia',
  Sore: 'Dolorido',
  'Cannot use it': 'No puedo usarlo',
  'Warm-up 1': 'Calentamiento 1',
  'Warm-up 2': 'Calentamiento 2',
  'Easy set': 'Serie fácil',
  'Max reps': 'Máximo de repeticiones',
  'Max hold': 'Máximo sostenido',
  'Short hold': 'Sostenido corto',
  'Known max': 'Máximo conocido',
  Squat: 'Sentadilla',
  Hinge: 'Bisagra',
  Lunge: 'Zancada',
  Push: 'Empuje',
  Overhead: 'Empuje vertical',
  Row: 'Remo',
  'Pull-up': 'Dominada',
  'Carry / grip': 'Acarreo / agarre',
  Run: 'Correr',

  // --- the explanatory notes under each control -------------------------------
  //
  // Long by design: these are the sentences that say why a setting is the way it is,
  // and a translation that only carried the label would leave the reasoning in English.
  'A different question to the one above — you can be part-way through a plan and have missed most of what it asked for.':
    'Una pregunta distinta a la de arriba — puedes ir a mitad de un plan y haber fallado la mayor parte de lo que pedía.',
  'A rough guess is fine. Everything is worked out from it, and a wrong one costs an extra attempt rather than the result — what gets recorded is the heaviest set you actually finish.':
    'Una estimación aproximada basta. Todo se calcula a partir de ella, y equivocarse cuesta un intento extra en vez del resultado — lo que se registra es la serie más pesada que realmente terminas.',
  'A test gives the app a real number to program from instead of a guess — and gives you something to beat.':
    'Una prueba le da a la app un número real del que programar en vez de una suposición — y te da algo que superar.',
  'Dating it honestly matters — an old result is still used, and the app says when it is getting stale rather than quietly trusting it forever.':
    'Ponerle la fecha real importa — un resultado antiguo se sigue usando, y la app avisa cuando se está quedando viejo en vez de confiar en él para siempre.',
  'Dropped sessions are removed from the plan, not from your history. Your adherence is measured against what remains.':
    'Las sesiones descartadas se quitan del plan, no de tu historial. Tu constancia se mide contra lo que queda.',
  "Each kind of run keeps its own setup, so a track session does not turn Sunday's long run into four by eight hundred.":
    'Cada tipo de carrera guarda su propia configuración, así que una sesión de pista no convierte la carrera larga del domingo en cuatro por ochocientos.',
  'Effort × minutes, so running and lifting add into one number. Ramping past about 1.5× your four-week average is where injuries cluster.':
    'Esfuerzo por minutos, para que correr y levantar sumen en un solo número. Subir más de una vez y media tu promedio de cuatro semanas es donde se concentran las lesiones.',
  'Erases every session, plan, and setting on this device and reseeds the movement library from scratch. Export a backup first if there is anything you want.':
    'Borra cada sesión, plan y ajuste en este dispositivo y vuelve a sembrar la biblioteca de movimientos desde cero. Exporta una copia de seguridad antes si hay algo que quieras conservar.',
  'Every plan is a starting point — once it is on your calendar you can move, skip, or rewrite any session in it.':
    'Cada plan es un punto de partida — una vez en tu calendario puedes mover, omitir o reescribir cualquier sesión.',
  'Failed it — stop the test':
    'No lo lograste — detener la prueba',
  'Finished workout — reviewing. Tap Edit to change anything.':
    'Entrenamiento terminado — en revisión. Toca Editar para cambiar algo.',
  'Hybrid Forge · offline training tracker':
    'Hybrid Forge — registro de entrenamiento sin conexión',
  'How hard was the whole session? This is what makes running and lifting comparable — effort × minutes is the one load number that spans both.':
    '¿Qué tan duro fue toda la sesión? Esto es lo que hace comparables correr y levantar — esfuerzo por minutos es el único número de carga que abarca ambos.',
  'Lay out a week — which days you train and what you do on them — and it repeats for as long as you set it to.':
    'Define una semana — qué días entrenas y qué haces en ellos — y se repite durante el tiempo que elijas.',
  'Loading…':
    'Cargando…',
  'Log a few sessions and this fills in — load, mileage, volume, and every personal best.':
    'Registra algunas sesiones y esto se llena — carga, kilometraje, volumen y cada récord personal.',
  'Log something that hurts and the sessions that load it step aside — the rest of your training carries on.':
    'Registra algo que duela y las sesiones que lo carguen se apartan — el resto de tu entrenamiento sigue.',
  'Made it — three good reps':
    'Lo lograste — tres repeticiones buenas',
  'Measured against the target above, or on a tempo or interval session against the pace of the piece you are on. Drifting is normal, so this waits — half a minute off pace before it says anything, and longer before it says the same thing twice.':
    'Se mide contra el objetivo de arriba, o en una sesión de tempo o intervalos contra el ritmo del tramo en el que estás. Desviarse es normal, así que esto espera medio minuto fuera de ritmo antes de decir algo, y más antes de repetirlo.',
  'Name a workout you have built and it comes back here, ready to run again — and, if it is timed, with its own best to beat.':
    'Ponle nombre a un entrenamiento que hayas creado y vuelve aquí, listo para repetirlo — y si es por tiempo, con su propia marca que superar.',
  'No write-up for this one yet — it is likely a movement you added yourself.':
    'Aún no hay descripción para este — probablemente sea un movimiento que añadiste tú.',
  'Nothing here touches your data — it is a display setting stored with your profile, so it travels in your backup.':
    'Nada de esto toca tus datos — es un ajuste de presentación guardado con tu perfil, así que viaja en tu copia de seguridad.',
  'Optional — saving without them is fine.':
    'Opcional — guardar sin ellos está bien.',
  'Per-set effort is how autoregulated strength work picks its loads — a 9 on a triple you wanted at 8 means the next set comes down. It is worth the extra box on every row only if you act on it between sets. Training load uses the session figure either way.':
    'El esfuerzo por serie es como el trabajo de fuerza autorregulado elige sus cargas — un 9 en una triple que querías a 8 significa que la siguiente serie baja. Solo vale la casilla extra en cada fila si actúas según ella entre series. La carga de entrenamiento usa la cifra de la sesión de todos modos.',
  'Sessions are spaced the way the plan author laid them out, counted from this day. It comes in switched off — starting it is a separate choice.':
    'Las sesiones se espacian como las dispuso el autor del plan, contando desde este día. Viene desactivado — iniciarlo es una decisión aparte.',
  'Silent keeps every cue on screen and says none of them — for a race, a group run, or a track session where someone is already shouting at you.':
    'Silencioso mantiene todos los avisos en pantalla y no dice ninguno — para una carrera, una salida en grupo o una sesión de pista donde ya hay alguien gritándote.',
  'Skipped, not deleted — mark the injury healed early and you can take them back.':
    'Omitidas, no eliminadas — marca la lesión como sanada antes y puedes recuperarlas.',
  'Stored data does not change — this only affects how numbers are shown, so switching back and forth never rounds your history away.':
    'Los datos guardados no cambian — esto solo afecta cómo se muestran los números, así que cambiar de un lado a otro nunca redondea tu historial.',
  'Striped = blocked out':
    'Rayado = bloqueado',
  'Suggested loads are worked out from this share of your tested max, rather than from the max itself. Ninety per cent is the usual convention: a number computed from your best day is not makeable on an average one, and a programme you miss reps on is one you stop running. At 100% the suggestions come straight off your max.':
    'Las cargas sugeridas se calculan desde esta parte de tu máximo probado, no del máximo en sí. Noventa por ciento es la convención habitual: un número calculado desde tu mejor día no es alcanzable en uno promedio, y un programa en el que fallas repeticiones es uno que dejas de seguir. Al 100% las sugerencias salen directamente de tu máximo.',
  'Suggested loads, progressions and test ladders all snap to these. Leave a section empty and that movement falls back to round numbers.':
    'Las cargas sugeridas, las progresiones y las escaleras de prueba se ajustan a estos. Deja una sección vacía y ese movimiento vuelve a números redondos.',
  'Tap the kit you added — the square-cornered ones — to mark it. One at a time to rename, any number to delete. Built-in kit cannot be changed.':
    'Toca el equipo que añadiste — los de esquinas cuadradas — para marcarlo. De uno en uno para renombrar, cualquier cantidad para eliminar. El equipo incluido no se puede cambiar.',
  'Ten per cent a week is the conventional ceiling for adding distance. Past it the injuries tend to arrive before the fitness does.':
    'Diez por ciento por semana es el techo convencional para añadir distancia. Pasado eso las lesiones suelen llegar antes que la forma.',
  'The clock keeps running in the strip at the top — closing this does not stop it.':
    'El reloj sigue corriendo en la barra de arriba — cerrar esto no lo detiene.',
  'The most you can do in one set with good form, stopping when the form goes — not a total across a session.':
    'Lo máximo que puedes hacer en una serie con buena forma, parando cuando la forma se rompe — no un total a lo largo de una sesión.',
  'These are four different directions, not four palettes. Each one changes the shape of things, the type, and how tightly the screen is packed.':
    'Son cuatro direcciones distintas, no cuatro paletas. Cada una cambia la forma de las cosas, la tipografía y qué tan apretada está la pantalla.',
  'They stay where they are — blocking stops new scheduling, it does not throw away work you had already planned. Skip or move them from their own days if you are not doing them.':
    'Se quedan donde están — bloquear detiene la programación nueva, no tira el trabajo que ya habías planeado. Omítelas o muévelas desde sus propios días si no las vas a hacer.',
  'This browser cannot speak, so cues will appear on screen only. Everything below still decides what gets shown.':
    'Este navegador no puede hablar, así que los avisos aparecerán solo en pantalla. Todo lo de abajo sigue decidiendo qué se muestra.',
  'This browser has no audio support — the timer still runs, silently.':
    'Este navegador no admite audio — el cronómetro sigue funcionando, en silencio.',
  'This is the load in every push-up, pull-up and lunge you do. Without it those sets show as no work at all on your volume chart. Sessions are valued at what you weighed that week, so logging it today does not rewrite last spring.':
    'Esta es la carga en cada flexión, dominada y zancada que haces. Sin ella esas series aparecen como cero trabajo en tu gráfica de volumen. Las sesiones se valoran con lo que pesabas esa semana, así que registrarlo hoy no reescribe la primavera pasada.',
  'This is your only profile. Make another before deleting this one — the app has to know what you can train with.':
    'Este es tu único perfil. Crea otro antes de eliminar este — la app tiene que saber con qué puedes entrenar.',
  'Trained one side at a time — log both sides, or double the sets.':
    'Se entrena un lado a la vez — registra ambos lados, o duplica las series.',
  'Whatever you train with that the list does not name. It behaves like any other equipment: tick it into a profile, and movements can require it.':
    'Lo que sea que uses para entrenar y la lista no nombre. Se comporta como cualquier otro equipo: márcalo en un perfil, y los movimientos pueden requerirlo.',
  'Which kinds of training each day can hold. Planning will respect this — a day with nothing selected is a rest day.':
    'Qué tipos de entrenamiento admite cada día. La planificación lo respetará — un día sin nada seleccionado es un día de descanso.',
  'Which shelf it shows up on. It will have square corners either way, which is how kit you added is told apart from the built-in list.':
    'En qué estante aparece. Tendrá esquinas cuadradas de cualquier forma, que es como se distingue el equipo que añadiste de la lista incluida.',
  'Worked out from the kit and the pattern, so filtering, suggestions and the injury log all understand it without being told separately.':
    'Se deduce del equipo y del patrón, para que el filtrado, las sugerencias y el registro de lesiones lo entiendan sin que haya que decírselo por separado.',
  'Your availability no longer matches where these sessions sit. Completed and skipped sessions are never touched, and nothing before today moves.':
    'Tu disponibilidad ya no coincide con dónde están estas sesiones. Las sesiones completadas y omitidas nunca se tocan, y nada anterior a hoy se mueve.',
  'Yours · copied into the plan':
    'Tuyos — copiado al plan',
  'Orders the plan library, sets what ‘Suggest a workout’ opens on, and shapes the sets and reps in plans you start from here. Plans already on your calendar keep what they prescribed.':
    'Ordena la biblioteca de planes, decide con qué abre ‘Sugerir un entrenamiento’, y da forma a las series y repeticiones de los planes que inicies desde aquí. Los planes que ya están en tu calendario conservan lo que prescribieron.',
  'Spoken cues on a run will use whichever voice this device has, which may not be a Spanish one. Adding a Spanish voice in your device settings fixes it.':
    'Los avisos hablados en una carrera usarán la voz que tenga este dispositivo, que puede no ser una voz en español. Añadir una voz en español en los ajustes del dispositivo lo soluciona.',
  'Changes what the app says out loud on a run. Distances stay on whatever the units below are set to.':
    'Cambia lo que la app dice en voz alta durante una carrera. Las distancias siguen las unidades de abajo.',
};
