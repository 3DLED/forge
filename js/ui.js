/* ============================================================
   ui.js — DOM helpers, sheets, toasts, formatters, and charts.
   No framework: a small set of primitives is enough for an app this size
   and keeps the whole thing dependency-free and instant to load.
   ============================================================ */

/* ---------- element building ---------- */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  appendAll(node, children);
  return node;
}

function appendAll(node, children) {
  for (const c of children.flat(4)) {
    if (c == null || c === false || c === '') continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  appendAll(f, children);
  return f;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function svgEl(tag, props = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    node.setAttribute(k, v);
  }
  for (const c of children.flat(3)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function icon(path, size = 18) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' },
    svgEl('path', { d: path, fill: 'currentColor' }));
}

export const ICONS = {
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  play: 'M8 5v14l11-7z',
  edit: 'M3 17.2V21h3.8L17.8 10 14 6.2zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83L18.9 8.9z',
  trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
  chevR: 'M9 6 15 12 9 18z',
  up: 'M12 4l8 8h-5v8H9v-8H4z',
  run: 'M13.5 5.5a2 2 0 1 0-2-2 2 2 0 0 0 2 2M9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7 7 0 0 0 19 13v-2a5 5 0 0 1-4.2-2.4l-1-1.6A2 2 0 0 0 12 6a2 2 0 0 0-.7.1L6 8.3V13h2V9.6z',
  dumbbell: 'M4 8h3v8H4zM17 8h3v8h-3zM7 10.5h10v3H7z',
  download: 'M12 16 6 10l1.4-1.4L11 12.2V4h2v8.2l3.6-3.6L18 10zM5 18h14v2H5z',
  upload: 'M12 4l6 6-1.4 1.4L13 7.8V16h-2V7.8L7.4 11.4 6 10zM5 18h14v2H5z',
  calendar: 'M7 2v2H4v18h16V4h-3V2h-2v2H9V2zm-1 8h12v10H6z',
};

/* ---------- formatting ---------- */

export function fmtDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

export function fmtDateLong(iso) {
  return fmtDate(iso, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function relDay(iso, todayIso) {
  const diff = Math.round((new Date(iso) - new Date(todayIso)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`;
  return fmtDate(iso);
}

export function fmtDuration(sec) {
  if (!sec && sec !== 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMin(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function fmtPace(secPerMi) {
  if (!secPerMi || !Number.isFinite(secPerMi)) return '—';
  const m = Math.floor(secPerMi / 60);
  const s = Math.round(secPerMi % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseTimeInput(str) {
  // Accepts "45", "45:30", "1:12:05" -> seconds
  if (!str) return null;
  const parts = String(str).trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0] * 60;          // bare number = minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export function num(v, fallback = null) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ---------- toast ---------- */

export function toast(msg, kind = '') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const t = el('div', { class: `toast ${kind}` }, msg);
  host.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity .25s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 260);
  }, 2600);
}

/* ---------- bottom sheet ---------- */

let openSheet = null;

/**
 * Show a modal sheet. `build(close)` returns {title, body, footer}.
 */
export function sheet({ title, body, footer, onClose }) {
  closeSheet();
  const host = document.getElementById('sheet-host');

  const close = () => {
    if (openSheet) { openSheet.remove(); openSheet = null; }
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const backdrop = el('div', {
    class: 'sheet-backdrop',
    onclick: (e) => { if (e.target === backdrop) close(); },
  },
    el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
      el('div', { class: 'sheet-head' },
        el('h2', {}, title || ''),
        el('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Close' }, icon(ICONS.close))
      ),
      el('div', { class: 'sheet-body' }, typeof body === 'function' ? body(close) : body),
      footer ? el('div', { class: 'sheet-foot' }, typeof footer === 'function' ? footer(close) : footer) : null
    )
  );

  host.append(backdrop);
  openSheet = backdrop;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  return close;
}

export function closeSheet() {
  if (openSheet) { openSheet.remove(); openSheet = null; document.body.style.overflow = ''; }
}

export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  const close = sheet({
    title,
    body: el('p', { class: 'muted' }, message),
    footer: (c) => frag(
      el('button', { class: 'btn ghost', onclick: c }, 'Cancel'),
      el('button', {
        class: `btn ${danger ? 'danger' : 'primary'}`,
        onclick: () => { c(); onConfirm(); },
      }, confirmLabel)
    ),
  });
  return close;
}

/* ---------- form field helpers ---------- */

export function field(label, input, hint) {
  return el('label', { class: 'field' },
    el('span', { class: 'lbl' }, label),
    input,
    hint ? el('span', { class: 'hint' }, hint) : null
  );
}

export function input(props = {}) { return el('input', { type: 'text', ...props }); }

export function select(options, value, props = {}) {
  const s = el('select', props);
  for (const o of options) {
    const opt = el('option', { value: o.value }, o.label);
    if (String(o.value) === String(value)) opt.selected = true;
    s.append(opt);
  }
  return s;
}

export function segmented(options, value, onChange) {
  const wrap = el('div', { class: 'seg', role: 'group' });
  options.forEach(o => {
    const b = el('button', {
      type: 'button',
      'aria-pressed': String(o.value) === String(value),
      onclick: () => {
        [...wrap.children].forEach(c => c.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        onChange(o.value);
      },
    }, o.label);
    wrap.append(b);
  });
  return wrap;
}

/* ============================================================
   Charts — small hand-rolled SVG. Enough for the four questions
   that matter: am I running more, lifting more, showing up, and
   ramping too fast?
   ============================================================ */

const CH = { w: 340, h: 150, padL: 30, padR: 8, padT: 10, padB: 22 };

function scaleFns(values, geom) {
  const max = Math.max(1, ...values.filter(Number.isFinite));
  const min = 0;
  const { w, h, padL, padR, padT, padB } = geom;
  const x = (i, n) => padL + (n <= 1 ? (w - padL - padR) / 2 : (i / (n - 1)) * (w - padL - padR));
  const y = (v) => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
  return { x, y, max };
}

/** Bar chart — good for discrete weekly totals. */
export function barChart(data, { color = 'var(--accent)', valueFmt = v => v, height = 150 } = {}) {
  const geom = { ...CH, h: height };
  const { w, h, padL, padR, padT, padB } = geom;
  const values = data.map(d => d.value);
  const { y, max } = scaleFns(values, geom);
  const n = data.length || 1;
  const slot = (w - padL - padR) / n;
  const bw = Math.max(3, slot * 0.62);

  const kids = [];
  // Gridlines + y labels at 0 / mid / max.
  [0, max / 2, max].forEach(v => {
    kids.push(svgEl('line', { class: 'grid-line', x1: padL, x2: w - padR, y1: y(v), y2: y(v) }));
    kids.push(svgEl('text', { class: 'axis-txt', x: padL - 5, y: y(v) + 3, 'text-anchor': 'end' }, valueFmt(+v.toFixed(1))));
  });

  data.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2;
    const top = y(d.value);
    kids.push(svgEl('rect', {
      class: 'bar', x: cx - bw / 2, y: top, width: bw,
      height: Math.max(0, h - padB - top), rx: 2,
      fill: d.color || color,
      opacity: d.dim ? 0.4 : 1,
    }, svgEl('title', {}, `${d.label}: ${valueFmt(d.value)}`)));
    if (d.tick) {
      kids.push(svgEl('text', { class: 'axis-txt', x: cx, y: h - padB + 13, 'text-anchor': 'middle' }, d.tick));
    }
  });

  return svgEl('svg', { class: 'chart', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', role: 'img' }, kids);
}

/** Multi-series line chart. */
export function lineChart(series, labels, { height = 150, valueFmt = v => v } = {}) {
  const geom = { ...CH, h: height };
  const { w, h, padL, padR, padT, padB } = geom;
  const all = series.flatMap(s => s.values.filter(Number.isFinite));
  const { x, y, max } = scaleFns(all.length ? all : [1], geom);
  const n = labels.length;

  const kids = [];
  [0, max / 2, max].forEach(v => {
    kids.push(svgEl('line', { class: 'grid-line', x1: padL, x2: w - padR, y1: y(v), y2: y(v) }));
    kids.push(svgEl('text', { class: 'axis-txt', x: padL - 5, y: y(v) + 3, 'text-anchor': 'end' }, valueFmt(+v.toFixed(1))));
  });

  series.forEach(s => {
    const pts = s.values
      .map((v, i) => (Number.isFinite(v) ? [x(i, n), y(v)] : null))
      .filter(Boolean);
    if (pts.length > 1) {
      kids.push(svgEl('path', {
        class: 'ln',
        d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
        stroke: s.color,
      }));
    }
    pts.forEach((p, i) => {
      kids.push(svgEl('circle', { class: 'pt', cx: p[0], cy: p[1], r: 2.8, fill: s.color },
        svgEl('title', {}, `${s.name} ${labels[i] || ''}: ${valueFmt(s.values[i])}`)));
    });
  });

  labels.forEach((l, i) => {
    if (!l) return;
    kids.push(svgEl('text', { class: 'axis-txt', x: x(i, n), y: h - padB + 13, 'text-anchor': 'middle' }, l));
  });

  return svgEl('svg', { class: 'chart', viewBox: `0 0 ${w} ${h}`, role: 'img' }, kids);
}

export function legend(items) {
  return el('div', { class: 'chart-legend' },
    items.map(i => el('span', {}, el('i', { style: { background: i.color } }), i.name))
  );
}

export function stat(k, v, unit, d) {
  return el('div', { class: 'stat' },
    el('div', { class: 'k' }, k),
    el('div', { class: 'v' }, String(v), unit ? el('span', { class: 'u' }, unit) : null),
    d ? el('div', { class: 'd' }, d) : null
  );
}

export function emptyState(title, msg, action) {
  return el('div', { class: 'empty' },
    el('h3', {}, title),
    el('p', { class: 'small' }, msg),
    action || null
  );
}
