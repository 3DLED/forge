/* ============================================================
   views/progress.js — am I actually getting fitter?
   Four questions, four answers: running volume, training load,
   movement progression, and personal records.
   ============================================================ */

import * as S from '../store.js';
import {
  el, stat, barChart, lineChart, legend, emptyState, fmtDate, fmtPace,
  select, icon, ICONS,
} from '../ui.js';
import { ALL_EXERCISES, getExercise, levelOf } from '../exercises.js';

let selectedExercise = null;

export function renderProgress() {
  const st = S.get();
  const root = el('div', {});

  root.append(el('div', { class: 'view-head' },
    el('h1', {}, 'Progress'),
    el('div', { class: 'sub' }, 'The trends that matter, and nothing that does not')
  ));

  if (st.sessions.length < 2) {
    root.append(emptyState(
      'Not enough data yet',
      'Log a few sessions and the charts fill in. Two weeks is usually enough for the trends to mean something.'
    ));
    return root;
  }

  const weeks = S.loadSeries(12);

  /* ---- headline numbers ---- */
  const last4 = weeks.slice(-4);
  const prev4 = weeks.slice(-8, -4);
  const miles4 = last4.reduce((t, w) => t + w.miles, 0);
  const milesPrev4 = prev4.reduce((t, w) => t + w.miles, 0);
  const trend = milesPrev4 ? Math.round(((miles4 - milesPrev4) / milesPrev4) * 100) : null;
  const acwr = S.acuteChronic();

  root.append(el('div', { class: 'grid-2 section' },
    stat('4-week miles', miles4.toFixed(0), 'mi',
      trend != null ? `${trend >= 0 ? '+' : ''}${trend}% vs prior` : null),
    stat('Avg sessions/wk', (last4.reduce((t, w) => t + w.sessionCount, 0) / 4).toFixed(1)),
    stat('Load ratio', acwr ?? '—', null, acwr ? loadVerdict(acwr) : 'needs 5 weeks'),
    stat('Streak', S.streak(), S.streak() === 1 ? 'day' : 'days')
  ));

  /* ---- weekly mileage ---- */
  root.append(chartCard(
    'Weekly running volume',
    'Steady upward stair-steps with regular dips are exactly what you want. Straight-line increases are how people get hurt.',
    barChart(
      weeks.map((w, i) => ({
        label: fmtDate(w.weekStart, { month: 'short', day: 'numeric' }),
        value: w.miles,
        tick: i % 3 === 0 ? fmtDate(w.weekStart, { month: 'short', day: 'numeric' }) : null,
        color: 'var(--c-run)',
        dim: i === weeks.length - 1,
      })),
      { valueFmt: v => `${v}` }
    ),
    'The final bar is the current week in progress.'
  ));

  /* ---- training load ---- */
  const loadVals = weeks.map(w => w.load);
  const chronic = loadVals.map((_, i) => {
    const window = loadVals.slice(Math.max(0, i - 3), i + 1).filter(v => v > 0);
    return window.length ? Math.round(window.reduce((a, b) => a + b, 0) / window.length) : null;
  });

  root.append(chartCard(
    'Training load',
    'Session RPE x minutes — one number covering running and lifting together. The line is your 4-week rolling average.',
    lineChart(
      [
        { name: 'Weekly load', values: loadVals, color: 'var(--accent)' },
        { name: '4-wk average', values: chronic, color: 'var(--text-mute)' },
      ],
      weeks.map((w, i) => (i % 3 === 0 ? fmtDate(w.weekStart, { month: 'short', day: 'numeric' }) : '')),
    ),
    null,
    legend([
      { name: 'Weekly load', color: 'var(--accent)' },
      { name: '4-week average', color: 'var(--text-mute)' },
    ])
  ));

  /* ---- session mix ---- */
  root.append(sessionMix(weeks));

  /* ---- exercise progression ---- */
  root.append(exerciseProgress(st));

  /* ---- PRs ---- */
  root.append(prSection(st));

  /* ---- ladder standing ---- */
  root.append(ladderSection(st));

  return root;
}

function loadVerdict(acwr) {
  if (acwr > 1.5) return 'ramping fast';
  if (acwr < 0.8) return 'backing off';
  return 'in the sweet spot';
}

