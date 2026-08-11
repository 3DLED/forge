/* ============================================================
   views/settings.js — profile, equipment, backup, import.
   ============================================================ */

import * as S from '../store.js';
import {
  el, frag, icon, ICONS, field, input, select, segmented, sheet, closeSheet,
  toast, confirmSheet, num, fmtDate,
} from '../ui.js';
import { EQUIPMENT, ALL_EXERCISES, availableExercises, variationName, levelOf, equipmentGap, seedLevels } from '../exercises.js';
import { importFile, dedupe } from '../importers.js';
import { navigate } from '../router.js';

export function renderSettings() {
  const st = S.get();
  const root = el('div', {});
  const rerender = () => root.replaceWith(renderSettings());

  root.append(el('div', { class: 'view-head' },
    el('h1', {}, 'More'),
    el('div', { class: 'sub' }, 'Profile, equipment, and your data')
  ));

  /* ---- profile ---- */
  root.append(el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Profile')),
    field('Name', input({
      value: st.profile.name, placeholder: 'Your name',
      oninput: e => S.update(s => { s.profile.name = e.target.value; }),
    })),
    field('Units', segmented(
      [{ value: 'imperial', label: 'Miles / lb' }, { value: 'metric', label: 'km / kg' }],
      st.profile.units,
      v => { S.update(s => { s.profile.units = v; }); toast('Units updated'); }
    )),
    field('Theme', segmented(
      [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
      st.profile.theme,
      v => {
        S.update(s => { s.profile.theme = v; });
        document.documentElement.setAttribute('data-theme', v);
      }
    ))
  ));

  /* ---- equipment ---- */
  root.append(equipmentSection(st, rerender));

  /* ---- baseline ---- */
  root.append(baselineSection(st, rerender));

  /* ---- import runs ---- */
  root.append(importSection(rerender));

  /* ---- backup ---- */
  root.append(backupSection(st, rerender));

  /* ---- exercise library ---- */
  root.append(el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Movement library')),
    el('p', { class: 'small muted' },
      `${availableExercises(st.profile.equipment).length} movements available with your current equipment, out of ${ALL_EXERCISES.length} total.`),
    el('button', { class: 'btn block', onclick: () => openLibrary(st) }, 'Browse movements')
  ));

  /* ---- about ---- */
  root.append(el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'About')),
    el('p', { class: 'small muted' },
      'Forge is yours. Everything runs on this device, no account, no subscription, no data leaving your phone. Add it to your home screen and it works offline.'),
    el('div', { class: 'kv' }, el('span', { class: 'k' }, 'Version'), el('span', { class: 'v' }, '1.0.0')),
    el('div', { class: 'kv' }, el('span', { class: 'k' }, 'Sessions stored'), el('span', { class: 'v num' }, String(st.sessions.length))),
    el('div', { class: 'kv' }, el('span', { class: 'k' }, 'Storage used'), el('span', { class: 'v num' }, storageUsed()))
  ));

  /* ---- danger zone ---- */
  root.append(el('div', { class: 'section' },
    el('button', {
      class: 'btn danger block',
      onclick: () => confirmSheet({
        title: 'Erase everything?',
        message: 'Every session, plan, and record is deleted permanently. Export a backup first if there is any chance you want this back.',
        confirmLabel: 'Erase all data', danger: true,
        onConfirm: () => { S.resetAll(); toast('All data erased'); navigate('#/today'); location.reload(); },
      }),
    }, icon(ICONS.trash, 16), 'Erase all data')
  ));

  return root;
}

/* ---------- equipment ---------- */

