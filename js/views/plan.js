/* ============================================================
   views/plan.js — the training calendar and the block builder.
   ============================================================ */

import * as S from '../store.js';
import {
  el, frag, icon, ICONS, field, input, select, segmented, sheet, closeSheet,
  toast, fmtDate, fmtDateLong, confirmSheet, emptyState, num,
} from '../ui.js';
import { generateBlock, PHASES, phaseFor, isDeloadWeek, typeColor, SESSION_TYPES } from '../planner.js';
import { seedLevels } from '../exercises.js';
import { plannedCard, openPlanned } from './today.js';
import { sessionCard } from './log.js';
import { navigate } from '../router.js';

let viewWeekStart = null;   // survives re-renders within a session

export function renderPlan(params = {}) {
  const st = S.get();
  const today = S.today();

  if (params.new) { setTimeout(() => openBlockBuilder(), 0); }
  if (params.date) viewWeekStart = S.startOfWeek(params.date);
  if (!viewWeekStart) viewWeekStart = S.startOfWeek(today);

  const root = el('div', {});
  const rerender = () => root.replaceWith(renderPlan({}));

  const block = S.activeBlock(today);

  /* ---- header ---- */
  root.append(el('div', { class: 'view-head' },
    el('div', { class: 'row-between' },
      el('div', {},
        el('h1', {}, 'Plan'),
        el('div', { class: 'sub' }, block ? block.name : 'No active training block')
      ),
      el('button', { class: 'btn sm', onclick: () => openBlockBuilder(rerender) },
        icon(ICONS.plus, 15), block ? 'New block' : 'Build')
    )
  ));

  if (!st.blocks.length) {
    root.append(emptyState(
      'No plan yet',
      'Tell me your race (or that you have none yet), how many days you can train, and where your fitness is now. I will lay out every week — runs and strength together, deloads included.',
      el('button', { class: 'btn primary', style: { marginTop: '14px' }, onclick: () => openBlockBuilder(rerender) },
        'Build my training block')
    ));
    root.append(racesSection(st, rerender));
    return root;
  }

  /* ---- block progress ---- */
  if (block) root.append(blockOverview(block, today));

  /* ---- week navigation ---- */
  const weekEnd = S.addDays(viewWeekStart, 6);
  const nav = el('div', { class: 'row-between section' },
    el('button', { class: 'btn sm', onclick: () => { viewWeekStart = S.addDays(viewWeekStart, -7); rerender(); } }, '←'),
    el('div', { class: 'center grow' },
      el('div', { style: { fontWeight: '700' } }, `${fmtDate(viewWeekStart, { month: 'short', day: 'numeric' })} – ${fmtDate(weekEnd, { month: 'short', day: 'numeric' })}`),
      el('div', { class: 'xsmall mute2' }, weekLabel(block, viewWeekStart))
    ),
    el('button', { class: 'btn sm', onclick: () => { viewWeekStart = S.addDays(viewWeekStart, 7); rerender(); } }, '→')
  );
  root.append(nav);

  if (viewWeekStart !== S.startOfWeek(today)) {
    root.append(el('button', {
      class: 'btn sm block section',
      onclick: () => { viewWeekStart = S.startOfWeek(today); rerender(); },
    }, 'Jump to this week'));
  }

  /* ---- week summary ---- */
  const wk = S.weeklyStats(viewWeekStart);
  const planned = S.plannedBetween(viewWeekStart, weekEnd);
  const plannedMiles = planned.reduce((t, p) => t + (p.prescription?.run?.distanceMi || 0), 0);
  const plannedMin = planned.reduce((t, p) => t + (p.prescription?.estMin || 0), 0);

  root.append(el('div', { class: 'grid-2 section' },
    el('div', { class: 'stat' },
      el('div', { class: 'k' }, 'Planned'),
      el('div', { class: 'v num' }, String(planned.length), el('span', { class: 'u' }, 'sessions'))),
    el('div', { class: 'stat' },
      el('div', { class: 'k' }, 'Run volume'),
      el('div', { class: 'v num' }, plannedMiles.toFixed(1), el('span', { class: 'u' }, 'mi'))),
    el('div', { class: 'stat' },
      el('div', { class: 'k' }, 'Est. time'),
      el('div', { class: 'v num' }, String(Math.round(plannedMin / 60)), el('span', { class: 'u' }, 'hr'))),
    el('div', { class: 'stat' },
      el('div', { class: 'k' }, 'Completed'),
      el('div', { class: 'v num' }, String(wk.doneCount), el('span', { class: 'u' }, `/ ${planned.length}`)))
  ));

  /* ---- day-by-day ---- */
  const days = el('div', { class: 'stack section' });
  for (let i = 0; i < 7; i++) {
    const date = S.addDays(viewWeekStart, i);
    const dayPlanned = planned.filter(p => p.date === date);
    const dayLogged = S.sessionsOn(date).filter(s => !s.plannedId);
    const isToday = date === today;

    const head = el('div', { class: 'row-between', style: { marginTop: i ? '14px' : '0', marginBottom: '6px' } },
      el('div', { class: 'row', style: { gap: '8px' } },
        el('span', { style: { fontWeight: '700', color: isToday ? 'var(--accent)' : 'inherit' } },
          fmtDate(date, { weekday: 'long' })),
        el('span', { class: 'xsmall mute2 num' }, fmtDate(date, { month: 'short', day: 'numeric' })),
        isToday ? el('span', { class: 'chip accent' }, 'Today') : null
      ),
      el('button', {
        class: 'btn sm ghost', style: { minHeight: '30px', padding: '0 9px' },
        onclick: () => navigate(`#/session/new?date=${date}`),
      }, icon(ICONS.plus, 14))
    );
    days.append(head);

    if (!dayPlanned.length && !dayLogged.length) {
      days.append(el('div', { class: 'card tight', style: { opacity: '.55' } },
        el('span', { class: 'small mute2' }, 'Rest')));
    } else {
      for (const p of dayPlanned) days.append(plannedCard(p));
      for (const s of dayLogged) days.append(sessionCard(s));
    }
  }
  root.append(days);

  root.append(racesSection(st, rerender));
  root.append(blocksSection(st, rerender));

  return root;
}

