"""What Forge would still be missing pictures for after buying the ExerciseDB set.

Answerable before spending anything, because the sample pack ships `exerciseList.json` — the
complete catalogue of 1,394 names. Only names, no ids and no images, which is enough: the
question is which of Forge's movements appear in that catalogue at all.

Names are the only join and the two sets write them differently. Forge says "Conventional
Deadlift" where the catalogue says "barbell deadlift", and "Bench Press" where it says
"barbell bench press". So matching runs in three passes, from most to least certain, and
everything is reported with the evidence rather than collapsed into a yes or no:

  likely    an exact match on the normalised name, or the Forge name appearing whole inside
            a catalogue name whose extra words this movement's own equipment explains.
            Strong evidence, not a guarantee: names alone cannot tell a Pendlay row from a
            bent-over one, so every one of these still wants a look at the GIF
  check     enough words in common to be worth a look, but a human has to decide
  missing   nothing close enough to be worth showing anyone

The conservative rule is the containment one. "Plank" sits inside "power point plank", which
is not a plank, so a short Forge name is only allowed to absorb one extra word. Being wrong in
this direction costs a picture; being wrong in the other direction shows somebody the wrong
movement, and they have no way to tell.

    python tools/exercise_media_gaps.py <path-to-exerciseList.json>
"""

import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SEED = os.path.join(ROOT, "src", "data", "seed", "exercises.ts")
OUT = os.path.join(ROOT, "docs", "exercise-media-gaps.md")

# The hand-checked pairs live with the importer that consumes them, and are read here so a
# name someone has already resolved never reappears in the report as a gap.
sys.path.insert(0, HERE)
from build_exercise_media import ALIASES  # noqa: E402

#: Words that carry no meaning for matching — the catalogue is full of them.
NOISE = {"v", "vs", "version", "with", "the", "a", "an", "and", "on", "in", "to", "of",
         "male", "female", "pov", "alt", "alternate", "alternating"}

#: Movements that are containers or locomotion, where a demonstration picture is not the point.
#: A picture of "AMRAP Block" is not a thing, and nobody needs to be shown what running is.
NO_PICTURE_NEEDED = {
    "amrap", "emom", "for-time", "easy-run", "long-run", "recovery-run", "tempo-run",
    "interval-run", "race-pace-run", "progression-run", "trail-run", "treadmill-run",
    "hill-repeats", "hill-sprint", "sprint", "walk", "incline-walk", "ruck", "swim",
    "open-water-swim", "stair-climb", "row-erg", "ski-erg", "bike-erg", "rebounder-bounce",
}


def normalise(name):
    name = name.lower()
    name = re.sub(r"\(.*?\)", " ", name)                 # "(male)", "(knees bent)"
    name = re.sub(r"\bv\.?\s*\d+\b", " ", name)          # "v. 2"
    name = name.replace("-", " ").replace("/", " ")
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    words = [w for w in name.split() if w not in NOISE]
    # Fold plurals so "push ups" meets "push up".
    words = [w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w for w in words]
    return words


def forge_exercises():
    """Slug, display name, helper, and the equipment tags — which are what break the ties."""
    source = io.open(SEED, encoding="utf-8").read()
    out = []
    for helper, slug, name, kit in re.findall(
        r"(?<![A-Za-z])(ex)\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*\[([^\]]*)\]", source
    ):
        out.append((slug, name, helper, set(re.findall(r"'([^']+)'", kit))))
    for helper, slug, name, kit in re.findall(
        r"(?<![A-Za-z])(cardio|mobility|skill)\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([^\]]*)\]", source
    ):
        out.append((slug, name, helper, set(re.findall(r"'([^']+)'", kit))))
    return out


#: Forge equipment tags, as the words the catalogue uses for the same thing.
#:
#: The point of this table is tie-breaking. "Bench Press" sits inside "barbell bench press" and
#: inside "band bench press", and picking the wrong one puts a resistance band on a screen that
#: says barbell — the kind of error nobody looking up an unfamiliar movement can catch.
EQUIPMENT_WORDS = {
    "barbell": {"barbell"},
    "plates": {"plate", "barbell"},
    "dumbbell": {"dumbbell"},
    "kettlebell": {"kettlebell"},
    "resistanceBand": {"band", "resistance"},
    "miniBand": {"band", "resistance"},
    "cableMachine": {"cable"},
    "smithMachine": {"smith"},
    "trapBar": {"trap"},
    "medicineBall": {"medicine"},
    "slamBall": {"medicine"},
    "stabilityBall": {"ball", "stability", "exercise"},
    "bench": {"bench"},
    "box": {"box"},
    "sled": {"sled"},
    "weightVest": {"weighted"},
    "rings": {"ring"},
    "suspensionTrainer": {"suspended", "suspension"},
    "jumpRope": {"rope"},
    "landmine": {"landmine"},
}

#: Words that name a *different* movement, not a variation of the same one.
#:
#: A dip and an assisted dip are not the same exercise, and neither are a shoulder press and a
#: one-arm shoulder press. If the catalogue name adds one of these and the Forge name did not
#: ask for it, the match is a candidate rather than an answer.
DIFFERENT_MOVEMENT = {
    "assisted", "one", "single", "kneeling", "seated", "incline", "decline", "reverse",
    "twisting", "close", "wide", "sumo", "deficit", "pause", "jump", "machine", "lever",
    "smith", "suspended", "landmine", "weighted", "cross", "walking", "lying",
    # Named variants that share every other word with the plain movement. An upright row is
    # not a row you do standing up, it is a different exercise.
    #
    # This list is triage, not a solution. Names cannot separate a Pendlay row from a
    # bent-over one, and every word added here fixes one pair and breaks another — so it
    # stops at the unambiguous cases and the output is a review list rather than an answer.
    "upright", "pendlay", "hammer", "preacher", "concentration", "spider", "zercher",
    "drag", "curtsey", "sissy", "hack", "potty", "frankenstein", "pistol", "jefferson",
    "snatch", "clean", "jerk", "behind", "overhead", "sprint", "burpee", "hip",
}


