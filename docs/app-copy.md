# Forge — every word the app says

This is all the user-facing text in the app, pulled straight from the source. Edit the text in
place and send it back; the ids in brackets are how each line is matched to where it lives, so
please leave those alone. Anything you delete entirely, mark **CUT** rather than deleting, so
it is clear you meant it.

Two things worth knowing while you read.

**Some of this is the app explaining itself.** Lines that justify a design decision — why the
lifting stays heavy in a deficit, why a rest day is not the same as an empty day — were written
to be reassuring, and some of them are the app talking to itself instead. Those are the ones to
cut. Others are genuinely load-bearing: a warning about what a button is about to delete, or
the one line that stops a number being misread. Cut with a free hand and I will push back on
anything I think is carrying weight.

**Not everything here is a sentence.** Button labels, column headings and placeholders are
included because they are words people read, but they will look thin next to the prose. Skim
past them unless one is wrong.

Counts: 470 strings, 56 files, 9 sections.

---

## Today

### TodayView

<sub>`src/features/today/TodayView.tsx`</sub>

- **[TODAY-001]** This week
- **[TODAY-002]** Tap for the week
- **[TODAY-003]** Planned for today
- **[TODAY-004]** In progress
- **[TODAY-005]** Today's sessions
- **[TODAY-006]** Nothing logged today.
- **[TODAY-007]** Training as
- **[TODAY-008]** 🏃 Log a run

---

## Logging a workout

### Adding a movement

<sub>`src/features/log/ExercisePicker.tsx`</sub>

- **[LOG-001]** Add anyway
- **[LOG-002]** Add exercise
- **[LOG-003]** Search movements, muscles, patterns…
- **[LOG-004]** You train these
- **[LOG-005]** Everything else

### ExerciseGroup

<sub>`src/features/log/ExerciseGroup.tsx`</sub>

- **[LOG-006]** Time this hold
- **[LOG-007]** + Set
- **[LOG-008]** − Set

### LogRunSheet

<sub>`src/features/log/LogRunSheet.tsx`</sub>

- **[LOG-009]** Log a run
- **[LOG-010]** 1 is a walk, 10 is everything you had. This is what your training load is built from, so it is worth a moment's thought.
- **[LOG-011]** Felt flat, humid, new shoes…

### Movement write-ups

<sub>`src/features/log/ExerciseInfoSheet.tsx`</sub>

- **[LOG-012]** Swap for another version
- **[LOG-013]** Set up
- **[LOG-014]** How to do it
- **[LOG-015]** Watch for
- **[LOG-016]** No write-up for this one yet — it is likely a movement you added yourself.
- **[LOG-017]** Trained one side at a time — log both sides, or double the sets.

### Picking a saved workout mid-session

<sub>`src/features/log/SavedWorkoutsSheet.tsx`</sub>

- **[LOG-018]** void | Promise
- **[LOG-019]** Your saved workouts
- **[LOG-020]** Nothing saved yet.
- **[LOG-021]** Name a workout you have built and it comes back here, ready to run again — and, if it is timed, with its own best to beat.
- **[LOG-022]** Straight sets
- **[LOG-023]** Share, import or tidy these up in More → Saved workouts.
- **[LOG-024]** Run it again

### PinnedTimer

<sub>`src/features/log/PinnedTimer.tsx`</sub>

- **[LOG-025]** Open the full timer
- **[LOG-026]** Record a completed round

### Running a benchmark test

<sub>`src/features/log/TestRunner.tsx`</sub>

- **[LOG-027]** Recently tested
- **[LOG-028]** What can you do for three?
- **[LOG-029]** A rough guess is fine. Everything is worked out from it, and a wrong one costs an extra attempt rather than the result — what gets recorded is the heaviest set you actually finish.
- **[LOG-030]** Lay out the test
- **[LOG-031]** Use it
- **[LOG-032]** Use a different weight
- **[LOG-033]** How many did you get?
- **[LOG-034]** Reps completed
- **[LOG-035]** Record it
- **[LOG-036]** ▶ Start the hold
- **[LOG-037]** Made it — three good reps
- **[LOG-038]** Failed it — stop the test
- **[LOG-039]** No attempt was completed, so there is nothing to record. Nothing is saved.

### SavedWorkoutRow

<sub>`src/features/log/SavedWorkoutRow.tsx`</sub>

