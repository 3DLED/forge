# Hybrid Forge — every word the app says

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

Counts: 735 strings, 67 files, 9 sections.

---

## Today

### TodayView

<sub>`src/features/today/TodayView.tsx`</sub>

- **[TODAY-001]** Today
- **[TODAY-002]** Show this week's workouts
- **[TODAY-003]** This week
- **[TODAY-004]** load
- **[TODAY-005]** Tap for the week
- **[TODAY-006]** Planned for today
- **[TODAY-007]** In progress
- **[TODAY-008]** min
- **[TODAY-009]** Continue
- **[TODAY-010]** Start
- **[TODAY-011]** Today's sessions
- **[TODAY-012]** Nothing logged today.
- **[TODAY-013]** Training as
- **[TODAY-014]** no equipment set
- **[TODAY-015]** Start a separate workout
- **[TODAY-016]** Start a workout
- **[TODAY-017]** Log a run
- **[TODAY-018]** Morning session
- **[TODAY-019]** Midday session
- **[TODAY-020]** Evening session
- **[TODAY-021]** Late session
- **[TODAY-022]** Yesterday

### WeekSheet

<sub>`src/features/today/WeekSheet.tsx`</sub>

- **[TODAY-023]** Today
- **[TODAY-024]** Planned
- **[TODAY-025]** Start

---

## Logging a workout

### Adding a movement

<sub>`src/features/log/ExercisePicker.tsx`</sub>

- **[LOG-001]** Add
- **[LOG-002]** Add anyway
- **[LOG-003]** Add exercise
- **[LOG-004]** Search movements, muscles, patterns…
- **[LOG-005]** All
- **[LOG-006]** You train these
- **[LOG-007]** Common
- **[LOG-008]** Everything else

### ExerciseGroup

<sub>`src/features/log/ExerciseGroup.tsx`</sub>

- **[LOG-009]** Swap
- **[LOG-010]** Time this hold
- **[LOG-011]** ▶ Track this run
- **[LOG-012]** Run alerts
- **[LOG-013]** + Set
- **[LOG-014]** − Set

### LogRunSheet

<sub>`src/features/log/LogRunSheet.tsx`</sub>

- **[LOG-015]** Log a run
- **[LOG-016]** Today
- **[LOG-017]** Yesterday
- **[LOG-018]** Time
- **[LOG-019]** Effort
- **[LOG-020]** 1 is a walk, 10 is everything you had. This is what your training load is built from, so it is worth a moment's thought.
- **[LOG-021]** Notes
- **[LOG-022]** Felt flat, humid, new shoes…

### Movement write-ups

<sub>`src/features/log/ExerciseInfoSheet.tsx`</sub>

- **[LOG-023]** Swap for another version
- **[LOG-024]** Set up
- **[LOG-025]** How to do it
- **[LOG-026]** Watch for
- **[LOG-027]** No write-up for this one yet — it is likely a movement you added yourself.
- **[LOG-028]** Note
- **[LOG-029]** Trains
- **[LOG-030]** also
- **[LOG-031]** Needs
- **[LOG-032]** Trained one side at a time — log both sides, or double the sets.
- **[LOG-033]** if your equipment changes.
- **[LOG-034]** stand-in

### Picking a saved workout mid-session

<sub>`src/features/log/SavedWorkoutsSheet.tsx`</sub>

- **[LOG-035]** void | Promise
- **[LOG-036]** Your saved workouts
- **[LOG-037]** Nothing saved yet.
- **[LOG-038]** Name a workout you have built and it comes back here, ready to run again — and, if it is timed, with its own best to beat.
- **[LOG-039]** Timed
- **[LOG-040]** Straight sets
- **[LOG-041]** Share, import or tidy these up in More → Saved workouts.
- **[LOG-042]** Run it again

### PinnedTimer

<sub>`src/features/log/PinnedTimer.tsx`</sub>

- **[LOG-043]** Session
- **[LOG-044]** Pause
- **[LOG-045]** Open the full timer
- **[LOG-046]** Record a completed round
- **[LOG-047]** Round
- **[LOG-048]** Save

### RunScreen

<sub>`src/features/log/RunScreen.tsx`</sub>

- **[LOG-049]** to go
- **[LOG-050]** Run alerts
- **[LOG-051]** Close
- **[LOG-052]** per kilometre
- **[LOG-053]** per mile
- **[LOG-054]** stopped
- **[LOG-055]** distance
- **[LOG-056]** time
- **[LOG-057]** average
- **[LOG-058]** Waiting for a decent fix. Under trees or between tall buildings this can take a minute.
- **[LOG-059]** Cues will appear here as they are said.
- **[LOG-060]** Start run
- **[LOG-061]** Pause
- **[LOG-062]** Finish
- **[LOG-063]** Resume
- **[LOG-064]** Discard
- **[LOG-065]** Save to workout

### Running a benchmark test

<sub>`src/features/log/TestRunner.tsx`</sub>