def classify(forge_words, kit, catalogue):
    """Best evidence that this movement is in the catalogue, and how much to trust it."""
    forge_set = set(forge_words)
    if not forge_set:
        return "missing", None, 0.0

    #: The catalogue words this movement's own equipment would justify.
    allowed = set()
    for tag in kit:
        allowed |= EQUIPMENT_WORDS.get(tag, set())

    supersets, best, best_score = [], None, 0.0
    for name, words in catalogue:
        other = set(words)
        if not other:
            continue
        if other == forge_set:
            return "covered", name, 1.0
        if forge_set < other:
            supersets.append((name, other - forge_set))
        score = len(forge_set & other) / len(forge_set | other)
        if score > best_score:
            best, best_score = name, score

    if supersets:
        # Fewest extra words first, then the one whose extras this movement's kit explains.
        def rank(entry):
            extras = entry[1]
            unexplained = len([w for w in extras if w in DIFFERENT_MOVEMENT and w not in allowed])
            contradicted = len([
                w for w in extras
                if any(w in words for words in EQUIPMENT_WORDS.values()) and w not in allowed
            ])
            return (unexplained + contradicted, len(extras))

        supersets.sort(key=rank)
        name, extras = supersets[0]
        penalty = rank((name, extras))[0]
        # A one-word Forge name absorbs one extra word; a longer one absorbs two, because more
        # shared words make the coincidence far less likely.
        room = 1 if len(forge_set) == 1 else 2
        if penalty == 0 and len(extras) <= room:
            return "covered", name, 0.95
        return "check", name, 0.9 if penalty == 0 else 0.7

    if best_score >= 0.5:
        return "check", best, best_score
    return "missing", best, best_score


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    names = json.load(io.open(sys.argv[1], encoding="utf-8"))
    catalogue = [(n, normalise(n)) for n in names]
    forge = forge_exercises()

    known = {n.lower() for n in names}
    buckets = {"covered": [], "check": [], "missing": []}
    for slug, name, helper, kit in forge:
        # An alias someone has already checked outranks anything guessed from the name.
        alias = ALIASES.get(slug)
        if alias and alias.lower() in known:
            buckets["covered"].append((slug, name, helper, alias, 1.0))
            continue
        verdict, best, score = classify(normalise(name), kit, catalogue)
        buckets[verdict].append((slug, name, helper, best, score))

    total = len(forge)
    lines = [
        "# Movements Forge would still have no picture for",
        "",
        f"Forge's seeded library is **{total} movements**. The ExerciseDB catalogue is "
        f"**{len(names)} names**. Matching is on name alone, which is all the sample pack "
        "supports, so the middle bucket needs a person.",
        "",
        f"- **{len(buckets['covered'])} covered** — an exact name, or the Forge name inside a "
        "catalogue name with an equipment word added",
        f"- **{len(buckets['check'])} worth checking** — enough in common to be plausible, not "
        "enough to trust",
        f"- **{len(buckets['missing'])} missing** — nothing close",
        "",
        "Generated by `tools/exercise_media_gaps.py`.",
        "",
    ]

    kinds = {"ex": "strength", "cardio": "cardio", "mobility": "mobility", "skill": "skill"}

    lines += ["## Missing", "", "| Movement | Kind | Closest name in the catalogue |", "|---|---|---|"]
    need, skip = [], []
    for slug, name, helper, best, score in sorted(buckets["missing"], key=lambda r: r[1]):
        (skip if slug in NO_PICTURE_NEEDED else need).append((slug, name, helper, best, score))
    for slug, name, helper, best, score in need:
        closest = f"{best} ({score:.2f})" if best and score > 0 else "—"
        lines.append(f"| {name} | {kinds.get(helper, helper)} | {closest} |")

    lines += [
        "",
        f"### Of those, {len(skip)} do not want a demonstration picture anyway",
        "",
        "Containers and locomotion. A picture of an AMRAP block is not a thing, and nobody "
        "needs to be shown what running is.",
        "",
        ", ".join(sorted(n for _, n, _, _, _ in skip)),
        "",
        f"### Which leaves **{len(need)}** that genuinely need drawing",
        "",
        "## Worth checking",
        "",
        "Plausible but unconfirmed. Open the GIF before adding any of these to the alias table "
        "in `tools/build_exercise_media.py`.",
        "",
        "| Movement | Best candidate | Score |",
        "|---|---|---|",
    ]
    for slug, name, helper, best, score in sorted(buckets["check"], key=lambda r: -r[4]):
        lines.append(f"| {name} | {best} | {score:.2f} |")

    lines += ["", "## Covered", "", "| Movement | Catalogue name |", "|---|---|"]
    for slug, name, helper, best, score in sorted(buckets["covered"], key=lambda r: r[1]):
        lines.append(f"| {name} | {best} |")
    lines.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\r\n").write("\n".join(lines))

    print(f"wrote {OUT}")
    print(f"  covered        {len(buckets['covered']):>3}")
    print(f"  worth checking {len(buckets['check']):>3}")
    print(f"  missing        {len(buckets['missing']):>3}  "
          f"({len(need)} that need drawing, {len(skip)} that do not want a picture)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