- **[LOG-040]** void | Promise

### SessionEquipmentSheet

<sub>`src/features/log/SessionEquipmentSheet.tsx`</sub>

- **[LOG-041]** void | Promise
- **[LOG-042]** Equipment for this workout
- **[LOG-043]** Use my default
- **[LOG-044]** Use for this workout
- **[LOG-045]** Start from a profile
- **[LOG-046]** Nothing but bodyweight

### Suggest a workout

<sub>`src/features/log/SuggestWorkoutSheet.tsx`</sub>

- **[LOG-047]** void | Promise
- **[LOG-048]** Suggest a workout
- **[LOG-049]** ⏱ Add as a timed workout
- **[LOG-050]** Your saved sessions
- **[LOG-051]** Or build a new one
- **[LOG-052]** Full body
- **[LOG-053]** Nothing available for that combination.
- **[LOG-054]** Try another region, or add equipment for this session.
- **[LOG-055]** Swap for an easier or harder version
- **[LOG-056]** Drop this movement
- **[LOG-057]** 🎲 Suggest something else

### The logging screen

<sub>`src/features/log/SessionLogger.tsx`</sub>

- **[LOG-058]** 💪 Great
- **[LOG-059]** 🙂 Good
- **[LOG-060]** 😐 OK
- **[LOG-061]** 😮‍💨 Rough
- **[LOG-062]** 🥴 Bad
- **[LOG-063]** That session is gone.
- **[LOG-064]** Back to today
- **[LOG-065]** Session name
- **[LOG-066]** Finished workout — reviewing. Tap Edit to change anything.
- **[LOG-067]** Editing a finished workout. Changes save as you make them.
- **[LOG-068]** ⏱ Add block
- **[LOG-069]** Add a movement, or start an AMRAP or EMOM block.
- **[LOG-070]** Each round
- **[LOG-071]** + Add movement to this block
- **[LOG-072]** ⏱ Edit timed workout
- **[LOG-073]** Ungroup block
- **[LOG-074]** + Add exercise
- **[LOG-075]** ✨ Suggest a workout
- **[LOG-076]** 💾 Save as a workout
- **[LOG-077]** 📂 Browse saved workouts
- **[LOG-078]** ⏱ Make this a timed workout
- **[LOG-079]** Discard session
- **[LOG-080]** Save this workout
- **[LOG-081]** Upper A
- **[LOG-082]** Edit timed workout
- **[LOG-083]** Discard this session?
- **[LOG-084]** Worth doing before you save
- **[LOG-085]** Cindy, Tuesday burner…
- **[LOG-086]** Name this workout
- **[LOG-087]** Name it
- **[LOG-088]** Optional — saving without them is fine.
- **[LOG-089]** How hard was the whole session? This is what makes running and lifting comparable — effort × minutes is the one load number that spans both.
- **[LOG-090]** 1 = barely moved · 5 = solid work · 8 = hard · 10 = everything you had
- **[LOG-091]** Duration in minutes
- **[LOG-092]** How did it feel?
- **[LOG-093]** Anything worth remembering next time…

### Timed workouts (AMRAP, EMOM, for time)

<sub>`src/features/log/NewBlockSheet.tsx`</sub>

- **[LOG-094]** As many rounds as possible before the cap. Tap a big button for each round.
- **[LOG-095]** Every minute on the minute — a cue at each interval, for a set number of rounds.
- **[LOG-096]** For time
- **[LOG-097]** Fixed work, clock running. The score is how long it took.
- **[LOG-098]** void | Promise
- **[LOG-099]** Your saved timed workouts
- **[LOG-100]** Or build a new one

### VariationSheet

<sub>`src/features/log/VariationSheet.tsx`</sub>

- **[LOG-101]** void | Promise

### WorkoutTimer

<sub>`src/features/log/WorkoutTimer.tsx`</sub>

- **[LOG-102]** void | Promise
- **[LOG-103]** The clock keeps running in the strip at the top — closing this does not stop it.
- **[LOG-104]** Each round
- **[LOG-105]** Record a completed round
- **[LOG-106]** Undo round
- **[LOG-107]** This browser has no audio support — the timer still runs, silently.

---

## Plan

### A single day

<sub>`src/features/plan/DaySheet.tsx`</sub>

