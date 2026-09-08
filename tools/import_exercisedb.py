"""Generate Forge's imported movement library from the ExerciseDB catalogue.

    python tools/import_exercisedb.py "C:/Users/johnc.moore/Downloads/starter/starter"

Writes `src/data/seed/catalogue.ts`: every catalogue entry Forge does not already have,
as a seeded movement. The hand-curated library in `exercises.ts` is left alone -- those 234
entries carry authored progressions, levels and coaching that nothing here can produce, and
overwriting them with derived data would be a downgrade. What the catalogue *does* improve on
them is muscles and description, and those are enriched separately by `enrich_seeded()`.

The awkward part is that Forge's `Exercise` and the catalogue barely overlap. The catalogue
has `bodyPart`, `equipment`, `target`, `secondaryMuscles`, `instructions` and `description`.
Forge needs a movement pattern, a metric list, an equipment tag list, a difficulty, whether it
is unilateral, whether it is accessory work, and how much bodyweight it moves. Only equipment
and muscles cross directly. Everything else is derived here, and every derivation is a
judgement worth reading:

- **pattern** comes from `classify_exercisedb`, which is measured at 98% against the movements
  Forge has already classified by hand.
- **level** is 3 for everything. Forge's levels are authored across the whole library so a
  ladder can be walked; a guess per movement would corrupt that ordering rather than extend
  it. Three means "no opinion", which is true.
- **common** is false for everything, which is not a cop-out but the point: the generator
  ranks staples above the long tail, and the long tail is exactly what this is.
- **progression and substitutes** stay empty. They are relationships between movements, and
  nothing in the catalogue expresses one.
"""

import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SEED = os.path.join(ROOT, "src", "data", "seed", "exercises.ts")
MEDIA_MAP = os.path.join(ROOT, "src", "data", "exerciseMediaMap.ts")
OUT = os.path.join(ROOT, "src", "data", "seed", "catalogue.ts")
ENRICH = os.path.join(ROOT, "src", "data", "seed", "enrichment.ts")

sys.path.insert(0, HERE)
from classify_exercisedb import classify, is_accessory, is_unilateral, says  # noqa: E402

CRLF = chr(13) + chr(10)
NL = chr(10)

#: Catalogue equipment -> the Forge tags a profile must have for the movement to be available.
#:
#: A few are judgements rather than translations. "ez barbell" becomes a plain barbell, because
#: an EZ bar is a barbell and a separate tag would be twenty-two rows in the picker for kit
#: nobody owns instead of a straight bar. "sled machine" is the 45-degree leg press, not a
#: prowler, so it becomes `legPress`. "assisted" is mostly partner-assisted stretching, which
#: needs nothing.
EQUIPMENT = {
    "body weight": ["bodyweight"],
    "barbell": ["barbell", "plates"],
    "olympic barbell": ["barbell", "plates"],
    "ez barbell": ["barbell", "plates"],
    "trap bar": ["trapBar"],
    "dumbbell": ["dumbbell"],
    "kettlebell": ["kettlebell"],
    "cable": ["cableMachine"],
    "leverage machine": ["leverageMachine"],
    "smith machine": ["smithMachine"],
    "sled machine": ["legPress"],
    "band": ["resistanceBand"],
    "resistance band": ["resistanceBand"],
    "medicine ball": ["medicineBall"],
    "stability ball": ["stabilityBall"],
    "bosu ball": ["bosuBall"],
    "roller": ["foamRoller"],
    "wheel roller": ["abWheel"],
    "tire": ["tire"],
    "hammer": ["sledgehammer"],
    "elliptical machine": ["elliptical"],
    "stationary bike": ["bikeErg"],
    "skierg machine": ["skiErg"],
    "stepmill machine": ["stairs"],
    "upper body ergometer": ["leverageMachine"],
    "assisted": ["bodyweight"],
    "assisted (towel)": ["bodyweight"],
    "dumbbell (used as handles for deeper range)": ["dumbbell"],
    "body weight (with resistance band)": ["resistanceBand"],
    "dumbbell, exercise ball": ["dumbbell", "stabilityBall"],
    "dumbbell, exercise ball, tennis ball": ["dumbbell", "stabilityBall"],
    "ez barbell, exercise ball": ["barbell", "plates", "stabilityBall"],
    #: "Weighted" means bodyweight plus something heavy, and Forge has no tag for "anything
    #: heavy". Plates is the commonest answer and the one a gym profile always has; a
    #: kettlebell-only profile loses these forty-three and keeps the unloaded versions.
    "weighted": ["plates"],
}

#: "rope" covers three unrelated things, so it is decided by the name instead.
def rope_tags(name):
    if says(name, "battling rope"):
        return ["battleRopes"]
    if says(name, "jump rope"):
        return ["jumpRope"]
    # The rest are stretches using a strap.
    return ["bodyweight"]


