# Author Studio Drafts · Historical Knowledge Library

**Status:** Archive · NOT Reference Brain
**Archived:** 2026-07-30 · per ADR-0042
**Original location:** `.author-studio-drafts/` (repo root · gitignored)
**Governed by:** ADR-0042 · Reference Brain Sole Authoritative Path

---

## What this is

Draft trade knowledge extracted via the Author Studio pipeline between 2026-07-23 and 2026-07-24, before the NEX Reference Brain governance was in place. Content was authored via a batch-extraction process (see `staircase/_extraction/`) and pointed at by the `brains/construction/staircases/brain.json` manifest as `knowledge_paths`.

Total: ~950 KB across:

- `staircase/craft.json` · 674 KB
- `staircase/materials.json` · 155 KB
- `staircase/regulations.json` · 65 KB
- `staircase/defects.json` · 31 KB
- `staircase/workflow.json` · 23 KB
- `staircase/manifest.json` · 844 bytes
- `staircase/pricing_model.json` · 380 bytes
- `staircase/_extraction/*.json` · 11 batch-extraction run records
- `undefined/_extraction/*.json` · 3 batch-extraction records with undefined scope
- `staircase/*.bak.*` · dated write-through backups

## Why archived not deleted

Per ADR-0042 · Historical Knowledge Library treatment: content that was authored before the Sole Authoritative Path was locked is preserved for optionality, not deleted. Individual records MAY be extracted by a named expert and re-authored as Layer 1 evidence via the governed path.

## Rules for this directory

- The Layer 3 runtime MUST NOT import from any file here
- The old `brains/construction/staircases/brain.json` manifest that used to point at these files was deleted alongside this archival (see git history · commit that shipped ADR-0042 sever)
- Contents CAN be reviewed by Philip or a named expert
- Useful records CAN be extracted → Layer 1 evidence at `data/nex-reference-brains/staircase-preparation/evidence/` with a named expert as author (Rule C attributable)
- Contents MUST NOT be edited in place — historical · frozen at archival time

## Provenance caveat

The `undefined/_extraction/` folder contains 3 batch-run files whose scope was not tagged — the run metadata identifies them as extractions but the target brain / topic is missing. Treat with extra caution during any future extraction review; provenance is weaker than the staircase-scoped files.

## Extraction workflow

Same as `knowledge_archive/staircase.json` (see the parent README):

1. Named expert reviews a candidate record
2. New Layer 1 evidence file authored at `data/nex-reference-brains/staircase-preparation/evidence/` — Rule C attribution to the expert
3. The evidence file cites the archived record as prior-authorship history, not as a Rule C source
4. Layer 2 draft authored from the new evidence when the topic is scheduled
5. Review · certification · publication follow the standard path

The archived record is never itself promoted. Only new expert-authored evidence is authoritative.

---

*Historical Knowledge Library · preserved for optionality · never Reference Brain.*
