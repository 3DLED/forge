"""What the ExerciseDB catalogue has that Forge does not.

The mirror of `exercise_media_gaps.py`, and a harder question to answer usefully. Subtracting
Forge's 234 movements from the catalogue's 1,394 names leaves around twelve hundred, which as
a flat list tells you nothing: most of it is the same handful of exercises wearing different
grips, angles and equipment.

So the leftovers are split two ways, because the two ask different questions of you.

**By family.** A family is the movement's head noun -- press, row, curl, squat, hinge. If
Forge already has a family, another entry in it is a *variation*: "barbell reverse grip incline
bench press" is worth having only if you would program it, and Forge's difficulty ladders
already cover the same ground with `easier`/`harder`. If Forge has no entry in that family at
all, the catalogue is offering something genuinely absent.

**By equipment.** Forge's whole premise is that equipment is a filter, not a footnote. A
hundred cable machine exercises are not an opportunity for somebody training in a garage with
kettlebells, and they are also not free: every movement added to the seed is one more row the
picker has to scroll past and the generator has to consider. Anything needing kit Forge has no
tag for cannot even be expressed today.

    python tools/exercisedb_extras.py <path-to-exerciseList.json>
"""

import io
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "docs", "exercisedb-extras.md")

sys.path.insert(0, HERE)
from exercise_media_gaps import classify, forge_exercises, normalise  # noqa: E402

#: Equipment as the catalogue names it, mapped to whether Forge can express it today.
#:
#: Ordered most specific first, because "resistance band" has to beat "band" and "ez barbell"
#: has to beat "barbell".
EQUIPMENT = [
    ("resistance band", "band", True),
    ("ez barbell", "barbell (EZ bar)", False),
    ("olympic barbell", "barbell", True),
    ("trap bar", "trap bar", True),
    ("barbell", "barbell", True),
    ("dumbbell", "dumbbell", True),
    ("kettlebell", "kettlebell", True),
    ("cable", "cable machine", True),
    ("smith", "Smith machine", True),
    ("lever", "plate-loaded machine", False),
    ("sled", "sled / leg press", True),
    ("band", "band", True),
    ("weighted", "added load", True),
    ("assisted", "assisted (partner or band)", False),
    ("stability ball", "stability ball", True),
    ("exercise ball", "stability ball", True),
    ("medicine ball", "medicine ball", True),
    ("bosu ball", "BOSU", False),
    ("roller", "foam roller", True),
    ("suspension", "suspension trainer", True),
    ("rope", "rope", True),
    ("wheel", "ab wheel", True),
    ("hammer", "hammer", False),
]

#: The head noun that names what the movement *is*.
#:
#: Matched against the *normalised* name on both sides, which is the whole point: Forge writes
#: "Push-Up" and the catalogue writes "push up", and comparing the raw strings put those in two
#: different families and then reported push-ups as something Forge does not have.
#:
#: Longest first, so "calf raise" beats "raise" -- a calf raise and a lateral raise are not the
#: same movement wearing different equipment.
FAMILIES = [
    "calf raise", "leg raise", "lateral raise", "front raise", "hip raise",
    "bench press", "shoulder press", "leg press", "chest press", "overhead press",
    "pull through", "good morning", "romanian deadlift", "deadlift",
    "pulldown", "pullover", "push up", "pull up", "chin up", "sit up", "step up",
    "squat", "lunge", "thruster", "clean", "snatch", "jerk", "rollout", "kickback",
    "row", "curl", "extension", "fly", "raise", "press", "shrug", "dip", "crunch",
    "twist", "plank", "bridge", "hold", "stretch", "carry", "walk", "run", "jump",
    "swing", "throw", "slam", "climb", "hang", "abduction", "adduction", "rotation",
]


def equipment_of(name):
    lowered = name.lower()
    for token, label, expressible in EQUIPMENT:
        if token in lowered:
            return label, expressible
    return "bodyweight or unspecified", True