LOADED = {"barbell", "plates", "dumbbell", "kettlebell", "trapBar", "smithMachine",
          "cableMachine", "leverageMachine", "legPress", "medicineBall", "plates", "tire",
          "sledgehammer"}

#: Bodyweight share, by pattern, for movements carrying no external load.
#:
#: Without it every calisthenics set scores zero volume, because volume is weight x reps and a
#: push-up records no weight. These are the same figures the curated library uses for its
#: equivalent movements, applied by pattern because nothing finer is knowable here.
BODYWEIGHT_FACTOR = {
    "pushHorizontal": 0.65, "pushVertical": 0.7, "pullVertical": 1.0, "pullHorizontal": 0.5,
    "squat": 0.9, "hinge": 0.6, "lunge": 0.85, "core": 0.35, "carry": 0.1,
    "fullBody": 0.6, "gait": 0.0,
}

STRETCH = ["stretch", "mobility", "pose", "circles", "release", "roller"]

#: Words that stay lower-case in a title, and ones that are already the way they should be.
SMALL = {"a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to",
         "with", "into", "over", "under"}
KEEP = {"v.", "bosu", "ez", "iso", "vmo", "gvt"}


def titlecase(name):
    """The catalogue writes names in lower case; Forge's library is in title case.

    Worth doing rather than living with, because the two libraries share one picker and a list
    reading "Bench Press / 45 side bend / Bulgarian Split Squat" looks like a bug. The
    "(male)" and "(female)" suffixes go at the same time -- they mark which model was filmed,
    which is a fact about the GIF and not about the movement.
    """
    name = re.sub(r"\s*\((?:male|female)\)", "", name).strip()
    words = name.split()
    out = []
    for i, word in enumerate(words):
        lowered = word.lower()
        if lowered in KEEP:
            out.append(lowered)
        elif i > 0 and lowered in SMALL:
            out.append(lowered)
        else:
            # Only the first letter, so "3/4" and "45°" and "V-Up" survive intact.
            out.append(word[0].upper() + word[1:] if word else word)
        # A hyphenated pair capitalises both halves: "sit-up" -> "Sit-Up".
        out[-1] = re.sub(r"(?<=-)([a-z])", lambda m: m.group(1).upper(), out[-1])
    return " ".join(out)


def equipment_for(record):
    raw = record.get("equipment", "").strip().lower()
    if raw == "rope":
        return rope_tags(record["name"].lower())
    # A couple of entries list two implements; the first is the one that matters.
    return EQUIPMENT.get(raw) or EQUIPMENT.get(raw.split(",")[0].strip()) or None


def modality_for(record, pattern):
    if pattern == "gait":
        return "cardio"
    if any(k in record["name"].lower() for k in STRETCH):
        return "mobility"
    return "strength"


def slugify(name, taken):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]
    if slug not in taken:
        return slug
    n = 2
    while f"{slug}-{n}" in taken:
        n += 1
    return f"{slug}-{n}"


def forge_slugs():
    source = io.open(SEED, encoding="utf-8").read()
    return set(
        re.findall(r"(?<![A-Za-z])(?:ex|cardio|mobility|skill)\(\s*'([^']+)'", source)
    )


def already_mapped_ids():
    """Catalogue ids already standing in for a curated movement, so they are not imported twice."""
    source = io.open(MEDIA_MAP, encoding="utf-8").read()
    return set(re.findall(r"'(\d+)',", source))


