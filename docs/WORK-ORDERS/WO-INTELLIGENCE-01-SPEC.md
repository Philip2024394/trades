# WO-INTELLIGENCE-01 · NEX Intelligence Discovery Core (vertical slice)

**Founder-authorised for SPECIFICATION 2026-09-13. Execution NOT yet authorised — that authorisation is the explicit gate at the end of this document.**

**Doctrine anchor:** P-S v2 (external LLM banned as authority/execution/truth; NEX-owned intelligence mechanisms permitted under existing WO gate + evidence + safety architecture).

**Programme track:** New parallel track distinct from WO-WORKSTATION-01..15. May run in parallel with WO-WORKSTATION-14 (authority adversarial) and WO-WORKSTATION-15 (crash/restart durability) — Guardian (Phase 14) is NOT a prerequisite because the authority boundary alone protects.

---

## 1 · Purpose

Prove the machinery that will eventually produce NEX Super Intelligence — not by trying to reach Super Intelligence in the first slice, but by demonstrating that the underlying pipeline is real, deterministic, reproducible, and evidence-backed.

The founder acceptance question:
> "Can NEX discover a technically meaningful relationship or improvement from multiple independent pieces of knowledge, test the resulting hypothesis, retain the evidence, and deterministically classify the result?"

If the answer is YES with real evidence, WO-INTELLIGENCE-01 is complete.

## 2 · Non-goals

- **Not** a general web-search feature
- **Not** an AI chatbot
- **Not** an LLM adapter (P-S v2)
- **Not** a system that grants NEX new capability (P-Q / P-U)
- **Not** a system that touches the substrate (WO-13)
- **Not** an attempt to prove Super Intelligence in the first slice
- **Not** a manually-curated knowledge base — promotion is deterministic
- **Not** authorised to sign its own WOs

## 3 · Doctrinal alignment

| Principle | How WO-INTELLIGENCE-01 honours it |
|---|---|
| P-Q · correction never creates authority | Discovery/hypothesis/experiment produce proposals only; no capability is activated without a founder-signed WO |
| P-U · more intelligence ≠ more authority | Even if the SUPER_INTELLIGENCE_LIBRARY contains 10,000 objects, NEX cannot execute any of them without WO signature |
| P-S v2 · no external LLM as authority/execution/truth | Zero external LLM SDK imports in the substrate or the Intelligence pipeline. Discovery/hypothesis/experiment engines are deterministic (rule-based, statistical, symbolic) |
| P-M · marketing framing discipline | SUPER_INTELLIGENCE_LIBRARY is an internal tier name only. No external claim of "world's most intelligent" or "surpasses OpenAI" is authorised |
| WO-13 · substrate integrity | Intelligence subsystem lives OUTSIDE the substrate integrity scope; any attempt by Intelligence to touch a substrate file is caught by WO-13 |
| P-V / P-W · Guardian architecture | Intelligence never grants capability; when Phase 14 Guardian ships, it will observe Intelligence's health signals |

## 4 · Architecture

