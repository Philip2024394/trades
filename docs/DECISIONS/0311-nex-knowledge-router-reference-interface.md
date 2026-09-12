# 0311 · NEX Knowledge Router · Reference Interface

**Status:** Proposed · contract doctrine only · database freeze remains in force
**Founder:** Phillip · directive 2026-09-11 · ADR-0310 approved
**Depends on:**
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority (this ADR realises Rule R4)
- ADR-0309.1 · Logical Authority Model (13 object types · 16-attribute matrix)
- ADR-0309 · Layered Architecture (Rules 1-15)

---

## Context

ADR-0310 established that all NEX consumers reach knowledge through a Knowledge Router · one logical interface · physical substrate abstracted away. ADR-0310 deliberately did not describe the Router's contract. This ADR does.

**ADR-0311 is doctrine only.** It specifies the shape and rules of the Router as it will eventually be built. It creates zero code. It touches no source files. It commits nothing to a package.

Every consumer (Chat · NEX1 · workers · UI) is a hypothetical caller of the shapes below. Nothing calls them today. Wiring happens in follow-up ADRs.

## Decision

The Knowledge Router exposes **exactly seven methods**. Every method returns the **same universal envelope**. Every response is auditable. Every response is deterministic. Every response identifies which physical substrate produced the result.

### The seven methods

| # | Method | Purpose |
|---|---|---|
| 1 | `resolveKnowledge` | Given a surface phrase + context · return the resolved logical object |
| 2 | `searchKnowledge` | Given a query · return ranked candidates matching a logical layer + domain |
| 3 | `getKnowledge` | Given a stable knowledge identifier · return the object |
| 4 | `getEvidence` | Given an object identifier · return its provenance rows |
| 5 | `getAuthority` | Given an object identifier · return its authority chain (authored/authorised/reviewed) |
| 6 | `getConfidence` | Given an object identifier · return its confidence history |
| 7 | `getContradictions` | Given an object identifier · return contradiction records that reference it |

Consumers never call anything else to reach canonical knowledge. Additions to this method set require an ADR.

### The universal response envelope

Every method returns this shape:

```
KnowledgeResponse {
  // What the caller asked for
  request_id                : string                // idempotency / audit key
  requested_at              : ISO-8601 timestamp

  // What was returned
  result                    : KnowledgeObject | KnowledgeObject[] | null

  // WHERE it came from (Rule 15 · physical location surfaced explicitly)
  physical_substrate        : "nex_dev.postgres" | "supabase.nex_dedicated" | "repo.file" | "in_memory_cache" | "none"
  physical_substrate_detail : string                // e.g. "nex.concept_senses" or "knowledge_records" or "data/nex/human-language-map.json"

  // WHAT it is (Rule 10 · layer never silently changes)
  logical_layer             : "language" | "semantic" | "people_say" | "domain_knowledge" | "provenance" | "governance" | "truth_engine_verdict" | "contradiction" | "confidence" | "version" | "runtime" | "competency" | "authorisation"
  logical_object_type       : one of the 13 LAM object types (ADR-0309.1)
  domain                    : "programming" | "meta" | "ukTrades" | "indonesia" | "language.enGB" | "peopleSay.staircase" | ... (extensible via ADR)

  // WHO the authority is
  authority                 : {
    authoritative           : boolean                 // TRUE only if the source row carries authoritative-tier status
    authored_by             : string | null
    authorised_by           : string | null           // founder or delegated authority (e.g. "Philip")
    reviewed_by             : string | null
    canonical_owner         : string | null           // e.g. "NEX Product · AI Engine team"
    substrate_authority_ref : string                  // stable id in the physical substrate for audit
  }

  // HOW TRUE it is
  confidence                : number (0-1)            // normalised · Router unifies both idioms (0-100 int + 0-1 numeric)
  confidence_raw            : { value: number, scale: "0-1" | "0-100" }   // for auditability
  truth_status              : "authoritative" | "truth_engine_ok" | "guardian_ok" | "draft" | "under_review" | "deprecated" | "contradicted" | "unknown"

  // VERSION / SUPERSESSION
  version                   : {
    version_id              : string | null
    version_label           : string | null           // e.g. "v1.0.0" or "record_version=1.0.0"
    supersedes              : string | null           // stable id of the version this supersedes
    superseded_by           : string | null
  }

  // WHERE THE CLAIM CAME FROM
  provenance                : ProvenanceRow[]        // may be empty · never omitted
                                                      // shape: { source_ref, source_reference, trust_layer, captured_by, captured_at }

  // WHAT DISAGREES WITH IT
  contradictions_flagged    : ContradictionRow[]     // may be empty · never omitted
                                                      // shape: { contradiction_id, record_a_id, record_b_id, summary, detected_by, detected_at, status }

  // ROUTER META
  router_version            : string                  // for future contract evolution
  cache_layer               : "none" | "hot_tier_hit" | "hot_tier_miss"   // rebuildable · never authoritative
  latency_ms                : number

  // FAILURE / GAP SIGNALS (Rule 3 · runtime never silently promoted)
  unknown                   : boolean                 // TRUE when Router honestly has no answer
  unknown_reason            : "no_matching_object" | "domain_not_covered" | "substrate_unreachable" | "ambiguous_multiple_authorities" | "contradicted" | null
  gap_ticket_ref            : string | null           // if unknown, a knowledge_gap row was created for tracking
  ambiguous                 : boolean                 // TRUE when multiple candidate answers exist and no context signal disambiguates
  candidates                : Array<KnowledgeObject>  // present when ambiguous=true · empty otherwise
}
```