- **[LOG-066]** Recently tested
- **[LOG-067]** What can you do for three?
- **[LOG-068]** A rough guess is fine. Everything is worked out from it, and a wrong one costs an extra attempt rather than the result — what gets recorded is the heaviest set you actually finish.
- **[LOG-069]** Lay out the test
- **[LOG-070]** Use it
- **[LOG-071]** Cancel
- **[LOG-072]** Use a different weight
- **[LOG-073]** How many did you get?
- **[LOG-074]** Reps completed
- **[LOG-075]** Record it
- **[LOG-076]** ▶ Start the hold
- **[LOG-077]** Made it — three good reps
- **[LOG-078]** Failed it — stop the test
- **[LOG-079]** No attempt was completed, so there is nothing to record. Nothing is saved.

### SavedWorkoutRow

<sub>`src/features/log/SavedWorkoutRow.tsx`</sub>

- **[LOG-080]** void | Promise
- **[LOG-081]** Use

### SessionEquipmentSheet

<sub>`src/features/log/SessionEquipmentSheet.tsx`</sub>

- **[LOG-082]** void | Promise
- **[LOG-083]** Equipment for this workout
- **[LOG-084]** Use my default
- **[LOG-085]** Use for this workout
- **[LOG-086]** Start from a profile
- **[LOG-087]** Nothing but bodyweight

### Suggest a workout

<sub>`src/features/log/SuggestWorkoutSheet.tsx`</sub>

- **[LOG-088]** void | Promise
- **[LOG-089]** Suggest a workout
- **[LOG-090]** ⏱ Add as a timed workout
- **[LOG-091]** Your saved sessions
- **[LOG-092]** Or build a new one
- **[LOG-093]** Train
- **[LOG-094]** Full body
- **[LOG-095]** Goal
- **[LOG-096]** Time
- **[LOG-097]** Nothing available for that combination.
- **[LOG-098]** Try another region, or add equipment for this session.
- **[LOG-099]** Swap for an easier or harder version
- **[LOG-100]** Swap
- **[LOG-101]** Drop this movement
- **[LOG-102]** 🎲 Suggest something else

### The logging screen

<sub>`src/features/log/SessionLogger.tsx`</sub>

- **[LOG-103]** 💪 Great
- **[LOG-104]** 🙂 Good
- **[LOG-105]** 😐 OK
- **[LOG-106]** 😮‍💨 Rough
- **[LOG-107]** 🥴 Bad
- **[LOG-108]** Loading…
- **[LOG-109]** That session is gone.
- **[LOG-110]** Back to today
- **[LOG-111]** Session name
- **[LOG-112]** Finished workout — reviewing. Tap Edit to change anything.
- **[LOG-113]** Editing a finished workout. Changes save as you make them.
- **[LOG-114]** ⏱ Add block
- **[LOG-115]** Add a movement, or start an AMRAP or EMOM block.
- **[LOG-116]** Each round
- **[LOG-117]** + Add movement to this block
- **[LOG-118]** ⏱ Edit timed workout
- **[LOG-119]** Ungroup block
- **[LOG-120]** + Add exercise
- **[LOG-121]** ✨ Suggest a workout
- **[LOG-122]** 💾 Save as a workout
- **[LOG-123]** 📂 Browse saved workouts
- **[LOG-124]** ⏱ Make this a timed workout
- **[LOG-125]** Discard session
- **[LOG-126]** Save this workout
- **[LOG-127]** Upper A
- **[LOG-128]** Edit timed workout
- **[LOG-129]** Discard this session?
- **[LOG-130]** Worth doing before you save
- **[LOG-131]** Add
- **[LOG-132]** Cindy, Tuesday burner…
- **[LOG-133]** Name this workout
- **[LOG-134]** Name it
- **[LOG-135]** Optional — saving without them is fine.
- **[LOG-136]** How hard was the whole session? This is what makes running and lifting comparable — effort × minutes is the one load number that spans both.
- **[LOG-137]** Effort
- **[LOG-138]** 1 = barely moved · 5 = solid work · 8 = hard · 10 = everything you had
- **[LOG-139]** Duration
- **[LOG-140]** Duration in minutes
- **[LOG-141]** How did it feel?
- **[LOG-142]** Notes
- **[LOG-143]** Anything worth remembering next time…

### Timed workouts (AMRAP, EMOM, for time)

<sub>`src/features/log/NewBlockSheet.tsx`</sub>

- **[LOG-144]** As many rounds as possible before the cap. Tap a big button for each round.
- **[LOG-145]** Every minute on the minute — a cue at each interval, for a set number of rounds.
- **[LOG-146]** For time
- **[LOG-147]** Fixed work, clock running. The score is how long it took.
- **[LOG-148]** void | Promise
- **[LOG-149]** Your saved timed workouts
- **[LOG-150]** Or build a new one
- **[LOG-151]** Interval
- **[LOG-152]** Rounds

### Timing a hold

<sub>`src/features/log/HoldTimer.tsx`</sub>

