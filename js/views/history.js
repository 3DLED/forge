/* ============================================================
   views/history.js — everything you have actually done.
   ============================================================ */

import * as S from '../store.js';
import { el, icon, ICONS, fmtDate, fmtDuration, fmtPace, emptyState, stat, select } from '../ui.js';
import { SESSION_TYPES } from '../planner.js';
import { sessionCard } from './log.js';
import { navigate } from '../router.js';

let filterType = 'all';
let searchTerm = '';

export function renderHistory() {
  const st = S.get();
  const root = el('div', {});
  const rerender = () => root.replaceWith(renderHistory());

  root.append(el('div', { class: 'view-head' },
    el('h1', {}, 'History'),
    el('div', { class: 'sub' }, `${st.sessions.length} session${st.sessions.length === 1 ? '' : 's'} logged`)
  ));

  if (!st.sessions.length) {
    root.append(emptyState(
      'Nothing logged yet',
      'Finish a workout and it shows up here. You can also bulk-import your whole Strava history from More → Import.',
      el('div', { class: 'btn-row', style: { marginTop: '14px' } },
        el('button', { class: 'btn sm', onclick: () => navigate('#/session/new') }, 'Log a session'),
        el('button', { class: 'btn sm', onclick: () => navigate('#/settings') }, 'Import history')
      )
    ));
    return root;
  }

  /* ---- lifetime totals ---- */
  const totals = lifetimeTotals(st.sessions);
  root.append(el('div', { class: 'grid-2 section' },
    stat('Total miles', totals.miles.toFixed(0), 'mi'),
    stat('Sessions', totals.count),
    stat('Time', `${Math.round(totals.minutes / 60)}`, 'hr'),
    stat('Sets', totals.sets)
  ));

  /* ---- filters ---- */
  const typeOptions = [{ value: 'all', label: 'All types' }]
    .concat(Object.values(SESSION_TYPES).filter(t => t.id !== 'rest').map(t => ({ value: t.id, label: t.label })));

  root.append(el('div', { class: 'section' },
    el('div', { class: 'row', style: { gap: '8px' } },
      el('input', {
        type: 'search', placeholder: 'Search sessions…', value: searchTerm,
        class: 'grow',
        oninput: e => { searchTerm = e.target.value; drawList(); },
      }),
      select(typeOptions, filterType, {
        style: { maxWidth: '140px' },
        onchange: e => { filterType = e.target.value; drawList(); },
      })
    )
  ));

  const listHost = el('div', { class: 'section' });
  root.append(listHost);

  function drawList() {
    listHost.replaceChildren();
    const q = searchTerm.trim().toLowerCase();
    const list = st.sessions.filter(s => {
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (!q) return true;
      return (s.title || '').toLowerCase().includes(q)
        || (s.notes || '').toLowerCase().includes(q)
        || (s.entries || []).some(e => e.name.toLowerCase().includes(q));
    });

    if (!list.length) {
      listHost.append(emptyState('No matches', 'Try a different search or filter.'));
      return;
    }

    let currentMonth = null;
    for (const s of list) {
      const month = s.date.slice(0, 7);
      if (month !== currentMonth) {
        currentMonth = month;
        const monthSessions = list.filter(x => x.date.slice(0, 7) === month);
        const mi = monthSessions.reduce((t, x) => t + (x.run?.distanceMi || 0), 0);
        listHost.append(el('div', { class: 'section-head', style: { marginTop: '18px' } },
          el('h2', {}, fmtDate(`${month}-01`, { month: 'long', year: 'numeric' })),
          el('span', { class: 'xsmall mute2 num' },
            `${monthSessions.length} sessions${mi ? ` · ${mi.toFixed(1)} mi` : ''}`)
        ));
      }
      listHost.append(el('div', { style: { marginBottom: '8px' } }, sessionCard(s, { showDate: true })));
    }
  }

  drawList();
  return root;
}

function lifetimeTotals(sessions) {
  let miles = 0, minutes = 0, sets = 0;
  for (const s of sessions) {
    miles += s.run?.distanceMi || 0;
    minutes += s.durationMin || (s.run?.durationSec ? s.run.durationSec / 60 : 0);
    sets += (s.entries || []).reduce((t, e) => t + e.sets.filter(x => x.done).length, 0);
  }
  return { miles, minutes, sets, count: sessions.length };
}
