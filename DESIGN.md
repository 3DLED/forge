# Design — hybrid training tracker (v2, rebuild)

## What this is

An offline-first training planner and logger that treats running, lifting, calisthenics,
and hybrid-race work (Hyrox / Spartan / OCR) as the same kind of thing: **a prescribed
session on a date, and a record of what actually happened.**

Not best-in-class at any one modality. Good enough at all of them that one person can
plan today, this week, and the next twelve months in one place — and then see whether
it worked.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Audience | Personal-first, built to generalize; public-ready later | No hardcoded athlete. Every constraint (equipment, goals, availability) is data, not code. |
| Platform | Installable PWA (offline, home-screen icon) | Works on iPhone and desktop from one codebase, no App Store, no `$99/yr`. |
| Stack | React + TypeScript + Vite | TypeScript is the guardrail for a data model this branchy. |
| Storage | IndexedDB (Dexie), 100% on-device | See below. |
| Cloud sync | **Optional, later — never required** | Data model is sync-ready from day one so it's an add-on, not a rewrite. |
| Planning | Hybrid: templates + freely editable calendar + optional goal generator | Nothing the generator produces is locked. |

### Why IndexedDB and not `localStorage`

The previous app kept everything in one `localStorage` key. That has three hard limits:
it caps around 5 MB, it is synchronous (every save re-serializes the *entire* database
and blocks the UI), and it cannot query — to find "sessions in March" you load all of it
and filter in memory.

A year of planned sessions plus set-level logs plus a full exercise library plus imported
run data crosses that line fast. IndexedDB is the same idea — data on your device, no
internet, no account — but it is indexed (date-range queries are cheap), async, and sized
in hundreds of MB. Dexie is a thin typed wrapper over it.

Backup stays exactly as friendly: **Export** writes one JSON file you can drop in OneDrive;
**Import** restores it on a new phone.

### Sync-readiness without a server

Every record carries `id` (ULID), `createdAt`, `updatedAt`, and `deletedAt` (soft delete).
All writes go through one repository layer that stamps those fields and appends to a local
change log. Adding sync later means writing a transport against that log — the schema does
not change and your data does not migrate.

## Data model

The trick that makes one app cover a marathon block and a push/pull/legs split is
**metric-driven exercises**. A set is not `{weight, reps}` — it is a bag of values whose
shape the exercise declares.

```
Exercise {
  id, name, modality: strength | cardio | mobility | skill
  movementPattern: squat | hinge | pushH | pushV | pullH | pullV | lunge | carry | core | gait
  equipment: EquipmentTag[]        // what it REQUIRES
  metrics: ('weight'|'reps'|'timeSec'|'distanceM'|'rpe'|'rounds')[]
  substitutes: exerciseId[]        // same stimulus, different kit
  progression: { easier: id[], harder: id[] }   // ladder, for when load can't go up
  isCustom
}
```

A barbell squat logs `weight + reps`. A 5k logs `distanceM + timeSec + rpe`. A plank logs
`timeSec`. A sled push logs `weight + distanceM`. Same table, same UI primitives, same
history and PR queries.

**Prescription and performance are separate records.**

```
SessionTemplate { id, name, blocks: Block[] }
Block { style: straight | superset | circuit | emom | amrap | interval | steady,
        rounds?, restSec?, items: PrescribedItem[] }
PrescribedItem { exerciseId, sets?, reps? | repRange?, timeSec?, distanceM?,
                 load: { absolute | pctOf1RM | rpe | bodyweight }, notes }

PlannedSession { id, date, planId?, prescription: <snapshot of the template>,
                 status: planned | completed | skipped | moved }
LoggedSession  { id, date, plannedSessionId?, sets: LoggedSet[], sessionRPE, feel, notes }
```

`PlannedSession` holds a **snapshot**, not a reference. Editing a template next month must
never rewrite what last month said you were supposed to do — that is the whole point of
tracking plan vs. actual.

Blocks cover both worlds: `straight` is 4x8 back squat; `interval` is 6x400 m at target
pace with 90 s float; `circuit` is a Spartan-style AMRAP. One renderer, one logger.

### Constraints as data

```
EquipmentProfile { id, name, items: EquipmentTag[] }   // "Home", "Full gym", "Road only"
AvailabilityRule { weekday, allowedModalities[], maxMinutes }
CalendarException { startDate, endDate, kind: blackout | restricted, allowedModalities[] }
Plan { id, name, goal: { kind: race|strength|general, eventDate?, eventType? },
       startDate, phases: [{ weeks, focus, deloadEvery }] }
```

Switching from "Home" to "Full gym" re-resolves every prescribed exercise through
`substitutes`, so a plan does not break when your access changes. Blackouts and weekday
rules are inputs to the generator *and* warnings on manual edits.

## Build order

Each milestone ends with something usable, not a half-app.

- **M0 — Foundation.** Scaffold, schema + migrations, repository layer, seed exercise
  library (~150 movements across the four modalities), export/import.
- **M1 — Log.** Today view, freeform session logging, rest timer, history. *Usable here.*
- **M2 — Equipment profiles.** Profiles, tag filtering, substitution engine.
- **M3 — Plan.** Calendar, planned sessions, template library (PPL / upper-lower /
  full-body 3x / 5k / half / marathon / Hyrox / OCR), apply-a-plan, drag to reschedule.
- **M4 — Progress.** Volume and load trends, PRs, pace and mileage, plan-vs-actual adherence.
- **M5 — Generator + calendar rules.** Goal in, periodized block out, respecting availability.
  The per-session half is built: pick a region and a goal, get a draft session from whatever
  equipment is on hand (`domain/generator.ts`). The per-*plan* half is still ahead.
- **M6 — Later.** Run file import (GPX / TCX / Strava export / Apple Health), optional sync.
- **Deferred — exercise demos.** Images or clips per movement. Held because no freely
  licensed library exists: `free-exercise-db`'s maintainer states the provenance of its
  images is unknown, and the widely-copied GIF sets are Gym Visual's, licensed per-project.
  Anything built here needs original artwork, a purchased licence, or the athlete's own media.

M2 and M4 are in the first release per requirements; M5 follows immediately after.