- **[LOG-153]** Cancel
- **[LOG-154]** Done

### VariationSheet

<sub>`src/features/log/VariationSheet.tsx`</sub>

- **[LOG-155]** void | Promise
- **[LOG-156]** Current
- **[LOG-157]** Swap

### WorkoutTimer

<sub>`src/features/log/WorkoutTimer.tsx`</sub>

- **[LOG-158]** void | Promise
- **[LOG-159]** Pause
- **[LOG-160]** Save
- **[LOG-161]** Reset
- **[LOG-162]** The clock keeps running in the strip at the top — closing this does not stop it.
- **[LOG-163]** Each round
- **[LOG-164]** Record a completed round
- **[LOG-165]** Undo round
- **[LOG-166]** Sound
- **[LOG-167]** This browser has no audio support — the timer still runs, silently.

---

## Plan

### A single day

<sub>`src/features/plan/DaySheet.tsx`</sub>

- **[PLAN-001]** Add a session
- **[PLAN-002]** Search workouts…
- **[PLAN-003]** Your saved workouts
- **[PLAN-004]** Add
- **[PLAN-005]** From the library
- **[PLAN-006]** Cancel
- **[PLAN-007]** Rest day
- **[PLAN-008]** Nothing scheduled or logged on this day.
- **[PLAN-009]** Done
- **[PLAN-010]** Skipped
- **[PLAN-011]** Start
- **[PLAN-012]** Move
- **[PLAN-013]** Move to date
- **[PLAN-014]** Skip
- **[PLAN-015]** Remove
- **[PLAN-016]** Un-skip
- **[PLAN-017]** Logged
- **[PLAN-018]** + Add a planned session
- **[PLAN-019]** Block this day out

### An active plan

<sub>`src/features/plan/PlanSheet.tsx`</sub>

- **[PLAN-020]** Dates
- **[PLAN-021]** Started
- **[PLAN-022]** Ends
- **[PLAN-023]** Race day
- **[PLAN-024]** Keeping up
- **[PLAN-025]** A different question to the one above — you can be part-way through a plan and have missed most of what it asked for.
- **[PLAN-026]** ↗ Share this plan
- **[PLAN-027]** End this plan

### Blocking days out

<sub>`src/features/plan/BlockOutSheet.tsx`</sub>

- **[PLAN-028]** Nothing new gets scheduled in a blocked stretch, and applying a plan routes around it.
- **[PLAN-029]** From
- **[PLAN-030]** Until
- **[PLAN-031]** Last day to block
- **[PLAN-032]** Reason
- **[PLAN-033]** Travel, rest, work…
- **[PLAN-034]** Reason (optional)
- **[PLAN-035]** They stay where they are — blocking stops new scheduling, it does not throw away work you had already planned. Skip or move them from their own days if you are not doing them.

### Browsing plans

<sub>`src/features/plan/PlanLibrary.tsx`</sub>

- **[PLAN-036]** Race training
- **[PLAN-037]** Set a race date and the plan counts backwards to it.
- **[PLAN-038]** Obstacle & hybrid racing
- **[PLAN-039]** Running and strength in one plan, with grip work that matters on a rig.
- **[PLAN-040]** Strength & muscle
- **[PLAN-041]** Ongoing splits with no end date. Pick the one that matches your week.
- **[PLAN-042]** Everything at once
- **[PLAN-043]** Stay strong and keep a running base without training for anything in particular.
- **[PLAN-044]** Plans
- **[PLAN-045]** Currently active
- **[PLAN-046]** End plan
- **[PLAN-047]** Yours, not running
- **[PLAN-048]** Start
- **[PLAN-049]** Built by you
- **[PLAN-050]** Use
- **[PLAN-051]** Edit
- **[PLAN-052]** Delete
- **[PLAN-053]** + Build a plan
- **[PLAN-054]** Every plan is a starting point — once it is on your calendar you can move, skip, or rewrite any session in it.

### Building your own plan

<sub>`src/features/plan/CustomPlanBuilder.tsx`</sub>

- **[PLAN-055]** Name
- **[PLAN-056]** Plan name
- **[PLAN-057]** Winter base
- **[PLAN-058]** What it is for
- **[PLAN-059]** How long
- **[PLAN-060]** Your week
- **[PLAN-061]** This repeats. The weights climb from what you actually lift, not from the plan.
- **[PLAN-062]** 😴 Rest day
- **[PLAN-063]** Clear
- **[PLAN-064]** Search sessions
- **[PLAN-065]** Decide on the day
- **[PLAN-066]** ✨ Suggest a session
- **[PLAN-067]** Filled in when the day arrives, from your kit and what you have been training.
- **[PLAN-068]** Train
- **[PLAN-069]** For about
- **[PLAN-070]** Your saved workouts
- **[PLAN-071]** Yours · copied into the plan
- **[PLAN-072]** Built in

### Making a distance grow weekly

<sub>`src/features/plan/RampEditor.tsx`</sub>

