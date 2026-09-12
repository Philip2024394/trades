# 0314 · NEX Unified Truth Engine

**Status:** Proposed · governance doctrine only · database freeze remains in force · zero implementation · zero migration
**Founder:** Phillip · directive 2026-09-11 · ADR-0313 approved
**Depends on:**
- ADR-0028 · NEX Intelligence Constitution (every LLM output verified before authoritative)
- ADR-0300 · NEX own storage migration blueprint
- ADR-0309 · Layered Architecture (Rule 11 · Guardian → Truth Engine gate)
- ADR-0309.1 · Logical Authority Model (Rule 11 failure catalogue · 13 object types)
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority (Rule R4 · Router)
- ADR-0311 · Router Reference Interface (Rule B8 · writes never through Router)
- ADR-0312 · Semantic ↔ Domain Bridge (BR9 · contradictions on bridges are first-class)
- ADR-0313 · Repo Orphan Classification (OP2 · provenance follows the row · OP7 · Guardian + Truth Engine gate on import)

---

## The central question

**How does NEX apply one Truth Engine authority / governance model across all its physical knowledge substrates without creating duplicate truth systems?**

## Context

The reconciliation audits established that Truth-Engine-like primitives already run in two places, in different states of maturity, with different rule sets:

- **Supabase NEX-dedicated** · `quality-checker@677` actively detects contradictions (8 real rows) · `knowledge_feedback` (402 rows · Philip-authored governance) · `record_versions` (22) · `sources` (3625 provenance) · `confidence_scores` (4228) · explicit `authorised_by` field per record.
- **`nex_dev` Postgres** · deterministic `Guardian` at `src/lib/nex/language/guardian.ts` (built 2026-09-11) · status ladder on `nex.concepts` / `.concept_senses` / `.questions` / `.answers` · `nex.evidence` (173 provenance rows) · `nex.contradictions` schema-ready but empty · numeric 0-1 confidence.
- **Repo files** · founder authorship implicit in Git commit history · file-level `authored_by` metadata (e.g. `data/nex/human-language-map.json` declares Rule B · Rule C · anti-scrape).

Path C proved zero row-level duplicates between these substrates today. But the Truth Engines running inside them are physically distinct with **no shared rule contract**. That is the last major duplicate-brain risk: **two Truth Engines silently applying different rules would create two competing authorities**, even if the underlying content is disjoint.

ADR-0314 unifies the Truth Engine as **one logical governance system** operating over **multiple physical verifiers**. It does not replace the existing verifiers. It does not touch a single row. It defines the rule-parity contract that every current and future verifier must satisfy.

## Decision · the unified model

```
              ┌───────────────────────────────────────┐
              │        FOUNDER AUTHORITY              │
              │  · highest layer · overrides all     │
              │  · authorised_by / knowledge_feedback │
              │  · ADRs · Git commit history          │
              └────────────────┬──────────────────────┘
                               │
                               ▼
              ┌───────────────────────────────────────┐
              │        TRUTH ENGINE (logical)         │
              │  · one rule set                       │
              │  · multiple physical verifiers        │
              │  · rule-parity mandatory              │
              │  · issues promotion verdicts          │
              │  · cross-substrate contradictions     │
              └────────────────┬──────────────────────┘
                               │
                               ▼
              ┌───────────────────────────────────────┐
              │        GUARDIAN (deterministic)       │
              │  · pre-Truth-Engine check             │
              │  · never LLM                          │
              │  · shape / schema / provenance /       │
              │    format / duplicate / unsupported   │
              └────────────────┬──────────────────────┘
                               │
                               ▼
              ┌───────────────────────────────────────┐
              │        KNOWLEDGE ROUTER               │
              │  · read-only surface (ADR-0311)       │
              │  · surfaces physical_substrate         │
              │  · surfaces truth_status               │
              │  · surfaces contradictions_flagged     │
              └────────────────┬──────────────────────┘
                               │
                               ▼
              ┌───────────────────────────────────────┐
              │      PHYSICAL SUBSTRATES              │
              │  nex_dev · Supabase · repo · caches   │
              │  · storage-only concerns              │
              │  · never authoritative alone          │
              └───────────────────────────────────────┘
```

