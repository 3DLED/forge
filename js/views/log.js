/* ============================================================
   views/log.js — logging a session.
   The screen you use mid-workout: large tap targets, pre-filled
   targets from the plan, one tap to mark a set complete.
   ============================================================ */

import * as S from '../store.js';
import {
  el, frag, icon, ICONS, field, input, select, segmented, sheet, closeSheet,
  toast, fmtDate, fmtDuration, fmtPace, parseTimeInput, num, confirmSheet, emptyState,
} from '../ui.js';
import { typeColor, SESSION_TYPES, prescriptionToEntries, shouldLevelUp } from '../planner.js';
import {
  getExercise, availableExercises, searchExercises, variationName, levelOf, canLevelUp,
} from '../exercises.js';
import { navigate, replace } from '../router.js';

/* ---------- entry points ---------- */

/** Create a live session from a planned one and jump straight into it. */
export function startFromPlan(p) {
  const existing = p.sessionId ? S.getSession(p.sessionId) : null;
  if (existing && !existing.completedAt) { navigate(`#/session/${existing.id}`); return; }

  const sess = S.newSession({
    date: p.date,
    type: p.type,
    title: p.title,
    plannedId: p.id,
    entries: prescriptionToEntries(p, S.get().profile.levels),
    run: p.prescription?.run ? {
      kind: p.prescription.run.kind || 'easy',
      distanceMi: p.prescription.run.distanceMi || null,
      durationSec: p.prescription.run.durationMin ? p.prescription.run.durationMin * 60 : null,
      avgHr: null,
      elevFt: null,
      source: 'manual',
      planned: true,
    } : null,
  });
  S.addSession(sess);
  S.updatePlanned(p.id, x => { x.sessionId = sess.id; });
  navigate(`#/session/${sess.id}`);
}

export function createBlankSession(type = 'strength') {
  const sess = S.newSession({
    type,
    title: type === 'run' ? 'Run' : 'Workout',
    run: type === 'run' ? { kind: 'easy', distanceMi: null, durationSec: null, avgHr: null, elevFt: null, source: 'manual' } : null,
  });
  S.addSession(sess);
  return sess;
}

/* ---------- the session editor ---------- */