- **[PLAN-073]** 📈 Make it grow each week
- **[PLAN-074]** Grows each week
- **[PLAN-075]** Turn off
- **[PLAN-076]** Start at
- **[PLAN-077]** Starting value
- **[PLAN-078]** By how much
- **[PLAN-079]** Ten per cent a week is the conventional ceiling for adding distance. Past it the injuries tend to arrive before the fitness does.
- **[PLAN-080]** Stop at
- **[PLAN-081]** Maximum value
- **[PLAN-082]** no limit
- **[PLAN-083]** Where the build-up levels off. Without one it keeps climbing for the whole plan.
- **[PLAN-084]** Week 1

### Putting a plan on the calendar

<sub>`src/features/plan/ApplyPlanSheet.tsx`</sub>

- **[PLAN-085]** Optional. Without it the plan is generated exactly as written.
- **[PLAN-086]** Already planned
- **[PLAN-087]** Testing days
- **[PLAN-088]** Heads up
- **[PLAN-089]** Race day
- **[PLAN-090]** Race date
- **[PLAN-091]** Start
- **[PLAN-092]** Start date
- **[PLAN-093]** How many weeks to lay down
- **[PLAN-094]** This plan has no end. Lay down a stretch now and extend it whenever you like.
- **[PLAN-095]** What you'll get
- **[PLAN-096]** Swapped for your equipment
- **[PLAN-097]** . These movements were replaced with the closest thing you can actually do.
- **[PLAN-098]** Using
- **[PLAN-099]** No substitute
- **[PLAN-100]** Couldn't be scheduled

### The calendar

<sub>`src/features/plan/PlanView.tsx`</sub>

- **[PLAN-101]** Plan
- **[PLAN-102]** Previous month
- **[PLAN-103]** Today
- **[PLAN-104]** Next month
- **[PLAN-105]** Dismiss
- **[PLAN-106]** Planned
- **[PLAN-107]** Done
- **[PLAN-108]** Skipped
- **[PLAN-109]** Striped = blocked out
- **[PLAN-110]** Swipe the calendar to change month.
- **[PLAN-111]** 📥 Import a plan
- **[PLAN-112]** Or tap any day to add a single session.

---

## History

### HistoryView

<sub>`src/features/history/HistoryView.tsx`</sub>

- **[HIST-001]** Loading…
- **[HIST-002]** History
- **[HIST-003]** No sessions yet.
- **[HIST-004]** Everything you log shows up here, newest first.
- **[HIST-005]** Load more

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

- **[PROG-012]** Loading…
- **[PROG-013]** Progress
- **[PROG-014]** Nothing to chart yet.
- **[PROG-015]** Log a few sessions and this fills in — load, mileage, volume, and every personal best.
- **[PROG-016]** Training load
- **[PROG-017]** Effort × minutes, so running and lifting add into one number. Ramping past about 1.5× your four-week average is where injuries cluster.
- **[PROG-018]** Weekly distance
- **[PROG-019]** Weekly volume
- **[PROG-020]** Log your bodyweight
- **[PROG-021]** and push-ups, pull-ups and lunges start counting toward volume instead of reading as no work.
- **[PROG-022]** Personal bests
- **[PROG-023]** Complete some sets and PRs land here.

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
- **[MORE-016]** Name
- **[MORE-017]** Bulgarian bag spin
- **[MORE-018]** Movement name
- **[MORE-019]** What it needs
- **[MORE-020]** Yours
- **[MORE-021]** Everything selected has to be in an equipment profile for this to be offered there.
- **[MORE-022]** How it moves
- **[MORE-023]** What it records
- **[MORE-024]** How hard
- **[MORE-025]** Files as
- **[MORE-026]** Worked out from the kit and the pattern, so filtering, suggestions and the injury log all understand it without being told separately.
- **[MORE-027]** What it trains
- **[MORE-028]** shoulders, core
- **[MORE-029]** Muscles trained
- **[MORE-030]** Set up
- **[MORE-031]** Where you and the kit start. Optional.
- **[MORE-032]** How to do it
- **[MORE-033]** One cue per line, in the order they happen.
- **[MORE-034]** Watch for
- **[MORE-035]** The one thing that usually goes wrong. Optional.

### AppearanceView

<sub>`src/features/more/AppearanceView.tsx`</sub>

- **[MORE-036]** Appearance
- **[MORE-037]** Back
- **[MORE-038]** These are four different directions, not four palettes. Each one changes the shape of things, the type, and how tightly the screen is packed.
- **[MORE-039]** Aa
- **[MORE-040]** Active
- **[MORE-041]** Nothing here touches your data — it is a display setting stored with your profile, so it travels in your backup.

### BodyView

<sub>`src/features/more/BodyView.tsx`</sub>