function equipmentSection(st, rerender) {
  const owned = new Set(st.profile.equipment);
  const gap = equipmentGap(st.profile.equipment);

  const list = el('div', { class: 'stack' },
    Object.values(EQUIPMENT).map(eq => {
      const cb = el('input', {
        type: 'checkbox', checked: owned.has(eq.id),
        onchange: e => {
          S.update(s => {
            const set = new Set(s.profile.equipment);
            if (e.target.checked) set.add(eq.id); else set.delete(eq.id);
            set.add('bw');  // bodyweight is never removable
            s.profile.equipment = [...set];
          });
          toast('Equipment updated');
          rerender();
        },
      });
      if (eq.id === 'bw') cb.disabled = true;
      return el('label', { class: 'check' }, cb, el('span', { class: 'grow' }, eq.label));
    })
  );

  return el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Equipment')),
    el('p', { class: 'small muted' }, 'Plans only ever prescribe movements you can actually do with what you own.'),
    list,
    gap ? el('div', { class: 'card tight', style: { marginTop: '12px', borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--line))' } },
      el('div', { style: { fontWeight: '700', marginBottom: '3px' } }, `Biggest gap: ${gap.item}`),
      el('div', { class: 'small muted' }, gap.why),
      el('div', { class: 'small muted', style: { marginTop: '6px' } }, gap.workaround)
    ) : null
  );
}

/* ---------- baseline ---------- */

function baselineSection(st, rerender) {
  const b = st.profile.baseline;
  const f = (label, key, hint, attrs = {}) => field(label,
    el('input', {
      type: 'number', inputmode: 'decimal', value: b[key] ?? '', ...attrs,
      onchange: e => { S.update(s => { s.profile.baseline[key] = num(e.target.value, b[key]); }); toast('Baseline updated'); },
    }), hint);

  return el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Fitness baseline')),
    el('p', { class: 'small muted' },
      'Retest every 4–6 weeks and update these. New training blocks scale off them, so stale numbers mean a stale plan.'),
    f('Longest comfortable run (mi)', 'longRunMi', null, { step: '0.5' }),
    f('Weekly mileage', 'weeklyMi', null, { step: '1' }),
    field('Easy pace (min/mi)', el('input', {
      type: 'text', value: b.easyPace || '', placeholder: '10:30',
      onchange: e => { S.update(s => { s.profile.baseline.easyPace = e.target.value; }); toast('Baseline updated'); },
    })),
    el('div', { class: 'grid-3' },
      f('Max push-ups', 'maxPushups'),
      f('Max pull-ups', 'maxPullups'),
      f('Dead hang (s)', 'maxHangSec')
    ),
    f('Burpees in 2 min', 'maxBurpees2min'),
    el('div', { class: 'divider' }),
    el('button', {
      class: 'btn block',
      onclick: () => confirmSheet({
        title: 'Recalibrate all movements?',
        message: 'Every movement is reset to the rung that matches your current baseline numbers. Progress you have earned on individual movements is discarded, so only do this after a real retest or a long layoff.',
        confirmLabel: 'Recalibrate',
        onConfirm: () => {
          S.update(s => { s.profile.levels = seedLevels(s.profile.baseline, s.profile.equipment, {}); });
          toast('Movements recalibrated', 'ok');
          rerender();
        },
      }),
    }, 'Recalibrate movement levels'),
    el('p', { class: 'xsmall mute2', style: { marginTop: '8px', marginBottom: '0' } },
      'Resets every progression ladder to match the numbers above.')
  );
}

/* ---------- import ---------- */

function importSection(rerender) {
  const fileIn = el('input', {
    type: 'file', accept: '.csv,.gpx,.tcx,.xml', multiple: true,
    style: { display: 'none' },
    onchange: async e => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      await runImport(files, rerender);
    },
  });

  return el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Import runs')),
    el('p', { class: 'small muted' },
      'Your Apple Watch runs land in Strava. Request a bulk export from Strava (Settings → My Account → Download or Delete Your Account → Request Your Archive), then drop the activities.csv here to pull in your entire history at once.'),
    el('ul', { class: 'small muted', style: { marginBottom: '12px' } },
      el('li', {}, 'Strava bulk export — activities.csv'),
      el('li', {}, 'GPX or TCX files — single activities'),
      el('li', {}, 'Apple Health export.xml — workout summaries')
    ),
    fileIn,
    el('button', { class: 'btn block', onclick: () => fileIn.click() }, icon(ICONS.upload, 16), 'Choose files'),
    el('p', { class: 'xsmall mute2', style: { marginTop: '10px', marginBottom: '0' } },
      'Everything is parsed on this device. Nothing is uploaded anywhere.')
  );
}

