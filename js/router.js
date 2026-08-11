/* ============================================================
   router.js — hash routing.
   Hash-based so the app works from any static host (GitHub Pages
   included) and from file:// without server rewrite rules.
   ============================================================ */

const routes = [];
let notFound = null;
let current = null;

export function route(pattern, handler) {
  // '#/session/:id' -> regex with a named capture
  const keys = [];
  const rx = new RegExp('^' + pattern
    .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })
    + '$');
  routes.push({ rx, keys, handler, pattern });
}

export function setNotFound(fn) { notFound = fn; }

export function navigate(hash) {
  if (location.hash === hash) { render(); return; }
  location.hash = hash;
}

export function replace(hash) {
  history.replaceState(null, '', hash);
  render();
}

export function currentRoute() { return current; }

function parse() {
  const raw = location.hash || '#/today';
  const [path, queryStr] = raw.split('?');
  const params = {};
  if (queryStr) {
    for (const [k, v] of new URLSearchParams(queryStr)) params[k] = v;
  }
  return { path, params };
}

export function render() {
  const { path, params } = parse();
  const host = document.getElementById('view');
  if (!host) return;

  for (const r of routes) {
    const m = path.match(r.rx);
    if (!m) continue;
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    current = { path, params, pattern: r.pattern };

    host.replaceChildren();
    try {
      const node = r.handler(params);
      if (node) host.append(node);
    } catch (err) {
      console.error('Render failed:', err);
      host.append(errorBox(err));
    }
    window.scrollTo(0, 0);
    highlightTab(path);
    return;
  }

  host.replaceChildren();
  if (notFound) host.append(notFound(path));
}

function highlightTab(path) {
  const base = '#/' + (path.split('/')[1] || 'today');
  document.querySelectorAll('.tabbar a').forEach(a => {
    const match = a.getAttribute('href') === base;
    if (match) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function errorBox(err) {
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML = `<h3>Something went wrong</h3><p class="small">${String(err.message || err)}</p>`;
  const btn = document.createElement('button');
  btn.className = 'btn sm';
  btn.style.marginTop = '12px';
  btn.textContent = 'Back to Today';
  btn.onclick = () => navigate('#/today');
  d.append(btn);
  return d;
}

export function start() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/today';
  else render();
}