function weekLabel(block, weekStart) {
  if (!block) return '';
  const idx = Math.floor(S.daysBetween(block.startDate, weekStart) / 7);
  if (idx < 0 || idx >= block.weeks) return 'Outside your current block';
  const weeksToRace = block.raceDate
    ? Math.ceil((S.daysBetween(block.startDate, block.raceDate) + 1) / 7)
    : null;
  const phase = phaseFor(idx, block.weeks, weeksToRace);
  return `Week ${idx + 1} of ${block.weeks} · ${phase.label}${isDeloadWeek(idx, block.weeks) ? ' (deload)' : ''}`;
}

/* ---------- block overview ---------- */

function blockOverview(block, today) {
  const elapsed = Math.floor(S.daysBetween(block.startDate, today) / 7);
  const pct = Math.max(0, Math.min(100, Math.round(((elapsed + 1) / block.weeks) * 100)));
  const weeksToRace = block.raceDate
    ? Math.ceil((S.daysBetween(block.startDate, block.raceDate) + 1) / 7)
    : null;
  const phase = phaseFor(Math.max(0, elapsed), block.weeks, weeksToRace);

  return el('div', { class: 'card section' },
    el('div', { class: 'row-between', style: { marginBottom: '10px' } },
      el('div', {},
        el('div', { class: 'card-title' }, block.name),
        el('div', { class: 'card-sub' }, `Week ${Math.max(1, elapsed + 1)} of ${block.weeks} · ${block.daysPerWeek} days/week`)
      ),
      el('span', { class: 'chip accent' }, phase.label)
    ),
    el('div', { class: 'progress-track' }, el('div', { class: 'progress-fill', style: { width: `${pct}%` } })),
    el('p', { class: 'small muted', style: { marginTop: '10px', marginBottom: '0' } }, phase.note)
  );
}

/* ---------- races ---------- */