async function runImport(files, rerender) {
  let unit = 'auto';
  const errors = [];
  const hasCSV = files.some(f => f.name.toLowerCase().endsWith('.csv'));

  const parseAll = async () => {
    const all = [];
    errors.length = 0;
    for (const f of files) {
      try {
        all.push(...await importFile(f, { distanceUnit: unit }));
      } catch (err) {
        errors.push(`${f.name}: ${err.message}`);
      }
    }
    return all;
  };

  let all = await parseAll();

  if (!all.length) {
    sheet({
      title: 'Import failed',
      body: el('div', {},
        el('p', { class: 'muted small' }, 'Nothing could be read from those files.'),
        errors.map(e => el('p', { class: 'small', style: { color: 'var(--bad)' } }, e))
      ),
    });
    return;
  }

  const statsHost = el('div', {});
  let fresh = [];

  const drawStats = () => {
    const res = dedupe(all, S.get().sessions);
    fresh = res.fresh;
    const miles = fresh.reduce((t, s) => t + (s.run?.distanceMi || 0), 0);
    const longest = fresh.reduce((m, s) => Math.max(m, s.run?.distanceMi || 0), 0);
    const dates = fresh.map(s => s.date).sort();

    statsHost.replaceChildren(
      el('div', { class: 'grid-2', style: { marginBottom: '14px' } },
        el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Activities'), el('div', { class: 'v num' }, String(fresh.length))),
        el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Total miles'), el('div', { class: 'v num' }, miles.toFixed(0))),
        el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Longest'), el('div', { class: 'v num' }, longest.toFixed(1), el('span', { class: 'u' }, 'mi'))),
        el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Duplicates skipped'), el('div', { class: 'v num' }, String(res.skipped)))
      ),
      el('div', { class: 'kv' },
        el('span', { class: 'k' }, 'Date range'),
        el('span', { class: 'v', style: { fontSize: '.86rem' } },
          dates.length ? `${fmtDate(dates[0], { month: 'short', year: 'numeric' })} – ${fmtDate(dates[dates.length - 1], { month: 'short', year: 'numeric' })}` : '—'))
    );

    const btn = document.querySelector('.sheet-foot .btn.primary');
    if (btn) btn.textContent = `Import ${fresh.length}`;
  };

  const body = el('div', {},
    // Getting the unit wrong silently corrupts every mile you own, so the
    // assumption is shown and the numbers above are the sanity check.
    hasCSV ? el('div', { style: { marginBottom: '14px' } },
      field('Distance column is in',
        segmented(
          [{ value: 'auto', label: 'Auto' }, { value: 'km', label: 'Kilometers' }, { value: 'mi', label: 'Miles' }],
          unit,
          async v => { unit = v; all = await parseAll(); drawStats(); }
        ),
        'Strava exports kilometers regardless of your display setting, so Auto is almost always right. Check the longest run below — if it looks wrong, switch this.')
    ) : null,
    statsHost,
    errors.length ? el('div', { style: { marginTop: '10px' } },
      el('p', { class: 'small', style: { color: 'var(--warn)' } }, 'Some files had problems:'),
      errors.map(e => el('p', { class: 'xsmall mute2' }, e))
    ) : null,
    el('p', { class: 'small muted', style: { marginTop: '12px' } },
      'Imported activities are added to your history. Nothing already logged is overwritten.')
  );

  sheet({
    title: 'Ready to import',
    body,
    footer: (close) => frag(
      el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        onclick: () => {
          S.update(s => {
            s.sessions = s.sessions.concat(fresh)
              .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
          });
          S.recomputePRs();
          close();
          toast(`Imported ${fresh.length} activities`, 'ok');
          rerender();
        },
      }, `Import ${all.length}`)
    ),
  });

  drawStats();
}

/* ---------- backup ---------- */

