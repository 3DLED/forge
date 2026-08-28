# Forge

An offline-first training planner and log for people who run *and* lift *and* do bodyweight
work — built because the paid apps make you pick one, and charge monthly for the privilege.

No account, no server, no subscription. Your data never leaves your device.

See [DESIGN.md](DESIGN.md) for the architecture and the build order.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open `http://localhost:5173`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Types only, no build |

## What works today

- **Log anything.** Lifts, runs, holds, carries, circuits. Exercises declare which metrics
  they record, so a set of squats and a 5k use the same screen without either feeling
  bolted on. Type `5k` into a miles field and it converts.
- **234 movements** across strength, cardio, mobility, and skill — each with substitutes for
  when you lack the kit, and a progression ladder for when you cannot add load.
- **Suggested sessions.** Pick upper / lower / core and a goal — build strength, muscle, or
  endurance — and get a draft workout from the equipment you have today, with the sets, reps,
  and rest that match the goal. Swap or drop anything before it lands in your log. With no
  weights to add, a strength goal steps up to a harder variation instead of piling on reps.
  Name a session you liked and it comes back — from the suggest sheet, or dropped onto a day
  in your plan. The rest timer runs for however long the session prescribed, not a fixed 90s.
- **Log a run in fifteen seconds.** Type, distance, time, effort — pace computed as you type,
  straight off your watch. Effort is required, because it is the half of training load that no
  watch file or import can supply, and just after the run is the only moment anyone knows it.
- **Every movement is written up.** Tap any exercise name for how to set up, two or three cues
  in the order they happen, and the mistake most people make. 234 movements, written for this
  app so there is no licensing attached, and bundled so it works with no signal at all.
- **Swap up or down a ladder.** Every movement sits on a difficulty scale, 1 to 5, banded
  beginner / intermediate / advanced. Tap Swap on any exercise — in a workout or in a
  suggestion — and you get every version of that movement ordered easiest to hardest, with
  the one you are doing marked. Too hard today, pick a rung down; stopped being hard, go up.
- **Equipment profiles.** Switch between bodyweight, kettlebells, and a full gym; the
  library re-resolves. The gap list tells you what one more purchase would unlock.
- **Progress.** Training load (effort × minutes, so running and lifting add up),
  weekly distance and volume, and personal bests including running pace.
- **Plan.** A month calendar, 13 prebuilt programs (5K through marathon, PPL / upper-lower
  / full-body, bodyweight-only, kettlebell-only, Hyrox, Spartan/OCR, hybrid run-and-lift),
  and 31 workout templates. Set a race date and the plan counts backwards so the taper lands
  on it. Long runs progress ~8% a week with a down week every fourth.
- **Your calendar is a hard constraint.** Weekday availability and blacked-out dates are
  respected when a plan is laid down — sessions that will not fit are reported as conflicts
  rather than crammed in. Sessions can be moved, skipped, or removed individually.
- **Four visual directions.** *More → Appearance* switches between Forge (warm dark),
  Blueprint (technical, monospaced figures), Chalk (light paper, serif), and Signal (OLED
  black, big targets). Each changes shape, type, and density — not just colour. Fonts are
  system stacks only, so nothing blocks on a network request.
- **Backup.** One JSON file out, one JSON file in — merge or replace.

The goal-driven generator for arbitrary goals (M5) is next; see the build order in DESIGN.md.

## Your data

Everything lives in this browser's IndexedDB, on this device.

- **It is genuinely yours.** No account, nobody else's server.
- **It is tied to one browser on one device.** Clearing site data erases it.
- **Back it up.** *More → Export backup* gives you a single JSON file. Keep it somewhere
  that syncs. That same file moves everything to a new phone.

Every record carries timestamps and a soft-delete tombstone, and every write appends to a
local change log — so optional cloud sync can be added later without a data migration.

## Installing it on a phone

Build it, publish `dist/` anywhere static (GitHub Pages works), then open the URL in Safari
on iOS and choose **Share → Add to Home Screen**. It gets its own icon, runs without browser
chrome, and works with no connection.

> A GitHub Pages site on a free account is publicly reachable by anyone with the URL. The
> page itself is public; your training data is not — it never leaves your device.