export function renderSession(id, params = {}) {
  if (id === 'new') {
    const sess = createBlankSession(params.type || 'strength');
    replace(`#/session/${sess.id}`);
    return el('div', {});
  }

  const sess = S.getSession(id);
  if (!sess) return emptyState('Session not found', 'It may have been deleted.',
    el('button', { class: 'btn sm', style: { marginTop: '12px' }, onclick: () => navigate('#/today') }, 'Back to Today'));

  const root = el('div', {});
  const rerender = () => {
    const fresh = renderSession(id, params);
    root.replaceWith(fresh);
  };

  const color = typeColor(sess.type);
  const isDone = !!sess.completedAt;

  /* ---- header ---- */
  root.append(el('div', { class: 'view-head' },
    el('div', { class: 'row', style: { gap: '8px', marginBottom: '6px' } },
      el('button', { class: 'btn sm ghost', onclick: () => history.back() }, '← Back'),
      el('span', { class: 'chip type', style: { '--type-color': color } },
        (SESSION_TYPES[sess.type] || {}).label || sess.type),
      isDone ? el('span', { class: 'chip ok' }, icon(ICONS.check, 12), 'Complete') : null
    ),
    el('h1', {}, sess.title || 'Workout'),
    el('div', { class: 'sub' }, fmtDate(sess.date, { weekday: 'long', month: 'long', day: 'numeric' }))
  ));

  /* ---- basics ---- */
  const basics = el('div', { class: 'card section' });
  const titleIn = input({
    value: sess.title || '',
    placeholder: 'Session name',
    oninput: e => S.updateSession(id, s => { s.title = e.target.value; }),
  });
  const dateIn = el('input', {
    type: 'date', value: sess.date,
    onchange: e => { S.updateSession(id, s => { s.date = e.target.value; }); toast('Date updated'); },
  });
  basics.append(
    field('Name', titleIn),
    field('Date', dateIn),
    field('Type', segmented(
      Object.values(SESSION_TYPES).filter(t => t.id !== 'rest').map(t => ({ value: t.id, label: t.label })),
      sess.type,
      v => {
        S.updateSession(id, s => {
          s.type = v;
          if (v === 'run' && !s.run) s.run = { kind: 'easy', distanceMi: null, durationSec: null, avgHr: null, elevFt: null, source: 'manual' };
        });
        rerender();
      }
    ))
  );
  root.append(basics);

  /* ---- run block ---- */
  if (sess.type === 'run' || sess.run) root.append(runBlock(sess, id, rerender));

  /* ---- exercises ---- */
  const exSection = el('div', { class: 'section' },
    el('div', { class: 'section-head' },
      el('h2', {}, 'Exercises'),
      el('button', { class: 'btn sm', onclick: () => openExercisePicker(id, rerender) }, icon(ICONS.plus, 15), 'Add')
    )
  );

  if (!sess.entries.length) {
    exSection.append(emptyState('No exercises yet', 'Add movements as you go, or start from a planned session to have them pre-filled.'));
  } else {
    const stack = el('div', { class: 'stack' });
    sess.entries.forEach((entry, i) => stack.append(exerciseBlock(sess, entry, i, id, rerender)));
    exSection.append(stack);
  }
  root.append(exSection);

  /* ---- wrap-up ---- */
  const rpeVal = el('span', { class: 'num', style: { fontWeight: '700' } }, sess.rpe ? String(sess.rpe) : '—');
  const wrap = el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Wrap-up')),
    field('Duration (minutes)', el('input', {
      type: 'number', inputmode: 'numeric', min: '0', value: sess.durationMin ?? '',
      placeholder: 'e.g. 45',
      oninput: e => S.updateSession(id, s => { s.durationMin = num(e.target.value); }),
    })),
    el('label', { class: 'field' },
      el('span', { class: 'lbl' }, 'How hard did that feel? ', rpeVal, ' / 10',
        sess.rpeEstimated ? el('span', { class: 'chip', style: { marginLeft: '8px', textTransform: 'none' } }, 'estimated') : null),
      el('input', {
        type: 'range', min: '1', max: '10', step: '1', value: sess.rpe ?? 5,
        // Touching the slider means you are reporting it, not guessing.
        oninput: e => { rpeVal.textContent = e.target.value; S.updateSession(id, s => { s.rpe = +e.target.value; s.rpeEstimated = false; }); },
      }),
      el('span', { class: 'hint' }, '1 = barely moved · 5 = solid work · 8 = hard · 10 = everything I had. Combined with duration, this is what drives the load tracking.')
    ),
    field('Notes', el('textarea', {
      placeholder: 'How it felt, terrain, weather, anything you want to remember.',
      oninput: e => S.updateSession(id, s => { s.notes = e.target.value; }),
    }, sess.notes || ''))
  );
  root.append(wrap);

  /* ---- actions ---- */
  root.append(el('div', { class: 'section' },
    el('div', { class: 'stack' },
      isDone
        ? el('button', { class: 'btn block', onclick: () => { S.updateSession(id, s => { s.completedAt = null; }); rerender(); toast('Reopened'); } }, 'Reopen session')
        : el('button', { class: 'btn primary block', onclick: () => finishSession(sess, id, rerender) }, icon(ICONS.check, 17), 'Finish session'),
      el('button', {
        class: 'btn danger block',
        onclick: () => confirmSheet({
          title: 'Delete this session?',
          message: 'This cannot be undone. If it came from your plan, the planned session goes back to unfinished.',
          confirmLabel: 'Delete',
          danger: true,
          onConfirm: () => { S.deleteSession(id); toast('Deleted'); navigate('#/today'); },
        }),
      }, icon(ICONS.trash, 16), 'Delete session')
    )
  ));

  return root;
}

/* ---------- run block ---------- */