function backupSection(st, rerender) {
  const last = st.settings.lastBackup;

  const restoreIn = el('input', {
    type: 'file', accept: '.json', style: { display: 'none' },
    onchange: async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const text = await f.text();
      sheet({
        title: 'Restore backup',
        body: el('div', {},
          el('p', { class: 'muted small' }, `Restoring from ${f.name}.`),
          el('p', { class: 'small' }, el('strong', {}, 'Replace'), ' wipes what is on this device and uses the backup instead.'),
          el('p', { class: 'small' }, el('strong', {}, 'Merge'), ' keeps everything you have now and adds anything the backup has that this device is missing.')
        ),
        footer: (close) => frag(
          el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          el('button', {
            class: 'btn',
            onclick: () => { doRestore(text, 'merge', close, rerender); },
          }, 'Merge'),
          el('button', {
            class: 'btn danger',
            onclick: () => { doRestore(text, 'replace', close, rerender); },
          }, 'Replace')
        ),
      });
    },
  });

  return el('div', { class: 'card section' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Backup & restore')),
    el('p', { class: 'small muted' },
      'Your data lives only on this device. Export regularly and keep the file in OneDrive — that is also how you move everything to a new phone.'),
    el('div', { class: 'kv' },
      el('span', { class: 'k' }, 'Last backup'),
      el('span', { class: 'v' }, last ? fmtDate(last.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never')
    ),
    restoreIn,
    el('div', { class: 'btn-row', style: { marginTop: '12px' } },
      el('button', { class: 'btn primary', onclick: () => { S.downloadBackup(); toast('Backup downloaded', 'ok'); rerender(); } },
        icon(ICONS.download, 16), 'Export'),
      el('button', { class: 'btn', onclick: () => restoreIn.click() }, icon(ICONS.upload, 16), 'Restore')
    )
  );
}

function doRestore(text, mode, close, rerender) {
  try {
    S.importJSON(text, mode);
    close();
    toast('Backup restored', 'ok');
    location.reload();
  } catch (err) {
    close();
    toast(err.message, 'bad');
  }
}

/* ---------- library browser ---------- */

function openLibrary(st) {
  const results = el('div', {});

  const draw = (q) => {
    results.replaceChildren();
    const owned = new Set(st.profile.equipment);
    const list = ALL_EXERCISES.filter(e =>
      !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.pattern.includes(q.toLowerCase()));

    const groups = {};
    for (const e of list) (groups[e.pattern] ||= []).push(e);

    for (const [pattern, items] of Object.entries(groups)) {
      results.append(el('div', { class: 'section-head', style: { marginTop: '14px' } }, el('h2', {}, pattern)));
      for (const ex of items) {
        const have = ex.equip.some(id => owned.has(id));
        const lvl = levelOf(ex, st.profile.levels);
        results.append(el('div', { class: 'card tight', style: { marginBottom: '8px', opacity: have ? '1' : '.45' } },
          el('div', { class: 'row-between' },
            el('div', { class: 'grow' },
              el('div', { style: { fontWeight: '650' } }, ex.name),
              el('div', { class: 'xsmall mute2' }, `Rung ${lvl + 1}/${ex.ladder.length}: ${ex.ladder[lvl]}`)
            ),
            el('div', { class: 'row', style: { gap: '5px' } },
              ex.ocr ? el('span', { class: 'chip accent' }, 'OCR') : null,
              !have ? el('span', { class: 'chip' }, 'Need gear') : null
            )
          ),
          el('div', { class: 'xsmall mute2', style: { marginTop: '5px' } }, ex.cues)
        ));
      }
    }
  };

  draw('');

  sheet({
    title: 'Movement library',
    body: el('div', {},
      el('input', { type: 'search', placeholder: 'Search…', oninput: e => draw(e.target.value) }),
      results
    ),
  });
}

/* ---------- misc ---------- */

function storageUsed() {
  try {
    const bytes = new Blob([JSON.stringify(S.get())]).size;
    return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  } catch { return '—'; }
}
