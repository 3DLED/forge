"""Pull the words the app shows people out of the source, for proofreading.

Deliberately crude: it over-collects rather than under-collects, because a human is going to
read the result and a missing line is worse than a spurious one.
"""

import io
import json
import os
import re

ROOT = "src"

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