- **[PLAN-001]** Add a session
- **[PLAN-002]** Search workouts…
- **[PLAN-003]** Your saved workouts
- **[PLAN-004]** From the library
- **[PLAN-005]** Rest day
- **[PLAN-006]** Nothing scheduled or logged on this day.
- **[PLAN-007]** Move to date
- **[PLAN-008]** + Add a planned session
- **[PLAN-009]** Block this day out

### An active plan

<sub>`src/features/plan/PlanSheet.tsx`</sub>

- **[PLAN-010]** Race day
- **[PLAN-011]** Keeping up
- **[PLAN-012]** A different question to the one above — you can be part-way through a plan and have missed most of what it asked for.
- **[PLAN-013]** ↗ Share this plan
- **[PLAN-014]** End this plan

### Blocking days out

<sub>`src/features/plan/BlockOutSheet.tsx`</sub>

- **[PLAN-015]** Nothing new gets scheduled in a blocked stretch, and applying a plan routes around it.
- **[PLAN-016]** Last day to block
- **[PLAN-017]** Travel, rest, work…
- **[PLAN-018]** Reason (optional)
- **[PLAN-019]** They stay where they are — blocking stops new scheduling, it does not throw away work you had already planned. Skip or move them from their own days if you are not doing them.

### Browsing plans

<sub>`src/features/plan/PlanLibrary.tsx`</sub>

- **[PLAN-020]** Race training
- **[PLAN-021]** Set a race date and the plan counts backwards to it.
- **[PLAN-022]** Obstacle & hybrid racing
- **[PLAN-023]** Running and strength in one plan, with grip work that matters on a rig.
- **[PLAN-024]** Strength & muscle
- **[PLAN-025]** Ongoing splits with no end date. Pick the one that matches your week.
- **[PLAN-026]** Everything at once
- **[PLAN-027]** Stay strong and keep a running base without training for anything in particular.
- **[PLAN-028]** Currently active
- **[PLAN-029]** End plan
- **[PLAN-030]** Yours, not running
- **[PLAN-031]** Built by you
- **[PLAN-032]** + Build a plan
- **[PLAN-033]** Every plan is a starting point — once it is on your calendar you can move, skip, or rewrite any session in it.

### Building your own plan

<sub>`src/features/plan/CustomPlanBuilder.tsx`</sub>

- **[PLAN-034]** Plan name
- **[PLAN-035]** Winter base
- **[PLAN-036]** What it is for
- **[PLAN-037]** How long
- **[PLAN-038]** Your week
- **[PLAN-039]** This repeats. The weights climb from what you actually lift, not from the plan.
- **[PLAN-040]** 😴 Rest day
- **[PLAN-041]** Search sessions
- **[PLAN-042]** Decide on the day
- **[PLAN-043]** ✨ Suggest a session
- **[PLAN-044]** Filled in when the day arrives, from your kit and what you have been training.
- **[PLAN-045]** For about
- **[PLAN-046]** Your saved workouts
- **[PLAN-047]** Yours · copied into the plan
- **[PLAN-048]** Built in

### Making a distance grow weekly

<sub>`src/features/plan/RampEditor.tsx`</sub>

- **[PLAN-049]** 📈 Make it grow each week
- **[PLAN-050]** Grows each week
- **[PLAN-051]** Turn off
- **[PLAN-052]** Start at
- **[PLAN-053]** Starting value
- **[PLAN-054]** By how much
- **[PLAN-055]** Ten per cent a week is the conventional ceiling for adding distance. Past it the injuries tend to arrive before the fitness does.
- **[PLAN-056]** Stop at
- **[PLAN-057]** Maximum value
- **[PLAN-058]** no limit
- **[PLAN-059]** Where the build-up levels off. Without one it keeps climbing for the whole plan.
- **[PLAN-060]** Week 1

### Putting a plan on the calendar

<sub>`src/features/plan/ApplyPlanSheet.tsx`</sub>

- **[PLAN-061]** Optional. Without it the plan is generated exactly as written.
- **[PLAN-062]** Already planned
- **[PLAN-063]** Testing days
- **[PLAN-064]** Heads up
- **[PLAN-065]** Race day
- **[PLAN-066]** Race date
- **[PLAN-067]** Start date
- **[PLAN-068]** How many weeks to lay down
- **[PLAN-069]** This plan has no end. Lay down a stretch now and extend it whenever you like.
- **[PLAN-070]** What you'll get
- **[PLAN-071]** Swapped for your equipment
- **[PLAN-072]** . These movements were replaced with the closest thing you can actually do.
- **[PLAN-073]** No substitute
- **[PLAN-074]** Couldn't be scheduled