Every field above is mandatory in the response shape. Fields may be `null` or empty arrays; they may never be omitted. This is doctrine, not optional structure.

### Method signatures

Doctrine-level TypeScript-shaped pseudocode. **Not code.** No file will exist that contains this until ADR-0311b (implementation contract).

```
namespace NEXKnowledgeRouter {

  // ── 1 · resolveKnowledge ─────────────────────────────────
  // Purpose: given a surface phrase (English input · possibly with slang) resolve to the
  // logical object type the caller asked for, in the appropriate domain, dispatched to the
  // authoritative substrate for that domain.
  resolveKnowledge(input: {
    surface                : string                          // raw English input
    logical_layer?         : LogicalLayer                    // hint (e.g. "semantic") · may be null
    domain?                : Domain                          // hint (e.g. "ukTrades" · "programming") · may be null
    context?               : {
      cooccur_tokens?      : string[]
      domain_hint?         : string[]
      grammatical_role?    : string
      prior_conversation?  : { entity_refs: string[]; last_intent?: string }
    }
    caller_identity        : { role: "nex_chat" | "nex1" | "worker" | "ui" | "audit"; instance_id: string }
  }): Promise<KnowledgeResponse>

  // ── 2 · searchKnowledge ──────────────────────────────────
  // Purpose: ranked candidate list within a specific logical_layer + domain.
  // Never crosses layers silently. Never crosses domains without explicit permission.
  searchKnowledge(input: {
    query                  : string
    logical_layer          : LogicalLayer                    // required · Router does not guess the layer for search
    domain?                : Domain
    max_results?           : number                          // default 10 · caller may request more
    min_confidence?        : number (0-1)                    // default 0.0
    include_deprecated?    : boolean                         // default false
    include_drafts?        : boolean                         // default false
    caller_identity        : CallerIdentity
  }): Promise<KnowledgeResponse>                              // result field is KnowledgeObject[]

  // ── 3 · getKnowledge ─────────────────────────────────────
  // Purpose: retrieve a specific object by its stable id.
  // If the substrate is unreachable, returns unknown=true · unknown_reason="substrate_unreachable"
  getKnowledge(input: {
    logical_object_type    : LogicalObjectType
    stable_id              : string                          // e.g. "concept:migration" or "knowledge_record:business_nex_business_brain_v1"
    caller_identity        : CallerIdentity
  }): Promise<KnowledgeResponse>

  // ── 4 · getEvidence ──────────────────────────────────────
  // Purpose: return provenance rows for a specific object.
  // Rule 5 (LAM): provenance attaches to the sense/answer/etc · never detached.
  getEvidence(input: {
    stable_id              : string
    logical_object_type    : LogicalObjectType
    caller_identity        : CallerIdentity
  }): Promise<KnowledgeResponse>                              // result field is ProvenanceRow[]

  // ── 5 · getAuthority ─────────────────────────────────────
  // Purpose: return the authority chain (authored_by · authorised_by · reviewed_by · canonical_owner).
  // Used by NEX Chat to disclose provenance to end users when they ask "who said this?"
  // Used by NEX1 to satisfy Rule 6 (LAM): governance follows the object.
  getAuthority(input: {
    stable_id              : string
    logical_object_type    : LogicalObjectType
    caller_identity        : CallerIdentity
  }): Promise<KnowledgeResponse>                              // authority field carries the chain

  // ── 6 · getConfidence ────────────────────────────────────
  // Purpose: return confidence score history for an object (time-series or single current value).
  // Handles the two idioms (Supabase int 0-100 · nex_dev numeric 0-1) and normalises to 0-1.
  getConfidence(input: {
    stable_id              : string
    logical_object_type    : LogicalObjectType
    include_history?       : boolean                         // default false · when true, returns time-series
    caller_identity        : CallerIdentity
  }): Promise<KnowledgeResponse>                              // result field is ConfidenceRow or ConfidenceRow[]

  // ── 7 · getContradictions ────────────────────────────────
  // Purpose: return contradiction records that reference the object.
  // Rule 11 (LAM): contradiction history is never discarded · Router surfaces it explicitly.
  getContradictions(input: {
    stable_id              : string
    logical_object_type    : LogicalObjectType
    include_resolved?      : boolean                         // default true
    caller_identity        : CallerIdentity
  }): Promise<KnowledgeResponse>                              // result field is ContradictionRow[]
}
```

