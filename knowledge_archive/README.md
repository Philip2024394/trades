# Historical Knowledge Library · `knowledge_archive/`

**Status:** Archive · NOT Reference Brain
**Established:** 2026-07-30 · Philip O'Farrell
**Governed by:** ADR-0042 (Reference Brain Sole Authoritative Path)

---

## What this directory is

Historical knowledge artefacts that were authored before the NEX Reference Brain governance was in place, or that never flowed through the Sole Authoritative Path. They are preserved for two reasons:

1. **Record extraction** — some entries may contain trade knowledge worth becoming Layer 1 evidence for future Layer 2 modules
2. **Provenance history** — deleting the artefact would erase the context of where earlier attempts at brain content went

## What this directory is NOT

- ❌ Reference Brain content
- ❌ Layer 1 evidence
- ❌ Anything the Layer 3 runtime is allowed to query
- ❌ A fallback for missing brain modules

Per ADR-0042, the Reference Brain accepts content through exactly one path:

```
Philip / named expert
  → Layer 1 evidence
  → Layer 2 draft
  → review → certification → publication
  → immutable versions in hammerex_nex_brain_versions
  → Layer 3 runtime → NEX answer
```

Nothing in `knowledge_archive/` is on that path.

## Rules for this directory

- The runtime MUST NOT import from any file in `knowledge_archive/`
- If a runtime import is detected during audit, it is a violation of ADR-0042 and must be severed before the offending code ships
- Contents CAN be reviewed by Philip or a named expert
- Useful records CAN be extracted and re-authored as Layer 1 evidence — the extraction is not automatic and must carry a named expert as author
- Contents MUST NOT be edited in place · they are historical · frozen at archival time
- Backups (`*.bak.*`) are preserved as-is

## What lives here

Contents populate when Priority 5 executes (per `project_nex_content_priorities_2026_07_30.md`):

- `staircase.json` — 1,922 FAQ-shaped records · 1.56 MB · authored 2026-07-25 → 2026-07-27
- `staircase.json.bak.*` — 40+ timestamped write-through backups from the authoring window

Until Priority 5 lands, this directory holds only this README as a scope-lock marker.

## Extraction workflow (when the time comes)

If a record in `knowledge_archive/staircase.json` is worth preserving:

1. Philip / named expert reviews the record
2. If accepted, the expert authors a new Layer 1 evidence file at `data/nex-reference-brains/staircase-preparation/evidence/` — subject to Rule C attribution (named expert or verified source)
3. The evidence file cites the archival record as prior authorship history — not as a Rule C source
4. Layer 2 draft is authored from the new evidence when the topic is scheduled
5. Review · certification · publication follow the standard path

The archival record is never itself promoted. Only the new expert-authored evidence file is authoritative.

---

*Historical Knowledge Library · preserved for optionality · never Reference Brain.*
