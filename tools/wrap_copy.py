"""Wrap the interface text in `t(...)`, so 375 strings do not have to be edited by hand.

Deliberately timid. It only touches the two shapes it can be certain about:

  <span>Save this workout</span>          ->  <span>{t('Save this workout')}</span>
  placeholder="Kettlebell"                ->  placeholder={t('Kettlebell')}

Anything with a brace, an expression, or a fragment of a ternary in it is left alone and
reported, because those are the ones where a wrong guess produces a file that still compiles
and shows the wrong thing. `copy_check` counts what is left either way, so being skipped here
is visible rather than silent.

It also inserts `const t = useT()` into the components that end up needing one, and the import
at the top. Component detection assumes the two forms this codebase actually uses, both
top-level: `function Name(` and `export default function Name(`. A component it cannot place
the hook in is reported and its file left untouched, rather than half-edited.

    python tools/wrap_copy.py <file> [<file> ...]     # convert
    python tools/wrap_copy.py --dry <file>            # show what it would do
"""

import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")

NL = chr(10)
CRLF = chr(13) + NL
Q = chr(39)
DQ = chr(34)

#: Attributes whose value is read by a person rather than by the browser.
ATTR = re.compile(r"\b(placeholder|aria-label|title)=" + DQ + r"([^" + DQ + r"{}]{2,})" + DQ)

#: A JSX text node with nothing but text in it. The leading capital is what separates a label
#: from a stray fragment of an expression that survived the tag matching.
#:
#: The lookbehind is load-bearing. Without it `) => Promise<void>` reads as a text node called
#: "Promise" sitting between two tags, and the tool rewrites a type annotation into JSX that
#: still looks plausible on the page it is on.
TEXT = re.compile(r"(?<![=-])>(\s*)([A-Z][A-Za-z0-9 ',.!?%/&:()—–…’-]{1,120}?)(\s*)<")

#: The same thing wrapped across several source lines, which is how every explanatory
#: paragraph in this app is written. Collapsed to one line before it becomes a key, so
#: that rewrapping the source later does not orphan the translation.
BLOCK = re.compile(
    r"(?<![=-])>(\s*\n\s*)([A-Z][A-Za-z0-9 ',.!?%/&:()\n\r—–…’-]{40,600}?)(\s*\n\s*)<",
    re.S,
)

#: Text that looks like prose but is not: units, symbols, and anything a person would not read
#: as a sentence.
SKIP = {"OK", "ID", "AM", "PM"}


#: A key can never contain these. If one does, a pattern has escaped its bounds and is
#: rewriting code as prose -- which compiles, renders something plausible, and is only
#: noticed later. Cheap to check, so it is checked on every candidate.
NOT_COPY = re.compile(r"[<>{}]|&&|=>")


def comment_mask(source):
    """Character positions inside a comment, which must never be rewritten."""
    mask = bytearray(len(source))
    for match in re.finditer(r"/\*.*?\*/", source, re.S):
        for i in range(match.start(), match.end()):
            mask[i] = 1
    for match in re.finditer(r"(?m)^[ \t]*//.*$", source):
        for i in range(match.start(), match.end()):
            mask[i] = 1
    return mask


def call(text):
    """`t('...')`, quoted so an apostrophe in the copy does not end the string."""
    if Q in text:
        return "t(" + DQ + text + DQ + ")"
    return "t(" + Q + text + Q + ")"


def body_start(source, at):
    """Index just past the `{` that opens a function body beginning at `at`."""
    depth = 0
    i = source.index("(", at)
    while i < len(source):
        ch = source[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                brace = source.find("{", i)
                return brace + 1 if brace != -1 else None
        i += 1
    return None


def components(source):
    """(name, index just past the opening brace) for each top-level component."""
    found = []
    for match in re.finditer(r"(?m)^(?:export default )?function ([A-Z]\w*)\s*\(", source):
        start = body_start(source, match.start())
        if start is not None:
            found.append((match.group(1), start))
    return found


def owner(components_, position):
    """Which component a position falls in: the last one that starts before it."""
    best = None
    for name, start in components_:
        if start <= position:
            best = (name, start)
    return best


def convert(path, dry=False):
    source = io.open(path, encoding="utf-8", newline="").read()
    flat = source.replace(CRLF, NL)
    mask = comment_mask(flat)
    comps = components(flat)

    edits = []
    strings = []
    needs = set()

    def consider(match, replacement, text):
        if mask[match.start()]:
            return
        if text.strip() in SKIP or not re.search(r"[A-Za-z]{2}", text):
            return
        if NOT_COPY.search(text):
            return
        who = owner(comps, match.start())
        if who is None:
            return
        needs.add(who)
        edits.append((match.start(), match.end(), replacement))
        strings.append(text)

    for match in ATTR.finditer(flat):
        text = match.group(2).strip()
        consider(match, f"{match.group(1)}={{{call(text)}}}", text)

    for match in TEXT.finditer(flat):
        text = match.group(2).strip()
        consider(match, f">{match.group(1)}{{{call(text)}}}{match.group(3)}<", text)

    taken = [(s, e) for s, e, _ in edits]
    for match in BLOCK.finditer(flat):
        if any(s <= match.start() < e for s, e in taken):
            continue
        text = " ".join(match.group(2).split())
        consider(match, f">{match.group(1)}{{{call(text)}}}{match.group(3)}<", text)

    if not edits:
        return [], f"{os.path.basename(path)}: nothing to do"

    # Applied back to front, so earlier offsets stay valid.
    out = flat
    for start, end, replacement in sorted(edits, reverse=True):
        out = out[:start] + replacement + out[end:]

    # The hook, once per component that now uses it, inserted after the opening brace. Done
    # after the edits and back to front for the same reason.
    already = set()
    for name, start in sorted(needs, key=lambda c: -c[1]):
        if name in already:
            continue
        already.add(name)
        shift = sum(len(r) - (e - s) for s, e, r in edits if e <= start)
        at = start + shift
        if re.search(r"const t = useT\(\)", out[at:at + 400]):
            continue
        out = out[:at] + NL + "  const t = useT();" + out[at:]

    if "i18n/useT" not in out:
        depth = os.path.relpath(path, os.path.join(ROOT, "src")).count(os.sep)
        up = "../" * depth if depth else "./"
        imports = list(re.finditer(r"(?m)^import .*?;$", out))
        line = f"import {{ useT }} from '{up}i18n/useT';"
        if imports:
            end = imports[-1].end()
            out = out[:end] + NL + line + out[end:]

    if not dry:
        io.open(path, "w", encoding="utf-8", newline="").write(out.replace(NL, CRLF))

    return strings, f"{os.path.basename(path):<28} {len(strings):>3} wrapped, {len(already)} component(s)"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    if not args:
        print(__doc__)
        return 1

    every = []
    for path in args:
        strings, note = convert(path, dry)
        every.extend(strings)
        print(note)

    if every:
        print()
        print(f"{len(every)} strings, {len(set(every))} distinct:")
        for text in sorted(set(every)):
            print(f"  {text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