## Router behavioural rules

The following behaviours are locked · any Router implementation must honour them.

### Rule B1 · Physical substrate always surfaced

Every response carries `physical_substrate` and `physical_substrate_detail`. There is no anonymous canonical answer. Callers may log or ignore this field, but they must never bypass it.

### Rule B2 · Layer + domain never silently changed

A caller asking `logical_layer="semantic"` never receives a response with `logical_layer="domain_knowledge"`. If the query is domain-crossing (e.g. asking for `route` where two domains have canonical rows), Router returns `ambiguous=true` with candidates from each domain listed.

### Rule B3 · Authority chain always accompanies content

`authority.authored_by`, `authored.authorised_by`, `authority.reviewed_by`, `authority.canonical_owner` are populated whenever the underlying object carries them. If a substrate lacks these fields for a specific row (e.g. `nex.brain_did_you_know_indonesia` has `verified_source` but no `authored_by`), Router surfaces the substrate's nearest equivalents and marks the missing fields as `null` · never fabricates.

### Rule B4 · Confidence unified at Router boundary

Router normalises to numeric `0-1`. It preserves the raw value + scale for audit. It never silently rescales without exposing both values.

### Rule B5 · Contradictions never silent

If any contradiction references the returned object (Supabase `contradictions` or `nex_dev.nex.contradictions`), Router populates `contradictions_flagged`. If `contradictions_flagged` is non-empty AND the object's `truth_status` is `authoritative`, the caller sees a warning-tier response but the content still returns. Consumers decide whether to display it.

### Rule B6 · Unknown is a valid deterministic answer

If Router cannot resolve, it returns `unknown=true` with a categorised `unknown_reason` and creates a `gap_ticket_ref` in the appropriate gap ledger. **Never fabricates. Never returns a plausible-looking guess.** ADR-0028 constitutional rule preserved.

### Rule B7 · Ambiguous is a valid deterministic answer

If Router finds multiple candidate authoritative rows across substrates (e.g. two `AUTHORITATIVE` records with overlapping title in Supabase), it returns `ambiguous=true` with the candidate list and does NOT pick one silently. Ambiguity resolution is the caller's or founder's responsibility.

### Rule B8 · Writes never through the Router

The Router is READ-ONLY doctrine. Writes to any canonical substrate flow through Guardian → Truth Engine → substrate-specific write path. Router never accepts a write. Router never proxies a write. This is a hard boundary that prevents a rogue caller from mutating canonical knowledge via the Router surface.

### Rule B9 · Auditability

Every Router call emits an audit event containing: `request_id`, `caller_identity`, `method`, redacted input, `physical_substrate`, `truth_status`, `latency_ms`, and any `contradictions_flagged` list. Audit events go to a substrate-specific audit table (Supabase `audit_log` for Supabase reads · a future `nex_dev.nex_agent.router_audit` for `nex_dev` reads). No Router call is silent.

### Rule B10 · Idempotence + observability

`request_id` is either caller-provided or Router-generated. Router returns the same `request_id` in the response, enabling end-to-end tracing.

### Rule B11 · Runtime cache visible but never authoritative

If the Router hits an in-memory hot tier, it sets `cache_layer="hot_tier_hit"`. If the cache is stale/miss, `cache_layer="hot_tier_miss"`. `physical_substrate` still names the canonical origin. Caches never claim authority (Rule 11 LAM · ADR-0308 rule 9).

## Caller identity discipline

