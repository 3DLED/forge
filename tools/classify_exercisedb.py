"""Work out a Forge movement pattern for every ExerciseDB entry, and measure how well.

The catalogue carries no movement pattern, and `pattern` is the field Forge's generator runs
on -- it groups candidates by pattern and fills a session by covering each one. So importing
the catalogue means deriving a pattern for 1,394 entries that never had one.

Two signals, in order of authority:

**The name, where it names a movement.** "squat", "deadlift", "carry" say what the body is
doing, which is what a pattern is. Checked first because it is the only signal that speaks
about mechanics rather than anatomy.

**The target muscle, otherwise.** `target` is one of nineteen values and nearly all of them
imply a pattern: lats are pulled to, pectorals are pushed from. `bodyPart` looks like it
should help and does not -- "back" covers rows, pulldowns and hyperextensions alike.

The point of this file is the last section: the 92 movements Forge already has *and* the
catalogue describes form a validation set with a known right answer, so the classifier can be
measured rather than trusted.

    python tools/classify_exercisedb.py <path-to-starter-folder>
"""

import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SEED = os.path.join(ROOT, "src", "data", "seed", "exercises.ts")
MAP = os.path.join(ROOT, "src", "data", "exerciseMediaMap.ts")

#: Name fragments that state the movement outright, checked before anything anatomical.
#:
#: Order matters: "split squat" is a lunge, so lunge has to be tested before squat, and
#: "hip thrust" is a hinge before "thrust" can be read as anything else.
BY_NAME = [
    # Whole-body efforts first: they contain words every other list wants ("jump", "rope",
    # "slam"), and calling a burpee a squat because it passes through one helps nobody.
    ("fullBody", ["burpee", "thruster", "man maker", "turkish get", "get-up", "get up",
                  "jump rope", "double under", "battling rope", "battle rope", "crawl",
                  "slam", "broad jump", "forward jump", "clean and jerk", "wall ball"]),
    ("carry", ["carry", "farmers walk", "waiter walk", "suitcase", "rope climb"]),
    ("core", ["crunch", "sit-up", "sit up", "plank", "russian twist", "leg raise",
              "knee raise", "hollow", "woodchop", "dead bug", "bicycle", "side bend",
              "toe touch", "v-up", "jackknife", "l-sit", "rollout", "oblique",
              "mountain climber", "flutter kick", "scissor kick"]),
    ("lunge", ["lunge", "split squat", "step-up", "step up", "curtsey"]),
    ("hinge", ["deadlift", "good morning", "hyperextension", "hyper extension", "hyper",
               "swing", "romanian", "hip thrust", "glute bridge", "bridge", "clean",
               "snatch", "pull through", "back extension"]),
    ("squat", ["squat", "leg press", "calf raise", "calf press", "sissy"]),
    # Vertical pushing before horizontal, because a handstand push-up and a pike push-up are
    # both overhead and both contain "push-up".
    ("pushVertical", ["shoulder press", "overhead press", "military press", "push press",
                      "handstand", "pike", "lateral raise", "front raise", "upright row",
                      "arnold", "jerk", "landmine press", "z press"]),
    ("pullVertical", ["pulldown", "pull-up", "pull up", "chin-up", "chin up", "pullover",
                      "lat pulldown", "muscle up", "high pull"]),
    ("pullHorizontal", ["row", "face pull", "rear delt", "reverse fly", "shrug"]),
    ("pushHorizontal", ["bench press", "push-up", "push up", "pushup", "chest press", "fly",
                        "dip", "pec deck"]),
    # Last, because "walking lunge" is a lunge and "bench press" is not a bench.
    ("gait", ["run", "jog", "sprint", "walk", "treadmill", "elliptical", "stationary bike",
              "stair", "skierg", "cycle", "stepmill"]),
]


def says(name, key):
    """Whether the name contains `key` as whole words.

    Naive substring matching put "lat " inside "flat bench" and filed a reverse hyper as a
    vertical pull, so the boundaries are the point. A trailing "s" is allowed through them,
    because the catalogue writes both "ring dip" and "ring dips" and means the same thing.
    """
    body = re.escape(key).replace(r"\ ", r"\s+")
    return re.search(r"(?<![a-z])" + body + r"s?(?![a-z])", name) is not None


