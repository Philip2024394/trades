# WO-INTELLIGENCE-02 · turning the Discovery Core into a continuously useful knowledge-growth subsystem

**Founder-authorised for SPECIFICATION 2026-09-13. Execution NOT yet authorised — the explicit gate is at the end of this document.**

**Doctrine anchor:** P-S v2 (external LLM banned as authority/execution/truth; NEX-owned intelligence mechanisms permitted under existing WO gate + evidence + safety architecture).

**Programme track:** parallel with WO-WORKSTATION-14 (authority adversarial) and WO-WORKSTATION-15 (crash/restart durability). Does NOT block Phase 9 Vision, Phase 14 Guardian.

**Prerequisite:** WO-INTELLIGENCE-01 complete (HEAD `39c795f214d4fc6a2d306105be197b01fd7293e9`, 227/227 tests, real-fixture end-to-end verified).

---

## 1 · Purpose

Turn NEX Intelligence from a one-shot vertical slice into a subsystem that grows knowledge continuously without silently changing history and without ever being fooled by evidence it constructed for itself.

Founder-locked acceptance question:
> "Does the hypothesis still work on something the system didn't use to create the hypothesis?"

If the answer is YES with real evidence and immutable history, WO-INTELLIGENCE-02 is complete.

## 2 · Non-goals

- **Not** an expansion of NEX authority. Knowledge growth remains separate from authority growth per P-Q/P-U.
- **Not** an addition of external LLM anywhere. P-S v2 unchanged.
- **Not** an Agent Academy build. That's WO-INTELLIGENCE-03 or a separate track.
- **Not** a substrate modification. WO-13 integrity table unchanged.
- **Not** an infinite crawling programme. Every source class requires an authorised manifest entry.
- **Not** a rewrite of WO-INTELLIGENCE-01. This is additive.

## 3 · Three priorities (founder-locked)

### Priority 1 · More independent sources

Slice-1 has one source class (arXiv). Slice-2 introduces a **source-class taxonomy** and adds at least one additional real source class:

| Source class | Authority classification | Example source |
|---|---|---|
| `academic_publication` | high — peer-reviewed | arXiv (slice 1), plus one additional academic source in slice 2 |
| `official_technical_documentation` | high — vendor-owned | e.g. Node.js official documentation |
| `standards_specification` | very high — normative | e.g. TC39 proposals, ECMA specs |
| `official_project_repository` | medium — vendor observation | e.g. github.com/nodejs/node (public metadata only) |
| `high_quality_engineering_source` | medium — curated | e.g. specific engineering blogs founder authorises |

Each source class has:
- A dedicated ingestion adapter (Atom, HTML, JSON, whatever the source uses)
- Its own manifest-entry template
- A per-source authority classification that influences the Scoring Engine's confidence calc
- A per-source query-predicate allowlist (crawler cannot invent queries)

**Scope for WO-INTELLIGENCE-02:** implement source-class taxonomy + add **exactly ONE** additional source class beyond arXiv. Founder names the source in §7 authorization. Additional source classes each require their own future WO.

### Priority 2 · Revisit loop

Founder-locked flow:
```
OLD KNOWLEDGE
      ↓
   REVISIT
      ↓
NEW EVIDENCE
      ↓
   COMPARE
      ↓
CONFIRM / UPDATE / SUPERSEDE / REJECT
```

**Immutability discipline:** the old KnowledgeObject is NEVER edited. A revisit produces:

