# Forge — Hybrid Training Tracker

A workout planner and tracker for people who run *and* lift *and* do bodyweight work — built because the paid apps make you pick one, and charge monthly for the privilege.

Runs entirely in your browser. No account, no server, no subscription, no data leaving your device.

---

## What it does

**Plans a real training block, not just a calendar.** Tell it your race (or that you don't have one yet), how many days a week you can train, and where your fitness actually is. It lays out every week — runs and strength together — with 3-weeks-up/1-week-deload waves, a long run that progresses about 10% per week, and a taper that lands on race day.

**Respects the equipment you actually own.** Two kettlebells and a floor is a real constraint, so every movement carries a **progression ladder** — easiest variation to hardest. You progress by climbing the ladder (leverage, unilateral, tempo, range of motion), not by adding plates you don't have. Clear every prescribed set with room to spare and it offers you the next rung.

**Treats grip and burpees as first-class work.** Every strength day ends with a grip finisher, and OCR finishers ride on the back of the long run — because training burpees on tired legs is the whole point.

**One training-load number across everything.** Session RPE × minutes covers running and lifting alike, so you can see the total load and get a warning when this week is ramping more than ~1.5× your 4-week average.

**Imports your Apple Watch history.** Strava bulk export, GPX, TCX, and Apple Health.

---

## Getting it on your phone

### 1. Publish it (once)

Create an empty repository on GitHub, then from this folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/forge.git
```

```bash
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**

A minute later your app is live at `https://YOUR-USERNAME.github.io/forge/`.

> Note: a GitHub Pages site on a free account is publicly reachable by anyone with the URL. The app holds no personal data on the server — your training data lives only in your browser — but the page itself is public. Use a private repo with GitHub Pages (requires a paid plan) if that matters to you.

### 2. Install it (once)

On your iPhone, open the URL in **Safari** (this only works in Safari, not Chrome), then **Share → Add to Home Screen**.

It now behaves like a native app: own icon, no browser chrome, works offline.

### 3. Updating it later

```bash
git add -A && git commit -m "Update" && git push
```

Bump `CACHE_VERSION` in `sw.js` whenever you change any file, or the service worker will keep serving the old cached copy.

---

## Running it locally

No build step and no dependencies. Any static server works:

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`.

Opening `index.html` directly via `file://` will not work — ES modules and the service worker both require `http://` or `https://`.

---

## Your data

Everything lives in your browser's `localStorage`, under a single key. That means:

- **It is genuinely yours.** No account, nobody else's server.
- **It is tied to this one browser on this one device.** Clearing site data erases it.
- **Back it up.** *More → Backup & restore → Export* gives you a single JSON file. Keep it in OneDrive. That same file is how you move everything to a new phone.

The app nags you if it's been more than three weeks since your last export. Listen to it.

### Importing run history

*More → Import runs.*

| Source | File | Notes |
|---|---|---|
| **Strava bulk export** | `activities.csv` | Best option — your entire history in one go. Strava → Settings → My Account → Download or Delete Your Account → Request Your Archive. |
| Single activity | `.gpx` / `.tcx` | Distance computed from GPS track points. |
| Apple Health | `export.xml` | Workout summaries only. Scanned with a streaming parser, since these files are often 100+ MB. |

Strava exports distances in **kilometers** regardless of your display setting. The import preview shows total and longest distance so you can sanity-check before committing, plus a manual unit override if a file came from somewhere else.

Imported activities get an **estimated** RPE (from heart rate where available, otherwise from the activity name) so training load works immediately. It's labeled as estimated; touching the slider marks it as yours.

---

## How the planning engine works

### Phases

With a race on the calendar, phases count back from race day, so the taper always lands correctly no matter the block length:

| Weeks out | Phase | Focus |
|---|---|---|
| 11+ | **Base** | Aerobic volume, movement quality, climbing ladders |
| 5–10 | **Build** | Hills, intervals, OCR-specific complexes |
| 2–4 | **Peak** | Heavy carries, burpee ladders, terrain running |
| 0–1 | **Taper** | Volume down sharply, intensity touches kept |

With no race, it alternates 4-week Base and Build waves.

Every 4th week is a **deload** at ~65% volume. That is not slacking — it is where adaptation actually happens.

### Weekly layout

Hard days are deliberately separated so a quality run never sits next to a heavy lift:

| Days/wk | Mon | Tue | Wed | Thu | Fri | Sat |
|---|---|---|---|---|---|---|
| 3 | Strength A | — | Quality run | — | — | Long run + OCR finisher |
| 4 | Strength A | Easy run | — | Strength B | — | Long run + OCR finisher |
| 5 | Strength A | Quality run | Mobility | Strength B | — | Long run + OCR finisher |
| 6 | Strength A | Quality run | Calisthenics | Strength B | Easy run | Long run + OCR finisher |

### Calibration

Your baseline numbers (longest run, max push-ups, max pull-ups, dead hang, 2-minute burpees) set the starting rung on every ladder and scale every rep target. Retest every 4–6 weeks and update them in *More → Fitness baseline*. Stale numbers mean a stale plan.

---

## The one thing worth buying

You currently have no pull-up bar, and there is no real substitute for hanging — it's the strongest predictor of finishing a Spartan rig. A doorway bar (~$25) or any park/playground bar unlocks six more movements including dead hangs, pull-ups, hanging leg raises, and towel work.

Until then the plan leans on KB farmer holds, towel-wrapped holds, pinch grip, and inverted rows under a sturdy table, which cover most but not all of it. The app flags this in *More → Equipment*.

---

## Project layout

```
index.html              app shell
manifest.webmanifest    PWA metadata
sw.js                   offline caching
css/styles.css          all styling
js/
  app.js                bootstrap, theme, onboarding
  router.js             hash routing
  store.js              persistence, stats, backup/restore
  planner.js            block generation, phases, prescriptions
  exercises.js          movement library + progression ladders
  importers.js          Strava CSV / GPX / TCX / Apple Health
  ui.js                 DOM helpers, sheets, charts
  views/                today, plan, log, history, progress, settings
```

No framework, no bundler, no dependencies. Every file is readable on its own.

---

## Things worth adding later

- Rest timer between sets
- Cloud sync so phone and PC stay in step (the store is already versioned and isolated to make this a drop-in rather than a rewrite)
- Direct Strava API sync instead of file import (needs a small server for the OAuth handshake)
- Route/GPS recording during a run
- Body-weight and sleep tracking