def family_of(name):
    """The family, read off the normalised name so both vocabularies land in the same bucket."""
    flat = " ".join(normalise(name))
    for family in FAMILIES:
        if family in flat:
            return family
    return "other"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    names = json.load(io.open(sys.argv[1], encoding="utf-8"))
    catalogue = [(n, normalise(n)) for n in names]
    forge = forge_exercises()

    # Every catalogue name already standing in for a Forge movement, so it is not "extra".
    spoken_for = set()
    forge_families = set()
    for slug, name, helper, kit in forge:
        forge_families.add(family_of(name))
        verdict, best, score = classify(normalise(name), kit, catalogue)
        if verdict in ("covered", "check") and best:
            spoken_for.add(best)

    extras = [n for n in names if n not in spoken_for]

    # How much of the catalogue is the same drawing twice.
    duplicates = [n for n in extras if re.search(r"\((?:male|female)\)|\bv\.?\s*\d", n)]

    by_family = defaultdict(list)
    for name in extras:
        by_family[family_of(name)].append(name)

    new_families = {f: v for f, v in by_family.items() if f not in forge_families and f != "other"}
    variations = {f: v for f, v in by_family.items() if f in forge_families}

    by_equipment = defaultdict(list)
    for name in extras:
        label, expressible = equipment_of(name)
        by_equipment[(label, expressible)].append(name)

    lines = [
        "# What ExerciseDB has that Forge does not",
        "",
        f"The catalogue is **{len(names)} names**. **{len(spoken_for)}** already stand in for a "
        f"Forge movement, leaving **{len(extras)}**.",
        "",
        "That number flatters itself. These are new *names*, not new *movements*: "
        f"**{len(duplicates)}** of them are the same exercise listed again as a (male) or "
        "(female) or v. 2 variant, and most of the rest are grip and angle variations of "
        "something Forge already has.",
        "",
        "Generated by `tools/exercisedb_extras.py`.",
        "",
        "## Movement families Forge has nothing in",
        "",
        "The part actually worth reading. Everything below is a kind of movement the seed does "
        "not currently cover at all.",
        "",
    ]
    for family, entries in sorted(new_families.items(), key=lambda kv: -len(kv[1])):
        lines.append(f"### {family} ({len(entries)})")
        lines.append("")
        lines.append(", ".join(sorted(entries)[:60]))
        if len(entries) > 60:
            lines.append("")
            lines.append(f"_...and {len(entries) - 60} more._")
        lines.append("")

    lines += [
        "## By equipment",
        "",
        "Equipment is a filter, not a footnote — a hundred cable exercises are not an "
        "opportunity for somebody in a garage with kettlebells. \"Expressible\" means Forge "
        "already has a tag for that kit; the rest could not be represented today without "
        "adding one.",
        "",
        "| Equipment | Extra movements | Forge can express it |",
        "|---|---|---|",
    ]
    for (label, expressible), entries in sorted(by_equipment.items(), key=lambda kv: -len(kv[1])):
        lines.append(f"| {label} | {len(entries)} | {'yes' if expressible else 'no'} |")

    lines += [
        "",
        "## Variations on families Forge already has",
        "",
        "Lower value per entry. Forge's difficulty ladders already move between harder and "
        "easier versions of these, so another grip is only worth a row in the picker if you "
        "would actually program it.",
        "",
        "| Family | Extra variations |",
        "|---|---|",
    ]
    for family, entries in sorted(variations.items(), key=lambda kv: -len(kv[1])):
        lines.append(f"| {family} | {len(entries)} |")

    lines += ["", "## Everything, by equipment", ""]
    for (label, expressible), entries in sorted(by_equipment.items(), key=lambda kv: -len(kv[1])):
        lines.append(f"### {label} ({len(entries)})")
        lines.append("")
        lines.append(", ".join(sorted(entries)))
        lines.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\r\n").write("\n".join(lines))

    print(f"wrote {OUT}")
    print(f"  catalogue          {len(names)}")
    print(f"  already in Forge   {len(spoken_for)}")
    print(f"  extra              {len(extras)}  ({len(duplicates)} are male/female/v2 repeats)")
    print()
    print("  families Forge has nothing in:")
    for family, entries in sorted(new_families.items(), key=lambda kv: -len(kv[1])):
        print(f"    {family:<16} {len(entries)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