function chartCard(title, blurb, chart, footnote, extra) {
  return el('div', { class: 'card section' },
    el('div', { class: 'card-title' }, title),
    blurb ? el('p', { class: 'small muted', style: { marginTop: '4px' } }, blurb) : null,
    el('div', { style: { marginTop: '10px' } }, chart),
    extra || null,
    footnote ? el('p', { class: 'xsmall mute2', style: { marginTop: '8px', marginBottom: '0' } }, footnote) : null
  );
}

/* ---------- session mix ---------- */

function sessionMix(weeks) {
  const types = ['run', 'strength', 'calisthenics', 'conditioning', 'mobility'];
  const colors = {
    run: 'var(--c-run)', strength: 'var(--c-strength)', calisthenics: 'var(--c-grip)',
    conditioning: 'var(--c-cond)', mobility: 'var(--c-mobility)',
  };
  const totals = {};
  for (const w of weeks) for (const [t, n] of Object.entries(w.byType)) totals[t] = (totals[t] || 0) + n;
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  if (!grand) return el('div', {});

  const bar = el('div', {
    style: { display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', marginTop: '10px', background: 'var(--bg-elev-2)' },
  });
  for (const t of types) {
    const n = totals[t] || 0;
    if (!n) continue;
    bar.append(el('div', {
      style: { width: `${(n / grand) * 100}%`, background: colors[t] },
      title: `${t}: ${n}`,
    }));
  }

  return el('div', { class: 'card section' },
    el('div', { class: 'card-title' }, 'Training mix — last 12 weeks'),
    el('p', { class: 'small muted', style: { marginTop: '4px' } },
      'Hybrid training only works if the balance holds. If one color swallows the bar, something is being neglected.'),
    bar,
    legend(types.filter(t => totals[t]).map(t => ({
      name: `${t} (${totals[t]})`, color: colors[t],
    })))
  );
}

/* ---------- exercise progression ---------- */

function exerciseProgress(st) {
  // Only movements with enough logged history to plot.
  const counts = {};
  for (const s of st.sessions) {
    for (const e of (s.entries || [])) {
      if ((e.sets || []).some(x => x.done)) counts[e.exerciseId] = (counts[e.exerciseId] || 0) + 1;
    }
  }
  const options = Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .map(([id]) => getExercise(id))
    .filter(Boolean)
    .sort((a, b) => counts[b.id] - counts[a.id]);

  if (!options.length) {
    return el('div', { class: 'card section' },
      el('div', { class: 'card-title' }, 'Movement progression'),
      el('p', { class: 'small muted', style: { marginBottom: '0' } },
        'Log the same movement across two or more sessions and its trend line appears here.')
    );
  }

  if (!selectedExercise || !options.find(o => o.id === selectedExercise)) {
    selectedExercise = options[0].id;
  }

  const host = el('div', {});

  const draw = () => {
    host.replaceChildren();
    const ex = getExercise(selectedExercise);
    const points = [];

    // Oldest first, so the chart reads left to right.
    for (const s of [...st.sessions].reverse()) {
      for (const e of (s.entries || [])) {
        if (e.exerciseId !== selectedExercise) continue;
        const done = e.sets.filter(x => x.done);
        if (!done.length) continue;
        const best = ex.unit === 'time'
          ? Math.max(...done.map(x => x.timeSec || 0))
          : ex.unit === 'distance'
            ? Math.max(...done.map(x => x.distanceM || 0))
            : Math.max(...done.map(x => (x.weight ? Math.round(x.weight * (1 + (x.reps || 0) / 30)) : x.reps || 0)));
        const volume = done.reduce((t, x) =>
          t + (ex.unit === 'reps' ? (x.reps || 0) : ex.unit === 'time' ? (x.timeSec || 0) : (x.distanceM || 0)), 0);
        if (best > 0) points.push({ date: s.date, best, volume });
      }
    }

    if (points.length < 2) {
      host.append(el('p', { class: 'small muted' }, 'Not enough logged sets for this movement yet.'));
      return;
    }

    const unitLabel = ex.unit === 'time' ? 'seconds' : ex.unit === 'distance' ? 'meters' : (points.some(p => p.best > 60) ? 'est. 1RM lb' : 'reps');

    host.append(lineChart(
      [
        { name: 'Best set', values: points.map(p => p.best), color: 'var(--accent)' },
        { name: 'Total volume', values: points.map(p => p.volume), color: 'var(--c-grip)' },
      ],
      points.map((p, i) => (i % Math.max(1, Math.ceil(points.length / 5)) === 0 ? fmtDate(p.date, { month: 'short', day: 'numeric' }) : '')),
    ));
    host.append(legend([
      { name: `Best set (${unitLabel})`, color: 'var(--accent)' },
      { name: 'Session volume', color: 'var(--c-grip)' },
    ]));

    const first = points[0].best, last = points[points.length - 1].best;
    const change = first ? Math.round(((last - first) / first) * 100) : 0;
    host.append(el('p', { class: 'small muted', style: { marginTop: '10px', marginBottom: '0' } },
      change >= 0
        ? `Best set is up ${change}% since ${fmtDate(points[0].date, { month: 'short', day: 'numeric' })}.`
        : `Best set is down ${Math.abs(change)}% since ${fmtDate(points[0].date, { month: 'short', day: 'numeric' })}. Worth checking whether fatigue or a harder variation explains it.`));
  };

  const picker = select(
    options.map(o => ({ value: o.id, label: o.name })),
    selectedExercise,
    { onchange: e => { selectedExercise = e.target.value; draw(); } }
  );

  draw();

  return el('div', { class: 'card section' },
    el('div', { class: 'card-title' }, 'Movement progression'),
    el('div', { style: { margin: '10px 0' } }, picker),
    host
  );
}

/* ---------- PRs ---------- */

function prSection(st) {
  const entries = Object.entries(st.prs || {});
  if (!entries.length) return el('div', {});

  const rows = entries
    .sort((a, b) => b[1].date.localeCompare(a[1].date))
    .slice(0, 12)
    .map(([key, pr]) => {
      let display;
      if (pr.unit === 'sec/mi') display = `${fmtPace(pr.value)}/mi`;
      else if (pr.unit === 'sec') display = `${pr.value}s`;
      else display = `${pr.value} ${pr.unit}`;
      return el('div', { class: 'kv' },
        el('span', { class: 'k' }, pr.label || key),
        el('span', { class: 'v' }, display,
          el('span', { class: 'xsmall mute2', style: { marginLeft: '8px', fontWeight: '400' } },
            fmtDate(pr.date, { month: 'short', day: 'numeric' })))
      );
    });

  return el('div', { class: 'card section' },
    el('div', { class: 'card-title' }, 'Personal records'),
    el('div', { style: { marginTop: '6px' } }, rows)
  );
}

/* ---------- ladder standing ---------- */

function ladderSection(st) {
  const levels = st.profile.levels || {};
  const climbed = Object.keys(levels)
    .map(id => getExercise(id))
    .filter(ex => ex && levels[ex.id] > 0)
    .sort((a, b) => (levels[b.id] / b.ladder.length) - (levels[a.id] / a.ladder.length));

  if (!climbed.length) {
    return el('div', { class: 'card section' },
      el('div', { class: 'card-title' }, 'Progression ladders'),
      el('p', { class: 'small muted', style: { marginBottom: '0' } },
        'With two fixed kettlebell weights, strength progress shows up as harder variations rather than heavier loads. Clear every prescribed set and the app offers you the next rung.')
    );
  }

  const rows = climbed.map(ex => {
    const lvl = levelOf(ex, levels);
    const pct = Math.round(((lvl + 1) / ex.ladder.length) * 100);
    return el('div', { style: { marginBottom: '12px' } },
      el('div', { class: 'row-between', style: { marginBottom: '4px' } },
        el('span', { class: 'small', style: { fontWeight: '650' } }, ex.name),
        el('span', { class: 'xsmall mute2 num' }, `${lvl + 1}/${ex.ladder.length}`)
      ),
      el('div', { class: 'progress-track' }, el('div', { class: 'progress-fill', style: { width: `${pct}%` } })),
      el('div', { class: 'xsmall mute2', style: { marginTop: '3px' } }, ex.ladder[lvl])
    );
  });

  return el('div', { class: 'card section' },
    el('div', { class: 'card-title' }, 'Progression ladders'),
    el('p', { class: 'small muted', style: { marginTop: '4px' } },
      'How far up each movement you have climbed.'),
    el('div', { style: { marginTop: '12px' } }, rows)
  );
}
