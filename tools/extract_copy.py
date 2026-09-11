"""Pull the words the app shows people out of the source, for proofreading.

Deliberately crude: it over-collects rather than under-collects, because a human is going to
read the result and a missing line is worse than a spurious one.

Two exceptions to that, both found the hard way.

**Translation calls are matched explicitly.** Internationalisation moved four hundred-odd
strings from bare JSX text into `{t('...')}`, and the loose matchers below stop dead at a
brace. So wrapping a string for Spanish used to delete it from this document, which is exactly
backwards: a wrapped string is one somebody has already worked on. The patterns are lifted
from `copy_check.py` rather than reinvented, because the two tools disagreeing about what
counts as copy is how a string ends up translated but never proofread.

**The licensed catalogue is skipped.** This document is committed, the repo is public, and
`catalogue.ts` alone is two and a half thousand strings of ExerciseDB. That seed data is
gitignored and travels encrypted so that it is not published; extracting it into a document
beside it would quietly undo the whole arrangement.
"""

import io
import json
import os
import re

ROOT = "src"

#: Licensed seed data, which must not end up in a committed document. These are the same four
#: paths `.gitignore` names; a fifth licensed file has to be added in both places.
LICENSED = (
    "src/data/seed/catalogue.ts",
    "src/data/seed/enrichment.ts",
    "src/data/seed/names.es.ts",
    "src/data/seed/prose.es.ts",
)

PROSE_PROPS = re.compile(
    r"\b(blurb|description|message|subtitle|notes?|label|placeholder|title|reason|protocol"
    r"|confirmLabel|name|setup|fault)\s*:\s*(['\"])((?:[^'\"\\]|\\.)*?)\2",
    re.S,
)

JSX_ATTR = re.compile(
    r"\b(placeholder|aria-label|title)=\{?(['\"])((?:[^'\"\\]|\\.)*?)\2\}?",
    re.S,
)

JSX_TEXT = re.compile(r">([^<>{}]{3,})<")

#: `t('...')`, `translate('...', lang)` and the local `say('...')` helpers that wrap it. Every
#: one of these sits inside braces, where `JSX_TEXT` cannot follow.
CALL = re.compile(r"(?<![A-Za-z0-9_.])(?:t|say|translate)\(\s*(['\"])((?:(?!\1).)*)\1\s*[,)]")
#: The singular of a noun the app pluralises for you: `t.count(n, 'session')`.
COUNT = re.compile(r"(?<![A-Za-z0-9_])t\.count\([^,]+,\s*(['\"])((?:(?!\1).)*)\1\s*\)")

#: A whole constant of labels keyed by an internal id, which the screen reaches by lookup:
#: `CATEGORY_LABELS.weights` is "Weights" and no screen ever spells it out. Domain only,
#: because that is where the app keeps the words it reasons about rather than decorates with.
LABEL_MAP = re.compile(r"(?s)_LABELS[^=]*=\s*[^{]*\{(.*?)\n\}")
LABEL_VALUE = re.compile(r":\s*(['\"])([A-Z][^'\"]{1,60})\1")


def strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", src)


def looks_technical(text: str) -> bool:
    if re.fullmatch(r"[a-z0-9\-_.]+", text):
        return True
    # Leftover source: a type annotation, a call, an arrow.
    if re.search(r"=>|\(\)|\w+\(|;\s|::|!:", text):
        return True
    # A JSX conditional the text matcher ran straight through the middle of.
    if re.search(r"&&|\|\||\?\s*\(|\)\s*:|^\)|^\(|\w+\.\w+", text):
        return True
    if text.startswith(("http", "var(", "#", "rgba", "0.", "1.")):
        return True
    if re.fullmatch(r"[\d\s.,:%×–—/-]+", text):
        return True
    return False


def line_of(src: str, index: int) -> int:
    return src.count("\n", 0, index) + 1


def collect() -> list[dict]:
    rows: list[dict] = []
    for base, _dirs, files in os.walk(ROOT):
        for fname in sorted(files):
            if not fname.endswith((".ts", ".tsx")):
                continue
            if ".test." in fname:
                continue
            # Plumbing, not words anyone reads.
            if base.replace("\\", "/").startswith(("src/db", "src/test")):
                continue

            path = os.path.join(base, fname).replace("\\", "/")
            if path in LICENSED:
                continue
            src = strip_comments(io.open(path, encoding="utf-8").read())

            found: list[tuple[int, str, str]] = []

            # Angle brackets in a .ts file are generics, not markup.
            for m in JSX_TEXT.finditer(src) if fname.endswith(".tsx") else []:
                text = " ".join(m.group(1).split())
                if len(text.split()) < 2 or looks_technical(text):
                    continue
                found.append((line_of(src, m.start(1)), text, "on screen"))

            for m in PROSE_PROPS.finditer(src):
                text = " ".join(m.group(3).split())
                if len(text.split()) < 2 or looks_technical(text):
                    continue
                found.append((line_of(src, m.start(3)), text, m.group(1)))

            for m in JSX_ATTR.finditer(src):
                text = " ".join(m.group(3).split())
                if len(text.split()) < 2 or looks_technical(text):
                    continue
                found.append((line_of(src, m.start(3)), text, m.group(1)))

            # Asking for a translation is a declaration that these words are shown to somebody,
            # so these three skip the guesswork the loose matchers need. In particular they
            # skip the two-word rule: "Today", "History" and "Silent" are all real copy, and
            # all three would fail it.
            for m in CALL.finditer(src):
                found.append((line_of(src, m.start(2)), " ".join(m.group(2).split()), "translated"))

            for m in COUNT.finditer(src):
                found.append((line_of(src, m.start(2)), " ".join(m.group(2).split()), "counted"))

            if "/domain/" in path:
                for block in LABEL_MAP.finditer(src):
                    for value in LABEL_VALUE.finditer(block.group(1)):
                        at = block.start(1) + value.start(2)
                        found.append((line_of(src, at), value.group(2), "lookup"))

            seen: set[str] = set()
            for line, text, kind in sorted(found):
                if text in seen:
                    continue
                seen.add(text)
                rows.append({"file": path, "line": line, "kind": kind, "text": text})

    return rows


if __name__ == "__main__":
    rows = collect()
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "app-copy.json")
    io.open(out, "w", encoding="utf-8").write(json.dumps(rows, ensure_ascii=False, indent=1))
    print(json.dumps({"strings": len(rows), "files": len({r["file"] for r in rows})}))