```
                       INTERNET (arXiv API only, this slice)
                                  │
                                  ▼
                     ┌───────────────────────┐
                     │ Authorised Crawler    │ ◄── Broker-gated, GET-only,
                     │ Manifest              │     allowlist: [arxiv.org]
                     │ (per-source signed)   │     rate-limited, provenance-hashed
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ Ingestion             │ ◄── deterministic parse,
                     │ (deterministic)       │     dedupe by content hash,
                     │                       │     extract (title, abstract, authors, refs)
                     └───────────┬───────────┘
                                 ▼
                ┌────────────────┴────────────────┐
                ▼                                 ▼
        ┌───────────────┐                 ┌───────────────┐
        │ NEW knowledge │                 │ OLD knowledge │  ◄── Intelligence Library
        │ (this cycle)  │                 │ (existing)    │      + stub for the first cycle
        └───────┬───────┘                 └───────┬───────┘
                └───────────────┬─────────────────┘
                                ▼
                     ┌───────────────────────┐
                     │ DISCOVERY ENGINE      │
                     ├───────────────────────┤
                     │  · pattern find       │  ◄── term co-occurrence,
                     │  · conflict find      │      citation-graph relationships,
                     │  · connection find    │      keyword-cluster analysis
                     │  · combinatorial      │      (all deterministic algorithms)
                     │    synthesis          │
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ HYPOTHESIS ENGINE     │  ◄── deterministic hypothesis generation
                     │                       │      from (pattern, conflict, connection):
                     │                       │      → testable claim
                     │                       │      → expected outcome
                     │                       │      → measurable success criterion
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ EXPERIMENT ENGINE     │  ◄── sandboxed real subprocess,
                     │                       │      bounded time + resource budget,
                     │                       │      captures success/failure/limitation
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ EVIDENCE              │  ◄── content-hashed, provenance-chained,
                     │ (GB-persisted jsonl)  │      persisted via existing WO-08 pattern
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ SCORING ENGINE        │  ◄── deterministic scoring:
                     │                       │      · reproducibility
                     │                       │      · source independence
                     │                       │      · confidence
                     │                       │      · correlation w/ existing objects
                     │                       │      · generalisability
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ PROMOTION GATE        │  ◄── deterministic thresholds
                     │ (pure function)       │      Intelligence / Super Intelligence
                     │                       │      (see §6 promotion criteria)
                     └───────────┬───────────┘
                                 ▼
                    ┌────────────┴──────────────┐
                    ▼                           ▼
        ┌────────────────────┐    ┌───────────────────────────┐
        │ INTELLIGENCE       │    │ SUPER_INTELLIGENCE        │
        │ LIBRARY            │    │ LIBRARY                   │
        │ (broad, tested)    │    │ (highest-value synthesis, │
        │                    │    │  principles, combined     │
        │                    │    │  discoveries)             │
        └──────────┬─────────┘    └────────┬──────────────────┘
                   └──────────────┬────────┘
                                  ▼
                   ┌───────────────────────────┐
                   │ Proposal Generator        │  ◄── emits WO drafts to
                   │                           │      founder inbox
                   │                           │      NEVER signs / activates
                   └──────────────┬────────────┘
                                  ▼
                        ═══════════════════════
                        FOUNDER WO GATE (unchanged)
                        ═══════════════════════
                                  ▼
                   ┌───────────────────────────┐
                   │ NEX1 Engineer,            │  ◄── reads only APPROVED
                   │ Master AI, Specialists    │      knowledge for
                   │                           │      engineering decisions
                   └───────────────────────────┘
```

## 5 · Data model

### 5.1 · SourceRecord (crawler output, immutable)

```typescript
interface SourceRecord {
  record_type: "NEX_INTELLIGENCE_SOURCE";
  source_id: string;                    // content-hash-derived
  crawler_manifest_entry_id: string;    // which authorised source this came from
  fetched_at: string;                   // ISO
  fetch_url: string;                    // exact URL fetched
  content_hash_sha256: string;
  content_bytes: number;
  content_type: string;                 // e.g. "application/atom+xml"
  raw_content_ref: string;              // path to immutable raw store
  provenance_chain_hash: string;
}
```

### 5.2 · KnowledgeObject (the core artefact)

