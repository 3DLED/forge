/* ============================================================
   views/today.js — the home screen.
   Answers, in order: what am I doing today, how is this week going,
   and is anything about to break.
   ============================================================ */

import * as S from '../store.js';
import { el, icon, ICONS, fmtDate, fmtMin, stat, emptyState, toast, sheet, frag } from '../ui.js';
import { typeColor, SESSION_TYPES, resolveVariation } from '../planner.js';
import { equipmentGap } from '../exercises.js';
import { navigate } from '../router.js';
import { sessionCard, startFromPlan } from './log.js';

export function renderToday() {
  const st = S.get();
  const today = S.today();
  const weekStart = S.startOfWeek(today);
  const wk = S.weeklyStats(weekStart);
  const block = S.activeBlock(today);
  const race = S.nextRace(today);

  const root = el('div', {});

  /* ---- header ---- */
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  root.append(el('div', { class: 'view-head' },
    el('h1', {}, st.profile.name ? `${greet}, ${st.profile.name}` : greet),
    el('div', { class: 'sub' }, fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' }))
  ));

  /* ---- race countdown ---- */
  if (race) {
    const days = S.daysBetween(today, race.date);
    root.append(el('div', { class: 'card pad-lg section', style: { borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--line))' } },
      el('div', { class: 'row-between' },
        el('div', {},
          el('div', { class: 'xsmall mute2', style: { textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: '700' } }, 'Next race'),
          el('div', { class: 'card-title', style: { marginTop: '3px' } }, race.name),
          el('div', { class: 'card-sub' }, fmtDate(race.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))
        ),
        el('div', { class: 'center' },
          el('div', { style: { fontSize: '2rem', fontWeight: '800', lineHeight: '1', color: 'var(--accent)' }, class: 'num' }, String(Math.max(0, days))),
          el('div', { class: 'xsmall mute2' }, days === 1 ? 'day out' : 'days out')
        )
      )
    ));
  }

  /* ---- week strip ---- */
  root.append(weekStrip(weekStart, today));

  /* ---- today's sessions ---- */
  const plannedToday = S.plannedOn(today);
  const loggedToday = S.sessionsOn(today);

  const sec = el('div', { class: 'section' },
    el('div', { class: 'section-head' },
      el('h2', {}, "Today's plan"),
      block ? el('span', { class: 'chip' }, block.name) : null
    )
  );

  if (!plannedToday.length && !loggedToday.length) {
    sec.append(emptyState(
      'Rest day',
      block ? 'Nothing scheduled. Recovery is part of the plan — but you can always log something extra.'
            : 'No training block yet. Build one and the whole week fills itself in.',
      el('div', { class: 'btn-row', style: { marginTop: '14px' } },
        block
          ? el('button', { class: 'btn sm', onclick: () => navigate('#/session/new') }, icon(ICONS.plus, 15), 'Log something')
          : el('button', { class: 'btn primary sm', onclick: () => navigate('#/plan?new=1') }, 'Build my plan')
      )
    ));
  } else {
    const stack = el('div', { class: 'stack' });
    for (const p of plannedToday) stack.append(plannedCard(p));
    for (const s of loggedToday.filter(x => !x.plannedId)) stack.append(sessionCard(s));
    sec.append(stack);
  }
  root.append(sec);

  /* ---- quick actions ---- */
  root.append(el('div', { class: 'section' },
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', onclick: () => navigate('#/session/new?type=run') }, icon(ICONS.run, 16), 'Log a run'),
      el('button', { class: 'btn', onclick: () => navigate('#/session/new?type=strength') }, icon(ICONS.dumbbell, 16), 'Log a workout')
    )
  ));

  /* ---- this week ---- */
  root.append(el('div', { class: 'section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'This week')),
    el('div', { class: 'grid-2' },
      stat('Miles', wk.miles.toFixed(1), 'mi'),
      stat('Sessions', wk.sessionCount, null, wk.plannedCount ? `of ${wk.plannedCount} planned` : null),
      stat('Sets', wk.strengthSets),
      stat('Load', wk.load || '—', null, 'RPE x min')
    ),
    wk.adherence != null ? el('div', { style: { marginTop: '10px' } },
      el('div', { class: 'row-between xsmall mute2', style: { marginBottom: '5px' } },
        el('span', {}, 'Plan adherence'),
        el('span', { class: 'num' }, `${wk.adherence}%`)
      ),
      el('div', { class: 'progress-track' },
        el('div', { class: 'progress-fill', style: { width: `${wk.adherence}%` } })
      )
    ) : null
  ));

  /* ---- advisories ---- */
  const advisories = buildAdvisories(st, today);
  if (advisories.length) {
    root.append(el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', {}, 'Worth knowing')),
      el('div', { class: 'stack' }, advisories)
    ));
  }

  return root;
}

