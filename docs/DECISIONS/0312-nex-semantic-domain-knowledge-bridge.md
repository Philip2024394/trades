# 0312 · NEX Semantic ↔ Domain Knowledge Bridge

**Status:** Proposed · reference doctrine only · database freeze remains in force
**Founder:** Phillip · directive 2026-09-11 · ADR-0311 approved
**Depends on:**
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority
- ADR-0311 · Knowledge Router Reference Interface
- ADR-0309.1 · Logical Authority Model
- ADR-0309 · Layered Architecture

---

## Context

Path C (2026-09-11) proved the semantic layer (`nex_dev.nex.concepts` + `.concept_senses`) and the UK Trade Knowledge substrate (Supabase `knowledge_records`) hold **zero row-level duplicates**. They cover different logical objects: semantic concepts are meaning-carriers with disambiguation; UK Trade records are Markdown articles about doors/floors/kitchens/staircases.

Yet a single English word can — and often will — cross both. When a founder or a customer says *"staircase"*, NEX must:

1. Resolve the word into the semantic concept (via `nex.concepts`).
2. Optionally reach the authoritative UK Trade Knowledge article about staircases (in Supabase `knowledge_records`).
3. Never conflate the two layers.
4. Never copy the Supabase article into `nex.*` to make step 2 easier.

The bridge answers "how does a semantic concept find its domain-knowledge relative?" without violating any earlier doctrine.

## Decision

Establish **bridge references** as a distinct logical object type (a 14th, extending the LAM's 13). Every bridge reference is a **soft link** from a semantic-layer object to a domain-knowledge target in another substrate. **The bridge stores relationships, not content.**

```
                    English phrase (input)
                              │
                              ▼
                Router.resolveKnowledge
                              │
                              ▼
                    Semantic layer resolution
                    (nex.concepts / nex.concept_senses)
                              │
                              │  ← if caller asks for domain content
                              ▼
                    BRIDGE REFERENCE (this ADR)
                              │
                              ▼
          Target substrate (Supabase · nex_dev · repo)
                              │
                              ▼
                Authoritative record fetched
                (Router surfaces physical_substrate)
```

The bridge answers exactly one question:

> **"This semantic concept refers to these domain objects."**

It does not answer:

- What the domain object contains (that stays with the target).
- Whether the target is authoritative (that's the target's `status`).
- What the target's governance says (that stays with the target's `authorised_by` etc.).
- What the target's provenance is (that stays with the target's `sources` row).

## The bridge reference contract

Every bridge row carries **exactly these fields**. This is doctrine · no physical schema committed yet.

```
BridgeReference {
  bridge_id                   : uuid                              // stable id for this reference row
  source_layer                : "semantic" | "language" | "people_say"
  source_stable_id            : string                            // e.g. "concept:staircase" or "sense:migration.database_schema_change"
  source_concept_id           : uuid | null                       // FK when source is a concept
  source_sense_id             : uuid | null                       // FK when source is a sense-level link
  target_substrate            : "supabase.nex_dedicated" | "nex_dev.postgres" | "repo.file" | ...
  target_substrate_detail     : string                            // e.g. "knowledge_records" | "data/nex-knowledge/kitchen/faqs.jsonl"
  target_logical_object_type  : LogicalObjectType                 // domain_knowledge · question · answer · etc.
  target_stable_id            : string                            // e.g. "components_riser_cleat_v1" · "kitchen_faq_row_42"
  relation_kind               : RelationKind
  confidence                  : number (0-1)
  authored_by                 : string                            // who created the bridge row
  authorised_by               : string | null                     // founder or delegated authority · null until authorised
  created_at                  : timestamp
  reviewed_at                 : timestamp | null
  evidence_ref                : uuid | null                       // pointer to nex.evidence (per LAM Rule 5)
  status                      : "draft" | "guardian_ok" | "truth_engine_ok" | "authoritative" | "deprecated" | "contradicted"
  bidirectional_hint          : boolean                           // whether the target also carries a back-reference · rare · default false
  notes                       : string | null                     // free-form justification for founder review
}
```