```typescript
type KnowledgeStatus =
  | "DISCOVERED"           // seen once, no evaluation yet
  | "PROPOSED"             // has hypothesis + limited evidence
  | "TESTED"               // has experiment evidence, insufficient for graduation
  | "APPROVED"             // meets Intelligence Library thresholds; awaiting founder WO
  | "PRODUCTION"           // founder-signed WO has authorised use in engineering
  | "SUPER_INTELLIGENCE_CANDIDATE"  // meets STRICT criteria; awaiting founder WO
  | "SUPER_INTELLIGENCE"           // founder-signed WO has authorised as Super Intelligence
  | "DEPRECATED";          // superseded / contradicted by later evidence

interface KnowledgeObject {
  record_type: "NEX_INTELLIGENCE_KNOWLEDGE_OBJECT";
  knowledge_id: string;                       // stable identifier
  version: number;                            // incremented on evidence update
  name: string;                               // human-readable, e.g. "PDF_TABLE_EXTRACTION_V4"
  created_at: string;
  updated_at: string;
  domain: string;                             // "software-engineering", "automated-program-repair", ...
  source_evidence: readonly {
    source_id: string;                        // FK → SourceRecord
    excerpt_hash: string;
    relevance_score: number;                  // 0..1
  }[];
  experiments: readonly {
    experiment_id: string;                    // FK → ExperimentRecord
    outcome: "SUCCESS" | "FAILURE" | "LIMITATION";
    evidence_hash: string;
  }[];
  limitations: readonly { case: string; severity: "low" | "moderate" | "high" }[];
  recommended_use: readonly string[];
  agent_capability_affected: string | null;
  confidence: number;                         // 0..1, deterministic score
  reproducibility_score: number;              // 0..1
  correlation_count: number;                  // # of existing objects this correlates with
  generalisation_passed: boolean;
  status: KnowledgeStatus;
  supersedes: readonly string[];              // knowledge_ids this replaces
  superseded_by: readonly string[];
  synthesised_from: readonly string[];        // knowledge_ids combined to produce this (combinatorial)
  authorised_by: string | null;               // Founder WO id, null until signed
  authorising_wo_id: string | null;
  revisit_scheduled_at: string | null;
  provenance_chain_hash: string;              // covers all fields above
}
```

### 5.3 · HypothesisRecord

```typescript
interface HypothesisRecord {
  record_type: "NEX_INTELLIGENCE_HYPOTHESIS";
  hypothesis_id: string;
  formed_at: string;
  formed_from: readonly string[];             // knowledge_ids (combinatorial input)
  discovery_pattern: "pattern" | "conflict" | "connection" | "combination";
  claim: string;                              // testable claim, deterministic-serialisation
  expected_outcome: unknown;                  // machine-comparable
  measurable_criterion: string;
  provenance_chain_hash: string;
}
```

### 5.4 · ExperimentRecord

```typescript
interface ExperimentRecord {
  record_type: "NEX_INTELLIGENCE_EXPERIMENT";
  experiment_id: string;
  hypothesis_id: string;
  run_at: string;
  sandbox_id: string;                         // Broker-provided sandbox
  test_cases: readonly { case_id: string; input_hash: string }[];
  outcomes: readonly { case_id: string; expected: unknown; actual: unknown; matched: boolean }[];
  success_count: number;
  failure_count: number;
  limitation_count: number;
  runtime_ms: number;
  resource_usage: { cpu_ms: number; memory_bytes: number };
  provenance_chain_hash: string;
}
```

## 6 · Promotion criteria (deterministic, pure function)

Same evidence → same promotion decision, every time. Auditable.

| Criterion | Intelligence Library threshold | Super Intelligence Library threshold |
|---|---:|---:|
| Independent source count | ≥ 3 | ≥ 7 |
| Successful experiments / total | ≥ 5/6 | ≥ 10/11 |
| Unreproducible failures | 0 | 0 |
| Correlations with existing objects | ≥ 1 | ≥ 3 |
| Generalisation test passed | narrow set | held-out set |
| Contradictions | resolved with evidence | zero unresolved |
| Confidence score | ≥ 0.80 | ≥ 0.95 |
| Reproduced by NEX in its own experiment | not required | REQUIRED |
| Combinatorial synthesis from multiple objects | not required | REQUIRED for structural principles |

If ALL criteria for the target tier are met, `promote(knowledgeObject)` returns the new status. If ANY criterion fails, the object stays in its current tier. Promotion is NEVER manual and NEVER carries authority — it only changes an internal enum. Activation for engineering use still requires a founder-signed WO.

## 7 · Vertical slice scope (first cycle)

Following the founder's "one tiny real proof" discipline. One source, one narrow domain, one full cycle end-to-end, real evidence.

### 7.1 · Source

**arXiv API** · `http://export.arxiv.org/api/query`

Restricted to categories:
- `cs.SE` (software engineering)
- `cs.PL` (programming languages)
- `cs.LG` restricted to sub-queries mentioning "program repair" or "agentic" or "autonomous programming"

Only these categories. Only Atom feed responses. Only public metadata + abstracts (no PDF fetch in slice 1 — defer to slice 2).