/* ---------- week strip ---------- */

function weekStrip(weekStart, today) {
  const strip = el('div', { class: 'weekstrip section' });
  for (let i = 0; i < 7; i++) {
    const date = S.addDays(weekStart, i);
    const planned = S.plannedOn(date);
    const logged = S.sessionsOn(date);
    const isToday = date === today;

    const dots = el('div', { class: 'dots' });
    const seen = new Set();
    for (const p of planned) {
      if (seen.has(p.type)) continue;
      seen.add(p.type);
      dots.append(el('i', {
        style: {
          background: typeColor(p.type),
          opacity: p.status === 'done' ? '1' : '.45',
        },
      }));
    }
    for (const s of logged.filter(x => !x.plannedId)) {
      if (seen.has(s.type)) continue;
      seen.add(s.type);
      dots.append(el('i', { style: { background: typeColor(s.type) } }));
    }

    strip.append(el('button', {
      class: `d ${isToday ? 'today' : ''}`,
      onclick: () => navigate(`#/plan?date=${date}`),
    },
      el('div', { class: 'dow' }, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]),
      el('div', { class: 'num' }, String(S.parseDate(date).getDate())),
      dots
    ));
  }
  return strip;
}

/* ---------- planned session card ---------- */

export function plannedCard(p, { showDate = false } = {}) {
  const done = p.status === 'done';
  const pres = p.prescription || {};
  const color = typeColor(p.type);

  const card = el('button', {
    class: `card session-card ${done ? 'is-done' : ''} ${p.date === S.today() ? 'is-today' : ''}`,
    style: { '--type-color': color },
    onclick: () => openPlanned(p),
  },
    el('div', { class: 'row-between', style: { alignItems: 'flex-start' } },
      el('div', { class: 'grow' },
        el('div', { class: 'row', style: { gap: '7px', marginBottom: '4px' } },
          el('span', { class: 'chip type', style: { '--type-color': color } },
            (SESSION_TYPES[p.type] || {}).label || p.type),
          pres.deload ? el('span', { class: 'chip warn' }, 'Deload') : null,
          showDate ? el('span', { class: 'chip' }, fmtDate(p.date)) : null,
          done ? el('span', { class: 'chip ok' }, icon(ICONS.check, 12), 'Done') : null
        ),
        el('div', { class: 'card-title' }, p.title),
        el('div', { class: 'card-sub' }, pres.summary || '')
      ),
      el('div', { class: 'center nowrap', style: { marginLeft: '10px' } },
        el('div', { class: 'xsmall mute2 num' }, pres.estMin ? `~${pres.estMin}m` : '')
      )
    )
  );
  return card;
}