**One logical NEX brain. One unified governance stack. Multiple physical substrates.**

## The 12 unifying rules

### Rule TE1 · One promotion ladder

Every canonical knowledge object in NEX follows the same status transition sequence regardless of substrate:

```
draft → guardian_ok → truth_engine_ok → authoritative
                                           │
                                           ├── deprecated (reversible · versioned)
                                           └── contradicted (unresolved contradiction · read allowed with warning)
```

Substrate-specific status enums (e.g. Supabase `DRAFT / UNDER_REVIEW / AUTHORITATIVE / DEPRECATED`) map to this canonical ladder:

| Canonical | Supabase equivalent | `nex_dev` equivalent |
|---|---|---|
| `draft` | `DRAFT` | `draft` |
| `guardian_ok` | (implicit · pre-review pass) | `guardian_ok` |
| `truth_engine_ok` | `UNDER_REVIEW` (Truth-Engine-approved but awaiting founder authorisation) | `truth_engine_ok` |
| `authoritative` | `AUTHORITATIVE` | `authoritative` |
| `deprecated` | `DEPRECATED` | `deprecated` |
| `contradicted` | (soft · surfaces via `contradictions` join) | `contradicted` |

Router normalises to canonical values in every response (ADR-0311 Rule B4 · confidence unification pattern applied to status).

### Rule TE2 · Guardian is deterministic

Guardian is a pure function of the object shape · schema · provenance presence · format · known-bad patterns. Zero LLM. Zero non-determinism. Same input · same verdict · every time. This mirrors the existing `src/lib/nex/language/guardian.ts` design and constrains any future Guardian to the same standard.