- A `RevisitRecord` (new record type) capturing the trigger, the new evidence, the comparison result, and the verdict
- If verdict is **CONFIRM**: old object's `revisit_scheduled_at` is bumped forward; no other change
- If verdict is **UPDATE**: a new KnowledgeObject `v2` is created with `supersedes: [old_id]`; the old `v1` gains `superseded_by: [new_id]` via a linked patch (the old object's canonical bytes stay intact — the link is stored in an adjacency collection)
- If verdict is **SUPERSEDE**: same as UPDATE plus old object's status becomes `DEPRECATED`
- If verdict is **REJECT**: revisit is recorded but neither object changes; a proposal is emitted to the founder

**Deterministic verdict function:**
```
if (new_evidence_count >= min_new_evidence AND contradictions == 0 AND confidence_delta < THRESHOLD_STABLE)
  → CONFIRM
elif (new_evidence_count >= min_new_evidence AND |confidence_delta| < THRESHOLD_UPDATE AND contradictions == 0)
  → UPDATE
elif (new_evidence_count >= min_new_evidence AND confidence_delta <= -THRESHOLD_SUPERSEDE)
  → SUPERSEDE
elif (contradictions >= THRESHOLD_REJECT AND new_evidence_count >= min_new_evidence)
  → REJECT
else
  → INSUFFICIENT_NEW_EVIDENCE (no change)
```

Verdict is a pure function of the evidence delta. Same delta → same verdict, always.

### Priority 3 · Held-out generalisation

For every hypothesis, the Experiment Engine splits its test cases into TWO disjoint sets:
- **Training set** — used to inform the hypothesis
- **Held-out set** — reserved; never used during hypothesis formation

Promotion to Intelligence tier now requires the hypothesis pass BOTH:
- Training-set success ratio ≥ threshold
- Held-out-set success ratio ≥ threshold

Held-out failure with training-set success → the object stays at `TESTED` with a specific `generalisation_failed` flag. Future revisits may resolve it.

**Corpus discipline:** the split is deterministic — same seed + same input corpus → same split. The training / held-out assignment is recorded on the `ExperimentRecord` so future audits can verify the hypothesis was NOT informed by held-out cases.

## 4 · Doctrinal alignment

| Principle | How WO-INTELLIGENCE-02 honours it |
|---|---|
| P-Q · correction never creates authority | Revisit verdicts (CONFIRM/UPDATE/SUPERSEDE/REJECT) never activate a KnowledgeObject to PRODUCTION — that still requires founder-signed WO |
| P-U · more intelligence ≠ more authority | New source classes / revisits / held-out passes never expand crawler manifest scope; each new source requires its own founder-signed WO |
| P-S v2 · no external LLM as authority/execution/truth | Revisit verdicts are pure functions; held-out testing uses real subprocess; source classifiers are rule-based |
| P-M · marketing framing | Internal tier naming preserved; no external claims |
| WO-13 · substrate integrity | Intelligence subsystem still lives outside substrate scope |
| WO-INTELLIGENCE-01 · authority discipline | All 16 A-tests remain green; new A-tests added for the new capabilities |

## 5 · Architecture (deltas from WO-INTELLIGENCE-01)

### New modules

- `src/lib/nex-intelligence/source-classes.ts` — taxonomy + authority classification
- `src/lib/nex-intelligence/adapters/` — per-source ingestion adapters (arXiv already exists; slice 2 adds one)
- `src/lib/nex-intelligence/revisit.ts` — deterministic revisit-verdict function + RevisitRecord type
- `src/lib/nex-intelligence/generalisation.ts` — corpus split + held-out enforcement

### New storage collections

- `nex_intelligence_revisits` — RevisitRecord persistence
- `nex_intelligence_supersede_edges` — adjacency records linking old ↔ new knowledge objects
- `nex_intelligence_generalisation_sets` — deterministic corpus splits

### Extensions to existing types

- `KnowledgeObject` gains `revisit_count`, `last_revisit_at`, `generalisation_failed_flag`
- `ExperimentRecord` gains `training_set_case_ids`, `held_out_set_case_ids`, `training_success_ratio`, `held_out_success_ratio`
- `CrawlerManifestEntry` gains `source_class` field

## 6 · Deterministic revisit thresholds (spec §5-6, revisit verdict)

| Threshold | Value | Justification |
|---:|---:|---|
| `min_new_evidence` | 2 | at least two new independent items to justify a verdict |
| `THRESHOLD_STABLE` | 0.05 | confidence within ±5% = CONFIRM |
| `THRESHOLD_UPDATE` | 0.20 | between 5% and 20% = UPDATE with new version |
| `THRESHOLD_SUPERSEDE` | 0.20 | confidence drops ≥20% = SUPERSEDE |
| `THRESHOLD_REJECT` | 3 | ≥3 independent contradictions = REJECT |

Values are constants; changing them is a future WO.

## 7 · Vertical slice scope (Priority 1 · one additional source)

**Requested from founder in the authorization decision (§12):** name the ONE additional source class + specific source for slice 2. Options:

- Option A · **Node.js official technical documentation** — `nodejs.org/api/` HTML rendered via a deterministic HTML → text extractor. Source class: `official_technical_documentation`.
- Option B · **TC39 proposals** — `github.com/tc39/proposals` README + specific proposal READMEs (public HTTP). Source class: `standards_specification`.
- Option C · **Node.js repository metadata** — `api.github.com/repos/nodejs/node/releases` (public, no auth required). Source class: `official_project_repository`.
- Option D · Something else you name.

Only ONE additional source in slice 2. The rest come in slice-3+.

## 8 · Real-execution requirements (unchanged from slice 1)

- Zero mocks anywhere
- Real HTTP GET through the Broker-gated crawler
- Real subprocess for held-out experiments (reuses WO-07 runSpecialist pattern)
- Real GB storage persistence
- Real content-hashed provenance chains

## 9 · Adversarial acceptance tests (spec-locked · 12 new · shape unchanged)

Every test: **secretly try to grow authority OR silently modify history → assert NEX refuses.**

1. Revisit CONFIRM verdict does NOT modify the old KnowledgeObject bytes on disk (content-hash unchanged)
2. Revisit UPDATE verdict produces a NEW KnowledgeObject with distinct `knowledge_id` and correct `supersedes` link; old object bytes unchanged
3. Revisit SUPERSEDE cannot mark old object as `DEPRECATED` without an accompanying new object
4. Revisit REJECT cannot silently produce a new PRODUCTION object
5. Deterministic verdict function is pure — 100 runs on same evidence delta return identical verdict
6. Corpus split is deterministic — same seed + same corpus → identical training / held-out assignment
7. Hypothesis that passes training but fails held-out is DENIED promotion to Intelligence tier (stays at TESTED)
8. Held-out test cases were NOT accessible to the Hypothesis Engine (grep-verified: hypothesis-engine.ts never reads `held_out_set_*` fields)
9. New source class does NOT gain authority over existing knowledge objects (source-class field influences scoring only, never enum-status)
10. Crawler manifest requires a source_class match for every new-source-class entry (existing entries grandfather in as `academic_publication`)
11. Revisit scheduler cannot fire outside its authorised cadence (rate-limited per manifest entry, same pattern as slice 1)
12. Supersede-edge adjacency records are content-hashed + provenance-chained; tampering is detected

Plus: all 16 A-tests from WO-INTELLIGENCE-01 remain green (regression).

Target test count: **23 (slice 1) + 12 (new WO-INTELLIGENCE-02) + property tests for the new capabilities = ~40 intelligence tests**, on top of the 204 orchestrator tests, for a suite target of **240+**.

## 10 · Success criteria (§7.7 shape)

1. Real fetch from the additional source class produces ≥ 5 real records with correct provenance chains
2. Corpus split produces a deterministic training / held-out partition
3. Hypothesis Engine forms hypothesis using ONLY training-set fragments
4. Experiment Engine runs against training AND held-out sets separately
5. Scoring reflects the held-out result; promotion honours the two-set requirement
6. At least ONE knowledge object from slice-1 is revisited with fresh evidence
7. Revisit verdict is deterministic and produces the correct record type
8. If revisit is UPDATE or SUPERSEDE, old-object bytes remain byte-identical on disk
9. Full 240+ test suite passes
10. Zero external LLM SDK imports (grep-verified)

## 11 · Sequencing + dependencies

- **Prerequisite:** WO-INTELLIGENCE-01 complete (satisfied at HEAD `39c795f2`)
- **May run in parallel with:** WO-WORKSTATION-14, WO-WORKSTATION-15, T3-C, WO-HQ-AGENTS-01
- **Blocks:** WO-INTELLIGENCE-03 (Agent Academy integration)
- **Does NOT depend on:** Phase 9 Vision, Phase 14 Guardian

## 12 · Founder authorisation gate

**No implementation begins until this section is signed off.**

Master AI will not:
- Create any source file under `src/lib/nex-intelligence/` beyond what already exists
- Fetch from any additional source class
- Add any storage collection constants beyond the three listed in §5
- Modify any substrate file

Until the founder explicitly authorises WO-INTELLIGENCE-02 execution AND names the specific additional source class from §7. Authorisation forms:

- "Authorise WO-INTELLIGENCE-02 execution · source class = Option A" (with your specific pick)
- "Authorise WO-INTELLIGENCE-02 execution · source class = <named source>"
- "Authorise WO-INTELLIGENCE-02 Priority X only" (staged)
- "Refine [specific section] first" (spec revision)
- Something else you direct

---

**End of specification. Awaiting founder authorisation to proceed.**
