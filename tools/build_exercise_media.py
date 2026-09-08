"""Turn the purchased ExerciseDB set into the map Forge reads.

    python tools/build_exercise_media.py <path-to-starter-folder> [--copy]

The delivered set is one combined `exerciseData_*.json` plus `180/` and `360/` folders of
`<id>.gif`. Forge is keyed by slug, so this joins the two and writes
`src/data/exerciseMediaMap.ts`.

Names are the join, and the two vocabularies do not line up: Forge says "Conventional
Deadlift" where the catalogue says "barbell deadlift". Three passes, most certain first:

1. an alias somebody has checked by eye
2. an exact match on the normalised name
3. the Forge name appearing whole inside a catalogue name -- "bench press" inside "barbell
   bench press" -- where the equipment agrees

That last check is what the delivered data buys us over the sample. Every entry carries an
`equipment` field, so "Bench Press" can be held against *barbell* bench press and not against
the band one. Guessing from the words in the name, which is all the sample supported, put a
resistance band on a screen that said barbell.

Nothing is guessed beyond that. A wrong picture is worse than no picture -- somebody looking
up a movement they do not know has no way to tell they are being shown the wrong one -- so
anything ambiguous is left out and listed for review.

`--copy` also copies the matched 180px GIFs into `public/exercise-media/`, which the app
serves. Only the matched ones: the full set is 530 MB and Forge has uses for a fraction of it.
That folder is gitignored and must stay that way -- see the note in `data/exerciseMedia.ts`.
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
REVIEW = os.path.join(ROOT, "docs", "exercise-media-review.md")
MEDIA = os.path.join(ROOT, "public", "exercise-media")

#: Which size ships. The info sheet draws at 180 CSS pixels; 360 costs about three times the
#: bytes, which is not worth it for a reference picture.
SIZE = "180"

#: Forge slug -> the catalogue's name for the same movement.
#:
#: Only pairs somebody has looked at. Extend this from the review list the script writes.
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
    "good-morning": "barbell good morning",
    "glute-bridge": "barbell glute bridge",
    "forward-lunge": "barbell lunge",
    "arnold-press": "dumbbell arnold press",
    "ab-wheel": "wheel rollout",
    # No alias for the carries. The catalogue's only two-handed carry is "farmers walk", and
    # Forge has no farmer's carry to hang it on -- it has a *suitcase* carry, which is
    # one-sided, and whose entire coaching point is resisting the lean that the second bell
    # removes. Checked the GIF: two dumbbells. Wrong movement, so no picture.
    "hanging-leg-raise": "hanging leg raise",
    "battle-ropes": "battling ropes",
    # No alias for double-unders: the catalogue has only a plain jump rope, and a picture of
    # someone skipping says nothing about the two rope passes that make it a double-under.
    "slam-ball": "medicine ball overhead slam",
    "freestanding-handstand-push-up": "handstand push-up",
    # Same movement, different vocabulary: the catalogue says "lever" for machines.
    "machine-row": "lever seated row",
    # Resolved from the ambiguous list. The catalogue carries several near-variants of each of
    # these and picking one is a judgement, not a match, so they live here where the judgement
    # is visible rather than buried in a scoring function.
    "calf-stretch": "standing calves calf stretch",
    "dip": "chest dip",
    "db-incline-press": "dumbbell incline bench press",
    "db-row": "dumbbell bent over row",
    "db-shoulder-press": "dumbbell seated shoulder press",
    "kb-clean": "kettlebell hang clean",
    "kb-single-arm-floor-press": "kettlebell one arm floor press",
    "kb-row": "kettlebell one arm row",
    "kb-snatch": "kettlebell one arm snatch",
    "leg-curl": "lever lying leg curl",
    "leg-press": "sled 45° leg press",
    "pallof-press": "band horizontal pallof press",
    "seated-cable-row": "cable low seated row",
    "cable-fly": "cable low fly",
    "band-curl": "band alternating biceps curl",
}

#: The catalogue's equipment vocabulary, as the Forge tags that would satisfy it.
#:
#: Used to *reject* a name match rather than to make one. An entry whose equipment contradicts
#: what the Forge movement needs is a different exercise wearing a similar name. Anything not
#: listed here -- "body weight", "weighted", "assisted" -- says nothing useful either way.
EQUIPMENT_TAGS = {
    "barbell": {"barbell"},
    "olympic barbell": {"barbell"},
    "ez barbell": {"barbell"},
    "trap bar": {"trapBar"},
    "dumbbell": {"dumbbell"},
    "kettlebell": {"kettlebell"},
    "cable": {"cableMachine", "latPulldown", "rowMachine"},
    "smith machine": {"smithMachine"},
    "band": {"resistanceBand", "miniBand"},
    "resistance band": {"resistanceBand", "miniBand"},
    "medicine ball": {"medicineBall", "slamBall", "wallBall"},
    "stability ball": {"stabilityBall"},
    "sled machine": {"sled", "legPress"},
    "wheel roller": {"abWheel"},
    "roller": {"foamRoller"},
}


def normalise(name):
    """Fold the two naming styles together: case, punctuation, parentheticals, plurals."""
    name = name.lower()
    name = re.sub(r"\(.*?\)", " ", name)
    name = re.sub(r"\bv\.?\s*\d+\b", " ", name)
    name = name.replace("-", " ").replace("/", " ")
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    # "v" is not noise. The `v. 2` regex above already removed version markers, and dropping a
    # bare "v" turns "V-Up" into "up", which then matched every pull-up in the catalogue.
    words = [w for w in name.split() if w not in {"male", "female", "version"}]
    words = [w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w for w in words]
    return " ".join(words)


def forge_exercises():
    """Slug, display name, and equipment tags for every seeded movement."""
    source = io.open(SEED, encoding="utf-8").read()
    out = {}
    for slug, name, kit in re.findall(
        r"(?<![A-Za-z])ex\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*\[([^\]]*)\]", source
    ):
        out[slug] = (name, set(re.findall(r"'([^']+)'", kit)))
    for _helper, slug, name, kit in re.findall(
        r"(?<![A-Za-z])(cardio|mobility|skill)\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([^\]]*)\]",
        source,
    ):
        out[slug] = (name, set(re.findall(r"'([^']+)'", kit)))
    return out


def load_catalogue(folder):
    """The delivered JSON, whatever it is called this release."""
    names = [f for f in os.listdir(folder) if f.endswith(".json")]
    if not names:
        raise SystemExit(f"No exercise JSON found in {folder}")
    return json.load(io.open(os.path.join(folder, names[0]), encoding="utf-8"))


def equipment_agrees(record, kit):
    """Whether the catalogue entry's equipment is something this Forge movement uses."""
    wanted = EQUIPMENT_TAGS.get(record.get("equipment", "").strip().lower())
    if wanted is None:
        return True
    return bool(wanted & kit)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    folder = sys.argv[1]
    copy = "--copy" in sys.argv

    forge = forge_exercises()
    catalogue = load_catalogue(folder)

    by_name = {}
    for record in catalogue:
        by_name.setdefault(normalise(record["name"]), record)

    #: An alias whose slug is not in the seed never matches and never shows up as a gap
    #: either. Cheap to check, and it has already caught three.
    unknown_slugs = sorted(slug for slug in ALIASES if slug not in forge)

    matched, unmatched, alias_misses, ambiguous = {}, [], [], []

    for slug, (name, kit) in sorted(forge.items()):
        alias = ALIASES.get(slug)
        if alias:
            hit = by_name.get(normalise(alias))
            if hit:
                matched[slug] = (hit, "alias")
            else:
                alias_misses.append((slug, alias))
            continue

        hit = by_name.get(normalise(name))
        if hit:
            matched[slug] = (hit, "exact name")
            continue

        # The Forge name inside a catalogue name, where the equipment does not contradict it.
        words = set(normalise(name).split())
        candidates = [
            record
            for record in catalogue
            if words
            and words < set(normalise(record["name"]).split())
            and len(set(normalise(record["name"]).split()) - words) <= 2
        ]

        agreeing = [r for r in candidates if equipment_agrees(r, kit)]
        if len(agreeing) == 1:
            matched[slug] = (agreeing[0], "name + equipment")
        elif agreeing:
            # More than one fits. Picking arbitrarily is how a band bench press ends up on a
            # screen that says barbell, so this goes to a person instead.
            ambiguous.append((slug, name, [r["name"] for r in agreeing][:5]))
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
    for slug, (record, _how) in sorted(matched.items()):
        lines.append(f"  '{slug}': '{record['id']}', // {record['name']}")
    lines.append("};")
    lines.append("")
    io.open(OUT, "w", encoding="utf-8", newline="\r\n").write("\n".join(lines))

    review = [
        "# Movement pictures, for review",
        "",
        f"**{len(matched)} of {len(forge)}** Forge movements have a picture. Names cannot be "
        "trusted on their own, so open each one before it ships — a wrong picture is worse "
        "than none, because nobody looking up an unfamiliar movement can tell.",
        "",
        "Generated by `tools/build_exercise_media.py`.",
        "",
        "## Matched",
        "",
        "| Forge movement | Catalogue entry | Equipment | Matched by |",
        "|---|---|---|---|",
    ]
    for slug, (record, how) in sorted(matched.items(), key=lambda kv: forge[kv[0]][0]):
        review.append(
            f"| {forge[slug][0]} | {record['name']} | {record.get('equipment', '')} | {how} |"
        )

    if ambiguous:
        review += [
            "",
            "## Ambiguous — several entries fit",
            "",
            "Pick one and add it to `ALIASES`, or leave the movement without a picture.",
            "",
            "| Forge movement | Candidates |",
            "|---|---|",
        ]
        for _slug, name, options in sorted(ambiguous, key=lambda r: r[1]):
            review.append(f"| {name} | {', '.join(options)} |")

    review += ["", "## No picture", "", "| Forge movement |", "|---|"]
    for _slug, name in sorted(unmatched, key=lambda r: r[1]):
        review.append(f"| {name} |")
    review.append("")

    os.makedirs(os.path.dirname(REVIEW), exist_ok=True)
    io.open(REVIEW, "w", encoding="utf-8", newline="\r\n").write("\n".join(review))

    if copy:
        os.makedirs(MEDIA, exist_ok=True)
        for existing in os.listdir(MEDIA):
            os.remove(os.path.join(MEDIA, existing))
        copied = 0
        for record, _how in matched.values():
            source = os.path.join(folder, SIZE, f"{record['id']}.gif")
            if os.path.exists(source):
                shutil.copy2(source, os.path.join(MEDIA, f"{record['id']}.gif"))
                copied += 1
        total = sum(os.path.getsize(os.path.join(MEDIA, f)) for f in os.listdir(MEDIA))
        print(f"copied {copied} GIFs into public/exercise-media/ ({total / 1_048_576:.1f} MB)")

    print(f"wrote {OUT}")
    print(f"wrote {REVIEW}")
    print(f"matched {len(matched)} of {len(forge)} Forge movements")
    if unknown_slugs:
        print()
        print(f"ALIASES naming slugs that are not in the seed ({len(unknown_slugs)}):")
        for slug in unknown_slugs:
            print(f"  {slug}")
    if alias_misses:
        print()
        print(f"ALIASES pointing at names not in the catalogue ({len(alias_misses)}):")
        for slug, target in alias_misses:
            print(f"  {slug} -> {target}")
    print()
    print(f"ambiguous, needs a person ({len(ambiguous)})")
    print(f"no picture ({len(unmatched)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