- **[MORE-042]** Bodyweight
- **[MORE-043]** Back
- **[MORE-044]** This is the load in every push-up, pull-up and lunge you do. Without it those sets show as no work at all on your volume chart. Sessions are valued at what you weighed that week, so logging it today does not rewrite last spring.
- **[MORE-045]** Log today
- **[MORE-046]** Trend
- **[MORE-047]** History
- **[MORE-048]** No weigh-ins yet.
- **[MORE-049]** Once a week is plenty. Daily readings mostly measure lunch.
- **[MORE-050]** Delete this weigh-in?

### Entering a max you know

<sub>`src/features/more/KnownMaxSheet.tsx`</sub>

- **[MORE-051]** The lift
- **[MORE-052]** Reps
- **[MORE-053]** A single, a triple, whatever you know it as. One rep means you are giving a true max.
- **[MORE-054]** Your best set
- **[MORE-055]** reps, unbroken
- **[MORE-056]** The most you can do in one set with good form, stopping when the form goes — not a total across a session.
- **[MORE-057]** Your best hold
- **[MORE-058]** Seconds
- **[MORE-059]** The longest you can hold the position before it breaks down.
- **[MORE-060]** When
- **[MORE-061]** Dating it honestly matters — an old result is still used, and the app says when it is getting stale rather than quietly trusting it forever.
- **[MORE-062]** Works out at
- **[MORE-063]** for one

### Equipment

<sub>`src/features/more/EquipmentView.tsx`</sub>

- **[MORE-064]** Equipment
- **[MORE-065]** Back
- **[MORE-066]** Profiles
- **[MORE-067]** Active
- **[MORE-068]** + New profile
- **[MORE-069]** New equipment profile
- **[MORE-070]** Hotel gym
- **[MORE-071]** Rename
- **[MORE-072]** Delete
- **[MORE-073]** This is your only profile. Make another before deleting this one — the app has to know what you can train with.
- **[MORE-074]** ✎ Tick what you have
- **[MORE-075]** + Add
- **[MORE-076]** ✎ Rename
- **[MORE-077]** Cancel
- **[MORE-078]** Tap the kit you added — the square-cornered ones — to mark it. One at a time to rename, any number to delete. Built-in kit cannot be changed.
- **[MORE-079]** Save kit
- **[MORE-080]** Biggest gaps
- **[MORE-081]** What one more piece of kit would unlock, on top of this profile.
- **[MORE-082]** Add a piece of kit
- **[MORE-083]** Whatever you train with that the list does not name. It behaves like any other equipment: tick it into a profile, and movements can require it.
- **[MORE-084]** What is it
- **[MORE-085]** Equipment name
- **[MORE-086]** Rebounder, macebell, sledgehammer…
- **[MORE-087]** Where it belongs
- **[MORE-088]** Which shelf it shows up on. It will have square corners either way, which is how kit you added is told apart from the built-in list.

### Importing a file

<sub>`src/features/more/ImportSheet.tsx`</sub>

- **[MORE-089]** That file could not be read. It may have been altered or truncated.
- **[MORE-090]** That import did not work.
- **[MORE-091]** Choose a file
- **[MORE-092]** What is in it
- **[MORE-093]** They will be added so this works. Anything you already have is left alone.
- **[MORE-094]** Start it on
- **[MORE-095]** Plan start date
- **[MORE-096]** Sessions are spaced the way the plan author laid them out, counted from this day. It comes in switched off — starting it is a separate choice.

### LibraryRow

<sub>`src/features/more/LibraryRow.tsx`</sub>

- **[MORE-097]** void | Promise
- **[MORE-098]** ↗ Export / Share
- **[MORE-099]** ✎ Edit

### Logging an injury

<sub>`src/features/more/InjurySheet.tsx`</sub>

- **[MORE-100]** Log an injury
- **[MORE-101]** What hurts
- **[MORE-102]** Left shoulder
- **[MORE-103]** What hurts, in your words
- **[MORE-104]** How bad
- **[MORE-105]** Rest until
- **[MORE-106]** How it happened
- **[MORE-107]** Optional — third set of overhead press
- **[MORE-108]** Skipped, not deleted — mark the injury healed early and you can take them back.

### ReshuffleSheet

<sub>`src/features/more/ReshuffleSheet.tsx`</sub>

- **[MORE-109]** Fit the plan to your week
- **[MORE-110]** Leave the plan alone
- **[MORE-111]** Your availability no longer matches where these sessions sit. Completed and skipped sessions are never touched, and nothing before today moves.
- **[MORE-112]** Dropped sessions are removed from the plan, not from your history. Your adherence is measured against what remains.

### RunSettingsView

<sub>`src/features/more/RunSettingsView.tsx`</sub>

