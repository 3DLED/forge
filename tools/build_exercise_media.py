"""Turn a purchased ExerciseDB set into the map Forge reads.

The dataset is keyed by its own four-digit ids: `0025.json` describes an exercise and
`0025-180.gif` is its animation. Forge is keyed by slug. This walks the purchased folder,
joins the two on the exercise *name*, and writes `src/data/exerciseMediaMap.ts`.

Names are the only join available, and they do not line up on their own -- Forge calls it
"Conventional Deadlift" and the dataset calls it "barbell deadlift". So there are two passes:
an exact match on a normalised name, then an explicit alias table below for the ones a human
has checked. Nothing is guessed. A wrong picture is worse than no picture -- somebody looking
up a movement they do not know has no way to tell they are being shown the wrong one -- so
anything unmatched is simply left out and reported at the end for review.

    python tools/build_exercise_media.py <path-to-purchased-set> [--copy]

`--copy` also copies the 180px GIFs it matched into `public/exercise-media/`, which is what
the app serves. Only the matched ones: the full set is around 165 MB at 180px, and Forge has
uses for a fraction of it.
"""

import io
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SEED = os.path.join(ROOT, "src", "data", "seed", "exercises.ts")
OUT = os.path.join(ROOT, "src", "data", "exerciseMediaMap.ts")
MEDIA = os.path.join(ROOT, "public", "exercise-media")

# Which size gets shipped. 180 is what the movement card and the info sheet display; the
# larger ones exist in the purchased set and are not worth the bytes at the size we draw them.
SIZE = 180

#: Forge slug -> the dataset's name for the same movement.
#:
#: Only pairs someone has actually looked at. Every name on the right was confirmed to exist
#: in the sample `exerciseList.json`; every slug on the left was confirmed to exist in the
#: seed. Extend this after eyeballing the GIF -- "barbell full squat" sounds like a back squat
#: and is worth one look before a few hundred people are shown it.
ALIASES = {
    "bench-press": "barbell bench press",
    "db-bench-press": "dumbbell bench press",
    "deadlift": "barbell deadlift",
    "romanian-deadlift": "barbell romanian deadlift",
    "db-romanian-deadlift": "dumbbell romanian deadlift",
    "back-squat": "barbell full squat",
    "front-squat": "barbell front squat",
    "db-goblet-squat": "dumbbell goblet squat",
    "goblet-squat": "kettlebell goblet squat",
    "kb-swing": "kettlebell swing",
    "kb-windmill": "kettlebell windmill",
    "barbell-row": "barbell bent over row",
    "bicep-curl": "barbell curl",
    "lateral-raise": "dumbbell lateral raise",
    "shrug": "barbell shrug",
    "good-morning": "barbell good morning",
    "glute-bridge": "barbell glute bridge",
    "forward-lunge": "barbell lunge",
    "arnold-press": "dumbbell arnold press",
    "ab-wheel-rollout": "wheel rollout",
    "farmers-carry": "farmers walk",
    "hanging-leg-raise": "hanging leg raise",
    "battle-ropes": "battling ropes",
    "slam-ball": "medicine ball overhead slam",
    "double-unders": "jump rope",
    "freestanding-handstand-push-up": "handstand push-up",
}


def normalise(name):
    """Fold the two naming styles together: case, punctuation, and parenthetical asides."""
    name = name.lower()
    name = re.sub(r"\(.*?\)", " ", name)
    name = name.replace("-", " ").replace("/", " ")
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    return " ".join(name.split())


def forge_exercises():
    """Slug and display name for every seeded movement."""
    source = io.open(SEED, encoding="utf-8").read()
    rows = re.findall(r"\b(?:ex|cardio|mobility|skill)\(\s*'([^']+)'\s*,\s*'([^']+)'", source)
    return {slug: name for slug, name in rows}


def dataset(folder):
    """Every `NNNN.json` in the purchased set, as {normalised name: (id, original name)}."""
    found = {}
    for entry in sorted(os.listdir(folder)):
        if not entry.endswith(".json") or entry == "exerciseList.json":
            continue
        record = json.load(io.open(os.path.join(folder, entry), encoding="utf-8"))
        if "id" in record and "name" in record:
            found[normalise(record["name"])] = (record["id"], record["name"])
    return found


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    folder = sys.argv[1]
    copy = "--copy" in sys.argv

    forge = forge_exercises()
    media = dataset(folder)
    if not media:
        print(f"No exercise JSON files found in {folder}")
        return 1

    matched, unmatched, aliased_but_absent = {}, [], []

    for slug, name in sorted(forge.items()):
        key = normalise(ALIASES[slug]) if slug in ALIASES else normalise(name)
        hit = media.get(key)
        if hit:
            matched[slug] = hit
        elif slug in ALIASES:
            # An alias pointing at a name the set does not have is a typo, not a gap.
            aliased_but_absent.append((slug, ALIASES[slug]))
        else:
            unmatched.append((slug, name))

    lines = [
        "/**",
        " * Forge slug -> ExerciseDB media id.",
        " *",
        " * Generated by `tools/build_exercise_media.py`. Do not edit by hand: add an entry to",
        " * that script's ALIASES table and run it again, so the mapping survives the next time",
        " * the dataset is refreshed.",
        " */",
        "",
        "export const EXERCISE_MEDIA: Record<string, string> = {",
    ]
    for slug, (media_id, name) in sorted(matched.items()):
        lines.append(f"  '{slug}': '{media_id}', // {name}")
    lines.append("};")
    lines.append("")

    io.open(OUT, "w", encoding="utf-8", newline="\r\n").write("\n".join(lines))

    if copy:
        os.makedirs(MEDIA, exist_ok=True)
        copied = 0
        for media_id, _ in matched.values():
            source = os.path.join(folder, f"{media_id}-{SIZE}.gif")
            if os.path.exists(source):
                shutil.copy2(source, os.path.join(MEDIA, f"{media_id}-{SIZE}.gif"))
                copied += 1
        print(f"copied {copied} GIFs into public/exercise-media/")

    print(f"wrote {OUT}")
    print(f"matched {len(matched)} of {len(forge)} Forge movements")
    if aliased_but_absent:
        print(f"\nALIASES pointing at names not in the set ({len(aliased_but_absent)}):")
        for slug, target in aliased_but_absent:
            print(f"  {slug} -> {target}")
    print(f"\nno picture ({len(unmatched)}):")
    for slug, name in unmatched:
        print(f"  {slug:<34} {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