Every method requires `caller_identity`. This exists so the audit trail can answer: *who asked what, when, from where?*

- `role`: `"nex_chat"` (customer chat surface) · `"nex1"` (software-engineering orchestrator) · `"worker"` (batch/background) · `"ui"` (admin dashboards) · `"audit"` (introspection tools)
- `instance_id`: process/session/worker identifier

Consumers may pass a service-role instance_id (e.g. `"nex_chat-conversation-abc123"`) but must never fake a different role.

## What ADR-0311 does NOT do

- ❌ Does not create any file under `src/`
- ❌ Does not create a TypeScript package
- ❌ Does not create an npm module
- ❌ Does not run any SQL
- ❌ Does not wire Chat or NEX1 into the Router
- ❌ Does not decide whether the Router is in-process TypeScript, an HTTP microservice, or something else
- ❌ Does not touch any canonical substrate
- ❌ Does not implement any of the 7 methods
- ❌ Does not open Gate 3

Each of the above requires its own ADR.

## Follow-up ADRs (numbered slots reserved)

- **ADR-0311a · Router Physical Deployment Choice** — whether Router is in-process, HTTP microservice, or Postgres extension. Doctrine.
- **ADR-0311b · Router Implementation Contract** — the reference implementation ADR that produces the first working code path. Founder-authorised gate.
- **ADR-0312 · Semantic Layer ↔ UK Trade Knowledge Bridge** — how `nex.concepts` and Supabase `knowledge_records` link when the underlying concept is the same. Doctrine.
- **ADR-0313 · Repo Orphan Homes** — where founder-authored JSON files eventually land.
- **ADR-0314 · Truth Engine Unification** — Router's contradiction-detection story across substrates.
- **ADR-0315 · Empty English Table Design Intent** — the `brain_english_grammar/lesson/practice/progress` question.
- **ADR-0316 · Main Supabase Project Decommissioning** — formal record.

## Consequences

### Positive

- **Consumers become substrate-agnostic.** Chat and NEX1 write code against the Router's shape · not against Postgres pool or Supabase client.
- **Migration becomes safe.** Moving `knowledge_records` from Supabase to `nex_dev` (if ever authorised) requires no code changes in consumers · Router redirects.
- **Contradiction detection has a natural home.** Router surfaces contradictions per response · consumers cannot ignore them silently.
- **Founder governance follows the object.** Router always returns `authority.authorised_by` when the substrate carries it.
- **Ambiguity is deterministic.** No silent guesses. Multiple candidates surface with ranked confidence.

### Negative

- **The response envelope is bigger than a raw row.** Callers pay a small serialisation cost. Trade-off is auditability + freedom from substrate churn.
- **The Router is doctrine, not code.** Chat and NEX1 still reach some substrates directly today. Rule B1-B11 apply the day the first Router call fires.
- **Cross-substrate calls may be slower** than a single-substrate call · Router doctrine allows caching, but caching is layered under Rule B11 (never authoritative).

### Rejected alternatives

- **Direct substrate access for consumers** — Rejected. Violates ADR-0310 Rule R1 (one logical architecture).
- **Router that writes as well as reads** — Rejected. Writes must flow through Guardian + Truth Engine per ADR-0309.1 Rule 11. Router as read-only surface preserves the write gate.
- **Different response envelopes per method** — Rejected. Uniform envelope is what makes consumer code substrate-agnostic.
- **Hide physical_substrate from callers** — Rejected. Rule 15 requires it be surfaced.

## Freeze status · post-ADR-0311

Unchanged. Nothing implemented. No code written.

- Hard freeze on all writes to `nex_dev`.
- Hard freeze on all writes to Supabase.
- No source files under `src/` touched.
- No new packages.
- No wiring.
- No cross-substrate copies.
- No Router implementation.
- Repo orphans untouched.
- English Brain expansion frozen (per founder 2026-09-11 directive · "stop expanding the English Brain").
- Gate 3 remains CLOSED.

## References

- ADR-0028 · NEX Intelligence Constitution
- ADR-0300 · NEX own storage migration blueprint
- ADR-0308 · English Brain v1 · semantic layer schema
- ADR-0309 · Layered architecture · Rules 1-15
- ADR-0309.1 · Logical Authority Model
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority
- `data/nex-english-source-map/reconciliation-2026-09-11.md`
- `data/nex-english-source-map/gate-2-supabase-audit.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

**End of ADR-0311 · contract doctrine only.**
**Zero code written. Zero implementation. Zero substrate touched. Freeze in force.**
