# Tools

## Proofreading the app's copy

Two scripts, run in order from the repo root:

```
python tools/extract_copy.py     # source  -> docs/app-copy.json
python tools/build_copy_doc.py   # json    -> docs/app-copy.md + docs/app-copy-index.json
```

`app-copy.md` is the document to read and edit. Every line carries a stable id — `[MORE-093]` —
which is how an edited copy is matched back to its source. Ids are assigned in reading order
within a section, so adding copy to a screen renumbers the ones after it; regenerate and
re-send rather than editing an old copy against new code.

`app-copy-index.json` maps each id to its file, line and original text. That original is what
makes the round trip work: an edited line is applied by finding its exact original in the
source and replacing it, so line numbers moving in between does not matter.

The extraction is deliberately over-inclusive. It is easier for a human to skim past a column
heading than to notice a missing paragraph, so it collects button labels and placeholders too.
