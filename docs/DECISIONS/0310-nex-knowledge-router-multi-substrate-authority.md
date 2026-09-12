# 0310 · NEX Knowledge Router + Multi-Substrate Domain Authority

**Status:** Proposed · doctrine only · database freeze remains in force
**Founder:** Phillip · directive 2026-09-11
**Depends on:**
- ADR-0308 · NEX English Brain v1 (semantic layer schema)
- ADR-0309 · Layered Architecture (Rules 1-15)
- ADR-0309.1 · Logical Authority Model (13 object types · 16-attribute matrix)
- `data/nex-english-source-map/reconciliation-2026-09-11.md`
- `data/nex-english-source-map/gate-2-supabase-audit.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

## Context

Three audits (reconciliation · Gate 2 Supabase · Path C row-level overlap) established:

1. NEX already contains substantial canonical knowledge across two physical substrates: `nex_dev` Postgres and NEX-dedicated Supabase.
2. The two substrates cover **complementary, non-overlapping domains**:
   - Supabase NEX-dedicated = UK Trade Knowledge (2,088 door · 620 flooring · 458 kitchen · 49 staircase · plus technical / customer / platform architecture · 3,627 rows total)
   - `nex_dev` = Indonesia data (accommodation · food · attractions · trivia) + programming/semantic layer (44 concepts) + general English A1 vocabulary (30 words)
3. **Zero row-level duplicates** were detected in any pairwise comparison. Zero cross-substrate conflicts.
4. The partition is architecturally clean and matches how the systems were populated: different mechanisms · different domains · different authorship pipelines · different origin timelines.
5. Founder-authored orphans (repo JSON files) hold unique authority for content not present anywhere else in either substrate.

The previous fear — that two competing canonical brains might exist for the same content — is not supported by evidence. The correct architectural response is therefore NOT physical unification. It is **formalising the current partition and abstracting physical storage behind a logical router**.

## Decision

NEX has **one logical knowledge architecture** consumed through **one logical interface** (the Knowledge Router). The Router resolves each knowledge query to the correct physical substrate based on **domain ownership**, not physical location.

```
                    NEX consumers (Chat · NEX1 · workers · UI)
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  NEX Knowledge Router (doctrine) │
                    │  · one logical entry point     │
                    │  · domain-based dispatch       │
                    │  · authority resolution        │
                    │  · provenance-preserving       │
                    │  · substrate-agnostic API      │
                    └────────────────┬──────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
                ▼                    ▼                    ▼
       NEX Storage             Supabase              Repo files
       (nex_dev + future       NEX-dedicated         (founder-authored
       NEX-controlled          (existing UK           orphans awaiting
       stores)                  Trade Knowledge)      DB homes)
                │                    │                    │
        · English Brain       · knowledge_records   · human-language-map.json
          (Language +           (UK trades · doors,   · nex-intent-phrasings.jsonl
           Semantic +           floors, kitchens,    · kitchen/faqs.jsonl
           People-Say)          staircases)          · trade-business/faqs.jsonl
        · Indonesia domain    · sources
          knowledge           · confidence_scores
        · Accommodation       · knowledge_feedback
          + Food business     · contradictions
          facts               · graph_edges
        · nex_agent.*         · record_versions
          (competency ·       · audit_log
           NEVER knowledge)