Every field is mandatory in the shape. Fields may be `null` or empty; they may never be omitted.

## Relation kinds (locked · additions require ADR)

The `relation_kind` enum is intentionally small.

| Value | Meaning |
|---|---|
| `defines` | The target document is the canonical definition of this concept. Example: `concept:staircase.staircase_general_meaning` → `knowledge_record:blondel_formula_step_proportions_v3` (defines geometric standards). |
| `narrows_to` | The concept has a specific meaning captured by this target. Example: `sense:migration.database_schema_change` → `knowledge_record:some_migration_governance_v1`. |
| `example_of` | The target is a concrete example of the concept. Example: `concept:route.path_between_points` → a `knowledge_record` describing a specific trade project route. |
| `describes` | The target describes (but does not define) the concept. Weaker than `defines`. |
| `mentioned_in` | The concept is mentioned in the target, not the target's main subject. Weakest useful link. |
| `synonym_of` | The target IS the concept, expressed in the target substrate. Reserved. |
| `related` | Soft relatedness · used sparingly · lowest weight. |

Any other relation kind requires a future ADR that names it and defines its promotion criteria.

## Rules governing the bridge

### Rule BR1 · Bridge stores relationships · never content

A bridge row **never** carries the target's title, body, summary, or any content field from the target substrate. The bridge names the target; it does not describe the target. If a caller wants the target's content, Router calls `getKnowledge(target_logical_object_type, target_stable_id)` after resolving the bridge · target substrate returns its own content.

### Rule BR2 · Bridge never becomes an authoritative content substrate

The bridge is `logical_object_type = "bridge_reference"` per the LAM extension. It is not `domain_knowledge`. It is not `semantic`. It is a distinct object type. Any read path that returns a bridge row as if it were domain content is a violation.

### Rule BR3 · Bridge does not mutate the target

Creating a bridge from concept X to record Y does NOT change Y's `status`, `authorised_by`, `confidence`, or any other target field. Y stays exactly as Y was. The bridge is one-directional soft-link.

### Rule BR4 · Bridge does not claim authority over the target

If the target substrate says `status="DRAFT"`, the bridge cannot promote the target to `AUTHORITATIVE`. The bridge's own `status` describes only the bridge row · never the target.

### Rule BR5 · Bridge follows LAM promotion ladder

Bridge rows go through `draft → guardian_ok → truth_engine_ok → authoritative` like any other canonical object. Guardian checks the shape (source_stable_id resolves · target_stable_id resolves · relation_kind is in the locked enum · confidence in range · authored_by set). Truth Engine signs off.

### Rule BR6 · Bridge carries evidence

Every bridge row that reaches `authoritative` must have a matching `nex.evidence` row (LAM Rule 5). The `source_ref` on the evidence row cites what justified the bridge: a founder decision, a similarity score, a link from the target itself, etc.

### Rule BR7 · Bridge may be founder-authored only or AI-proposed with founder review

AI may propose bridge candidates (via similarity scoring, entity extraction, or graph analysis). Every AI-proposed bridge starts as `status="draft"`. Bridges reach `authoritative` **only** by founder or delegated-authority sign-off. This mirrors Rule B (no-AI-authored) from `human-language-map.json`, adapted for the semantic ↔ domain bridge.

### Rule BR8 · Router surfaces bridges as first-class response data

When `Router.resolveKnowledge` returns a semantic object AND that object has authoritative bridges, the response carries the bridge list under `related_bridges: BridgeReference[]`. Callers who want domain content follow up with `Router.getKnowledge(target_logical_object_type, target_stable_id)`. Router does NOT auto-inline target content — that would violate BR1.

### Rule BR9 · Contradictions on bridges are contradictions

If two authoritative bridges from the same concept target contradictory records (e.g. `concept:staircase.staircase_general_meaning` → `record_A` says one thing · `record_B` says the opposite), the Truth Engine flags a contradiction on the BRIDGE object (per LAM Rule 8). Router surfaces the contradiction per ADR-0311 Rule B5.

