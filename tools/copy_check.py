"""Compare what the source asks to translate against what the catalogue answers.

Two failure modes, and they fail differently:

**A key with no entry** shows English on a Spanish screen. Harmless in isolation and the
reason the English string is the key at all, but a list of them is the phase-two backlog.

**An entry no key asks for** is worse than useless: it is a translation of a sentence that no
longer exists, kept alive because nothing was watching. Changing an English string silently
orphans its Spanish, and this is what notices.

Counts the wrapped and the unwrapped separately, so progress through 500-odd strings is a
number rather than a feeling.

    python tools/copy_check.py            # summary and the first of each list
    python tools/copy_check.py --all      # every missing key, for working through
"""

import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SRC = os.path.join(ROOT, "src")
CATALOGUE = os.path.join(SRC, "i18n", "es.ts")

#: `t('...')`, `translate('...', lang)`, and the local `say('...')` helpers that wrap it.
CALL = re.compile(r"(?<![A-Za-z0-9_.])(?:t|say|translate)\(\s*(['\"])((?:(?!\1).)*)\1\s*[,)]")
COUNT = re.compile(r"(?<![A-Za-z0-9_])t\.count\([^,]+,\s*(['\"])((?:(?!\1).)*)\1\s*\)")

#: Copy that reaches the translator through a constant rather than a literal call:
#: `t(SPLIT_INTERVALS[unit].label)` asks for a string this file never sees spelled out.
#: Those labels live in the domain because they name a thing rather than decorate a
#: screen, so the keys are collected from where they are declared instead.
INDIRECT = re.compile(r"(?m)\blabel:\s*(['\"])([A-Z][^'\"]{2,})\1")

#: A quoted string sitting in a JSX attribute that is shown to somebody.
UNWRAPPED_ATTR = re.compile(r"\b(?:placeholder|aria-label|title)=(['\"])([^'\"]{3,})\1")
#: Bare text between JSX tags, which is the bulk of what is left to do. The lookbehind keeps
#: `) => Promise<void>` out of the count: a type annotation is not copy, and one sitting in the
#: backlog forever would train everybody to ignore the number.
UNWRAPPED_TEXT = re.compile(r"(?<![=-])>\s*([A-Z][A-Za-z',.!? -]{3,})\s*<")


def strip_comments(source: str) -> str:
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", source)


def catalogue_keys() -> set[str]:
    """The keys `es.ts` answers, read as text rather than executed."""
    source = io.open(CATALOGUE, encoding="utf-8").read()
    source = strip_comments(source)
    keys = set()
    # Quoted keys, and the bare-identifier form TypeScript allows for simple words.
    for match in re.finditer(r"(?m)^\s*(?:(['\"])((?:(?!\1).)*)\1|([A-Za-z_][A-Za-z0-9_]*))\s*:", source):
        keys.add(match.group(2) if match.group(2) is not None else match.group(3))
    return keys


def walk():
    for base, _dirs, files in os.walk(SRC):
        for name in sorted(files):
            if not name.endswith((".ts", ".tsx")) or ".test." in name:
                continue
            path = os.path.join(base, name)
            if os.path.normpath(path) == os.path.normpath(CATALOGUE):
                continue
            yield path, strip_comments(io.open(path, encoding="utf-8").read())


def main() -> int:
    show_all = "--all" in sys.argv

    asked: dict[str, str] = {}
    nouns: set[str] = set()
    unwrapped: list[tuple[str, str]] = []

    for path, source in walk():
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        for match in CALL.finditer(source):
            asked.setdefault(match.group(2), rel)
        for match in COUNT.finditer(source):
            nouns.add(match.group(2))
        if "/domain/" in rel:
            for match in INDIRECT.finditer(source):
                asked.setdefault(match.group(2), rel)
        for pattern in (UNWRAPPED_ATTR, UNWRAPPED_TEXT):
            for match in pattern.finditer(source):
                text = (match.group(2) if pattern is UNWRAPPED_ATTR else match.group(1)).strip()
                # Placeholders showing the shape of an answer -- "6.2", "48:30" -- are examples
                # of a number, and a number reads the same in both languages.
                if not re.search(r"[A-Za-z]{2}", text):
                    continue
                unwrapped.append((rel, text))

    known = catalogue_keys()
    # A key carrying context is stored with it; compare on the whole thing.
    missing = sorted(k for k in asked if k not in known)
    orphaned = sorted(known - set(asked) - nouns)

    print(f"wrapped and translated   {len(asked) - len(missing)}")
    print(f"wrapped, no translation  {len(missing)}")
    print(f"not wrapped yet          {len(unwrapped)}")
    print(f"orphaned entries         {len(orphaned)}")

    if missing:
        print()
        print("asked for, not in es.ts:")
        for key in missing if show_all else missing[:12]:
            print(f"  {asked[key]:<44} {key}")
        if not show_all and len(missing) > 12:
            print(f"  ... and {len(missing) - 12} more (--all)")

    if orphaned:
        print()
        print("in es.ts, nothing asks for it:")
        for key in orphaned if show_all else orphaned[:12]:
            print(f"  {key}")
        if not show_all and len(orphaned) > 12:
            print(f"  ... and {len(orphaned) - 12} more (--all)")

    if unwrapped and show_all:
        print()
        print("still English in the source:")
        for rel, text in unwrapped:
            print(f"  {rel:<44} {text}")

    # Orphans are the only thing worth failing on: the others are honest progress.
    return 1 if orphaned else 0


if __name__ == "__main__":
    raise SystemExit(main())
