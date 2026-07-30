# Layer 2 drafts — pre-database authoring canvas

Layer 2 modules ultimately live in the `hammerex_nex_brain_drafts` table (once authored) and `hammerex_nex_brain_versions` table (once published). This directory holds the **pre-database authoring canvas** — one file per module while a named expert writes the trade content.

## Why files, not straight-to-database

Rule B says *"no AI-generated trade content enters a Reference Brain without a named expert's approval."* The database tables are the Reference Brain. Expert authoring must happen OUTSIDE the database until the content is ready.

This directory is where the expert writes. Once every governance check reads PASS and the module is technically reviewed + approved, it gets promoted to `hammerex_nex_brain_drafts` (state: `expert_draft`), and the file here can be archived.

## Rule B split (locked · IMMUTABLE)

- **Claude scaffolds:** front-matter schema · section headings · governance-compliance checks · lifecycle fields · phrasing constraints inherited from the evidence file · answer-shape templates (Principle 0003 four moves · promise structure).
- **Named expert authors:** every sentence of trade content. Every claim. Every recommendation. Every alternative-honestly-named.
- **Rule B verification at sign-off:** author confirms that no AI-generated trade prose remains in the module body before promoting to database.

## Files

- `stopped-wedge-principle.md` — Layer 2 Priority #1 · authored_by slot: Philip O'Farrell · evidence_refs → `evidence/workshop-observations/stopped-wedge-principle.md`
- `top-tread-machining.md` — Layer 2 Priority #2 · authored_by slot: Junior Francis · evidence_refs → `evidence/workshop-observations/top-tread-machining.md` · attribution: documented_workshop_experience (NOT external_expert_citation)

Add new draft files here as evidence files move from `verified` to Layer 2 authoring per Philip's 2026-07-30 authoring sequence (Stopped Wedge → Top Tread → String Housings → Closed Strings → Open Strings → Timber Movement → Stair Repairs → Installation Tolerances). Priorities #3-#8 are queued but blocked pending evidence collection (#3 awaits BWF citation · #4/#5/#8 have no evidence file yet · #6/#7 have partial evidence but need broader-scope files).

## Promotion path

```
Evidence file (verified · reviewed)
  ↓  scaffolded
Layer 2 draft file (this directory)
  ↓  authored by named expert
Same file (lifecycle_state: authored_awaiting_review)
  ↓  technical review by second named expert
Same file (lifecycle_state: approved)
  ↓  promoted to database
hammerex_nex_brain_drafts row (state: expert_draft)
  ↓  published
hammerex_nex_brain_versions row (immutable · version-locked)
```

Every step gated on the previous. No skipping.