### The calendar

<sub>`src/features/plan/PlanView.tsx`</sub>

- **[PLAN-075]** Previous month
- **[PLAN-076]** Next month
- **[PLAN-077]** Striped = blocked out
- **[PLAN-078]** Swipe the calendar to change month.
- **[PLAN-079]** 📥 Import a plan
- **[PLAN-080]** Or tap any day to add a single session.

---

## History

### HistoryView

<sub>`src/features/history/HistoryView.tsx`</sub>

- **[HIST-001]** No sessions yet.
- **[HIST-002]** Everything you log shows up here, newest first.
- **[HIST-003]** Load more

---

## Progress

### PrSheet

<sub>`src/features/progress/PrSheet.tsx`</sub>

- **[PROG-001]** Estimated 1RM
- **[PROG-002]** Calculated from the heaviest set you completed, not a single you actually lifted.
- **[PROG-003]** Relative strength
- **[PROG-004]** Against what you weighed that day, so it stays honest across a bulk or a cut.
- **[PROG-005]** Most reps in a set
- **[PROG-006]** Most rounds
- **[PROG-007]** Only comparable against the same window — 9 rounds in 20 minutes is not a better score than 7 in 12.
- **[PROG-008]** Longest hold
- **[PROG-009]** Fastest pace
- **[PROG-010]** Over at least a kilometre.
- **[PROG-011]** Nothing recorded for this movement yet.

### ProgressView

<sub>`src/features/progress/ProgressView.tsx`</sub>

- **[PROG-012]** Nothing to chart yet.
- **[PROG-013]** Log a few sessions and this fills in — load, mileage, volume, and every personal best.
- **[PROG-014]** Training load
- **[PROG-015]** Weekly distance
- **[PROG-016]** Weekly volume
- **[PROG-017]** Log your bodyweight
- **[PROG-018]** and push-ups, pull-ups and lunges start counting toward volume instead of reading as no work.
- **[PROG-019]** Personal bests
- **[PROG-020]** Complete some sets and PRs land here.

---

## More

### Adding your own movement

<sub>`src/features/more/ExerciseEditorSheet.tsx`</sub>

- **[MORE-001]** Pull-up bar
- **[MORE-002]** Jump rope
- **[MORE-003]** Push (forward)
- **[MORE-004]** Push (overhead)
- **[MORE-005]** Pull (row)
- **[MORE-006]** Pull (chin)
- **[MORE-007]** Full body
- **[MORE-008]** Run / walk
- **[MORE-009]** A loaded lift.
- **[MORE-010]** Weight & reps
- **[MORE-011]** Bodyweight, counted.
- **[MORE-012]** A plank, a hang, a wall sit.
- **[MORE-013]** Time held
- **[MORE-014]** A run, a row, a carry.
- **[MORE-015]** Distance & time
- **[MORE-016]** Bulgarian bag spin
- **[MORE-017]** Movement name
- **[MORE-018]** What it needs
- **[MORE-019]** Everything selected has to be in an equipment profile for this to be offered there.
- **[MORE-020]** How it moves
- **[MORE-021]** What it records
- **[MORE-022]** How hard
- **[MORE-023]** Files as
- **[MORE-024]** Worked out from the kit and the pattern, so filtering, suggestions and the injury log all understand it without being told separately.
- **[MORE-025]** What it trains
- **[MORE-026]** shoulders, core
- **[MORE-027]** Muscles trained
- **[MORE-028]** Set up
- **[MORE-029]** Where you and the kit start. Optional.
- **[MORE-030]** How to do it
- **[MORE-031]** One cue per line, in the order they happen.
- **[MORE-032]** Watch for
- **[MORE-033]** The one thing that usually goes wrong. Optional.

### AppearanceView

<sub>`src/features/more/AppearanceView.tsx`</sub>

- **[MORE-034]** These are four different directions, not four palettes. Each one changes the shape of things, the type, and how tightly the screen is packed.
- **[MORE-035]** Nothing here touches your data — it is a display setting stored with your profile, so it travels in your backup.

### BodyView

<sub>`src/features/more/BodyView.tsx`</sub>

