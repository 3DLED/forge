"""Collect every sentence the app shows about a movement, and track what is translated.

The movement names were a grammar, so a program could do them. This is not: instructions and
descriptions are real prose, and a rule-based attempt would produce exactly the failure mode
the name translator was rewritten to avoid -- plausible Spanish that says the wrong thing,
noticed by nobody. So these are translated by hand, and what this file does is make that
tractable: it says what is left, in what order, and keeps the finished work.

The store IS the generated module. `src/data/seed/prose.es.ts` is read back in, merged with
whatever is new, and written out again, so a run adds to it rather than starting over and the
work survives being done a few hundred strings at a time.

Ordering matters more than it looks. A half-translated movement shows a Spanish setup and
English cues, which reads as a bug; a fully translated one beside an English one reads as
progress. So coverage is counted by movement, and whole movements are handed out to work on.

    python tools/prose.py                       # what is done, what is next
    python tools/prose.py --next 40             # the next 40 movements' strings, to translate
    python tools/prose.py --add pairs.json      # merge {english: spanish} into the store
"""

import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SEED = os.path.join(ROOT, "src", "data", "seed")
STORE = os.path.join(SEED, "prose.es.ts")

Q = chr(39)
NL = chr(10)
CRLF = chr(13) + NL


def quoted(block):
    """Every single-quoted string in a block of TypeScript source."""
    return re.findall(Q + r"([^" + Q + r"]*)" + Q, block)


def curated():
    """slug -> the sentences Forge itself wrote about a movement.

    Coaching is the app's own text: a setup, two or three cues, and the fault that most often
    spoils the lift. It is the highest-value prose in the app, because it belongs to the 234
    movements the session generator actually picks from.
    """
    out = {}
    source = io.open(os.path.join(SEED, "coaching.ts"), encoding="utf-8").read()
    body = source[source.index("const RAW"):]
    for slug, block in re.findall(r"(?m)^  '([a-z0-9-]+)': \[\s*\n((?:.*?\n)*?)  \],", body):
        strings = []
        for value in quoted(block):
            # Cues are pipe-separated in the source to keep the table readable.
            strings += [piece.strip() for piece in value.split("|") if piece.strip()]
        out[slug] = strings

    source = io.open(os.path.join(SEED, "exercises.ts"), encoding="utf-8").read()
    for slug, note in re.findall(r"'([a-z0-9-]+)'.*?notes: " + Q + r"([^" + Q + r"]*)" + Q, source):
        out.setdefault(slug, []).append(note)

    path = os.path.join(SEED, "enrichment.ts")
    if os.path.exists(path):
        source = io.open(path, encoding="utf-8").read()
        for slug, text in re.findall(r"'([a-z0-9-]+)': \{[^}]*?description: " + Q + r"([^" + Q + r"]*)" + Q, source, re.S):
            out.setdefault(slug, []).append(text)
    return out


def imported():
    """slug -> the catalogue's own instructions and description."""
    path = os.path.join(SEED, "catalogue.ts")
    if not os.path.exists(path):
        return {}
    source = io.open(path, encoding="utf-8").read()
    out = {}
    for record in source.split("{ slug: ")[1:]:
        slug = quoted(record)[0]
        strings = []
        steps = re.search(r"instructions: \[(.*?)\],\s*description:", record, re.S)
        if steps:
            # "Repeat for the desired number of repetitions" is dropped before display, so
            # translating it would be work nobody sees.
            strings += [s for s in quoted(steps.group(1)) if not re.match(r"repeat (for|the)", s, re.I)]
        description = re.search(r"description: " + Q + r"([^" + Q + r"]*)" + Q, record)
        if description and description.group(1):
            strings.append(description.group(1))
        out[slug] = strings
    return out


def store():
    """What has been translated so far, read back out of the module it generates."""
    if not os.path.exists(STORE):
        return {}
    source = io.open(STORE, encoding="utf-8").read()
    pairs = {}
    for match in re.finditer(r"(?m)^  (['\"])((?:(?!\1).)*)\1:\s*(['\"])((?:(?!\3).)*)\3,$", source):
        pairs[match.group(2)] = match.group(4)
    return pairs


def write_store(pairs):
    def literal(text):
        return (chr(34) + text + chr(34)) if Q in text else (Q + text + Q)

    lines = [
        "/**",
        " * Movement instructions and descriptions in Spanish, keyed on the English they replace.",
        " *",
        " * Maintained by `tools/prose.py`, which reads this file back in before writing it out, so",
        " * the work can be done a few hundred strings at a time without losing what is finished.",
        " *",
        " * Translated by hand rather than by rule. Movement *names* are a grammar and a program can",
        " * do them; these are sentences, and a rule-based attempt would produce fluent Spanish that",
        " * says the wrong thing about how to hold a barbell.",
        " *",
        " * Ignored by git and committed encrypted: most of it is derived from the licensed",
        " * catalogue, and the rest travels with it.",
        " */",
        "",
        "export const PROSE_ES: Record<string, string> = {",
    ]
    for english in sorted(pairs):
        lines.append(f"  {literal(english)}: {literal(pairs[english])},")
    lines.append("};")
    io.open(STORE, "w", encoding="utf-8", newline="").write(CRLF.join(lines) + CRLF)


def main():
    done = store()
    groups = [("curated", curated()), ("imported", imported())]

    pending = []
    print(f"{'':<10} {'movements':>10} {'done':>7} {'strings':>9} {'left':>8}")
    for label, movements in groups:
        whole = 0
        strings = set()
        left = set()
        for slug, texts in movements.items():
            if not texts:
                continue
            strings.update(texts)
            missing = [t for t in texts if t not in done]
            if missing:
                left.update(missing)
                pending.append((label, slug, missing))
            else:
                whole += 1
        total = len([s for s, t in movements.items() if t])
        print(f"{label:<10} {total:>10} {whole:>7} {len(strings):>9} {len(left):>8}")

    words = sum(len(t.split()) for _l, _s, texts in pending for t in texts)
    print()
    print(f"{len(pending)} movements not finished, about {words:,} words left")

    if "--next" in sys.argv:
        count = int(sys.argv[sys.argv.index("--next") + 1])
        # Curated first: it is the app's own writing, and it is what the generator picks from.
        batch = pending[:count]
        seen = set()
        out = []
        for _label, _slug, texts in batch:
            for text in texts:
                if text not in seen:
                    seen.add(text)
                    out.append(text)
        print()
        print(json.dumps(out, ensure_ascii=False, indent=1))

    if "--add" in sys.argv:
        path = sys.argv[sys.argv.index("--add") + 1]
        added = json.load(io.open(path, encoding="utf-8"))
        before = len(done)
        done.update({k: v for k, v in added.items() if v})
        write_store(done)
        print()
        print(f"merged {len(done) - before} new, {len(done)} in the store")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