def ts(value):
    """A TypeScript literal. Single quotes, so anything containing one is escaped."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return "[" + ", ".join(ts(v) for v in value) + "]"
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def write_enrichment(catalogue):
    """Muscles and descriptions for the movements Forge already had.

    The curated library keeps its own names, equipment, patterns, ladders and coaching -- all
    authored, none of it derivable. What it never had is per-movement muscles: `define.ts`
    infers them from the pattern, so every squat in the app claims quads, glutes, hamstrings
    and core, whether it is a goblet squat or a pistol. The catalogue states them per
    movement, so those two fields plus the description come across.

    A side table rather than 92 edits scattered through a hand-written file: this is generated
    and will be regenerated, and the file it enriches should stay something a person owns.
    """
    by_id = {r["id"]: r for r in catalogue}
    source = io.open(MEDIA_MAP, encoding="utf-8").read()
    pairs = re.findall(r"'([a-z0-9-]+)': '(\d+)'", source)

    rows = []
    for slug, media_id in sorted(pairs):
        record = by_id.get(media_id)
        if not record:
            continue
        rows.append(
            f"  '{slug}': {{ primary: {ts([record['target']])}, "
            f"secondary: {ts(record.get('secondaryMuscles', []))}, "
            f"description: {ts(record.get('description', ''))} }},"
        )

    header = f'''/**
 * Per-movement muscles and descriptions for the curated library.
 *
 * Generated by `tools/import_exercisedb.py`. Do not edit by hand.
 *
 * Forge's curated movements were never given muscles of their own -- `define.ts` derives them
 * from the movement pattern, which means every squat in the library claims the same four and
 * a pistol squat reads identically to a goblet squat. The catalogue states them per movement,
 * so for the {len(rows)} movements that appear in both, its answer wins.
 *
 * Only these two fields and the description. Names, equipment, patterns, progressions and
 * coaching stay as authored -- they carry judgement the catalogue has no way to express.
 */

export interface Enrichment {{
  primary: string[];
  secondary: string[];
  description: string;
}}

export const ENRICHMENT: Record<string, Enrichment> = {{
'''

    io.open(ENRICH, "w", encoding="utf-8", newline=CRLF).write(
        header + NL.join(rows) + NL + "};" + NL
    )


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    folder = sys.argv[1]
    names = [f for f in os.listdir(folder) if f.endswith(".json")]
    catalogue = json.load(io.open(os.path.join(folder, names[0]), encoding="utf-8"))

    curated = forge_slugs()
    mapped = already_mapped_ids()
    taken = set(curated)

    rows, skipped = [], []
    for record in catalogue:
        if record["id"] in mapped:
            continue  # Already a curated movement; enriched in place, not duplicated.

        kit = equipment_for(record)
        if kit is None:
            skipped.append((record["id"], record["name"], record.get("equipment", "")))
            continue

        pattern, _how = classify(record)
        modality = modality_for(record, pattern)
        loaded = any(tag in LOADED for tag in kit)
        slug = slugify(record["name"], taken)
        taken.add(slug)

        rows.append({
            "slug": slug,
            "mediaId": record["id"],
            "name": titlecase(record["name"]),
            "modality": modality,
            "pattern": pattern,
            "equipment": kit,
            "primary": [record["target"]],
            "secondary": record.get("secondaryMuscles", []),
            "unilateral": is_unilateral(record),
            "accessory": is_accessory(record) or modality == "mobility",
            "bodyweightFactor": 0 if loaded else BODYWEIGHT_FACTOR.get(pattern, 0.5),
            "instructions": record.get("instructions", []),
            "description": record.get("description", ""),
        })

    body = []
    for r in rows:
        fields = ", ".join(
            f"{k}: {ts(r[k])}"
            for k in ("slug", "mediaId", "name", "modality", "pattern", "equipment",
                      "primary", "secondary", "unilateral", "accessory", "bodyweightFactor",
                      "instructions", "description")
        )
        body.append("  { " + fields + " },")

    header = f'''/**
 * The imported movement library.
 *
 * Generated by `tools/import_exercisedb.py` from the licensed ExerciseDB catalogue. Do not
 * edit by hand -- change the importer and run it again.
 *
 * These are the {len(rows)} catalogue entries Forge did not already have. The curated library in
 * `exercises.ts` is untouched: those movements carry authored progressions, levels and
 * coaching that nothing derivable could replace.
 *
 * Everything here is `common: false` and `level: 3`. That is not laziness, it is the design:
 * the generator ranks compounds first, then staples, then whatever has been trained least
 * recently -- so these sort below every curated movement in their own pattern and surface
 * when you shuffle or when your equipment rules the staples out, which is when you want them.
 *
 * Progressions and substitutes are empty. They are relationships between movements and the
 * catalogue expresses none, so the swap sheet offers nothing here rather than something wrong.
 */

import type {{ EquipmentTag, MetricKey, Modality, MovementPattern }} from '../../domain/types';

export interface CatalogueEntry {{
  slug: string;
  /** The ExerciseDB id, which is also the picture's filename. */
  mediaId: string;
  name: string;
  modality: Modality;
  pattern: MovementPattern;
  equipment: EquipmentTag[];
  primary: string[];
  secondary: string[];
  unilateral: boolean;
  accessory: boolean;
  bodyweightFactor: number;
  /** Straight from the catalogue. Curated movements use the authored table in `coaching.ts`. */
  instructions: string[];
  description: string;
  metrics?: MetricKey[];
}}

export const CATALOGUE: CatalogueEntry[] = [
'''

    io.open(OUT, "w", encoding="utf-8", newline=CRLF).write(header + CRLF.join(body).replace(CRLF, "\n") + "\n];\n")

    write_enrichment(catalogue)

    print(f"wrote {OUT}")
    print(f"wrote {ENRICH}")
    print(f"  imported   {len(rows)}")
    print(f"  already curated (enriched in place, not duplicated)  {len(mapped)}")
    if skipped:
        print(f"  skipped, no equipment mapping ({len(skipped)}):")
        for _id, name, kit in skipped[:12]:
            print(f"    {name:<44} [{kit}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
