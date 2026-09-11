"""Convert the purchased ExerciseDB animations into what the app ships.

    python tools/convert_exercise_media.py "C:/Users/johnc.moore/Downloads/starter/starter"

The delivered set is 1,394 animated GIFs at two sizes, 134 MB at 180px and 395 MB at 360px.
Neither is shippable as-is: a Capacitor build has to carry its pictures in the bundle, because
it serves from the device and cannot fetch a missing one later.

Animated WebP is the answer, and the numbers are not close. Measured across a spread of these
files it lands around 30% of the GIF at quality 65 — the whole library for the price of a
third of it. Support is not a concern either: iOS has decoded animated WebP since 14, and the
app requires far newer than that.

Three decisions worth writing down.

**Downscaled from the 360 rather than taken from the 180.** The info sheet renders at 180
points, so the 180px files are being upscaled threefold on any modern phone, which is why they
look soft even when they load. Resampling the larger source down to 270 gives 1.5x on that
display for about 63 MB, where the full 360 would be 104 MB. Upscaling the small one would
have cost the same bytes and fixed nothing.

**Frame timing is carried across explicitly.** Pillow will happily write an animation that
ignores the source delays and plays everything at a flat 100 ms, which turns a slow controlled
rep into a twitch. Durations are read per frame and handed back.

**Only what the app references.** That happens to be all 1,394 — the catalogue's 1,302 media
ids and the curated map's 92 are disjoint and cover the set exactly — but the set is read from
the app rather than the directory, so a future trim narrows the output automatically.
"""

import argparse
import io
import os
import re
import sys
import time
from multiprocessing import Pool

from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
CATALOGUE = os.path.join(ROOT, "src", "data", "seed", "catalogue.ts")
MEDIA_MAP = os.path.join(ROOT, "src", "data", "exerciseMediaMap.ts")
OUT_DIR = os.path.join(ROOT, "public", "exercise-media")

Q = chr(39)


def referenced() -> set[str]:
    """Every media id the app can ask for, from the two places that name one."""
    ids = set()
    if os.path.exists(CATALOGUE):
        source = io.open(CATALOGUE, encoding="utf-8").read()
        ids |= set(re.findall(r"mediaId: " + Q + r"([0-9]+)" + Q, source))
    else:
        print("catalogue.ts is missing - run `npm run seed:unlock` first", file=sys.stderr)
        raise SystemExit(1)
    source = io.open(MEDIA_MAP, encoding="utf-8").read()
    ids |= set(re.findall(r": " + Q + r"([0-9]+)" + Q, source))
    return ids


def convert(job: tuple[str, str, int, int]) -> tuple[str, int, str]:
    src, dst, size, quality = job
    try:
        with Image.open(src) as im:
            frames, durations = [], []
            for frame in ImageSequence.Iterator(im):
                picture = frame.convert("RGBA")
                if picture.size != (size, size):
                    picture = picture.resize((size, size), Image.LANCZOS)
                frames.append(picture)
                # A missing delay means the source did not say; 100 ms is what every decoder
                # falls back to, so matching it keeps the playback identical to the GIF.
                durations.append(frame.info.get("duration", 100))
            buffer = io.BytesIO()
            frames[0].save(
                buffer,
                format="WEBP",
                save_all=True,
                append_images=frames[1:],
                duration=durations,
                loop=0,
                quality=quality,
                method=6,
            )
        data = buffer.getvalue()
        with open(dst, "wb") as out:
            out.write(data)
        return os.path.basename(dst), len(data), ""
    except Exception as error:  # noqa: BLE001 - reported per file rather than killing the run
        return os.path.basename(dst), 0, str(error)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("set_path", help="the unpacked purchased set, holding 180/ and 360/")
    parser.add_argument("--source", default="360", choices=["180", "360"])
    parser.add_argument("--size", type=int, default=270, help="output edge in pixels")
    parser.add_argument("--quality", type=int, default=65)
    parser.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 4) - 1))
    parser.add_argument("--force", action="store_true", help="redo files that already exist")
    args = parser.parse_args()

    source_dir = os.path.join(args.set_path, args.source)
    if not os.path.isdir(source_dir):
        print(f"no {args.source}/ directory under {args.set_path}", file=sys.stderr)
        return 1

    wanted = referenced()
    os.makedirs(OUT_DIR, exist_ok=True)

    jobs, missing, skipped = [], [], 0
    for media_id in sorted(wanted):
        src = os.path.join(source_dir, f"{media_id}.gif")
        if not os.path.exists(src):
            missing.append(media_id)
            continue
        dst = os.path.join(OUT_DIR, f"{media_id}.webp")
        if os.path.exists(dst) and not args.force:
            skipped += 1
            continue
        jobs.append((src, dst, args.size, args.quality))

    print(f"referenced {len(wanted)}, converting {len(jobs)}, already done {skipped}")
    if missing:
        print(f"no source file for {len(missing)}: {', '.join(missing[:8])}")
    if not jobs:
        return 0
    print(f"{args.source}px -> {args.size}px, quality {args.quality}, {args.jobs} workers")

    started = time.time()
    total, failures = 0, []
    with Pool(args.jobs) as pool:
        for done, (name, size, error) in enumerate(pool.imap_unordered(convert, jobs), 1):
            if error:
                failures.append((name, error))
            total += size
            if done % 100 == 0 or done == len(jobs):
                rate = done / max(time.time() - started, 0.001)
                print(f"  {done}/{len(jobs)}  {total / 1048576:.0f} MB  {rate:.1f}/s")

    print()
    print(f"wrote {len(jobs) - len(failures)} files, {total / 1048576:.1f} MB")
    for name, error in failures[:10]:
        print(f"  FAILED {name}: {error}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
