# src/lib/nex/refacing/ · NEX Refacing intelligence layer

**Doctrinal authority (read in order):**

1. `docs/refacing/STAGE-1-REMEDIATION-SPEC.md` — what must be fixed (V1–V8)
2. `docs/refacing/PR-12-EXECUTION-SPEC.md` — how image intelligence is structured
3. Auto-memory `project_nex_refacing_architecture_v2_2026_08_12.md` — 18 PRODUCT RULES + 9-verb pipeline

**What this namespace owns:**

- `case-id.ts` — canonical `rf_...` Refacing Case identity (per V1 + Stage 1 · C2, C5)
- `confidence.ts` — Confidence enum + attribute-level markers (per PR-16)
- `provenance.ts` — CompositionProvenance types + PR-18 validator
- `image-schema.ts` — `images_v3[]` entry types (per PR-12 spec §1-2)
- `case-schema.ts` — RefacingCase type (per architecture memory · Refacing Case structure)
- `validators.ts` — universal schema validators enforcing PR-16 + PR-18 at write time
- `retrieval.ts` — Brain query functions for SEE/TRY/CONNECT (per PR-12 spec §5)
- `use-case.ts` — client hook for Case-aware viewers (V5)
- `case-store.ts` — Case persistence (V1/V6)

**Hard constraints:**

- **PR-16:** every field describing an observable attribute MUST carry a `_confidence` sibling. Schema rejects otherwise. Field naming hedges (`likely_species`, `visible_tread_count`) — never certainty-named fields from visual-only evidence.
- **PR-18:** every composed design element in a Refacing Case MUST carry a `composition_provenance[]` entry tracing to a real `image_id` in `images_v3[]`. Cases without provenance are schema-rejected. No open-ended generation ever.
- **PR-13:** this namespace has NO code that generates or displays a homeowner-facing price. Prices come from Members after SURVEY.
- **PR-14:** the output of LOCK is the Refacing Case artefact. Everything here serves that.

Do NOT extend this namespace with new capabilities without cross-referencing the three doctrinal sources above.