Crawler manifest entry (signed by founder before first fetch):
```jsonc
{
  "manifest_entry_id": "arxiv-swe-2026-09-13",
  "authorised_hosts": ["export.arxiv.org"],
  "authorised_paths": ["/api/query"],
  "authorised_methods": ["GET"],
  "rate_limit_requests_per_minute": 20,
  "authorised_categories": ["cs.SE", "cs.PL"],
  "authorised_query_predicates": ["program repair", "agentic", "autonomous programming", "automated program repair", "agentic software engineering"],
  "provenance_required": true,
  "authorising_wo_id": "wo-intelligence-01",
  "founder_signature_hex": "<Ed25519 signature over canonical form>",
  "expires_at": "<ISO>"
}
```

### 7.2 · Ingestion

- Parse Atom feed deterministically
- Extract per-paper: id, title, abstract, authors, categories, published_at, primary_category, references (if present)
- Content-hash each parsed paper
- Dedupe by paper id + content hash

### 7.3 · Discovery cycle

Run all four discovery modes at least once:
- **Pattern:** find ≥ 3 papers using a common technical term or method (deterministic keyword-cluster + term-frequency analysis)
- **Conflict:** find ≥ 1 pair of papers making contradictory claims about the same method (rule-based semantic-role tagging + polarity check on measured claims)
- **Connection:** find ≥ 1 citation-graph or shared-author relationship linking otherwise-independent findings
- **Combination:** synthesise ≥ 1 hypothesis from 2+ knowledge objects (the founder-highlighted pattern: A + B + C → new hypothesis)

### 7.4 · Hypothesis

At least ONE testable claim, with:
- expected outcome (machine-comparable)
- measurable criterion
- link back to source knowledge

Example (illustrative, actual claim decided at run-time by the deterministic Hypothesis Engine):
- Claim: "The `Cannot find module` stderr pattern (WO-07 file-not-found rule) reproduces on every published `node --check` case where the target file is absent, across Node versions v20–v24"
- Expected outcome: `parseNodeSyntaxError` returns a `file-not-found` finding
- Measurable criterion: ≥ 90% match on the test set

### 7.5 · Experiment

Real subprocess. Real test cases. Bounded time + resource. Sandboxed via Broker.

Example (illustrative):
- Test set: 5–10 test cases assembled from published examples in the arXiv papers + WO-07's existing corpus
- Run `parseNodeSyntaxError` against each stderr
- Record matched / not matched
- Compute success rate

### 7.6 · Evidence + scoring + promotion

- Persist SourceRecord, HypothesisRecord, ExperimentRecord to GB storage (jsonl, following WO-08 pattern)
- Compute deterministic score
- Promote (or not) to Intelligence Library based on §6 thresholds
- If STRICT thresholds met AND ≥ 3 knowledge objects combined AND generalisation passes, mark as SUPER_INTELLIGENCE_CANDIDATE
- Emit a proposal to founder inbox (a jsonl append + a human-readable summary)

### 7.7 · What "done" looks like

1. Real arXiv fetch produces ≥ 20 real SourceRecords
2. Ingestion produces ≥ 20 knowledge fragments
3. Discovery Engine produces ≥ 1 pattern + ≥ 1 combination-based synthesis
4. Hypothesis Engine produces ≥ 1 testable claim
5. Experiment Engine runs a real subprocess and produces ≥ 1 ExperimentRecord with 5-10 test cases
6. Scoring produces a deterministic score
7. At least ONE KnowledgeObject reaches at least `PROPOSED` status; the run's proposal is emitted to a founder-visible inbox
8. Every artefact carries a provenance chain hash
9. Zero external LLM SDK imports anywhere in the pipeline
10. Every adversarial test (see §8) passes

## 8 · Adversarial acceptance tests (following the WO-13 pattern)

Every test is of the form: **secretly try to grow authority → assert NEX refuses.**

