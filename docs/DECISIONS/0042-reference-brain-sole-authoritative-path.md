# ADR-0042 · Reference Brain Sole Authoritative Path

**Status:** Accepted · Immutable
**Date:** 2026-07-30
**Author:** Philip O'Farrell
**Type:** Governance boundary (closes the "parallel sources of truth" failure mode)
**Extends:** ADR-0038 (Three-Layer Architecture) · ADR-0040 (Prime Sentence) · ADR-0041 (Author-Driven Rule)
**Alongside:** Rules A · B · C (Anti-Fabrication · No AI-Authored · Attributable Origin)

---

## The rule (HARD LAW)

> **The NEX Reference Brain accepts content through exactly ONE path. Nothing else is authoritative.**

```
Philip / named expert
  ↓
Layer 1 evidence          (data/nex-reference-brains/staircase-preparation/evidence/)
  ↓
Layer 2 draft             (data/nex-reference-brains/staircase-preparation/layer-2-drafts/)
  ↓
review
  ↓
certification
  ↓
publication               (hammerex_nex_brain_versions.modules_json)
  ↓
immutable versions        (BEFORE DELETE trigger enforces immutability)
  ↓
Layer 3 runtime           (src/lib/nex/brains/*.ts composes at query time)
  ↓
NEX answer
```

No parallel path. No shortcut. No "temporarily use this JSON until we migrate." No "fall back to the old brain." If content did not flow through this chain, it is not Reference Brain content and the runtime must not read from it.

---

## Why this ADR exists

The 2026-07-30 Brain Area audit surfaced three parallel staircase knowledge bases:

1. **`data/nex-reference-brains/staircase-preparation/`** — governed · Rule B compliant · authoritative-in-progress
2. **`knowledge/staircase.json`** — 1,922 FAQ records · unknown provenance · not Rule B compliant
3. **`brains/*/brain.json`** — 16 pre-governance stubs · dormant since 2026-07-24

Philip's verbatim finding:

> *"The biggest risk isn't missing knowledge. It's having three sources of truth."*

Three parallel brains means three answers to the same question, three provenance chains, three levels of trust. The Prime Sentence (*"most trusted professional reference"*) requires exactly one authoritative brain per topic. This ADR closes the door before Layer 2 authoring scales.

---

## What IS Reference Brain content

Only content that has passed through the full chain above. This means:

- **Rule B compliant** — expert-authored · never AI-generated (AI may organise, dedupe, find contradictions, adversarial-question · AI never authors)
- **Rule C attributable** — every fact carries a named source or expert
- **Rule A honoured** — silence over guessing; empty is safe, fabricated is dangerous
- **Reviewed + certified** before publication
- **Stored in immutable versioned records** (`hammerex_nex_brain_versions`)

---

## What is NOT Reference Brain content

Everything else, no matter how well-organised or trade-relevant:

- ❌ `knowledge/staircase.json` (1,922 FAQ records · reclassified as Historical Knowledge Library · see §Reclassification)
- ❌ `brains/*/brain.json` (16 pre-governance stubs · scheduled for deletion after runtime-import check)
- ❌ `data/nex-staircase-components/` (Component Library · Application Module data)
- ❌ `data/nex-staircase-assemblies/` (Assembly Library · Application Module data)
- ❌ `data/nex-staircase-geometry/` (Geometry Library · Application Module data)
- ❌ `data/nex-staircase-materials/` (Material Library · Application Module data)
- ❌ Temporary drafts, scratch notes, research artefacts
- ❌ Historical archives (see next section)

Application Module data (Components / Geometry / Assemblies / Materials) is not a violation — it belongs in the Application Module scope per ADR-0038 (Three-Layer Architecture). It just isn't Reference Brain content and must not be conflated with it.

---

## Reclassification of `knowledge/staircase.json`

Philip 2026-07-30 verbatim:

> *"I wouldn't delete it. I would reclassify it."*

**New status:** Historical Knowledge Library.
**New location:** `knowledge_archive/staircase.json` (moved · never deleted).
**New rules:**