function runBlock(sess, id, rerender) {
  const r = sess.run || {};
  const paceOut = el('div', { class: 'stat' },
    el('div', { class: 'k' }, 'Avg pace'),
    el('div', { class: 'v num' }, r.distanceMi && r.durationSec ? fmtPace(r.durationSec / r.distanceMi) : '—',
      el('span', { class: 'u' }, '/mi'))
  );

  const recalc = () => {
    const s = S.getSession(id);
    const v = (s.run.distanceMi && s.run.durationSec) ? fmtPace(s.run.durationSec / s.run.distanceMi) : '—';
    paceOut.querySelector('.v').firstChild.textContent = v;
  };

  return el('div', { class: 'card section', style: { '--type-color': 'var(--c-run)' } },
    el('div', { class: 'section-head' }, el('h2', {}, 'Run')),
    el('div', { class: 'grid-3', style: { marginBottom: '12px' } },
      el('div', { class: 'stat' },
        el('div', { class: 'k' }, 'Distance'),
        el('input', {
          type: 'number', step: '0.01', inputmode: 'decimal', value: r.distanceMi ?? '',
          placeholder: '0.00',
          style: { marginTop: '4px', minHeight: '40px', padding: '6px 8px' },
          oninput: e => { S.updateSession(id, s => { s.run.distanceMi = num(e.target.value); }); recalc(); },
        })
      ),
      el('div', { class: 'stat' },
        el('div', { class: 'k' }, 'Time'),
        el('input', {
          type: 'text', inputmode: 'numeric', value: r.durationSec ? fmtDuration(r.durationSec) : '',
          placeholder: 'mm:ss',
          style: { marginTop: '4px', minHeight: '40px', padding: '6px 8px' },
          oninput: e => { S.updateSession(id, s => { s.run.durationSec = parseTimeInput(e.target.value); }); recalc(); },
        })
      ),
      paceOut
    ),
    el('div', { class: 'grid-3' },
      field('Type', select([
        { value: 'easy', label: 'Easy' },
        { value: 'long', label: 'Long' },
        { value: 'tempo', label: 'Tempo' },
        { value: 'intervals', label: 'Intervals' },
        { value: 'hills', label: 'Hills' },
        { value: 'trail', label: 'Trail' },
        { value: 'race', label: 'Race' },
      ], r.kind || 'easy', { onchange: e => S.updateSession(id, s => { s.run.kind = e.target.value; }) })),
      field('Avg HR', el('input', {
        type: 'number', inputmode: 'numeric', value: r.avgHr ?? '', placeholder: 'bpm',
        oninput: e => S.updateSession(id, s => { s.run.avgHr = num(e.target.value); }),
      })),
      field('Elev (ft)', el('input', {
        type: 'number', inputmode: 'numeric', value: r.elevFt ?? '', placeholder: 'ft',
        oninput: e => S.updateSession(id, s => { s.run.elevFt = num(e.target.value); }),
      }))
    )
  );
}

/* ---------- exercise block ---------- */

function exerciseBlock(sess, entry, entryIdx, sessionId, rerender) {
  const ex = getExercise(entry.exerciseId);
  const last = S.lastPerformance(entry.exerciseId, sessionId);

  const head = el('div', { class: 'ex-head' },
    el('div', { class: 'grow' },
      el('div', { class: 'nm' }, entry.variation || entry.name),
      entry.targetNote ? el('div', { class: 'pr' }, `Target ${entry.targetNote}`) : null,
      last ? el('div', { class: 'pr' }, `Last ${fmtDate(last.date, { month: 'short', day: 'numeric' })}: ${summarize(last.entry)}`) : null
    ),
    el('button', {
      class: 'icon-btn', 'aria-label': 'Exercise options',
      onclick: () => openEntryMenu(sess, entry, entryIdx, sessionId, rerender),
    }, icon(ICONS.edit, 16))
  );

  const cols = columnsFor(entry.unit);
  const body = el('div', { class: 'ex-body' },
    el('div', { class: 'set-head' },
      el('span', {}, ''), el('span', {}, cols[0]), el('span', {}, cols[1]), el('span', {}, '')
    )
  );

  entry.sets.forEach((set, i) => body.append(setRow(entry, set, i, sessionId)));

  body.append(el('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } },
    el('button', {
      class: 'btn sm grow',
      onclick: () => {
        S.updateSession(sessionId, s => {
          const e = s.entries[entryIdx];
          const prev = e.sets[e.sets.length - 1] || {};
          e.sets.push({ reps: prev.reps ?? null, weight: prev.weight ?? null, timeSec: prev.timeSec ?? null, distanceM: prev.distanceM ?? null, done: false });
        });
        rerender();
      },
    }, icon(ICONS.plus, 14), 'Add set'),
    entry.sets.length > 1 ? el('button', {
      class: 'btn sm ghost',
      onclick: () => {
        S.updateSession(sessionId, s => { s.entries[entryIdx].sets.pop(); });
        rerender();
      },
    }, 'Remove set') : null
  ));

  if (ex?.cues) body.append(el('p', { class: 'xsmall mute2', style: { marginTop: '10px', marginBottom: '0' } }, ex.cues));

  return el('div', { class: 'ex-block' }, head, body);
}