- **[MORE-113]** 200 m
- **[MORE-114]** 400 m
- **[MORE-115]** 800 m
- **[MORE-116]** 1 km
- **[MORE-117]** 1600 m
- **[MORE-118]** ¼ mi
- **[MORE-119]** ½ mi
- **[MORE-120]** 1 mi
- **[MORE-121]** Just run
- **[MORE-122]** Easy or long
- **[MORE-123]** Run alerts
- **[MORE-124]** Back
- **[MORE-125]** This browser cannot speak, so cues will appear on screen only. Everything below still decides what gets shown.
- **[MORE-126]** Voice
- **[MORE-127]** Speak cues
- **[MORE-128]** Silent
- **[MORE-129]** Silent keeps every cue on screen and says none of them — for a race, a group run, or a track session where someone is already shouting at you.
- **[MORE-130]** Splits
- **[MORE-131]** On
- **[MORE-132]** Off
- **[MORE-133]** , with the pace for that piece alone and how it compares to your target. Distance rather than a timer, so standing at a crossing does not count.
- **[MORE-134]** Each kind of run keeps its own setup, so a track session does not turn Sunday's long run into four by eight hundred.
- **[MORE-135]** Reps
- **[MORE-136]** Each rep
- **[MORE-137]** Jog between
- **[MORE-138]** Pace alerts
- **[MORE-139]** Say something once I am off by
- **[MORE-140]** Measured against the target above, or on a tempo or interval session against the pace of the piece you are on. Drifting is normal, so this waits — half a minute off pace before it says anything, and longer before it says the same thing twice.
- **[MORE-141]** Minutes and seconds, like 8:30

### Settings

<sub>`src/features/more/SettingsView.tsx`</sub>

- **[MORE-142]** Settings
- **[MORE-143]** Back
- **[MORE-144]** Name
- **[MORE-145]** Training for
- **[MORE-146]** Orders the plan library, sets what ‘Suggest a workout’ opens on, and shapes the sets and reps in plans you start from here. Plans already on your calendar keep what they prescribed.
- **[MORE-147]** Training max
- **[MORE-148]** Suggested loads are worked out from this share of your tested max, rather than from the max itself. Ninety per cent is the usual convention: a number computed from your best day is not makeable on an average one, and a programme you miss reps on is one you stop running. At 100% the suggestions come straight off your max.
- **[MORE-149]** Language
- **[MORE-150]** Spoken cues on a run will use whichever voice this device has, which may not be a Spanish one. Adding a Spanish voice in your device settings fixes it.
- **[MORE-151]** Changes what the app says out loud on a run. Distances stay on whatever the units below are set to.
- **[MORE-152]** Units
- **[MORE-153]** lb / miles
- **[MORE-154]** kg / km
- **[MORE-155]** Stored data does not change — this only affects how numbers are shown, so switching back and forth never rounds your history away.
- **[MORE-156]** Week starts on
- **[MORE-157]** Effort per set
- **[MORE-158]** Once per session
- **[MORE-159]** Every set
- **[MORE-160]** Per-set effort is how autoregulated strength work picks its loads — a 9 on a triple you wanted at 8 means the next set comes down. It is worth the extra box on every row only if you act on it between sets. Training load uses the session figure either way.
- **[MORE-161]** Weekly availability
- **[MORE-162]** See what would move
- **[MORE-163]** Which kinds of training each day can hold. Planning will respect this — a day with nothing selected is a rest day.
- **[MORE-164]** Rest

### Tests

<sub>`src/features/more/TestsView.tsx`</sub>

- **[MORE-165]** Tests
- **[MORE-166]** Back
- **[MORE-167]** Nothing measured yet.
- **[MORE-168]** A test gives the app a real number to program from instead of a guess — and gives you something to beat.
- **[MORE-169]** Due
- **[MORE-170]** Just tested
- **[MORE-171]** Test it again
- **[MORE-172]** Remove this result
- **[MORE-173]** Test a movement
- **[MORE-174]** Enter a max I already know
- **[MORE-175]** Remove this result?

### The More menu

<sub>`src/features/more/MoreView.tsx`</sub>

- **[MORE-176]** Could not read that file.
- **[MORE-177]** More
- **[MORE-178]** Equipment
- **[MORE-179]** Not set
- **[MORE-180]** item
- **[MORE-181]** Run alerts
- **[MORE-182]** Settings
- **[MORE-183]** Kilograms and kilometres
- **[MORE-184]** Pounds and miles
- **[MORE-185]** Appearance
- **[MORE-186]** try the other directions
- **[MORE-187]** Movements
- **[MORE-188]** movement
- **[MORE-189]** of them yours
- **[MORE-190]** add your own
- **[MORE-191]** Plans
- **[MORE-192]** of your own — build, share, import
- **[MORE-193]** plan
- **[MORE-194]** Build your own week, or open a plan someone sent
- **[MORE-195]** Saved workouts
- **[MORE-196]** share, import, tidy up
- **[MORE-197]** workout
- **[MORE-198]** Workouts you have named come back here
- **[MORE-199]** Tests
- **[MORE-200]** due a retest
- **[MORE-201]** Measure a max, and program from a number instead of a guess
- **[MORE-202]** Injuries
- **[MORE-203]** resting
- **[MORE-204]** Log something that hurts and the sessions that load it step aside
- **[MORE-205]** Bodyweight
- **[MORE-206]** the load in every push-up
- **[MORE-207]** Not set — bodyweight sets count as no work without it
- **[MORE-208]** Your data
- **[MORE-209]** Everything lives in this browser on this device. Nothing is uploaded, and no account exists — which also means a cleared browser takes your history with it. Export regularly and keep the file somewhere that syncs.
- **[MORE-210]** planned
- **[MORE-211]** session
- **[MORE-212]** Saved
- **[MORE-213]** Export backup
- **[MORE-214]** Restore from backup
- **[MORE-215]** Start over
- **[MORE-216]** Erases every session, plan, and setting on this device and reseeds the movement library from scratch. Export a backup first if there is anything you want.
- **[MORE-217]** Erase all data
- **[MORE-218]** Hybrid Forge · offline training tracker
- **[MORE-219]** Restore backup
- **[MORE-220]** . Merging keeps what is already on this device and lets the newer copy of each record win — the right choice when you have trained since the export. Replacing wipes first, for moving to a new phone.
- **[MORE-221]** Restoring
- **[MORE-222]** Merge (recommended)
- **[MORE-223]** Replace everything
- **[MORE-224]** Type ERASE to confirm

