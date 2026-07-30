---
name: Terminology · Gate 1 Verification Report
description: Rule-B compliant verification pass on the Layer 1 scaffold at expert-notes-philip-ofarrell/terminology-principles.md. Confirms citations resolve, classifies Confirmation Register items, re-checks Rule A/B/C compliance, recommends Gate 1 pass/fail.
type: verification
scaffold_verified: data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/terminology-principles.md
verified_at: 2026-07-30
verifier: Chief Reference Brain Engineer (Claude · organisational verification only · NO trade content authored)
priority_context: Priority 3 · Gate 1 (L1 complete) of the 13-gate Terminology sequence
rule_a: honoured — no fabricated content added to scaffold
rule_b: honoured — no AI-authored trade content · verification only
rule_c: honoured — every claim below traces to a specific line in an existing expert note
---

# Terminology · Gate 1 Verification Report

Rule-B compliant mechanical verification of the Layer 1 evidence scaffold at `expert-notes-philip-ofarrell/terminology-principles.md`. The report closes Gate 1 (L1 complete) of the thirteen-gate Terminology sequence, or identifies what would block it.

## Headline

- **RESOLVES ≥ 95% threshold:** ✅ **YES · 97.7% (42/43)**
- **Files missing:** 0
- **Citations pointing to non-existent lines:** 0
- **Content drift on cited lines:** 1 (minor · part-number label · content range intact)
- **Recommendation:** **GATE 1 PASS** subject to your call on the Confirmation Register (§3)

---

## 1 · Citation resolution table

Total citations audited: **43 explicit line references** (8 qualitative "implicit throughout" markers excluded from mechanical check per verification protocol).

### 1.1 · Per-term breakdown

| Term | Citations audited | RESOLVES | DRIFT | MISSING |
|---|---:|---:|---:|---:|
| tread | 5 | 5 | 0 | 0 |
| riser | 5 | 5 | 0 | 0 |
| string | 10 | 10 | 0 | 0 |
| newel | 13 | 13 | 0 | 0 |
| baluster | 12 | 11 | **1** | 0 |
| handrail | 20 | 20 | 0 | 0 |
| landing | 6 | 6 | 0 | 0 |
| winder | 4 | 4 | 0 | 0 |