- NEVER queried by the Layer 3 runtime
- CAN be reviewed by Philip or a named expert
- Useful records MAY be extracted → become Layer 1 evidence → flow through the authoritative path
- Removed from any runtime import path
- File header must state: *"Historical Knowledge Library · not Reference Brain · never queried by runtime · records here MAY be promoted to Layer 1 evidence after expert review"*

**Why archived not deleted:** 1,922 records represent real prior work. Some records may contain useful content that becomes evidence for future Layer 2 modules. Deletion loses optionality; archival preserves it while enforcing the boundary.

The `knowledge_archive/README.md` documents these rules at the file level.

---

## Rejection examples

Every future proposal that would create a parallel knowledge path is rejected. Examples:

| Proposal | Verdict | Reason |
|---|---|---|
| *"Let's use staircase.json as a fallback until Layer 2 is populated"* | ❌ REJECT | Bypasses Rule B/C · creates parallel truth |
| *"Let's have the composer read from both sources and merge"* | ❌ REJECT | Two sources of truth in one answer · trust chain lost |
| *"Let's copy the FAQ records into `hammerex_nex_brain_versions` without expert review"* | ❌ REJECT | Skips review + certification · violates Rule B |
| *"Let's create a lightweight brain shape for quick prototyping"* | ❌ REJECT | Prototype becomes production; second source appears |
| *"Let's leave `brains/*/brain.json` as fallback in case the new brain fails"* | ❌ REJECT | Fallback IS a parallel truth path |

Every proposal that PREVENTS a parallel knowledge path is accepted:

| Proposal | Verdict |
|---|---|
| *"Move `knowledge/staircase.json` → `knowledge_archive/`"* | ✅ ACCEPT |
| *"Delete `brains/*/brain.json` stubs after runtime-import check"* | ✅ ACCEPT |
| *"Add a runtime guard that fails loudly if any code tries to import from `knowledge_archive/`"* | ✅ ACCEPT |
| *"Extract useful records from staircase.json → author as Layer 2 draft with named source"* | ✅ ACCEPT (goes through the path) |

---

## The three-question ship gate for any "Reference Brain content" claim

Every artefact that claims to be Reference Brain content must pass:

1. **Path check** — Did this content flow through Layer 1 → Layer 2 → review → certification → publication?
2. **Provenance check** — Can we name the expert or source that authored it? (Rule C)
3. **Governance check** — Is it stored in `hammerex_nex_brain_versions` under immutability?

If any of the three fail, the content is NOT Reference Brain. It may still be valuable (evidence · prep · draft · historical) but it must not be queried by the Layer 3 runtime as authoritative.

---

## What the runtime must do

- Layer 3 modules under `src/lib/nex/brains/` may only load from `hammerex_nex_brain_versions` (and its caches / preloaders).
- Any code that imports from `knowledge/staircase.json`, `knowledge_archive/`, or `brains/*/brain.json` is a violation of this ADR and must be severed.
- A runtime guard SHOULD reject imports from these paths at build time (recommended · not blocking on ship of this ADR).

The Priority 1 scan that ships alongside this ADR reports which files (if any) currently import from these paths. That report becomes the deletion / severing punch list for Priorities 2 and 5.

---

## Composition with adjacent ADRs

- **ADR-0038 (Three-Layer Architecture)** — defines what a Reference Brain IS (Layer 1 + Layer 2 + Layer 3 composition). This ADR defines HOW content enters it.
- **ADR-0040 (Prime Sentence)** — *"most trusted professional reference"* requires one authoritative path. This ADR enforces it.
- **ADR-0041 (Author-Driven Rule)** — platform grows only when authoring surfaces a limitation. This ADR is the exact kind of governance the Author-Driven Rule produces: the audit surfaced a gap, and this ADR closes it.
- **Rules A · B · C** — the trust rules for individual facts. This ADR is the trust rule for the whole pipeline.

All four compose. Every Reference Brain artefact passes all four or does not ship.

---

## The immutable line

Locked as **HARD LAW · IMMUTABLE** by Philip O'Farrell · 2026-07-30.

No future ADR overrides this. Amendments require a new ADR that explicitly cites and supersedes this one, with the same immutable line.

*"One authoritative path. One trusted brain. No parallel truth."*