function racesSection(st, rerender) {
  const upcoming = st.races.filter(r => r.date >= S.today()).sort((a, b) => a.date.localeCompare(b.date));
  const past = st.races.filter(r => r.date < S.today()).sort((a, b) => b.date.localeCompare(a.date));

  const sec = el('div', { class: 'section' },
    el('div', { class: 'section-head' },
      el('h2', {}, 'Races'),
      el('button', { class: 'btn sm ghost', style: { minHeight: '30px' }, onclick: () => openRaceEditor(null, rerender) },
        icon(ICONS.plus, 14), 'Add')
    )
  );

  if (!upcoming.length && !past.length) {
    sec.append(el('div', { class: 'card tight' },
      el('div', { class: 'small muted' }, 'No races on the calendar. Add one whenever you register and the plan will re-aim itself at that date.')));
    return sec;
  }

  const stack = el('div', { class: 'stack' });
  for (const r of upcoming) stack.append(raceCard(r, rerender, true));
  for (const r of past) stack.append(raceCard(r, rerender, false));
  sec.append(stack);
  return sec;
}

function raceCard(r, rerender, upcoming) {
  const days = S.daysBetween(S.today(), r.date);
  return el('button', {
    class: 'card session-card',
    style: { '--type-color': upcoming ? 'var(--accent)' : 'var(--c-rest)', opacity: upcoming ? '1' : '.65' },
    onclick: () => openRaceEditor(r, rerender),
  },
    el('div', { class: 'row-between' },
      el('div', { class: 'grow' },
        el('div', { class: 'card-title' }, r.name),
        el('div', { class: 'card-sub' },
          [fmtDate(r.date, { month: 'long', day: 'numeric', year: 'numeric' }),
           r.type, r.distanceMi ? `${r.distanceMi} mi` : null,
           r.obstacles ? `${r.obstacles} obstacles` : null].filter(Boolean).join(' · '))
      ),
      upcoming ? el('div', { class: 'center nowrap' },
        el('div', { class: 'num', style: { fontWeight: '700' } }, String(days)),
        el('div', { class: 'xsmall mute2' }, 'days')
      ) : null
    )
  );
}

const RACE_PRESETS = [
  { label: 'Spartan Sprint (5k, 20 obstacles)', type: 'Spartan Sprint', distanceMi: 3.1, obstacles: 20 },
  { label: 'Spartan Super (10k, 25 obstacles)', type: 'Spartan Super', distanceMi: 6.2, obstacles: 25 },
  { label: 'Spartan Beast (21k, 30 obstacles)', type: 'Spartan Beast', distanceMi: 13.1, obstacles: 30 },
  { label: 'Spartan Trifecta weekend', type: 'Spartan Trifecta', distanceMi: 22.4, obstacles: 75 },
  { label: '5k', type: 'Road 5k', distanceMi: 3.1, obstacles: 0 },
  { label: '10k', type: 'Road 10k', distanceMi: 6.2, obstacles: 0 },
  { label: 'Half marathon', type: 'Half Marathon', distanceMi: 13.1, obstacles: 0 },
  { label: 'Marathon', type: 'Marathon', distanceMi: 26.2, obstacles: 0 },
  { label: 'Other', type: 'Other', distanceMi: null, obstacles: 0 },
];

