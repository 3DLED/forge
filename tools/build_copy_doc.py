"""Turn the extracted strings into something a person can actually proofread.

Grouped by where you meet the words rather than by file, because "which screen is this on" is
the question a proofreader asks and "which module holds it" is not. Every line carries a stable
id, so an edited copy can be matched back to its source without relying on line numbers, which
move the moment anyone touches the file.
"""

import io
import json
import os

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")

# Where the words are met, in the order you meet them.
AREAS: list[tuple[str, str, tuple[str, ...]]] = [
    ("TODAY", "Today", ("src/features/today/",)),
    ("LOG", "Logging a workout", ("src/features/log/",)),
    ("PLAN", "Plan", ("src/features/plan/",)),
    ("HIST", "History", ("src/features/history/",)),
    ("PROG", "Progress", ("src/features/progress/",)),
    ("MORE", "More", ("src/features/more/",)),
    ("SHARED", "Shared bits — buttons, sheets, empty states", ("src/ui/",)),
    ("LIB", "The built-in library — movements, sessions, plans", ("src/data/seed/",)),
    ("WORDS", "Wording used across screens", ("src/domain/", "src/data/")),
]

PREFACE = """# Forge — every word the app says

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

Counts: %(strings)s strings, %(files)s files, %(areas)s sections.

---

"""

FILE_TITLES = {
    "SessionLogger.tsx": "The logging screen",
    "SuggestWorkoutSheet.tsx": "Suggest a workout",
    "ExercisePicker.tsx": "Adding a movement",
    "ExerciseInfoSheet.tsx": "Movement write-ups",
    "NewBlockSheet.tsx": "Timed workouts (AMRAP, EMOM, for time)",
    "RestTimer.tsx": "The rest timer",
    "HoldTimer.tsx": "Timing a hold",
    "TestRunner.tsx": "Running a benchmark test",
    "SavedWorkoutsSheet.tsx": "Picking a saved workout mid-session",
    "PlanView.tsx": "The calendar",
    "PlanLibrary.tsx": "Browsing plans",
    "ApplyPlanSheet.tsx": "Putting a plan on the calendar",
    "CustomPlanBuilder.tsx": "Building your own plan",
    "RampEditor.tsx": "Making a distance grow weekly",
    "DaySheet.tsx": "A single day",
    "BlockOutSheet.tsx": "Blocking days out",
    "PlanSheet.tsx": "An active plan",
    "MoreView.tsx": "The More menu",
    "SettingsView.tsx": "Settings",
    "EquipmentView.tsx": "Equipment",
    "RackEditor.tsx": "Which weights you own",
    "ExerciseLibraryView.tsx": "The movement library",
    "ExerciseEditorSheet.tsx": "Adding your own movement",
    "TestsView.tsx": "Tests",
    "KnownMaxSheet.tsx": "Entering a max you know",
    "InjuryView.tsx": "The injury log",
    "InjurySheet.tsx": "Logging an injury",
    "ImportSheet.tsx": "Importing a file",
    "PlansView.tsx": "Your plans",
    "SavedWorkoutsView.tsx": "Your saved workouts",
    "exercises.ts": "Movement names and notes",
    "sessionTemplates.ts": "Built-in session names",
    "planTemplates.ts": "Built-in plan names and descriptions",
    "coaching.ts": "How-to write-ups",
}


def title_for(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    return FILE_TITLES.get(name, name.replace(".tsx", "").replace(".ts", ""))


def build() -> str:
    rows = json.load(io.open(os.path.join(HERE, "app-copy.json"), encoding="utf-8"))

    used: set[int] = set()
    sections: list[str] = []
    counters: dict[str, int] = {}
    index: dict[str, dict] = {}

    for prefix, heading, roots in AREAS:
        mine = [
            (i, r)
            for i, r in enumerate(rows)
            if i not in used and any(r["file"].startswith(root) for root in roots)
        ]
        if not mine:
            continue

        body: list[str] = [f"## {heading}\n"]
        by_file: dict[str, list[tuple[int, dict]]] = {}
        for i, r in mine:
            used.add(i)
            by_file.setdefault(r["file"], []).append((i, r))

        for path, entries in sorted(by_file.items(), key=lambda kv: title_for(kv[0])):
            body.append(f"### {title_for(path)}\n")
            body.append(f"<sub>`{path}`</sub>\n")
            for _i, r in entries:
                counters[prefix] = counters.get(prefix, 0) + 1
                key = f"{prefix}-{counters[prefix]:03d}"
                index[key] = r
                body.append(f"- **[{key}]** {r['text']}")
            body.append("")

        sections.append("\n".join(body))

    header = PREFACE % {
        "strings": len(rows),
        "files": len({r["file"] for r in rows}),
        "areas": len(sections),
    }

    io.open(os.path.join(HERE, "app-copy-index.json"), "w", encoding="utf-8").write(
        json.dumps(index, ensure_ascii=False, indent=1)
    )
    return header + "\n---\n\n".join(sections) + "\n"


if __name__ == "__main__":
    doc = build()
    out = os.path.join(HERE, "app-copy.md")
    io.open(out, "w", encoding="utf-8", newline="\n").write(doc)
    print(f"wrote {out} ({len(doc.splitlines())} lines)")