- **[MORE-036]** This is the load in every push-up, pull-up and lunge you do. Without it those sets show as no work at all on your volume chart. Sessions are valued at what you weighed that week, so logging it today does not rewrite last spring.
- **[MORE-037]** Log today
- **[MORE-038]** No weigh-ins yet.
- **[MORE-039]** Once a week is plenty. Daily readings mostly measure lunch.
- **[MORE-040]** Delete this weigh-in?

### Entering a max you know

<sub>`src/features/more/KnownMaxSheet.tsx`</sub>

- **[MORE-041]** The lift
- **[MORE-042]** A single, a triple, whatever you know it as. One rep means you are giving a true max.
- **[MORE-043]** Your best set
- **[MORE-044]** reps, unbroken
- **[MORE-045]** The most you can do in one set with good form, stopping when the form goes — not a total across a session.
- **[MORE-046]** Your best hold
- **[MORE-047]** The longest you can hold the position before it breaks down.
- **[MORE-048]** Dating it honestly matters — an old result is still used, and the app says when it is getting stale rather than quietly trusting it forever.
- **[MORE-049]** Works out at
- **[MORE-050]** for one

### Equipment

<sub>`src/features/more/EquipmentView.tsx`</sub>

- **[MORE-051]** + New profile
- **[MORE-052]** New equipment profile
- **[MORE-053]** Hotel gym
- **[MORE-054]** This is your only profile. Make another before deleting this one — the app has to know what you can train with.
- **[MORE-055]** ✎ Edit kit
- **[MORE-056]** Save kit
- **[MORE-057]** Biggest gaps
- **[MORE-058]** What one more piece of kit would unlock, on top of this profile.

### Importing a file

<sub>`src/features/more/ImportSheet.tsx`</sub>

- **[MORE-059]** That file could not be read. It may have been altered or truncated.
- **[MORE-060]** That import did not work.
- **[MORE-061]** Choose a file
- **[MORE-062]** What is in it
- **[MORE-063]** They will be added so this works. Anything you already have is left alone.
- **[MORE-064]** Start it on
- **[MORE-065]** Plan start date
- **[MORE-066]** Sessions are spaced the way the plan author laid them out, counted from this day. It comes in switched off — starting it is a separate choice.

### LibraryRow

<sub>`src/features/more/LibraryRow.tsx`</sub>

- **[MORE-067]** void | Promise
- **[MORE-068]** ↗ Export / Share
- **[MORE-069]** ✎ Edit

### Logging an injury

<sub>`src/features/more/InjurySheet.tsx`</sub>

- **[MORE-070]** Log an injury
- **[MORE-071]** What hurts
- **[MORE-072]** Left shoulder
- **[MORE-073]** What hurts, in your words
- **[MORE-074]** How bad
- **[MORE-075]** Rest until
- **[MORE-076]** How it happened
- **[MORE-077]** Optional — third set of overhead press
- **[MORE-078]** Skipped, not deleted — mark the injury healed early and you can take them back.

### ReshuffleSheet

<sub>`src/features/more/ReshuffleSheet.tsx`</sub>

- **[MORE-079]** Fit the plan to your week
- **[MORE-080]** Leave the plan alone
- **[MORE-081]** Your availability no longer matches where these sessions sit. Completed and skipped sessions are never touched, and nothing before today moves.
- **[MORE-082]** Dropped sessions are removed from the plan, not from your history. Your adherence is measured against what remains.

### Settings

<sub>`src/features/more/SettingsView.tsx`</sub>

- **[MORE-083]** Training for
- **[MORE-084]** Orders the plan library, sets what ‘Suggest a workout’ opens on, and shapes the sets and reps in plans you start from here. Plans already on your calendar keep what they prescribed.
- **[MORE-085]** Training max
- **[MORE-086]** Suggested loads are worked out from this share of your tested max, rather than from the max itself. Ninety per cent is the usual convention: a number computed from your best day is not makeable on an average one, and a programme you miss reps on is one you stop running. At 100% the suggestions come straight off your max.
- **[MORE-087]** lb / miles
- **[MORE-088]** kg / km
- **[MORE-089]** Stored data does not change — this only affects how numbers are shown, so switching back and forth never rounds your history away.
- **[MORE-090]** Week starts on
- **[MORE-091]** Effort per set
- **[MORE-092]** Once per session
- **[MORE-093]** Every set
- **[MORE-094]** Per-set effort is how autoregulated strength work picks its loads — a 9 on a triple you wanted at 8 means the next set comes down. It is worth the extra box on every row only if you act on it between sets. Training load uses the session figure either way.
- **[MORE-095]** Weekly availability
- **[MORE-096]** See what would move
- **[MORE-097]** Which kinds of training each day can hold. Planning will respect this — a day with nothing selected is a rest day.