#: Where a muscle is worked from, when the name does not say.
#:
#: Every one of these is a judgement about which of Forge's eleven patterns comes closest, and
#: a few are uncomfortable. A calf raise is not really a squat; it is filed there because the
#: pattern's only structural job is to put the movement in the lower-body bucket, which is
#: right. Neck work has nowhere sensible to go at all -- see NECK below.
BY_TARGET = {
    "abs": "core",
    "spine": "core",
    "pectorals": "pushHorizontal",
    "serratus anterior": "pushHorizontal",
    "delts": "pushVertical",
    "triceps": "pushVertical",
    "lats": "pullVertical",
    "biceps": "pullVertical",
    "upper back": "pullHorizontal",
    "traps": "pullHorizontal",
    "forearms": "pullHorizontal",
    "levator scapulae": "pullHorizontal",
    "glutes": "hinge",
    "hamstrings": "hinge",
    "quads": "squat",
    "calves": "squat",
    "adductors": "lunge",
    "abductors": "lunge",
    "cardiovascular system": "gait",
}

#: Targets whose movements are single-joint, so the generator opens a session with something
#: else. `isAccessory` is the flag that keeps a session starting with the lift that justifies
#: it rather than with a curl.
ACCESSORY_TARGETS = {
    "biceps", "triceps", "delts", "calves", "forearms", "traps", "levator scapulae",
    "adductors", "abductors", "serratus anterior",
}

#: One arm, one leg, or alternating -- which changes how volume is counted.
UNILATERAL = ["one arm", "single arm", "one leg", "single leg", "alternating", "alternate",
              "unilateral", "suitcase", "pistol", "bulgarian", "one-arm", "single-arm"]


def classify(record):
    """A Forge movement pattern, and which signal decided it."""
    name = record["name"].lower()
    for pattern, keys in BY_NAME:
        if any(says(name, k) for k in keys):
            return pattern, "name"
    target = record.get("target", "").strip().lower()
    if target in BY_TARGET:
        return BY_TARGET[target], "target"
    return None, "none"


def is_unilateral(record):
    lowered = record["name"].lower()
    return any(says(lowered, k) for k in UNILATERAL)


def is_accessory(record):
    return record.get("target", "").strip().lower() in ACCESSORY_TARGETS


def forge_patterns():
    """Slug -> the pattern Forge already authored, which is the right answer."""
    source = io.open(SEED, encoding="utf-8").read()
    return {
        slug: pattern
        for slug, _name, pattern in re.findall(
            r"(?<![A-Za-z])ex\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'", source
        )
    }


def matched_pairs():
    """Forge slug -> catalogue id, for the movements a person has already checked."""
    source = io.open(MAP, encoding="utf-8").read()
    return dict(re.findall(r"'([a-z0-9-]+)': '(\d+)'", source))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    folder = sys.argv[1]
    names = [f for f in os.listdir(folder) if f.endswith(".json")]
    catalogue = {r["id"]: r for r in json.load(io.open(os.path.join(folder, names[0]), encoding="utf-8"))}

    decided = {"name": 0, "target": 0, "none": 0}
    unclassified = []
    for record in catalogue.values():
        pattern, how = classify(record)
        decided[how] += 1
        if pattern is None:
            unclassified.append(record)

    total = len(catalogue)
    covered = total - decided["none"]
    print(f"pattern found for {covered} of {total} ({covered * 100 // total}%)")
    print(f"  from the name    {decided['name']}")
    print(f"  from the target  {decided['target']}")
    print(f"  neither          {decided['none']}")
    for record in unclassified[:10]:
        print(f"    {record['name']:<44} [{record['bodyPart']} / {record['target']}]")

    # The part that matters: measured against movements whose pattern Forge already states.
    authored = forge_patterns()
    agree, disagree = 0, []
    for slug, media_id in matched_pairs().items():
        record = catalogue.get(media_id)
        if not record or slug not in authored:
            continue
        guess, how = classify(record)
        if guess == authored[slug]:
            agree += 1
        else:
            disagree.append((slug, record["name"], authored[slug], guess, how))

    checked = agree + len(disagree)
    print()
    print(f"against the {checked} movements Forge has already classified by hand:")
    print(f"  agrees    {agree} ({agree * 100 // max(checked, 1)}%)")
    print(f"  disagrees {len(disagree)}")
    for slug, name, want, got, how in sorted(disagree):
        print(f"    {slug:<26} Forge says {want:<15} classifier says {got or '-':<15} (by {how})")
        print(f"      {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