### The injury log

<sub>`src/features/more/InjuryView.tsx`</sub>

- **[MORE-225]** Injuries
- **[MORE-226]** Back
- **[MORE-227]** Nothing logged.
- **[MORE-228]** Log something that hurts and the sessions that load it step aside — the rest of your training carries on.
- **[MORE-229]** Current
- **[MORE-230]** Mark it healed
- **[MORE-231]** Healed
- **[MORE-232]** Remove from the log
- **[MORE-233]** Log an injury
- **[MORE-234]** Healed already?
- **[MORE-235]** Remove this from the log?

### The movement library

<sub>`src/features/more/ExerciseLibraryView.tsx`</sub>

- **[MORE-236]** Edit
- **[MORE-237]** Delete
- **[MORE-238]** Movements
- **[MORE-239]** movement
- **[MORE-240]** Back
- **[MORE-241]** Search movements
- **[MORE-242]** All
- **[MORE-243]** Add a movement
- **[MORE-244]** Yours
- **[MORE-245]** Built in
- **[MORE-246]** more movement

### Which weights you own

<sub>`src/features/more/RackEditor.tsx`</sub>

- **[MORE-247]** Add
- **[MORE-248]** Cancel
- **[MORE-249]** + Another size
- **[MORE-250]** Weights you own
- **[MORE-251]** Suggested loads, progressions and test ladders all snap to these. Leave a section empty and that movement falls back to round numbers.
- **[MORE-252]** Barbell
- **[MORE-253]** The bar
- **[MORE-254]** Plates, in pairs

### Your plans

<sub>`src/features/more/PlansView.tsx`</sub>

- **[MORE-255]** Plans
- **[MORE-256]** Back
- **[MORE-257]** Dismiss
- **[MORE-258]** No plans of your own yet.
- **[MORE-259]** Lay out a week — which days you train and what you do on them — and it repeats for as long as you set it to.
- **[MORE-260]** + Build a plan
- **[MORE-261]** 📥 Import a plan

### Your saved workouts

<sub>`src/features/more/SavedWorkoutsView.tsx`</sub>

- **[MORE-262]** Saved workouts
- **[MORE-263]** Back
- **[MORE-264]** Dismiss
- **[MORE-265]** Nothing saved yet.
- **[MORE-266]** Name a workout you have built and it comes back here, ready to run again — and, if it is timed, with its own best to beat.
- **[MORE-267]** 📥 Import a workout

---

## Shared bits — buttons, sheets, empty states

### AppProvider

<sub>`src/ui/AppProvider.tsx`</sub>

- **[SHARED-001]** Could not open your training data
- **[SHARED-002]** Private browsing blocks local storage in some browsers. Try a normal window.

### AskSheet

<sub>`src/ui/AskSheet.tsx`</sub>

- **[SHARED-003]** void | Promise
- **[SHARED-004]** Cancel

### SessionCard

<sub>`src/ui/SessionCard.tsx`</sub>

- **[SHARED-005]** In progress

### Sheet

<sub>`src/ui/Sheet.tsx`</sub>

- **[SHARED-006]** Close

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
- **[LIB-050]** Low-impact cardio on a mini trampoline. Scored by time — the health bounce is small and quick, not high.

### equipment

<sub>`src/data/seed/equipment.ts`</sub>

- **[LIB-051]** Free weights
- **[LIB-052]** Hanging & bars
- **[LIB-053]** Odd objects
- **[LIB-054]** Places to train
- **[LIB-055]** Bodyweight only
- **[LIB-056]** Road & bodyweight
- **[LIB-057]** Home — kettlebells
- **[LIB-058]** Full gym

---

## Wording used across screens

### categories

<sub>`src/domain/categories.ts`</sub>

- **[WORDS-001]** Weights
- **[WORDS-002]** Calisthenics
- **[WORDS-003]** Cardio
- **[WORDS-004]** Skill
- **[WORDS-005]** Mobility

### customPlans