### Tests

<sub>`src/features/more/TestsView.tsx`</sub>

- **[MORE-098]** Nothing measured yet.
- **[MORE-099]** A test gives the app a real number to program from instead of a guess — and gives you something to beat.
- **[MORE-100]** Just tested
- **[MORE-101]** Test it again
- **[MORE-102]** Remove this result
- **[MORE-103]** Test a movement
- **[MORE-104]** Enter a max I already know
- **[MORE-105]** Remove this result?

### The More menu

<sub>`src/features/more/MoreView.tsx`</sub>

- **[MORE-106]** Could not read that file.
- **[MORE-107]** Saved workouts
- **[MORE-108]** Your data
- **[MORE-109]** Everything lives in this browser on this device. Nothing is uploaded, and no account exists — which also means a cleared browser takes your history with it. Export regularly and keep the file somewhere that syncs.
- **[MORE-110]** Export backup
- **[MORE-111]** Restore from backup
- **[MORE-112]** Start over
- **[MORE-113]** Erases every session, plan, and setting on this device and reseeds the movement library from scratch. Export a backup first if there is anything you want.
- **[MORE-114]** Erase all data
- **[MORE-115]** Forge · offline training tracker
- **[MORE-116]** Restore backup
- **[MORE-117]** . Merging keeps what is already on this device and lets the newer copy of each record win — the right choice when you have trained since the export. Replacing wipes first, for moving to a new phone.
- **[MORE-118]** Merge (recommended)
- **[MORE-119]** Replace everything
- **[MORE-120]** Type ERASE to confirm

### The injury log

<sub>`src/features/more/InjuryView.tsx`</sub>

- **[MORE-121]** Nothing logged.
- **[MORE-122]** Log something that hurts and the sessions that load it step aside — the rest of your training carries on.
- **[MORE-123]** Mark it healed
- **[MORE-124]** Remove from the log
- **[MORE-125]** Log an injury
- **[MORE-126]** Healed already?
- **[MORE-127]** Remove this from the log?

### The movement library

<sub>`src/features/more/ExerciseLibraryView.tsx`</sub>

- **[MORE-128]** Search movements
- **[MORE-129]** + Add a movement
- **[MORE-130]** Built in

### Which weights you own

<sub>`src/features/more/RackEditor.tsx`</sub>

- **[MORE-131]** + Another size
- **[MORE-132]** Weights you own
- **[MORE-133]** Suggested loads, progressions and test ladders all snap to these. Leave a section empty and that movement falls back to round numbers.
- **[MORE-134]** The bar
- **[MORE-135]** Plates, in pairs

### Your plans

<sub>`src/features/more/PlansView.tsx`</sub>

- **[MORE-136]** No plans of your own yet.
- **[MORE-137]** Lay out a week — which days you train and what you do on them — and it repeats for as long as you set it to.
- **[MORE-138]** + Build a plan
- **[MORE-139]** 📥 Import a plan

### Your saved workouts

<sub>`src/features/more/SavedWorkoutsView.tsx`</sub>

- **[MORE-140]** Saved workouts
- **[MORE-141]** Nothing saved yet.
- **[MORE-142]** Name a workout you have built and it comes back here, ready to run again — and, if it is timed, with its own best to beat.
- **[MORE-143]** 📥 Import a workout

---

## Shared bits — buttons, sheets, empty states

### AppProvider

<sub>`src/ui/AppProvider.tsx`</sub>

- **[SHARED-001]** Could not open your training data
- **[SHARED-002]** Private browsing blocks local storage in some browsers. Try a normal window.

### AskSheet

<sub>`src/ui/AskSheet.tsx`</sub>

- **[SHARED-003]** void | Promise

### SessionCard

<sub>`src/ui/SessionCard.tsx`</sub>

- **[SHARED-004]** In progress

---

## The built-in library — movements, sessions, plans

### Built-in plan names and descriptions

<sub>`src/data/seed/planTemplates.ts`</sub>