```

## The four founding rules of this ADR

### Rule R1 · One logical knowledge architecture

NEX Chat and NEX1 (and any future NEX consumer) consult the same logical knowledge architecture. There is one architecture. There is one logical interface — the Knowledge Router. Multiple physical substrates may back that architecture. Consumers never bypass the Router to reach a physical substrate directly.

### Rule R2 · Domain ownership determines authority

Each *domain* has one authoritative substrate. Today:

| Domain | Authoritative substrate |
|---|---|
| **Language** (word · POS · CEFR · pronunciation · EN+ID) | `nex_dev.nex.brain_english_vocabulary` |
| **Semantic** (concepts · senses · contexts · relationships · questions · answers · evidence) | `nex_dev.nex.concepts` + `.concept_senses` + `.contexts` + `.questions` + `.answers` + `.evidence` |
| **People-Say** (folk-phrase → canonical concept · founder-authored) | `data/nex/human-language-map.json` (repo · Rule B enforced) |
| **UK Trade Knowledge** (doors · flooring · kitchens · staircases · trade technical · trade customer · platform architecture · components · materials) | Supabase NEX-dedicated · `knowledge_records` + supporting substrate tables |
| **UK Trade business-process** (site visits · quotations · deposits · warranties · snagging) | `data/nex-knowledge/_shared/trade-business/faqs.jsonl` (repo · founder-authored) |
| **UK homeowner-facing kitchen Q&A** | `data/nex-knowledge/kitchen/faqs.jsonl` (repo · founder-authored) |
| **UK intent phrasings** (wide-domain: Design · Marketing · Business · Sales · Finance · Personal) | `data/nex-intent-phrasings.jsonl` (repo · founder-authored) |
| **Indonesia accommodation business facts** | `nex_dev.nex.business_knowledge` (accommodation vertical) + `nex.accommodation_business` + `nex.accommodation_business_field_provenance` |
| **Indonesia food business facts** | `nex_dev.nex.business_knowledge` (food vertical) + `nex.food_business` + `nex.food_business_field_provenance` |
| **Indonesia trivia** | `nex_dev.nex.brain_did_you_know_indonesia` |
| **Indonesia attractions** | `nex_dev.nex.brain_attractions` |
| **Truth Engine verdicts** (contradictions) | Currently Supabase `contradictions` for its own records · nex_dev `nex.contradictions` schema-ready for cross-substrate future use |
| **Founder governance** (knowledge_feedback · authorised_by) | Currently Supabase `knowledge_feedback` for Supabase records · Git for repo files · implicit for `nex_dev` semantic layer |
| **Competency + Authorisation** | `nex_dev.nex_agent.*` · segregated from knowledge (ADR-0308 rule 11 · ADR-0309 rule 9) |

Adding a new domain requires an ADR that names its authoritative substrate.

### Rule R3 · NEX Storage is the preferred home for NEW canonical knowledge

**Going forward**, any new canonical knowledge that does not fit an existing domain-authority should be created in NEX-controlled storage (currently `nex_dev` Postgres) rather than Supabase, because:

- NEX Storage is founder-controlled top-to-bottom (per ADR-0300 migration blueprint).
- NEX Storage does not carry a third-party runtime dependency risk.
- NEX Storage matches the "no third-party runtime" doctrine (per ADR-0028 constitution).

**HOWEVER:** existing Supabase UK Trade Knowledge stays where it is. Path C proved there is no duplicate-brain problem to solve, so moving 3,627 records purely to consolidate storage would create risk without solving an architectural issue. Migration requires:

1. A demonstrated architectural reason (not just "storage consolidation"), AND
2. A safe migration path that preserves every LAM object attribute (provenance · governance · contradictions · confidence · versions · authorised_by · reviewed_by · record_version · status).

Neither condition is met today. **Supabase UK Trade Knowledge remains its own authoritative substrate until explicitly re-authorised in a future ADR.**

### Rule R4 · The Knowledge Router abstracts physical storage from NEX consumers

Every knowledge read by NEX Chat, NEX1, workers, and UI flows through the Knowledge Router. Consumers do not reach a physical substrate directly for canonical knowledge lookups.

The Router's contract is minimal, physical-substrate-agnostic, and doctrine-first:

```
resolve(logical_request) → resolved_result | unknown_with_gap_ticket