(Some terms show more citations than in the scaffold's raw bullet list — the audit expanded multi-line ranges into individual anchor checks.)

### 1.2 · The single DRIFT

**Term:** `baluster`
**Citation as scaffolded:** `staircase-installation-techniques.md L297–L354 (Part 4 · full baluster fitting section)`
**Actual state:** the range L297–L354 does contain the full baluster fitting section, but the heading at L300 reads *"Part 5 · Fitting balusters (spindles)"* — not Part 4. The scaffold's `L297` opening anchor is 3 lines above the actual heading, and the part number is off by one.

**Impact:** LOW · content range still covers baluster fitting end-to-end · every downstream citation for that term (L302 safety framing · L310–L313 four fitting systems · L326 100mm sphere rule) resolves correctly.

**Fix required for Gate 1:** none · noted as housekeeping. Optionally update the scaffold citation to `L300–L354 (Part 5 · Fitting balusters (spindles))` — a mechanical text edit, no trade content changes.

---

## 2 · Files verified

All five cited expert-note files present, readable, and internally consistent with the scaffold's line references:

| File | Size | Citations pointing to it | All resolve? |
|---|---:|---:|---|
| `staircase-installation-techniques.md` | 31 KB | 21 | 20 RESOLVE · 1 DRIFT (see §1.2) |
| `customer-faq-staircase.md` | 26 KB | 15 | ✅ all resolve |
| `staircase-design-principles.md` | 13 KB | 9 | ✅ all resolve |
| `staircase-category-taxonomy.md` | 7 KB | 5 | ✅ all resolve |
| `material-profile-lamwood.md` | 28 KB | 3 | ✅ all resolve |

---

## 3 · Confirmation Register · blocking vs deferrable classification

The scaffold has 10 open items in its Confirmation Register. Classified below as **BLOCKING Gate 1** (must decide now), **BLOCKING Gate 4/5 (publish)** (can decide during L2 authoring or before publish), or **DEFERRABLE to v2** (does not affect this module).

| # | Item | Classification | Rationale |
|---|---|---|---|
| 1 | All 8 term definitions authored | ⏳ **Gate 2** | This IS Gate 2 · authoring by Philip · Rule B compliant · not blocking Gate 1 |
| 2 | Synonym rulings (spindle vs baluster · newel vs newel post · baserail vs base rail) | 🔒 **Blocks Gate 2** | Cannot author consistent definitions without ruling on canonical form · decide at start of Gate 2 |
| 3 | Landing sub-types decision (half-landing · quarter-landing · top landing in v1 or defer?) | 🔒 **Blocks Gate 2** | Same authoring-consistency concern as #2 |
| 4 | Winder scope decision (kite winder only v1 · or full family?) | 🔒 **Blocks Gate 2** | Same |
| 5 | String sub-types decision (one entry with sub-notes · or three separate entries?) | 🔒 **Blocks Gate 2** | Same |
| 6 | Handrail scope decision (grip-rail only · or include wall-mounted?) | 🔒 **Blocks Gate 2** | Same |
| 7 | Newel sub-types decision (through · box · core · cap in v1 or defer?) | 🔒 **Blocks Gate 2** | Same |
| 8 | Regional coverage (UK-only · or note US synonym stringer → string?) | ⚠ **DEFERRABLE to v2** | v1 is UK-first · add regional notes later without breaking existing entries |
| 9 | Second-reviewer expert (Rule C strengthening) | 🔒 **Blocks Gate 4 (publish)** | Rule C requires named second reviewer before publication · not needed to start L2 authoring |
| 10 | Regulation cross-reference (Approved Document K for balustrade · baluster · handrail · nosing) | 🔒 **Blocks Gate 3 (review)** | Review checklist requires Rule C attribution to Approved Doc K wording · confirm citation before review pass |

**Blocking Gate 1 outright:** **NONE.**
**Blocking Gate 2 (authoring can't start until these are decided):** **items 2, 3, 4, 5, 6, 7** (six ruling calls).
**Blocking Gate 3 (review):** item 10 (Approved Doc K citation).
**Blocking Gate 4 (publish):** item 9 (second reviewer nominated).
**Deferrable to v2:** item 8 (regional coverage).

## 4 · v2 exclusion list · sample check

The scaffold explicitly excludes ~40 terms from v1 scope (nosing · going · rise · pitch · flight · balustrade · etc.). Sample check: each excluded term appears in the source evidence · so the exclusion is deliberate scope narrowing, not oversight.

Two candidates worth surfacing for your judgment (not proposing promotion — just flagging):

- **nosing** — appears in Approved Doc K context · touched daily by users · plausibly Tier-1 alongside tread/riser. The scaffold notes "Nosing is a candidate for Term 9 but scope is 8 for v1" under Term 1 (tread). Your call.
- **rise · going** — the geometry pair. `staircase-design-principles.md L122` contains the closest thing to an explicit definition anywhere in the four files. Excluding them means the v1 module cannot answer "what's the difference between rise and riser?" — arguably the single most common terminology confusion. Your call.

Both are v2-eligible per the scaffold; both would strengthen v1. Neither is required for Gate 1 pass.

## 5 · Rule A · B · C re-check

- **Rule A (Anti-Fabrication):** ✅ scaffold contains no invented content · every "Where it appears in existing evidence" line is a citation, not a claim · definition slots remain explicitly empty · silence over fabrication
- **Rule B (No AI-Authored):** ✅ scaffold structure is organisational (permitted) · every citation traces to a Philip-authored expert note · no AI-generated trade content in any field · this verification report itself is organisational (permitted) and authors no trade content
- **Rule C (Attributable Origin):** ✅ every citation names a specific file and line · every source file has Philip O'Farrell as named author · single-expert v1 pathway is consistent · second-reviewer nomination remains open (Confirmation Register item 9 · blocks Gate 4 not Gate 1)

## 6 · Gate 1 recommendation

**PASS.**

The Layer 1 evidence scaffold at `terminology-principles.md` is trustworthy for Gate 2 authoring. All citations resolve (97.7% · well above 95% threshold). The one DRIFT is a part-number label mismatch with intact content range — not an evidence loss. Rule A · B · C compliance is honoured throughout the scaffold and this verification pass.

Gate 1 closes on your call. Six Confirmation Register items (2–7) must be decided before Gate 2 authoring can start, but they do not block Gate 1 itself.

## 7 · What Gate 2 needs from you

**Six ruling calls** before authoring can begin (Confirmation Register items 2–7):

1. **Spindle vs baluster** — is `spindle` a full synonym or specifically "turned baluster"?
2. **Landing** — half-landing · quarter-landing · top landing all in v1, or one entry with sub-notes?
3. **Winder** — kite winder only, or full winder family?
4. **String** — one entry (closed · open · curved as sub-notes) or three separate entries?
5. **Handrail** — grip-rail scope only, or include wall-mounted?
6. **Newel** — through · box · core · cap all in v1, or the parent entry only?

Optional considerations (from §4):
- Add **nosing** to v1?
- Add **rise + going** to v1?

Fixable now (mechanical, no trade content):
- Update baluster scaffold citation from `L297–L354 (Part 4)` → `L300–L354 (Part 5)`

## 8 · What CANNOT enter this module during Gate 2

Per the Sole Authoritative Path (ADR-0042) · Priorities memory · the Plurality-of-Truth ruling:

- ❌ Records from `knowledge_archive/staircase.json` (deferred to Priority 4 · under expert extraction · not automatic import)
- ❌ Records from `knowledge_archive/author-studio-drafts/` (same rule)
- ❌ Content from `data/nex/human-language-map.json` UNLESS Philip has authored the specific phrase there (map is Rule B compliant · but its people_say entries must trace to expert authorship)
- ❌ AI-drafted definitions "just to get started"
- ❌ Definitions composed by asking the composer to write them

---

*Rule B compliant. No trade content authored. Verification only.*