function columnsFor(unit) {
  if (unit === 'time') return ['Seconds', 'Weight (lb)'];
  if (unit === 'distance') return ['Meters', 'Weight (lb)'];
  return ['Reps', 'Weight (lb)'];
}

function setRow(entry, set, i, sessionId) {
  const entryIdx = S.getSession(sessionId).entries.findIndex(e => e.id === entry.id);

  const primaryKey = entry.unit === 'time' ? 'timeSec' : entry.unit === 'distance' ? 'distanceM' : 'reps';

  const primary = el('input', {
    type: 'number', inputmode: 'numeric', value: set[primaryKey] ?? '',
    placeholder: '—',
    oninput: e => S.updateSession(sessionId, s => { s.entries[entryIdx].sets[i][primaryKey] = num(e.target.value); }),
  });

  const weight = el('input', {
    type: 'number', inputmode: 'decimal', step: '0.5', value: set.weight ?? '',
    placeholder: 'BW',
    oninput: e => S.updateSession(sessionId, s => { s.entries[entryIdx].sets[i].weight = num(e.target.value); }),
  });

  const doneBtn = el('button', {
    class: 'done-btn', 'aria-pressed': String(!!set.done), 'aria-label': `Mark set ${i + 1} done`,
    onclick: () => {
      const next = doneBtn.getAttribute('aria-pressed') !== 'true';
      doneBtn.setAttribute('aria-pressed', String(next));
      S.updateSession(sessionId, s => {
        const e = s.entries[entryIdx];
        const st = e.sets[i];
        st.done = next;
        // Marking done with an empty field means "I hit the target".
        // Read that from the prescription, not from set 1 — set 1 may
        // itself have been edited to something other than the target.
        if (next && st[primaryKey] == null) {
          const target = e.target?.[primaryKey] ?? e.sets[0][primaryKey];
          if (target != null) { st[primaryKey] = target; primary.value = target; }
        }
      });
    },
  }, icon(ICONS.check, 18));

  return el('div', { class: 'set-row' },
    el('span', { class: 'idx' }, String(i + 1)),
    primary, weight, doneBtn
  );
}

function summarize(entry) {
  const done = (entry.sets || []).filter(s => s.done);
  if (!done.length) return '—';
  if (entry.unit === 'time') return done.map(s => `${s.timeSec ?? '?'}s`).join(', ');
  if (entry.unit === 'distance') return done.map(s => `${s.distanceM ?? '?'}m`).join(', ');
  return done.map(s => `${s.reps ?? '?'}${s.weight ? `x${s.weight}` : ''}`).join(', ');
}

/* ---------- entry menu ---------- */