function openRaceEditor(race, rerender) {
  const isNew = !race;
  const draft = race ? { ...race } : {
    id: S.uid('r'), name: '', type: 'Spartan Super', date: S.addDays(S.today(), 84),
    distanceMi: 6.2, obstacles: 25, notes: '',
  };

  const nameIn = input({ value: draft.name, placeholder: 'e.g. Spartan Super — Asheville', oninput: e => { draft.name = e.target.value; } });
  const dateIn = el('input', { type: 'date', value: draft.date, onchange: e => { draft.date = e.target.value; } });
  const distIn = el('input', { type: 'number', step: '0.1', inputmode: 'decimal', value: draft.distanceMi ?? '', oninput: e => { draft.distanceMi = num(e.target.value); } });
  const obsIn = el('input', { type: 'number', inputmode: 'numeric', value: draft.obstacles ?? 0, oninput: e => { draft.obstacles = num(e.target.value, 0); } });

  const presetSel = select(
    RACE_PRESETS.map((p, i) => ({ value: i, label: p.label })),
    RACE_PRESETS.findIndex(p => p.type === draft.type),
    { onchange: e => {
        const p = RACE_PRESETS[+e.target.value];
        draft.type = p.type;
        draft.distanceMi = p.distanceMi;
        draft.obstacles = p.obstacles;
        distIn.value = p.distanceMi ?? '';
        obsIn.value = p.obstacles ?? 0;
        if (!draft.name) { nameIn.value = p.type; draft.name = p.type; }
      } }
  );

  sheet({
    title: isNew ? 'Add a race' : 'Edit race',
    body: el('div', {},
      field('Race type', presetSel),
      field('Name', nameIn),
      field('Date', dateIn),
      el('div', { class: 'grid-3' },
        field('Distance (mi)', distIn),
        field('Obstacles', obsIn)
      ),
      field('Notes', el('textarea', { placeholder: 'Terrain, elevation, travel, gear…', oninput: e => { draft.notes = e.target.value; } }, draft.notes || ''))
    ),
    footer: (close) => frag(
      !isNew ? el('button', {
        class: 'btn danger',
        onclick: () => {
          S.update(s => { s.races = s.races.filter(x => x.id !== draft.id); });
          close(); rerender(); toast('Race removed');
        },
      }, icon(ICONS.trash, 16)) : null,
      el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        onclick: () => {
          if (!draft.name.trim()) draft.name = draft.type;
          S.update(s => {
            const i = s.races.findIndex(x => x.id === draft.id);
            if (i === -1) s.races.push(draft); else s.races[i] = draft;
          });
          close(); rerender();
          toast(isNew ? 'Race added' : 'Race updated', 'ok');
        },
      }, 'Save')
    ),
  });
}

/* ---------- blocks list ---------- */

function blocksSection(st, rerender) {
  if (!st.blocks.length) return el('div', {});
  const sec = el('div', { class: 'section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Training blocks'))
  );
  const stack = el('div', { class: 'stack' });
  for (const b of [...st.blocks].reverse()) {
    const end = S.addDays(b.startDate, b.weeks * 7 - 1);
    const active = S.today() >= b.startDate && S.today() <= end;
    stack.append(el('div', { class: 'card tight' },
      el('div', { class: 'row-between' },
        el('div', { class: 'grow' },
          el('div', { style: { fontWeight: '650' } }, b.name),
          el('div', { class: 'xsmall mute2' },
            `${fmtDate(b.startDate, { month: 'short', day: 'numeric' })} – ${fmtDate(end, { month: 'short', day: 'numeric' })} · ${b.weeks} weeks`)
        ),
        el('div', { class: 'row', style: { gap: '6px' } },
          active ? el('span', { class: 'chip ok' }, 'Active') : null,
          el('button', {
            class: 'icon-btn', 'aria-label': 'Delete block',
            onclick: () => confirmSheet({
              title: 'Delete this block?',
              message: 'Planned sessions from this block are removed. Sessions you already logged are kept.',
              confirmLabel: 'Delete block', danger: true,
              onConfirm: () => {
                S.update(s => {
                  s.blocks = s.blocks.filter(x => x.id !== b.id);
                  s.planned = s.planned.filter(p => p.blockId !== b.id || p.status === 'done');
                });
                rerender(); toast('Block deleted');
              },
            }),
          }, icon(ICONS.trash, 15))
        )
      )
    ));
  }
  sec.append(stack);
  return sec;
}

/* ---------- the block builder ---------- */