<sub>`src/data/customPlans.ts`</sub>

- **[WORDS-006]** Suggested session

### dates

<sub>`src/domain/dates.ts`</sub>

- **[WORDS-007]** Today
- **[WORDS-008]** Yesterday
- **[WORDS-009]** Tomorrow

### difficulty

<sub>`src/domain/difficulty.ts`</sub>

- **[WORDS-010]** Beginner
- **[WORDS-011]** Intermediate
- **[WORDS-012]** Advanced

### fitnessTests

<sub>`src/domain/fitnessTests.ts`</sub>

- **[WORDS-013]** Known max
- **[WORDS-014]** A max you already knew, entered by hand.
- **[WORDS-015]** Whatever you lifted it for, and whenever. Treated exactly like a tested max until you test it, and it ages the same way.
- **[WORDS-016]** Max reps
- **[WORDS-017]** One set to technical failure.
- **[WORDS-018]** Warm up, then one set for as many reps as you can hold form for. Stop when depth, alignment or tempo goes — not when the muscle gives out. Those are different numbers, and only the first one is comparable next time.
- **[WORDS-019]** 3 rep max
- **[WORDS-020]** Work up in threes to the heaviest you can hold form for.
- **[WORDS-021]** Two warm-up sets, then up to five attempts of three, resting two to four minutes between them. It stops at five: past that you are measuring how tired you are rather than how strong.
- **[WORDS-022]** Max hold
- **[WORDS-023]** One hold to form failure.
- **[WORDS-024]** Warm up briefly, then hold for as long as the position stays honest. The clock stops when the shape goes, not when it hurts.
- **[WORDS-025]** Easy set
- **[WORDS-026]** Well short of failure. Enough to be warm, not enough to cost you reps.
- **[WORDS-027]** Stop at technical failure — when depth, alignment or tempo goes, not when it burns.
- **[WORDS-028]** Short hold
- **[WORDS-029]** Find the position. Nowhere near failure.
- **[WORDS-030]** Hold while the shape stays honest. The clock stops when the position goes.
- **[WORDS-031]** Warm-up 1
- **[WORDS-032]** Light. Moving well is the only goal.
- **[WORDS-033]** Warm-up 2
- **[WORDS-034]** Getting heavy, still comfortable.

### generator

<sub>`src/domain/generator.ts`</sub>

- **[WORDS-035]** Build strength
- **[WORDS-036]** Heavy, low reps, long rest. Or a harder variation when there is nothing to load.
- **[WORDS-037]** Build muscle
- **[WORDS-038]** Moderate load, moderate reps, enough rest to repeat it. A rep or two left in the tank.
- **[WORDS-039]** Build endurance
- **[WORDS-040]** Lighter, higher reps, short rest. The point is to keep going.

### goals

<sub>`src/domain/goals.ts`</sub>

- **[WORDS-041]** Get stronger
- **[WORDS-042]** Heavy, low reps, long rest.
- **[WORDS-043]** Build muscle
- **[WORDS-044]** Moderate loads and rep ranges, with enough rest to repeat them.
- **[WORDS-045]** Build endurance
- **[WORDS-046]** Lighter, higher reps, short rest, and more time on your feet.
- **[WORDS-047]** Lose fat
- **[WORDS-048]** Heavy lifting kept intact, with conditioning added around it.
- **[WORDS-049]** The lifting stays heavy on purpose — load is what protects muscle while you are losing weight, and light high-rep circuits give that up for nothing. The conditioning and the eating do the fat loss.
- **[WORDS-050]** General fitness
- **[WORDS-051]** No particular bias. Plans and suggestions are left as written.

### injuries

<sub>`src/domain/injuries.ts`</sub>

- **[WORDS-052]** Noticeable, but it does not stop you.
- **[WORDS-053]** It limits what you can do with the area.
- **[WORDS-054]** Cannot use it
- **[WORDS-055]** Training this area is off the table for now.

### pace

<sub>`src/domain/pace.ts`</sub>

- **[WORDS-056]** Every quarter mile
- **[WORDS-057]** Every half mile
- **[WORDS-058]** Every mile
- **[WORDS-059]** Every half kilometre
- **[WORDS-060]** Every kilometre

### plans

<sub>`src/data/plans.ts`</sub>

- **[WORDS-061]** Benchmark tests
- **[WORDS-062]** Run this from Tests so the protocol is the same both times.

### regions

<sub>`src/domain/regions.ts`</sub>

- **[WORDS-063]** Upper body
- **[WORDS-064]** Lower body
- **[WORDS-065]** Core
- **[WORDS-066]** Conditioning
- **[WORDS-067]** Cardio

### runSettings

<sub>`src/domain/runSettings.ts`</sub>

- **[WORDS-068]** Silent
- **[WORDS-069]** pace alerts
- **[WORDS-070]** Nothing spoken

### scheduling

<sub>`src/domain/scheduling.ts`</sub>

- **[WORDS-071]** That day has already passed this week
- **[WORDS-072]** No available days this week