function openEntryMenu(sess, entry, entryIdx, sessionId, rerender) {
  const ex = getExercise(entry.exerciseId);
  const st = S.get();

  const body = el('div', { class: 'stack' });

  if (ex) {
    const lvl = levelOf(ex, st.profile.levels);
    body.append(el('div', { class: 'card' },
      el('div', { class: 'card-title' }, 'Progression'),
      el('p', { class: 'small muted' },
        `You are on rung ${lvl + 1} of ${ex.ladder.length}. With fixed kettlebell weights, moving up this ladder is how you get stronger.`),
      el('div', { class: 'stack' },
        ex.ladder.map((name, i) => el('button', {
          class: 'check',
          onclick: () => {
            S.update(s => { s.profile.levels[ex.id] = i; });
            S.updateSession(sessionId, s => { s.entries[entryIdx].variation = name; });
            closeSheet(); rerender();
            toast(`Set to: ${name}`);
          },
        },
          el('span', { class: 'dot', style: { background: i <= lvl ? 'var(--accent)' : 'var(--line)' } }),
          el('span', { class: 'grow small' }, name),
          i === lvl ? el('span', { class: 'chip accent' }, 'Current') : null
        ))
      )
    ));
  }

  body.append(el('button', {
    class: 'btn danger block',
    onclick: () => {
      S.updateSession(sessionId, s => { s.entries.splice(entryIdx, 1); });
      closeSheet(); rerender(); toast('Removed');
    },
  }, icon(ICONS.trash, 16), 'Remove exercise'));

  sheet({ title: entry.name, body });
}

/* ---------- exercise picker ---------- */

export function openExercisePicker(sessionId, rerender) {
  const st = S.get();
  const results = el('div', { class: 'stack' });

  const add = (ex) => {
    S.updateSession(sessionId, s => {
      s.entries.push({
        id: S.uid('e'),
        exerciseId: ex.id,
        name: ex.name,
        variation: variationName(ex, st.profile.levels),
        unit: ex.unit,
        targetNote: null,
        sets: Array.from({ length: 3 }, () => ({ reps: null, weight: null, timeSec: null, distanceM: null, done: false })),
      });
    });
    closeSheet();
    rerender();
    toast(`Added ${ex.name}`);
  };

  const draw = (query) => {
    results.replaceChildren();
    const list = searchExercises(query, st.profile.equipment);
    if (!list.length) {
      results.append(el('p', { class: 'muted small center' }, 'Nothing matches. Check your equipment list in More → Equipment.'));
      return;
    }
    const groups = {};
    for (const e of list) (groups[e.pattern] ||= []).push(e);
    for (const [pattern, items] of Object.entries(groups)) {
      results.append(el('div', { class: 'section-head', style: { marginTop: '12px' } },
        el('h2', {}, pattern)));
      for (const ex of items) {
        results.append(el('button', {
          class: 'card tight session-card',
          style: { '--type-color': ex.ocr ? 'var(--accent)' : 'var(--line)' },
          onclick: () => add(ex),
        },
          el('div', { class: 'row-between' },
            el('div', { class: 'grow' },
              el('div', { style: { fontWeight: '650' } }, ex.name),
              el('div', { class: 'xsmall mute2' }, variationName(ex, st.profile.levels))
            ),
            ex.ocr ? el('span', { class: 'chip accent' }, 'OCR') : null
          )
        ));
      }
    }
  };

  const search = el('input', {
    type: 'search', placeholder: 'Search movements…',
    oninput: e => draw(e.target.value),
  });

  draw('');

  sheet({
    title: 'Add exercise',
    body: el('div', {}, el('div', { style: { marginBottom: '10px' } }, search), results),
  });
}

/* ---------- finishing ---------- */

function finishSession(sess, id, rerender) {
  S.updateSession(id, s => {
    s.completedAt = new Date().toISOString();
    // Infer duration from elapsed time if the user never typed one.
    if (!s.durationMin && s.startedAt) {
      const mins = Math.round((Date.now() - new Date(s.startedAt)) / 60000);
      if (mins > 0 && mins < 300) s.durationMin = mins;
    }
    if (!s.rpe) s.rpe = 5;
  });

  if (sess.plannedId) {
    S.updatePlanned(sess.plannedId, p => { p.status = 'done'; p.sessionId = id; });
  }

  const fresh = S.getSession(id);
  const promotions = (fresh.entries || []).filter(shouldLevelUp)
    .map(e => ({ entry: e, ex: getExercise(e.exerciseId) }))
    .filter(x => x.ex && canLevelUp(x.ex, S.get().profile.levels));

  if (promotions.length) {
    offerPromotions(promotions, rerender);
  } else {
    toast('Session logged', 'ok');
    navigate('#/today');
  }
}