export function openBlockBuilder(rerender = () => location.reload()) {
  const st = S.get();
  const race = S.nextRace();

  const draft = {
    goal: 'spartan',
    daysPerWeek: st.profile.daysPerWeek || 4,
    weeks: 8,
    raceId: race ? race.id : null,
    startDate: S.today(),
    baseline: { ...st.profile.baseline },
  };

  const raceOptions = [{ value: '', label: 'No race — year-round training' }]
    .concat(st.races.filter(r => r.date >= S.today())
      .map(r => ({ value: r.id, label: `${r.name} — ${fmtDate(r.date, { month: 'short', day: 'numeric' })}` })));

  const weeksField = field('Block length',
    select([4, 6, 8, 10, 12, 16].map(w => ({ value: w, label: `${w} weeks` })), draft.weeks,
      { onchange: e => { draft.weeks = +e.target.value; } }),
    'Ignored when a race is selected — the block sizes itself to land on race day.');

  const raceSel = select(raceOptions, draft.raceId || '', {
    onchange: e => {
      draft.raceId = e.target.value || null;
      weeksField.style.opacity = draft.raceId ? '.45' : '1';
      weeksField.querySelector('select').disabled = !!draft.raceId;
    },
  });
  if (draft.raceId) { weeksField.style.opacity = '.45'; weeksField.querySelector('select').disabled = true; }

  const b = draft.baseline;
  const bl = (label, key, hint, attrs = {}) => field(label,
    el('input', {
      type: 'number', inputmode: 'decimal', value: b[key] ?? '', ...attrs,
      oninput: e => { b[key] = num(e.target.value, b[key]); },
    }), hint);

  const body = el('div', {},
    el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', {}, 'Goal')),
      field('Target', select([
        { value: 'spartan', label: 'Spartan / OCR' },
        { value: 'running', label: 'Road racing' },
        { value: 'general', label: 'General fitness' },
      ], draft.goal, { onchange: e => { draft.goal = e.target.value; } })),
      field('Race', raceSel),
      weeksField,
      field('Days per week', segmented(
        [3, 4, 5, 6].map(d => ({ value: d, label: String(d) })),
        draft.daysPerWeek, v => { draft.daysPerWeek = +v; }
      )),
      field('Start', el('input', { type: 'date', value: draft.startDate, onchange: e => { draft.startDate = e.target.value; } }),
        'The block starts on the Monday of this week.')
    ),

    el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', {}, 'Where you are now')),
      el('p', { class: 'small muted' },
        'Be honest rather than optimistic — every prescription is scaled off these numbers. You can retest and update them any time.'),
      bl('Longest comfortable run (mi)', 'longRunMi', 'Not your PR — what you could run today without wrecking yourself.', { step: '0.5' }),
      bl('Current weekly mileage', 'weeklyMi', null, { step: '1' }),
      field('Easy pace (min/mi)', el('input', {
        type: 'text', value: b.easyPace || '', placeholder: '10:30',
        oninput: e => { b.easyPace = e.target.value; },
      }), 'Conversational pace, not race pace.'),
      el('div', { class: 'grid-3' },
        bl('Max push-ups', 'maxPushups'),
        bl('Max pull-ups', 'maxPullups'),
        bl('Dead hang (sec)', 'maxHangSec')
      ),
      bl('Burpees in 2 min', 'maxBurpees2min', 'The Spartan penalty is 30. Knowing this number lets the plan calibrate your finishers.')
    )
  );

  sheet({
    title: 'Build a training block',
    body,
    footer: (close) => frag(
      el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        onclick: () => {
          const selectedRace = draft.raceId ? st.races.find(r => r.id === draft.raceId) : null;

          S.update(s => {
            s.profile.baseline = { ...s.profile.baseline, ...draft.baseline };
            s.profile.daysPerWeek = draft.daysPerWeek;
            // Fills in any movement that has no rung yet; anything you have
            // already progressed or set by hand is left alone.
            s.profile.levels = seedLevels(s.profile.baseline, s.profile.equipment, s.profile.levels);
          });

          const { block, planned } = generateBlock({
            startDate: draft.startDate,
            weeks: draft.weeks,
            daysPerWeek: draft.daysPerWeek,
            goal: draft.goal,
            raceId: selectedRace?.id || null,
            raceDate: selectedRace?.date || null,
            baseline: S.get().profile.baseline,
            equipment: S.get().profile.equipment,
            levels: S.get().profile.levels,
          });

          S.update(s => { s.blocks.push(block); });
          S.replaceBlockPlan(block.id, planned);

          close();
          viewWeekStart = S.startOfWeek(S.today());
          toast(`${block.weeks}-week block created`, 'ok');
          rerender();
        },
      }, 'Generate plan')
    ),
  });
}