- **[LIB-001]** Full Body, 3× a week
- **[LIB-002]** Three rotating full-body days. The best return per hour if you train three times a week, and the easiest plan to miss a day of without derailing.
- **[LIB-003]** Upper / Lower, 4× a week
- **[LIB-004]** Two upper days and two lower days. More volume per muscle than full body without the six-day commitment of a full split.
- **[LIB-005]** Push / Pull / Legs, 6× a week
- **[LIB-006]** The classic six-day split, run twice through. High volume and high commitment — it falls apart fast if you can only train four days.
- **[LIB-007]** Push / Pull / Legs, 3× a week
- **[LIB-008]** The same split at a sustainable cadence — each day comes round once a week. A good landing spot when six days stops being realistic.
- **[LIB-009]** Bodyweight Only, 3× a week
- **[LIB-010]** No equipment at all. Progress comes from the movement ladder — harder leverage and less assistance — rather than from adding load.
- **[LIB-011]** Kettlebell Only, 3× a week
- **[LIB-012]** Built for one or two bells and a floor. Swings, get-ups, presses and carries, with a grip finisher on every day.
- **[LIB-013]** First 5K
- **[LIB-014]** Nine weeks from not running to running five kilometres. Every run is easy — the only thing that increases is how long you go.
- **[LIB-015]** 5K — Get Faster
- **[LIB-016]** Eight weeks of speed work on top of an easy-running base. Assumes you can already run 5K without stopping.
- **[LIB-017]** Half Marathon
- **[LIB-018]** Hybrid — Run & Lift
- **[LIB-019]** Two full-body strength days and two runs a week, indefinitely. For staying strong and keeping a running base without training for anything in particular.
- **[LIB-020]** Obstacle Course Race
- **[LIB-021]** Twelve weeks for obstacle racing. Hills and trail instead of track, grip work on every strength day, and burpees on tired legs — because that is when they actually happen.
- **[LIB-022]** Hybrid Fitness Race
- **[LIB-023]** Twelve weeks of compromised running — the thing that actually decides a hybrid fitness race. Strength, a race simulation, intervals, and one long run each week.

### Movement names and notes

<sub>`src/data/seed/exercises.ts`</sub>

- **[LIB-024]** Three seconds down, one second pause, three seconds up. Load without weight.
- **[LIB-025]** Hold a doorframe or counter for balance, or sit back to a box.
- **[LIB-026]** Hip snap, not a squat. The single best conditioning tool for one bell.
- **[LIB-027]** Heels on towels or furniture sliders. Works on any smooth floor.
- **[LIB-028]** A chair, couch, or bed step works as the rear-foot elevation.
- **[LIB-029]** A hybrid-race staple. Tall box, over the top, alternating.
- **[LIB-030]** Hands on a counter or stair. The regression that actually works.
- **[LIB-031]** Brutal grip and shoulder-stability work with a light bell.
- **[LIB-032]** A sturdy table is the no-equipment answer to horizontal pulling.
- **[LIB-033]** Jump to the top, lower for five seconds. The fastest route to a first pull-up.
- **[LIB-034]** Anchor a band overhead. The only vertical pull available with no bar.
- **[LIB-035]** One bell only. The anti-lateral-flexion demand is the whole point.
- **[LIB-036]** Grip work disguised as a carry. A light bell is plenty.
- **[LIB-037]** A common obstacle-race carry. A five-gallon bucket of gravel is the honest rehearsal.
- **[LIB-038]** The single best predictor of holding on to an obstacle.
- **[LIB-039]** Five minutes of get-ups is a full-body session when you own one bell.
- **[LIB-040]** The OCR tax. Every failed obstacle costs 30 of these.
- **[LIB-041]** Burpee into a snatch. Miserable, and extremely effective with one bell.
- **[LIB-042]** Clean, press, squat, row, swing without setting the bell down.
- **[LIB-043]** As many rounds as possible inside a time cap.
- **[LIB-044]** Every minute on the minute. The rest is whatever the minute leaves you.
- **[LIB-045]** Fixed work, clock running. The score is the time.
- **[LIB-046]** Conversational. Most of your weekly mileage belongs here.
- **[LIB-047]** The single most important session in any distance plan.
- **[LIB-048]** Comfortably hard, roughly one-hour race effort.
- **[LIB-049]** Where OCR fitness actually gets built — uneven ground and real vert.