/**
 * You beat the target on every set — time to climb the ladder.
 * This is the progression mechanism when load is fixed.
 */
function offerPromotions(promotions, rerender) {
  const chosen = new Set(promotions.map(p => p.ex.id));

  sheet({
    title: 'You earned a level up',
    body: el('div', {},
      el('p', { class: 'muted small' },
        'You cleared every prescribed set with room to spare. Moving up the ladder is how you keep progressing on fixed kettlebell weights.'),
      el('div', { class: 'stack' },
        promotions.map(({ ex }) => {
          const lvl = levelOf(ex, S.get().profile.levels);
          const cb = el('input', { type: 'checkbox', checked: true, onchange: e => {
            if (e.target.checked) chosen.add(ex.id); else chosen.delete(ex.id);
          } });
          return el('label', { class: 'check' }, cb,
            el('span', { class: 'grow' },
              el('div', { style: { fontWeight: '650' } }, ex.name),
              el('div', { class: 'xsmall mute2' }, `${ex.ladder[lvl]}  →  ${ex.ladder[lvl + 1]}`)
            )
          );
        })
      )
    ),
    footer: (close) => frag(
      el('button', { class: 'btn ghost', onclick: () => { close(); toast('Session logged', 'ok'); navigate('#/today'); } }, 'Not yet'),
      el('button', {
        class: 'btn primary',
        onclick: () => {
          S.update(s => {
            for (const { ex } of promotions) {
              if (chosen.has(ex.id)) s.profile.levels[ex.id] = levelOf(ex, s.profile.levels) + 1;
            }
          });
          close();
          toast(`Leveled up ${chosen.size} movement${chosen.size === 1 ? '' : 's'}`, 'ok');
          navigate('#/today');
        },
      }, icon(ICONS.up, 16), 'Level up'),
    ),
  });
}

/* ---------- compact card used by Today / History ---------- */

export function sessionCard(s, { showDate = false } = {}) {
  const color = typeColor(s.type);
  const bits = [];
  if (s.run?.distanceMi) bits.push(`${s.run.distanceMi.toFixed(2)} mi`);
  if (s.run?.durationSec) bits.push(fmtDuration(s.run.durationSec));
  if (s.run?.distanceMi && s.run?.durationSec) bits.push(`${fmtPace(s.run.durationSec / s.run.distanceMi)}/mi`);
  const setCount = (s.entries || []).reduce((t, e) => t + e.sets.filter(x => x.done).length, 0);
  if (setCount) bits.push(`${setCount} sets`);
  if (s.durationMin && !s.run) bits.push(`${s.durationMin} min`);

  return el('button', {
    class: `card session-card ${s.completedAt ? '' : ''}`,
    style: { '--type-color': color },
    onclick: () => navigate(`#/session/${s.id}`),
  },
    el('div', { class: 'row-between', style: { alignItems: 'flex-start' } },
      el('div', { class: 'grow' },
        el('div', { class: 'row', style: { gap: '7px', marginBottom: '4px' } },
          el('span', { class: 'chip type', style: { '--type-color': color } },
            (SESSION_TYPES[s.type] || {}).label || s.type),
          showDate ? el('span', { class: 'chip' }, fmtDate(s.date)) : null,
          s.source !== 'manual' ? el('span', { class: 'chip' }, s.source) : null,
          !s.completedAt ? el('span', { class: 'chip warn' }, 'In progress') : null
        ),
        el('div', { class: 'card-title' }, s.title || 'Workout'),
        bits.length ? el('div', { class: 'card-sub num' }, bits.join(' · ')) : null
      ),
      s.rpe ? el('div', { class: 'center nowrap', style: { marginLeft: '10px' } },
        el('div', { class: 'num', style: { fontWeight: '700' } }, String(s.rpe)),
        el('div', { class: 'xsmall mute2' }, 'RPE')
      ) : null
    )
  );
}