### Rule BR10 · Deprecating a target does not auto-deprecate its bridges

If Supabase deprecates `knowledge_record:some_v1`, existing bridges pointing at it stay in place until the bridge itself is reviewed. Bridges may still be useful for historical lookups. When founder or Truth Engine reviews the bridge, it may be marked `deprecated`. Silent auto-deprecation is forbidden (LAM Rule 12: additive migrations · reversible · governance-preserving).

### Rule BR11 · Cross-substrate joins never fabricate

If a bridge points at `knowledge_records:X` and Supabase is unreachable, Router returns `unknown=true` with `unknown_reason="substrate_unreachable"` for the target lookup · the bridge row itself remains valid and readable. NEX never fabricates the missing target content.

## Router integration semantics

When `Router.resolveKnowledge` resolves a semantic object, the response envelope (ADR-0311) is extended with:

```
KnowledgeResponse.related_bridges : BridgeReference[]
```

This field:
- Is populated only when the resolved object is `semantic` or `language` or `people_say`.
- Contains **only bridges whose `status ∈ {truth_engine_ok, authoritative}`**.
- Is empty (never omitted) when no authoritative bridges exist.
- Never contains the target's content · only the bridge row.

If the caller wants the target's content, they follow up:

```
router.getKnowledge({
  logical_object_type: response.related_bridges[i].target_logical_object_type,
  stable_id:           response.related_bridges[i].target_stable_id,
  caller_identity:     ...
})
```

This preserves ADR-0311 Rule B1 (physical_substrate always surfaced), because the follow-up call returns a response whose `physical_substrate` reveals where the target lives.

## Prevents which failure modes

Bridge doctrine actively defends against these failure modes from LAM Rule 11:

| # | Failure mode | How the bridge prevents it |
|---|---|---|
| 1 | Duplicate canonical brains | Bridge stores no content. Only a reference. There is only ever one canonical copy of a target (in its own substrate). |
| 2 | Silent authority conflicts | Bridge always names the target's substrate. Chat and NEX1 see the same physical_substrate for the same bridge. |
| 4 | Migration before row-level reconciliation | Bridges make cross-substrate relationships explicit BEFORE any migration is contemplated. |
| 5 | Founder governance lost during migration | If a target is later moved, only its stable_id needs updating in existing bridges. Governance stays with the target row. |
| 6 | Contradiction history discarded | Contradictions on bridges are first-class (BR9). |
| 7 | Provenance detached | Every bridge cites `evidence_ref` (BR6). |
| 9 | Semantic mixed with domain knowledge | Bridge object type is distinct from either. |
| 11 | Runtime retrieval data mistaken for canonical | Bridges have their own promotion ladder (BR5) and cannot be caches. |

## What ADR-0312 does NOT do

- ❌ No SQL migration
- ❌ No physical `bridge_references` table created
- ❌ No decision on where the bridge physically lives (in `nex_dev`? in Supabase? both?)
- ❌ No bridge rows populated
- ❌ No Router implementation
- ❌ No wiring
- ❌ No copy of any Supabase record into `nex.*`
- ❌ No modification of any existing `nex.concepts` · `nex.concept_senses` · `nex.evidence` · Supabase `knowledge_records`
- ❌ Gate 3 remains CLOSED

Each of the above requires a follow-up founder-authorised ADR.

## Follow-up ADRs (numbered slots reserved)

- **ADR-0312a · Bridge Physical Home** — where the `bridge_references` table lives (default candidate: `nex_dev.nex.bridge_references` because bridges are metadata about relationships between substrates, and NEX Storage is the preferred home for new canonical data per ADR-0310 Rule R3). Still doctrine.
- **ADR-0312b · Bridge Seed Migration** — the specific migration ADR that creates the table + first bridge rows (if founder approves). Gate 3 candidate.
- **ADR-0312c · AI-Proposed Bridge Discovery Pipeline** — how workers propose candidate bridges from `nex.concepts` to `knowledge_records` via similarity scoring, and how founder reviews them.