### equipment

<sub>`src/data/seed/equipment.ts`</sub>

- **[LIB-050]** Free weights
- **[LIB-051]** Hanging & bars
- **[LIB-052]** Odd objects
- **[LIB-053]** Places to train
- **[LIB-054]** Bodyweight only
- **[LIB-055]** Road & bodyweight
- **[LIB-056]** Home — kettlebells
- **[LIB-057]** Full gym

---

## Wording used across screens

### customPlans

<sub>`src/data/customPlans.ts`</sub>

- **[WORDS-001]** Suggested session

### fitnessTests

<sub>`src/domain/fitnessTests.ts`</sub>

- **[WORDS-002]** Known max
- **[WORDS-003]** A max you already knew, entered by hand.
- **[WORDS-004]** Whatever you lifted it for, and whenever. Treated exactly like a tested max until you test it, and it ages the same way.
- **[WORDS-005]** Max reps
- **[WORDS-006]** One set to technical failure.
- **[WORDS-007]** Warm up, then one set for as many reps as you can hold form for. Stop when depth, alignment or tempo goes — not when the muscle gives out. Those are different numbers, and only the first one is comparable next time.
- **[WORDS-008]** 3 rep max
- **[WORDS-009]** Work up in threes to the heaviest you can hold form for.
- **[WORDS-010]** Two warm-up sets, then up to five attempts of three, resting two to four minutes between them. It stops at five: past that you are measuring how tired you are rather than how strong.
- **[WORDS-011]** Max hold
- **[WORDS-012]** One hold to form failure.
- **[WORDS-013]** Warm up briefly, then hold for as long as the position stays honest. The clock stops when the shape goes, not when it hurts.
- **[WORDS-014]** Easy set
- **[WORDS-015]** Well short of failure. Enough to be warm, not enough to cost you reps.
- **[WORDS-016]** Stop at technical failure — when depth, alignment or tempo goes, not when it burns.
- **[WORDS-017]** Short hold
- **[WORDS-018]** Find the position. Nowhere near failure.
- **[WORDS-019]** Hold while the shape stays honest. The clock stops when the position goes.
- **[WORDS-020]** Warm-up 1
- **[WORDS-021]** Light. Moving well is the only goal.
- **[WORDS-022]** Warm-up 2
- **[WORDS-023]** Getting heavy, still comfortable.

### generator

<sub>`src/domain/generator.ts`</sub>

- **[WORDS-024]** Build strength
- **[WORDS-025]** Heavy, low reps, long rest. Or a harder variation when there is nothing to load.
- **[WORDS-026]** Build muscle
- **[WORDS-027]** Moderate load, moderate reps, enough rest to repeat it. A rep or two left in the tank.
- **[WORDS-028]** Build endurance
- **[WORDS-029]** Lighter, higher reps, short rest. The point is to keep going.

### goals

<sub>`src/domain/goals.ts`</sub>

- **[WORDS-030]** Get stronger
- **[WORDS-031]** Heavy, low reps, long rest.
- **[WORDS-032]** Build muscle
- **[WORDS-033]** Moderate loads and rep ranges, with enough rest to repeat them.
- **[WORDS-034]** Build endurance
- **[WORDS-035]** Lighter, higher reps, short rest, and more time on your feet.
- **[WORDS-036]** Lose fat
- **[WORDS-037]** Heavy lifting kept intact, with conditioning added around it.
- **[WORDS-038]** The lifting stays heavy on purpose — load is what protects muscle while you are losing weight, and light high-rep circuits give that up for nothing. The conditioning and the eating do the fat loss.
- **[WORDS-039]** General fitness
- **[WORDS-040]** No particular bias. Plans and suggestions are left as written.

### injuries

<sub>`src/domain/injuries.ts`</sub>

- **[WORDS-041]** Noticeable, but it does not stop you.
- **[WORDS-042]** It limits what you can do with the area.
- **[WORDS-043]** Cannot use it
- **[WORDS-044]** Training this area is off the table for now.

### plans

<sub>`src/data/plans.ts`</sub>

- **[WORDS-045]** Benchmark tests
- **[WORDS-046]** Run this from Tests so the protocol is the same both times.

### scheduling

<sub>`src/domain/scheduling.ts`</sub>

- **[WORDS-047]** That day has already passed this week
- **[WORDS-048]** No available days this week