1. **Intelligence writes KnowledgeObject with `status: PRODUCTION` and `authorised_by: null`** → write refused
2. **Crawler fetches URL not in authorised manifest** → Broker refuses
3. **Intelligence tries to add a URL to its own crawler manifest** → refused (manifest expansion = founder WO only)
4. **Discovery / Hypothesis / Experiment engines attempt to modify substrate files** → WO-13 detects
5. **Experiment Engine tries to write outside its sandbox** → Broker refuses
6. **Promotion algorithm produces PRODUCTION or SUPER_INTELLIGENCE for below-threshold evidence** → property-based test asserts impossible
7. **Intelligence tries to sign a WO** → no signing key access, refused
8. **Scoring engine tries to inflate confidence without new evidence** → refused (score is pure function of evidence)
9. **Crawler performs POST/PUT/DELETE** → refused (crawler is GET-only by construction)
10. **Crawler exceeds rate limit** → Broker refuses further requests
11. **Ingestion accepts content that fails content-hash verification** → refused
12. **A DEPRECATED KnowledgeObject is silently elevated to PRODUCTION by the revisit loop** → refused
13. **Combinatorial synthesis attempts to combine knowledge from outside the founder-authorised domain** → refused
14. **Any adversarial input to arXiv API produces a non-arxiv host redirect** → Broker rejects on host mismatch
15. **Provenance chain hash is broken (single-byte tamper)** → detected on next read
16. **Zero external-LLM SDK imports** → grep-based test fails CI if `openai`, `anthropic`, `@anthropic-ai`, `claude`, `cohere`, `mistral`, `gemini`, `bedrock` appears anywhere in the intelligence subsystem

## 9 · Evidence + provenance requirements

Every intelligence artefact carries:
- `record_type` (typed)
- `*_id` (unique)
- Content-addressable hashes (SHA-256) where applicable
- `provenance_chain_hash` — SHA-256 over the canonical form of the record's antecedents

The Intelligence subsystem uses the existing WO-08 storage pattern (jsonl per collection) — no new storage abstraction. Collections:
- `nex_intelligence_sources`
- `nex_intelligence_knowledge_objects`
- `nex_intelligence_hypotheses`
- `nex_intelligence_experiments`
- `nex_intelligence_proposals`
- `nex_intelligence_crawler_audit`

## 10 · Explicit non-authorisation

WO-INTELLIGENCE-01 does not authorise:

- Adding new crawler sources (each requires its own founder-signed WO)
- Promoting any object to `PRODUCTION` or `SUPER_INTELLIGENCE` (each requires a founder-signed WO)
- Modifying `wo13-integrity.ts` scope to include intelligence files (deliberately out of scope)
- Signing WO drafts on behalf of the founder
- Using any external LLM SDK
- Making any claim of external superiority ("world's most intelligent", "surpasses X")
- Bundling with WO-INTELLIGENCE-02..N in the same commit
- Consuming knowledge in NEX1 Engineer decisions until the specific KnowledgeObject has been promoted to `PRODUCTION` via a founder-signed WO

## 11 · Sequencing + dependencies

- **Prerequisite:** WO-13 substrate hardening complete ✅ (satisfied at HEAD `9ffd8d0e`)
- **May run in parallel with:** WO-WORKSTATION-14 (authority adversarial), WO-WORKSTATION-15 (crash/restart durability), T3-C native Job Object
- **Not blocked by:** Phase 9 Vision, Phase 14 Guardian
- **Blocks:** WO-INTELLIGENCE-02..N (each subsequent slice authorised individually)

## 12 · Founder authorisation gate

**No implementation begins until this section is signed off.**

Master AI Engineer will not:
- Create any source file under `src/lib/nex-intelligence/`
- Create any test file under `src/lib/nex-intelligence/__tests__/`
- Fetch any URL from arXiv or anywhere else
- Add any collection constant to `src/lib/nex/storage/types.ts`
- Modify any substrate file

Until the founder explicitly authorises WO-INTELLIGENCE-01 execution by one of:

- "Authorise WO-INTELLIGENCE-01 execution" (full)
- "Authorise WO-INTELLIGENCE-01 stages 1-3 only" (partial, staged)
- "Refine [specific section] first" (spec revision)
- Something else the founder directs

---

**End of specification. Awaiting founder authorisation to proceed.**