## Consequences

### Positive

- **Chat and NEX1 can traverse from English input → semantic concept → UK Trade content** without copying UK Trade content anywhere.
- **UK Trade Knowledge stays put** as ADR-0310 Rule R3 requires. No migration risk.
- **Cross-substrate contradictions become detectable** via bridge-level Truth Engine (BR9).
- **Founder governance follows the object.** Bridges carry their own `authorised_by`; target records keep theirs.
- **Extensible.** Same bridge mechanism serves semantic ↔ Indonesia domain, semantic ↔ people-say, semantic ↔ founder-authored FAQ files, etc.

### Negative

- **Cross-substrate reads become two-hop.** `resolveKnowledge` returns bridges · `getKnowledge` fetches target content. Two Router calls where a naive design would use one. Trade-off: substrate independence + auditability.
- **Bridge rows must be maintained** as targets evolve. If a Supabase record is renamed or moved, bridge `target_stable_id` must be updated. Router surfaces broken bridges as `unknown` per BR11 · never fabricates.
- **Requires a promotion pipeline** for AI-proposed bridges (ADR-0312c). Not free.

### Rejected alternatives

- **Copy UK Trade records into `nex.concept_senses.examples` JSONB** — Rejected. Violates BR1 (bridge stores no content) and creates duplicate canonical brains (LAM Rule 11 failure #1).
- **Materialised views spanning both substrates** — Rejected. Cross-substrate materialised views require constant sync · high risk of drift · violates LAM Rule 15 (physical location does not determine logical authority) at implementation level.
- **Bidirectional bridges (concept ↔ target · both sides authoritative)** — Rejected for now. `bidirectional_hint` is a soft field; the LAM keeps authority one-directional (source cites target · target does not need to know about the bridge). May be revisited in a future ADR if data warrants.
- **AI-authored bridges without founder review** — Rejected. Violates BR7. Bridges are canonical objects · they follow the same governance ladder as everything else.
- **Bridges as ephemeral cache** — Rejected. Bridges are canonical (they carry their own status ladder and evidence). Caches are elsewhere (Router's hot tier · Rule B11 of ADR-0311).

## Open founder decisions

None block ADR-0312. The following will be answered in follow-up ADRs:

1. Should the bridge table live in `nex_dev` (preferred per Rule R3) or Supabase (co-located with targets)? — ADR-0312a
2. When should the first bridge rows be populated? — ADR-0312b (implementation gate)
3. Should AI-proposed bridges be built via similarity scoring, LLM extraction, or human-authored only for the first slice? — ADR-0312c
4. Should `people_say` map (`data/nex/human-language-map.json`) target the semantic layer via bridges too? Or does People-Say remain source-of-truth with its own reflex resolver? — deferred

## Freeze status · post-ADR-0312

Unchanged.

- Hard freeze on all writes to `nex_dev`.
- Hard freeze on all writes to Supabase.
- No source files under `src/` touched.
- No new packages.
- No bridge table created.
- No bridge row created.
- No cross-substrate copies.
- No Router implementation.
- Repo orphans untouched.
- English Brain expansion frozen (permanent · founder 2026-09-11 directive).
- Gate 3 remains CLOSED.

## References

- ADR-0028 · NEX Intelligence Constitution
- ADR-0300 · NEX own storage migration blueprint
- ADR-0308 · English Brain v1 · semantic layer schema
- ADR-0309 · Layered architecture · Rules 1-15
- ADR-0309.1 · Logical Authority Model
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority
- ADR-0311 · Router Reference Interface
- `data/nex-english-source-map/reconciliation-2026-09-11.md`
- `data/nex-english-source-map/gate-2-supabase-audit.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

**End of ADR-0312 · reference doctrine only.**
**Zero code written. Zero table created. Zero substrate touched. Zero content copied.**
**Freeze in force across all substrates.**