/** Tap a planned session -> see the full prescription, then start it. */
export function openPlanned(p) {
  const pres = p.prescription || {};
  const body = el('div', {});

  if (pres.phaseNote) {
    body.append(el('div', { class: 'card tight', style: { marginBottom: '14px' } },
      el('div', { class: 'xsmall mute2' }, `Week ${p.week} · ${p.phase}`),
      el('div', { class: 'small muted', style: { marginTop: '3px' } }, pres.phaseNote)
    ));
  }

  if (pres.run) {
    const r = pres.run;
    body.append(el('div', { class: 'card', style: { marginBottom: '12px', '--type-color': 'var(--c-run)' } },
      el('div', { class: 'card-title' }, 'The run'),
      el('div', { class: 'stack', style: { marginTop: '8px' } },
        r.distanceMi ? kv('Distance', `${r.distanceMi} mi`) : null,
        r.durationMin ? kv('Duration', `${r.durationMin} min`) : null,
        r.intervals ? kv('Structure', r.intervals) : null,
        r.targetPace ? kv('Target pace', `${r.targetPace} /mi`) : null,
        r.rpe ? kv('Effort', `RPE ${r.rpe}/10`) : null
      ),
      r.note ? el('p', { class: 'small muted', style: { marginTop: '10px', marginBottom: '0' } }, r.note) : null
    ));
  }

  for (const b of (pres.blocks || [])) {
    const list = el('div', { class: 'stack' });
    for (const it of b.items) {
      list.append(el('div', { class: 'card tight' },
        el('div', { class: 'row-between' },
          el('div', { class: 'grow' },
            el('div', { style: { fontWeight: '650' } }, resolveVariation(it, S.get().profile.levels) || it.name),
            it.note ? el('div', { class: 'xsmall mute2' }, it.note) : null
          ),
          el('div', { class: 'chip nowrap' }, targetLabel(it))
        )
      ));
    }
    body.append(el('div', { style: { marginBottom: '14px' } },
      el('div', { class: 'section-head' }, el('h2', {}, b.label)),
      b.note ? el('p', { class: 'small muted' }, b.note) : null,
      list
    ));
  }

  sheet({
    title: p.title,
    body,
    footer: (close) => frag(
      p.status === 'done'
        ? el('button', { class: 'btn ghost', onclick: () => { close(); navigate(`#/session/${p.sessionId}`); } }, 'View log')
        : el('button', { class: 'btn ghost', onclick: () => { markSkipped(p); close(); } }, 'Skip'),
      el('button', {
        class: 'btn primary',
        onclick: () => { close(); startFromPlan(p); },
      }, icon(ICONS.play, 16), p.status === 'done' ? 'Log again' : 'Start')
    ),
  });
}

function markSkipped(p) {
  S.updatePlanned(p.id, x => { x.status = x.status === 'skipped' ? 'planned' : 'skipped'; });
  toast('Marked skipped');
}

function kv(k, v) {
  return el('div', { class: 'kv' }, el('span', { class: 'k' }, k), el('span', { class: 'v' }, v));
}

export function targetLabel(it) {
  if (it.unit === 'time') return `${it.sets} x ${it.timeSec}s`;
  if (it.unit === 'distance') return `${it.sets} x ${it.distanceM}m`;
  return `${it.sets} x ${it.reps}`;
}

/* ---------- advisories ---------- */

function buildAdvisories(st, today) {
  const out = [];

  // Training-load ramp warning.
  const acwr = S.acuteChronic(today);
  if (acwr != null && acwr > 1.5) {
    out.push(advisory('warn', 'Load is ramping fast',
      `This week's training load is ${acwr}x your 4-week average. Above ~1.5x is where injury risk climbs. Consider keeping the next hard session easy.`));
  }

  // Equipment gap — the single highest-leverage purchase for OCR.
  const gap = equipmentGap(st.profile.equipment);
  if (gap && st.sessions.length >= 3) {
    out.push(advisory('tip', `Missing: ${gap.item}`, `${gap.why} ${gap.workaround}`));
  }

  // Backup nudge — local-only storage means a lost phone is a lost history.
  const last = st.settings.lastBackup ? new Date(st.settings.lastBackup) : null;
  const daysSince = last ? Math.round((Date.now() - last) / 86400000) : null;
  if (st.sessions.length >= 5 && (daysSince == null || daysSince > 21)) {
    out.push(advisory('warn', 'Back up your data',
      last ? `Last backup was ${daysSince} days ago.` : 'You have never exported a backup. Your history lives only on this device.',
      el('button', { class: 'btn sm', style: { marginTop: '10px' }, onclick: () => { S.downloadBackup(); toast('Backup downloaded', 'ok'); } },
        icon(ICONS.download, 15), 'Export now')
    ));
  }

  // Streak.
  const stk = S.streak();
  if (stk >= 3) out.push(advisory('ok', `${stk}-day streak`, 'Consistency is the whole game. Keep it going.'));

  return out;
}

function advisory(kind, title, msg, action) {
  const color = kind === 'warn' ? 'var(--warn)' : kind === 'ok' ? 'var(--ok)' : 'var(--c-run)';
  return el('div', { class: 'card session-card', style: { '--type-color': color, cursor: 'default' } },
    el('div', { style: { fontWeight: '700', marginBottom: '3px' } }, title),
    el('div', { class: 'small muted' }, msg),
    action || null
  );
}