where:
  logical_request  = { domain? · logical_object_type · surface? · context? · caller_identity }
  resolved_result  = {
    logical_object_type,
    domain,
    physical_substrate,             // provenance of where truth came from
    authoritative: boolean,
    row_data,                        // shape depends on logical_object_type
    provenance,                      // source_ref · captured_by · trust_layer
    confidence,
    version_id?,
    supersedes?,
    contradictions_flagged?,         // per Rule 15 · never silently ignored
    governance_status?               // e.g. 'AUTHORITATIVE' vs 'DRAFT' vs 'DEPRECATED'
  }
```

The Router does NOT:
- Modify canonical data.
- Cache without invalidation semantics.
- Fail-over silently between substrates when they disagree.
- Present the same content twice from different substrates without marking the duplicate.
- Bypass Guardian + Truth Engine on writes.

The Router MUST:
- Dispatch by domain ownership per Rule R2.
- Surface `physical_substrate` in every response for auditability.
- Emit an audit event on every resolve that returns a non-empty result.
- Enforce ADR-0309 Rule 15 (physical location does not determine logical authority).
- Enforce ADR-0309.1 Rule 10 (no layer silently becomes an alternative source of truth).

## The 11 failure modes ADR-0310 defends against

Same as ADR-0309.1 Rule 11 failure catalogue, restated here for enforcement:

1. Duplicate canonical brains
2. Silent authority conflicts
3. Runtime cache accidentally promoted to canonical
4. Migration before row-level reconciliation
5. Founder governance lost during migration
6. Contradiction history discarded
7. Provenance detached from its object
8. Confidence/version information lost
9. Semantic knowledge mixed with domain knowledge
10. Knowledge mixed with agent competency
11. Runtime retrieval data mistaken for canonical knowledge

The Router pattern actively prevents most of these because every response identifies its `physical_substrate` and `logical_object_type` explicitly.

## What ADR-0310 does NOT do

The Router is doctrine. This ADR does not build it. Specifically ADR-0310 does NOT:

- Write any SQL migration.
- Alter, drop, or create any table.
- Move any row between substrates.
- Change any row's status.
- Copy `knowledge_records` from Supabase to `nex_dev` or vice versa.
- Decide the physical home of the People-Say layer.
- Decide the physical home of the empty schema-ready English tables (`brain_english_grammar/lesson/practice/progress`).
- Draft the Router's TypeScript interface, class, or implementation.
- Wire Chat or NEX1 into the Router.
- Deprecate any existing substrate.
- Rename any table or column.
- Open Gate 3 (implementation gate) unilaterally.

Each of the above requires its own founder-authorised ADR.

## Deferred to future ADRs (numbered slots reserved)

The following work is expected, each in its own founder-approved ADR:

- **ADR-0311 · Knowledge Router Reference Interface** — the TypeScript contract that consumers call. Doctrine + type signatures only. No wiring.
- **ADR-0312 · Semantic Layer ↔ UK Trade Knowledge Bridge** — how a `nex.concepts` entry links to a `knowledge_records` article when the underlying concept is the same. Cross-substrate reference model, still zero migration.
- **ADR-0313 · Repo Orphan Homes** — where staircase People-Say · kitchen FAQ · trade-business FAQ · intent phrasings eventually land in DB (if at all).
- **ADR-0314 · Truth Engine Unification** — whether `quality-checker@677` (Supabase) and a future `nex_dev` verifier remain separate or converge on a common Guardian.
- **ADR-0315 · Empty English Table Design Intent** — the original intent (if any) of `brain_english_grammar/lesson/practice/progress` and whether they slot into the layered architecture.
- **ADR-0316 · Main Supabase Project Decommissioning** — formal record that `msdonkkechxzgagyguoe.supabase.co` is retired.
- **ADR-0317+ (open)** — future migration ADRs, if founder ever authorises consolidation of a specific substrate.

Each future ADR must respect ADR-0309.1 Rule 15 and ADR-0310 Rules R1-R4.

## Consequences

### Positive

- **No forced migration.** The 3,627 Supabase records stay where they are · zero migration risk · zero governance loss · zero provenance detachment.
- **Founder governance preserved.** Every existing `knowledge_feedback` row, every `authorised_by=Philip` marker, every `contradictions` detection continues to apply exactly where it was written.
- **Domain-based partition is architecturally explicit.** UK Trades = Supabase · Indonesia + programming + English = `nex_dev` · Repo orphans = repo (until moved).
- **New canonical knowledge lands in NEX Storage by default.** Aligns with ADR-0300 own-storage doctrine.
- **The Router is a doctrine-first pattern.** Consumers get one interface without physical unification churn.
- **English Brain work is preserved and validated.** The 44 concepts + 30 vocab rows + 60 questions + 62 answers + 173 evidence rows are architecturally correct in their current home.

### Negative

- **Two physical substrates to operate.** Backup · monitoring · schema versioning must cover both. This is already the state today · no new burden.
- **Router implementation is deferred.** Chat and NEX1 currently reach some substrates directly. Wiring them through the Router requires ADR-0311 + implementation ADRs. Until then, Rule R4 is doctrine, not enforced by code.
- **Supabase remains a third-party runtime dependency for UK Trade Knowledge reads.** Mitigated by: Path C proved these are the ONLY records living there · they are stable · not growing rapidly · not on the hot path for Indonesia operations.
- **Cross-substrate contradictions are not currently detected.** `quality-checker@677` runs inside Supabase only. A contradiction between a `nex.concepts` entry and a `knowledge_records` article would not be caught today. Deferred to ADR-0314.

### Rejected alternatives

- **Physical consolidation** (move 3,627 rows from Supabase to `nex_dev`) — Rejected. Path C proved no duplicate-brain problem exists · migration would create risk without solving anything.
- **Wipe Supabase** (per ADR-0300 migration off Supabase) — Rejected for now. ADR-0300 migration completed for hot-path systems already; UK Trade Knowledge remains as a special case because it is stable, non-conflicting, and useful. Future re-authorisation possible.
- **Two independent NEX brains** (Supabase reads for Chat · `nex_dev` reads for NEX1) — Rejected. Violates the "one shared architecture" rule from ADR-0308 rule 5 and ADR-0309 rule 1.
- **Router as full implementation now** — Rejected. Doctrine first, implementation gated. Prevents premature commitment.

## Open founder decisions

The following are not blocked by ADR-0310 but should be answered in follow-up ADRs (numbered slots above):

1. Which consumers wire into the Router first (Chat · NEX1 · both)?
2. Is the Router a TypeScript library, an HTTP microservice, or an in-process module?
3. Where does the People-Say layer physically live long-term (ADR-0313)?
4. Do the empty English schema-ready tables get activated (ADR-0315)?
5. When does the main Supabase project get formally decommissioned (ADR-0316)?
6. What triggers Truth Engine unification across substrates (ADR-0314)?

## Freeze status · post-ADR-0310

- Hard freeze on all writes to `nex_dev` remains.
- Hard freeze on all writes to Supabase remains.
- No `nex.*` schema changes.
- No Supabase schema changes.
- No source-file imports.
- No canonical-status changes.
- No cross-substrate copies.
- No Router implementation.
- Repo orphan files untouched.
- Gate 3 remains CLOSED. Founder decides when Gate 3 opens (implementation of Router or any migration).

## References

- ADR-0028 · NEX Intelligence Constitution
- ADR-0300 · NEX own storage migration blueprint
- ADR-0308 · NEX English Brain v1 · semantic layer schema
- ADR-0309 · Layered architecture · Rules 1-15
- ADR-0309.1 · Logical Authority Model · 13 object types · 16-attribute matrix
- `data/nex-english-source-map/reconciliation-2026-09-11.md`
- `data/nex-english-source-map/gate-2-supabase-audit.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

**End of ADR-0310 · doctrine only.**
**Zero SQL performed. Zero migrations drafted. Zero physical moves. Zero writes outside this document.**
**Freeze in force across all substrates.**
