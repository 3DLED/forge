/* ============================================================
   app.js — bootstrap: theme, routes, onboarding, service worker.
   ============================================================ */

import * as S from './store.js';
import { route, setNotFound, start, render, navigate } from './router.js';
import { el, frag, sheet, toast, field, input, segmented, icon, ICONS, num } from './ui.js';
import { seedLevels } from './exercises.js';
import { renderToday } from './views/today.js';
import { renderPlan, openBlockBuilder } from './views/plan.js';
import { renderSession } from './views/log.js';
import { renderHistory } from './views/history.js';
import { renderProgress } from './views/progress.js';
import { renderSettings } from './views/settings.js';

/* ---------- theme ---------- */

function applyTheme() {
  const theme = S.get().profile.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f6fa' : '#0e1116');
}

document.getElementById('btn-theme').addEventListener('click', () => {
  const next = (S.get().profile.theme === 'light') ? 'dark' : 'light';
  S.update(s => { s.profile.theme = next; });
  applyTheme();
});

/* ---------- race countdown in the app bar ---------- */

function updateCountdown() {
  const badge = document.getElementById('race-countdown');
  const race = S.nextRace();
  if (!race) { badge.hidden = true; return; }
  const days = S.daysBetween(S.today(), race.date);
  badge.hidden = false;
  badge.textContent = days === 0 ? 'RACE DAY' : `${days}d to ${race.name.split(' ').slice(0, 2).join(' ')}`;
}

/* ---------- routes ---------- */

route('#/today', () => renderToday());
route('#/plan', (p) => renderPlan(p));
route('#/history', () => renderHistory());
route('#/progress', () => renderProgress());
route('#/settings', () => renderSettings());
route('#/session/:id', (p) => renderSession(p.id, p));

setNotFound(() => {
  const d = el('div', { class: 'empty' },
    el('h3', {}, 'Page not found'),
    el('button', { class: 'btn sm', style: { marginTop: '12px' }, onclick: () => navigate('#/today') }, 'Back to Today')
  );
  return d;
});

/* ---------- onboarding ---------- */

function maybeOnboard() {
  const st = S.get();
  if (st.profile.onboarded) return;

  const draft = {
    name: '',
    daysPerWeek: st.profile.daysPerWeek,
    equipment: new Set(st.profile.equipment),
    baseline: { ...st.profile.baseline },
  };

  const b = draft.baseline;
  const bl = (label, key, hint, attrs = {}) => field(label,
    el('input', {
      type: 'number', inputmode: 'decimal', value: b[key] ?? '', ...attrs,
      oninput: e => { b[key] = num(e.target.value, b[key]); },
    }), hint);

  const eqOptions = [
    { id: 'kb10', label: '10 lb kettlebell' },
    { id: 'kb36', label: '36 lb kettlebell' },
    { id: 'bar', label: 'Pull-up bar' },
    { id: 'dbs', label: 'Dumbbells' },
    { id: 'band', label: 'Resistance bands' },
    { id: 'ruck', label: 'Backpack / ruck' },
    { id: 'gym', label: 'Full gym' },
  ];

  sheet({
    title: 'Welcome to Forge',
    body: el('div', {},
      el('p', { class: 'muted small' },
        'Four quick things and your first training block is ready. All of it is editable later.'),

      field('What should I call you?', input({
        placeholder: 'First name', oninput: e => { draft.name = e.target.value; },
      })),

      field('How many days a week can you train?', segmented(
        [3, 4, 5, 6].map(d => ({ value: d, label: String(d) })),
        draft.daysPerWeek, v => { draft.daysPerWeek = +v; }
      )),

      el('div', { class: 'field' },
        el('span', { class: 'lbl' }, 'What do you have to train with?'),
        el('div', { class: 'stack' },
          eqOptions.map(o => el('label', { class: 'check' },
            el('input', {
              type: 'checkbox', checked: draft.equipment.has(o.id),
              onchange: e => { e.target.checked ? draft.equipment.add(o.id) : draft.equipment.delete(o.id); },
            }),
            el('span', { class: 'grow' }, o.label)
          ))
        ),
        el('span', { class: 'hint' }, 'Bodyweight is always included. Only movements you can actually do get prescribed.')
      ),

      el('div', { class: 'divider' }),
      el('p', { class: 'small muted' },
        'Last part — roughly where is your fitness today? Honest beats optimistic; every prescription scales off these.'),
      bl('Longest comfortable run (mi)', 'longRunMi', null, { step: '0.5' }),
      el('div', { class: 'grid-3' },
        bl('Max push-ups', 'maxPushups'),
        bl('Max pull-ups', 'maxPullups'),
        bl('Dead hang (s)', 'maxHangSec')
      )
    ),
    footer: (close) => frag(
      el('button', {
        class: 'btn primary block',
        onclick: () => {
          draft.equipment.add('bw');
          S.update(s => {
            s.profile.name = draft.name.trim();
            s.profile.daysPerWeek = draft.daysPerWeek;
            s.profile.equipment = [...draft.equipment];
            s.profile.baseline = { ...s.profile.baseline, ...draft.baseline };
            // Start every movement at a rung that matches your actual
            // fitness rather than at the bottom of the ladder.
            s.profile.levels = seedLevels(s.profile.baseline, s.profile.equipment, s.profile.levels);
            s.profile.onboarded = true;
          });
          close();
          render();
          setTimeout(() => openBlockBuilder(() => { render(); updateCountdown(); }), 250);
        },
      }, 'Build my plan')
    ),
  });
}

/* ---------- service worker ---------- */

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;   // SW needs http(s)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

/* ---------- boot ---------- */

S.onError(msg => toast(msg, 'bad'));
S.load();
applyTheme();
updateCountdown();
S.subscribe(updateCountdown);
start();
registerSW();
maybeOnboard();

// Recompute derived data once on boot in case a backup was hand-edited.
S.recomputePRs();