Guardian's checks (locked · additions require ADR):
- Shape validation (fields present · types correct · enum values in range)
- Schema compliance (foreign keys resolve · required fields non-null)
- Provenance presence (every object promoted past `draft` must have an evidence row)
- Format / naming (canonical_key snake_case · sense_key stable id · etc.)
- Duplicate detection within substrate (same canonical_key twice · same sense_key on same concept)
- Unsupported-claim detection (any authoritative row lacking `source_ref` is rejected)
- Hallucination signal (references to files/tables/APIs that don't exist)
- Terminology consistency (sense_key follows `<concept>.<snake_case>` convention)

### Rule TE3 · One Truth Engine rule-set · multiple physical verifiers

The Truth Engine is **one logical rule set**. Physical verifiers implement it. Today's two verifiers (Supabase `quality-checker@677` · a future `nex_dev` verifier — not yet built) are two instances of the same logical Truth Engine. **Rule parity is mandatory.**

Adding a new physical verifier requires an ADR that either:
- Certifies the new verifier implements the same rule set (rule-parity ADR), OR
- Explicitly names a defined subset the new verifier implements and marks it as verifier-scoped (partial-verifier ADR).

Silent addition of a verifier with a different rule set is forbidden. A silent divergence is exactly the "duplicate truth authority" failure mode this ADR prevents.

### Rule TE4 · Founder Authority is the highest layer

Founder Authority overrides the Truth Engine. Concretely:

- **Explicit authorisation** · `authorised_by = "Philip"` on a Supabase `knowledge_records` row promotes to `AUTHORITATIVE` even if Truth Engine has not signed off (this is the current Supabase pattern · preserved by this ADR).
- **Explicit override** · a `knowledge_feedback` row from `feedback_source = "philip"` with `feedback_kind ∈ {"promotion" | "deprecation" | "override"}` supersedes any Truth Engine verdict on the referenced object.
- **ADRs override rule-set changes** · every rule modification to Guardian or Truth Engine happens via ADR · never via runtime configuration.

Founder Authority always leaves an audit trail. Overrides are never silent.

### Rule TE5 · Provenance is required for any object reaching `authoritative`

No exceptions. Every `authoritative` object must have a matching provenance row (Supabase `sources` · `nex.evidence` · repo file `authored_by` metadata). LAM Rule 5 applies universally.

Objects lacking provenance can reach `guardian_ok` (Guardian may pass shape checks) but never `truth_engine_ok` or `authoritative` without provenance being attached.

### Rule TE6 · Contradictions are first-class per object · substrate-agnostic

A contradiction is a first-class object (LAM object type 8). Every physical verifier writes contradictions to its own contradiction store today (Supabase `contradictions` · future `nex_dev.nex.contradictions`). The unified Truth Engine treats them as **one logical contradiction pool** indexed by the objects they reference.

Router surfaces `contradictions_flagged[]` (ADR-0311) on every response that touches a contradicted object, regardless of which physical verifier detected it. Chat and NEX1 see the same warnings.

### Rule TE7 · Cross-substrate contradictions are first-class

If a `nex.concepts` sense and a Supabase `knowledge_records` article disagree on the same subject (via a bridge, per ADR-0312), that is a cross-substrate contradiction. It is real. It must be detected.

Detecting cross-substrate contradictions requires either:
- A dedicated cross-substrate verifier that reads through the Router (Router-side detection), OR
- Founder / reviewer flagging via `knowledge_feedback` with a `contradiction` kind.

Silent tolerance of cross-substrate contradictions is forbidden. Router MUST surface any known cross-substrate contradiction on the objects involved.

### Rule TE8 · Confidence is normalised at Router boundary · Truth Engine reads normalised values

Router already normalises confidence to numeric 0-1 (ADR-0311 Rule B4). Truth Engine rule evaluation always operates on normalised confidence. This prevents rule-writing errors caused by mixing 0-100 integers with 0-1 numerics.

### Rule TE9 · Substrate unreachable never falls back to fabrication

If a substrate is unreachable at read time, Router returns `unknown=true` with `unknown_reason="substrate_unreachable"` (ADR-0311 Rule B6).

At **write time**, if a promotion depends on data from an unreachable substrate (e.g. Truth Engine needs to check whether a Supabase `knowledge_records` row exists to promote a bridge to authoritative, and Supabase is down), the promotion **is blocked** and the object stays at its current status. The verdict never falls back to fabricated existence.

### Rule TE10 · Deprecation is reversible · versioned

Deprecation is a status change · not deletion. Every `deprecated` object retains its full history · full provenance · full evidence chain. Un-deprecation is possible via founder authorisation.

Deletion is never a Truth Engine outcome. Only founder authority (via an explicit ADR) can authorise deletion of canonical rows. Truth Engine may only mark them `deprecated`.

### Rule TE11 · Truth Engine never writes to canonical substrates directly

Truth Engine issues verdicts. Verdicts trigger substrate-specific write paths (Postgres `UPDATE nex.concepts SET status = ...` · Supabase `PATCH /rest/v1/knowledge_records`). Those write paths are audit-logged and Guardian-checked. The Truth Engine itself is a decision layer, not a writer.

This means: no Router mutation, no bulk Truth Engine promotion job, no verifier-side write on canonical rows outside the substrate-specific write path.

### Rule TE12 · Every promotion emits an audit event

Every status transition (`draft → guardian_ok → truth_engine_ok → authoritative → deprecated → contradicted`) emits a durable audit event containing:

- `object_stable_id`
- `object_logical_type` (LAM type)
- `physical_substrate`
- `prior_status`
- `new_status`
- `verdict_by` (Guardian instance · Truth Engine verifier · founder identity)
- `evidence_ref` (justifying evidence · required for promotion into authoritative)
- `timestamp`
- `override` flag (true if a founder authorisation bypassed Truth Engine)

Existing audit substrates (Supabase `audit_log` · 20,224 rows) already do this for Supabase. A future `nex_dev.nex_agent.truth_engine_audit` mirrors the pattern for `nex_dev`. Both flow into the same logical audit stream · Router does not filter.

## Cross-substrate governance responsibilities matrix

For each LAM logical object type · which layer applies what governance?

| Logical object | Guardian check | Truth Engine verdict | Founder authority | Where written today |
|---|---|---|---|---|
| Language (words) | shape / POS enum / CEFR / duplicate word_normalised | promotion requires provenance | `flagged_for_review = false` transition | `nex_dev.nex.brain_english_vocabulary` |
| Semantic (concepts · senses · contexts · relationships) | shape / canonical_key regex / sense_key regex / provenance / duplicate | promotion requires evidence + no unresolved contradictions | ADRs 0308 · 0309 · 0309.1 | `nex_dev.nex.*` |
| People-Say | Rule B (no AI authored) / Rule C (attributable origin) / anti-scrape | Truth Engine cannot promote AI-authored entry · founder-only path | Every entry is founder-authored | Repo `data/nex/human-language-map.json` today · future ADR-0313a home |
| Domain Knowledge record | shape / status enum / authored_by present / body_markdown non-empty | promotion requires provenance chain (sources) + no unresolved contradiction | Supabase `authorised_by = Philip` field · `knowledge_feedback` | Supabase `knowledge_records` (UK Trades) · `nex_dev.nex.brain_*` (Indonesia) |
| Provenance | source_ref non-null · trust_layer in enum | provenance itself is never promoted (LAM Rule 5) | founder may add provenance manually | Supabase `sources` · `nex.evidence` · per-field provenance tables |
| Governance (founder judgment) | feedback_source == authorised founder identity | governance rows are themselves authority · Truth Engine may not overrule | self · always authoritative | Supabase `knowledge_feedback` · repo commit history |
| Truth Engine verdict | verifier identity resolvable · rule-parity certification exists (Rule TE3) | verdicts are outputs · not further promoted | founder can override any verdict | Substrate-specific audit tables |
| Contradiction | shape / references resolve | Truth Engine outputs contradictions · promotes/demotes objects based on them | founder resolves via `knowledge_feedback` | Supabase `contradictions` · `nex.contradictions` (schema-ready) |
| Confidence | numeric range / scale metadata | promotion floor per object type (e.g. authoritative ≥ 0.7) | founder may override any confidence | Substrate-inline + Supabase `confidence_scores` |
| Version | version_id present · supersedes chain valid | version rows are immutable · not promoted | founder may deprecate old versions | Supabase `record_versions` · Git for repo |
| Runtime cache | never promoted · rebuildable check | Truth Engine may not run against runtime | founder does not review runtime | `nex.question_variant` · `nex.semantic_question_index` · hot tiers |
| Competency | segregated from knowledge | Truth Engine does not touch competency | founder controls tier promotion gates | `nex_dev.nex_agent.*` |
| Authorisation | ADR text · doctrine · rule schema | Truth Engine may propose · founder authors | founder-only | `docs/DECISIONS/*.md` · `rules/*.md` |
| Bridge reference (ADR-0312) | source resolves · target resolves · relation_kind in enum · confidence in range | promotion requires evidence + bidirectional integrity check | founder authorises bridge status | Future `nex.bridge_references` (ADR-0312a decides) |

Nothing in this matrix is a new capability. It is a **consolidation of current practice into one governance contract.**

## The two idioms that already exist · reconciled

### Idiom 1 · Supabase `quality-checker@677`

- Actively runs (8 contradictions detected 2026-08-06)
- Uses Supabase status enum (DRAFT / UNDER_REVIEW / AUTHORITATIVE / DEPRECATED)
- Governance via `authorised_by` field + `knowledge_feedback`
- Integer confidence 0-100 · `confidence_scores` table
- Version history in `record_versions`

**Under this ADR:** `quality-checker@677` remains authoritative Truth Engine verifier for objects in `supabase.knowledge_records`. Its rule set becomes part of the unified rule set. Any rule it applies must be documented in the rule-parity ADR (a follow-up).

### Idiom 2 · `nex_dev` Guardian + status enums

- `src/lib/nex/language/guardian.ts` (2026-09-11 · built by Master AI Engineer)
- Uses status enum (draft / guardian_ok / truth_engine_ok / authoritative / deprecated / contradicted)
- Provenance via `nex.evidence` (173 rows)
- Numeric confidence 0-1
- No Truth Engine verifier running yet (Guardian only)

**Under this ADR:** `nex_dev` Guardian is one instance of the unified Guardian. A future `nex_dev` Truth Engine verifier is needed to promote objects past `guardian_ok`. Until it exists, `nex_dev` semantic objects may reach `guardian_ok` but not `truth_engine_ok` without founder direct authorisation.

### Idiom 3 · Repo commit history + file-level `authored_by`

- Founder-authored files (`human-language-map.json` · FAQ JSONLs · intent phrasings) carry provenance in file metadata + Git commits
- No verifier runs · no status ladder inside the files

**Under this ADR:** repo files are treated as canonical for their content (per ADR-0313 classification). Guardian runs at import time (if/when an orphan is imported per ADR-0313a-e). Truth Engine verdict on repo content is delivered by founder authorship + Git commit history. There is no separate verifier over the repo · founder authorship IS the verdict.

## What ADR-0314 does NOT do

- ❌ Does not build a new Truth Engine verifier for `nex_dev`.
- ❌ Does not modify `quality-checker@677` in Supabase.
- ❌ Does not create any new table.
- ❌ Does not migrate any row.
- ❌ Does not synchronise Supabase and `nex_dev` audit logs.
- ❌ Does not draft the rule-parity certification for existing verifiers (that's a follow-up ADR-0314a).
- ❌ Does not build the cross-substrate contradiction detector.
- ❌ Does not decide how the Truth Engine verdicts are physically stored (that's a follow-up ADR-0314b).
- ❌ Does not import any repo orphan.
- ❌ Does not open Gate 3.

## Follow-up ADRs (numbered slots · each founder-authorised)

- **ADR-0314a · Rule Parity Certification** — enumerate the specific rules `quality-checker@677` applies · certify equivalence with the future `nex_dev` verifier · lock any deltas as verifier-scoped subsets. Doctrine.
- **ADR-0314b · Truth Engine Verdict Storage** — where the unified verdict trail lives when new verdicts fire (co-located per substrate · or a dedicated substrate). Doctrine.
- **ADR-0314c · Cross-Substrate Contradiction Detection** — Router-side detector that compares bridged objects and flags contradictions between substrates. Doctrine.
- **ADR-0314d · Founder Override Audit Discipline** — the specific fields and audit shape when founder overrides Truth Engine. Doctrine.
- **ADR-0314e · `nex_dev` Truth Engine Verifier Implementation** — the first working `nex_dev` verifier (parallel to `quality-checker@677`). Gate 3 candidate — first ADR in the arc that involves executable code.

## Consequences

### Positive

- **One logical Truth Engine · multiple physical verifiers.** Prevents duplicate truth authorities.
- **Guardian rules unified.** Every substrate gets the same shape / provenance / hallucination-signal checks.
- **Founder Authority preserved as the highest layer.** No Truth Engine change can silently override a founder judgment.
- **Cross-substrate contradictions become detectable.** Rule TE7 makes silent tolerance forbidden.
- **Rule parity is explicit.** Adding a new verifier requires an ADR · not a runtime config change.
- **Confidence idioms unified at the Router boundary** (already ADR-0311 · reinforced here).

### Negative

- **Two idioms still coexist physically** until ADR-0314a certifies rule parity and ADR-0314e implements the `nex_dev` verifier. During the interim, `nex_dev` semantic objects can only reach `guardian_ok` autonomously.
- **Cross-substrate contradiction detection remains a doctrine, not a running check.** ADR-0314c would build it. Until then, cross-substrate contradictions rely on founder reviewer flagging.
- **The rule set becomes contract-heavy.** Every new verifier must certify parity. Some agility trade-off for consistency.

### Rejected alternatives

- **Replace `quality-checker@677` with a new `nex_dev` verifier and abandon Supabase Truth Engine** — Rejected. Path C proved 8 real contradictions detected · abandoning would lose Truth Engine coverage of 3,627 knowledge_records + 402 knowledge_feedback rows.
- **Let each substrate have its own independent Truth Engine forever** — Rejected. Creates the exact "duplicate truth authority" failure mode ADR-0314 exists to prevent.
- **Move all verdicts into a single Postgres table** — Rejected. Would require Supabase `audit_log` migration (20,224 rows) · violates ADR-0310 Rule R3 principle that existing substrates stay put unless migration is justified.
- **Make Truth Engine autonomous of founder** — Rejected. Violates ADR-0309.1 governance rules · founder authorship is the highest layer.

## Open founder decisions (unblock follow-up ADRs · not gate this ADR)

1. **When does ADR-0314a (Rule Parity Certification) draft?** — Requires enumerating `quality-checker@677`'s current rules. Founder decides trigger.
2. **Where do unified verdicts physically live?** — ADR-0314b · options: per-substrate (current) or a new dedicated substrate.
3. **Timing for ADR-0314e (nex_dev Truth Engine implementation)** — this is the first execution ADR in the arc · founder decides when Gate 3 opens.
4. **Cross-substrate contradiction detector priority** — ADR-0314c · founder decides urgency.

## Freeze status · post-ADR-0314

Unchanged.

- Hard freeze on writes to `nex_dev`.
- Hard freeze on writes to Supabase.
- No `nex_dev` Truth Engine verifier built.
- No `quality-checker@677` modification.
- No new tables.
- No rule-parity certification yet (ADR-0314a).
- No cross-substrate contradiction detector (ADR-0314c).
- No override audit discipline yet (ADR-0314d).
- No physical verdict storage yet (ADR-0314b).
- No orphan imports.
- No bridge rows.
- Repo orphans untouched.
- English Brain expansion permanently frozen (founder directive 2026-09-11).
- Gate 3 remains CLOSED.

## The doctrine arc so far

```
0308   English Brain v1 · semantic schema
0309   Layered Architecture · Rules 1-15
0309.1 Logical Authority Model · 13 object types
0310   Knowledge Router + Multi-Substrate Domain Authority  ✅
0311   Router Reference Interface (7 methods · universal envelope)  ✅
0312   Semantic ↔ Domain Bridge (reference not copy)  ✅
0313   Repo Orphan Classification (2-axis · OP1-OP7)  ✅
0314   Unified Truth Engine (this ADR · 12 rules)  ← today
0314a  Rule Parity Certification                    (reserved)
0314b  Truth Engine Verdict Storage                 (reserved)
0314c  Cross-Substrate Contradiction Detection      (reserved)
0314d  Founder Override Audit Discipline            (reserved)
0314e  nex_dev Truth Engine Verifier Implementation (reserved · Gate 3 candidate)
0313a  People-Say Physical Home                     (reserved · executes AFTER 0314 doctrine)
0313b  FAQ Physical Home                            (reserved · executes AFTER 0314 doctrine)
0313c  Intent Phrasing Role + Home                  (reserved)
0313d  Staircase Symptoms Expert Authoring          (reserved)
0313e  Guardian Rules for Orphan Import             (reserved)
0315   Empty English Tables                         (reserved)
0316   Main Supabase Decommissioning                (reserved)
```

## References

- ADR-0028 · NEX Intelligence Constitution (constitutional foundation)
- ADR-0300 · NEX own storage migration blueprint
- ADR-0308 · English Brain v1
- ADR-0309 · Layered Architecture · Rules 1-15
- ADR-0309.1 · Logical Authority Model
- ADR-0310 · Knowledge Router + Multi-Substrate Domain Authority
- ADR-0311 · Router Reference Interface
- ADR-0312 · Semantic ↔ Domain Bridge
- ADR-0313 · Repo Orphan Classification
- `data/nex-english-source-map/reconciliation-2026-09-11.md`
- `data/nex-english-source-map/gate-2-supabase-audit.md`
- `data/nex-english-source-map/path-c-overlap-analysis-2026-09-11.md`

---

**End of ADR-0314 · governance doctrine only.**
**Zero code written. Zero verifier built or modified. Zero rows written. Zero migration.**
**Freeze in force across all substrates.**
