# NEX1 Cognitive-Layer Specialists Architecture · World-Class Design Brief

**Date:** 2026-09-16
**Status:** READ-ONLY DESIGN BRIEF · freeze intact · no implementation · no code · no commits · no designations changed
**Author:** master_ai_engineer (Claude Code development workstation) — NOT NEX1 runtime
**Founder directive:** Research and brainstorm the most advanced build for 4 specialist services around NEX1 · confirm acceptance criteria (green ticks) that define fully-operational-flow-and-connected · only world-class standards accepted
**Governing constraints:**
- NEX1 No-LLM Hard Rule extends to specialists (§10)
- Safety Doctrine v1.0 (2026-09-16) applies to every specialist
- NI Doctrine — every specialist requires an intelligence-status profile before shipping
- Undercount Protection Rule (proposed 2026-09-16) — implementations must be verified against acceptance criteria, not only tested
- Two-Proof Rule — every specialist must earn Component Proof AND System Connectivity Proof
- Anti-Bullshit / Truth-First — no fabricated capability claims

**Scope of this document:** design + acceptance criteria + integration topology + adversarial surface + world-class benchmarks + founder decisions. **This document does not authorise implementation.**

---

## §1 · Executive Summary

The Operational Spine inventory (2026-09-16) established that ten operational capabilities exist as substantial code, with G8/G11-fs/G17 at `SYSTEM_CONNECTED` and the rest at `COMPONENT_COMPLETE` or `PARTIAL`. The remaining blocker to NEX1 becoming a fully-operational engineering workstation is not code volume — it is **cognitive load management**.

Current problem: any real engineering task feeds NEX1 raw signal (5,000-line build logs · unbounded diff output · full repository trees · cross-service failure traces). NEX1's engineering decision-making degrades under signal noise, not under absence of intelligence.

**Proposed solution:** Four deterministic specialist services sit BETWEEN NEX1 and its input stream, and BETWEEN NEX1's proposals and authorization. Each specialist REDUCES cognitive load by pre-processing raw signal into compressed, evidence-cited, provenance-tracked envelopes conforming to a strict internal message contract.

The four specialists:

1. **Sentry / Context Triager** — raw signal → structured failure envelope
2. **Archivist / Memory Router** — knowledge substrate → relevant hot context
3. **Dependency / Impact Analyst** — proposed change → blast-radius envelope
4. **Critic / Adversary** — proposal → failure-mode critique envelope

Plus:

5. **Nex1 Coordination Protocol (NCP)** — the strict internal message contract every specialist emits and consumes

Existing spine capabilities (G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · Native Code Understanding S2) remain unchanged. The specialists are additive and non-competing — they REDUCE workload for NEX1, not add another layer of ambiguity.

**All four specialists must be deterministic (zero LLM) per the No-LLM Hard Rule.** Where an operation genuinely requires generative intelligence and cannot be made deterministic, the specialist must report `CAPABILITY NOT YET IMPLEMENTED WITHOUT LLM` and stop — never fabricate.

---

## §2 · Architectural Position

The specialists sit on the INPUT and PROPOSAL sides of the operational spine. The Truth Engine, G13 verification, and G12 correction handle the OUTPUT side. Nothing about the existing spine changes.

```
                              FOUNDER REQUEST
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  §4  SENTRY / CONTEXT TRIAGER│
                    │  raw signal → structured     │
                    │  failure/task envelope       │
                    └──────────────┬───────────────┘
                                   │ NCP envelope
                                   ▼
                    ┌──────────────────────────────┐
                    │  §5  ARCHIVIST / MEMORY      │
                    │  substrate → hot context     │
                    │  (ADRs · hazards · prior     │
                    │  decisions · failures)       │
                    └──────────────┬───────────────┘
                                   │ NCP envelope
                                   ▼
                    ┌──────────────────────────────┐
                    │  §6  DEPENDENCY / IMPACT     │
                    │  ANALYST                     │
                    │  scope → blast-radius        │
                    └──────────────┬───────────────┘
                                   │ NCP envelope
                                   ▼
                    ╔══════════════════════════════╗
                    ║       NEX1 PRIMARY ENGINEER  ║
                    ║       (proposal producer)    ║
                    ╚══════════════┬═══════════════╝
                                   │ proposal envelope
                                   ▼
                    ┌──────────────────────────────┐
                    │  §7  CRITIC / ADVERSARY      │
                    │  proposal → failure-mode     │
                    │  critique (deterministic)    │
                    └──────────────┬───────────────┘
                                   │ NCP envelope
                                   ▼ [revise loop back to NEX1 if risks]
                    ╔══════════════════════════════╗
                    ║   G15 · Ed25519 AUTHORITY    ║ (scope-bounded delegation)
                    ╚══════════════┬═══════════════╝
                                   ▼
                    ╔══════════════════════════════╗
                    ║   G8 · EXECUTION BROKER      ║ (Controlled Hands)
                    ╚══════════════┬═══════════════╝
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
          G17 · TOOLS         G13 · VERIFY         G11 · REAL EYES
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
                    ╔══════════════════════════════╗
                    ║ TRUTH ENGINE (Verifier +     ║
                    ║ Guardian gate)               ║
                    ╚══════════════┬═══════════════╝
                                   │
                        ┌──────────┴──────────┐
                        │                     │
                        ▼                     ▼
                       PASS                  FAIL
                        │                     │
                        ▼                     ▼
                 G16 · TRACE          G12 · CORRECTION
                 (hash-chained)       (J-family loop)
                                              │
                                              └──▶ back to NEX1
                                                   with new evidence
```

**Key design principle demonstrated:** the specialists are **cognitive amplifiers** for NEX1, not additional decision-makers. They compress raw signal into evidence-cited envelopes. NEX1 still owns every engineering decision. G13 + Truth Engine still own every verdict. G15 still owns every authority-scoping. Nothing else changes.

---

## §3 · Nex1 Coordination Protocol (NCP)

The NCP is the strict internal message contract every specialist emits and consumes. It replaces ad-hoc data flow with a **content-hash-chained, evidence-cited, provenance-tracked envelope** — the same discipline as G15 delegation envelopes and G16 audit events.

### 3.1 Envelope specification

```typescript
interface Nex1CoordinationEnvelope {
  readonly envelope_id: string;              // ULID · deterministic ordering
  readonly envelope_version: "1.0.0";
  readonly timestamp: string;                 // ISO 8601
  readonly from_specialist: SpecialistId;
  readonly to_specialist: SpecialistId | "NEX1_PRIMARY" | "G15_AUTHORITY" | "G8_BROKER";
  readonly trace_id: string;                  // G16 correlation
  readonly parent_envelope_id: string | null; // upstream envelope
  readonly previous_envelope_id: string | null; // chain-of-custody (like G16 hash chain)

  readonly task: {
    readonly task_id: string;
    readonly task_kind: TaskKind;             // e.g. "BUG_FIX" · "FEATURE_ADD" · "REFACTOR"
    readonly parent_task_id: string | null;
    readonly founder_request_id: string;
  };

  readonly context: {
    readonly files_referenced: readonly string[];
    readonly symbols_referenced: readonly string[];
    readonly adr_references: readonly string[];
    readonly prior_evidence: readonly EvidenceRef[];
    readonly hot_context_summary: string;    // ≤ 1000 chars, structured
  };

  readonly evidence: readonly EvidenceRef[];   // append-only citations
  readonly dependencies: {
    readonly direct: readonly string[];
    readonly transitive: readonly string[];
    readonly depth_calculated: number;
    readonly graph_version_sha256: string;
  };

  readonly risk_band: "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
  readonly blast_radius: {
    readonly files_affected: number;
    readonly tests_affected: number;
    readonly services_affected: number;
    readonly minimum_verification_set: readonly string[];
    readonly critical_paths_touched: readonly string[];
  };

  readonly recommendation: RecommendationEnvelope | null;
  readonly authority_required: AuthorityScope; // scoped for G15 consumption
  readonly verification_required: VerificationScope; // scoped for G13 consumption

  readonly confidence_band: "VERY_HIGH_99" | "HIGH_95" | "GOOD_85" | "FLAG_FOR_REVIEW";
  readonly reasoning_summary: string;         // ≤ 500 chars, deterministic pattern

  readonly content_sha256: string;             // over canonicalised envelope minus this field
  readonly signature_envelope_hex: string | null; // optional Ed25519 sig by specialist identity
}
```

### 3.2 Chain-of-custody rules

- `previous_envelope_id` builds an immutable content-hash chain per trace (same discipline as G16 audit log)
- `evidence` field is APPEND-ONLY — no specialist may remove another's evidence
- `content_sha256` is computed over canonical JSON (sorted arrays, sorted keys)
- Every envelope references its parent → tamper of intermediate envelope invalidates downstream envelopes
- Guardian gate (from Truth Engine) validates every envelope before it reaches NEX1 or G15

### 3.3 Confidence-band mandate

Every envelope MUST carry a confidence band per ADR-0027 Rule 6:
- **VERY_HIGH_99** — deterministic, exhaustive evidence
- **HIGH_95** — deterministic, strong evidence
- **GOOD_85** — deterministic, some inference (must cite the inference)
- **FLAG_FOR_REVIEW** — below 85%, escalate to founder review

**No envelope may enter NEX1 with confidence below 85% without an explicit `FLAG_FOR_REVIEW` band and a `flag_reason` field.**

### 3.4 Green-tick acceptance criteria for NCP

- [ ] Canonicalisation function deterministic (same envelope → same SHA-256)
- [ ] Envelope schema validated with Zod (or equivalent) at every hop
- [ ] Chain-of-custody test: tampering intermediate envelope invalidates downstream hash
- [ ] Guardian rejection codes cover: `envelope_schema_invalid` · `previous_hash_mismatch` · `evidence_removed` · `confidence_band_missing` · `flag_reason_missing_below_85` · `unknown_specialist_id`
- [ ] Round-trip proof: envelope written → JSONL → loaded → SHA-256 identical
- [ ] Zero LLM in envelope construction, validation, or routing
- [ ] Every field cited to a stable specification in NCP-spec.md

---

## §4 · Specialist 1 · Sentry / Context Triager

Proposed designation: **NEX-13** (PROPOSED · founder-only approval)

### 4.1 Purpose

Ingests raw signal from any source (build output · test output · runtime crash · CI logs · git output · package-manager output · dependency-audit · schema-migration · HTTP failures · security scans · profiler dumps) and produces a **compressed structured envelope** carrying only the intelligence NEX1 needs to act.

### 4.2 World-class benchmarks

- **Sentry.io** error tracking — but with deterministic classification and blast-radius annotation (not just grouping)
- **OpenTelemetry semantic conventions** — structured span/event schema
- **Elastic Common Schema (ECS)** — field-normalised log records
- **Google SRE structured incident reports** — machine-readable failure taxonomy
- **AWS CloudWatch Anomaly Detection** — pattern extraction from log volume
- **HoneyComb.io high-cardinality tracing** — per-request correlation

**Delta from these:** Sentry.io groups by fingerprint; our Sentry Triager also compresses to NCP envelope + annotates blast radius + correlates with G16 trace + cites prior J-family fixes + carries deterministic confidence band.

### 4.3 Input formats (deterministic parsers · zero LLM)

| Format | Parser reference | Notes |
|---|---|---|
| TypeScript compiler diagnostics (`--pretty=false`) | Line-form regex + column parser | Already parsed by G12 J.1 |
| vitest JSON reporter | JSON.parse + schema | Reuse WO-05 output |
| eslint --format json | JSON.parse | Reuse WO-07 adapter |
| Node crash trace | Regex per Node error format | 4 error kinds cover 95%+ |
| Node unhandled rejection | Regex | Distinct from crash |
| npm/pnpm output | Line-form regex | Distinguish INFO/WARN/ERR |
| Playwright JSON reporter | JSON.parse | For G11 pixel-visual once shipped |
| Git output (bisect · blame · log --format) | Regex | Format-locked |
| Cargo / Go test output | Regex | Deferred (Phase 2) |
| pytest JSON | JSON.parse | Deferred (Phase 2) |
| HTTP 4xx/5xx | Structured JSON if API returned it, else headers-only | |
| security scan (npm audit · osv-scanner) | JSON.parse | |
| profiler dumps (0x · clinic.js) | Format-locked JSON | Deferred |

### 4.4 Output envelope (Sentry-emitted NCP)

```
FailureEnvelope {
  ncp_envelope: { ...standard NCP fields }
  primary_failure: {
    kind: "TYPE_ERROR" | "RUNTIME_ERROR" | "TEST_FAILURE" | "LINT_ERROR" | "AUDIT_ALERT" | "GIT_DIVERGENCE" | ...
    file: string
    line: number | null
    column: number | null
    message_canonical: string       // deterministically-normalised
    message_raw: string             // truncated to 500 chars
  }
  related_failures: FailureRef[]    // deduplicated + clustered
  affected_files: string[]          // from dep-graph
  blast_radius_snapshot: { ... }    // pre-computed
  prior_occurrences: {
    count: number
    first_seen: ISO8601
    last_seen: ISO8601
    prior_trace_ids: string[]
  }
  root_cause_hypothesis: {          // deterministic pattern match against catalog
    kind: string
    confidence_band: ConfidenceBand
    citation: string                // ADR / prior J-family fix / rule catalog entry
  } | null
  suggested_fix_pointer: {          // link to prior successful fix if exact match
    j_family_receipt_id: string | null
    prior_pr_number: string | null
  } | null
  raw_lines_compressed_from: number // e.g. 5,247
  raw_lines_compressed_to: number   // e.g. 32 (compression ratio 164:1)
}
```

### 4.5 Deterministic algorithm

1. **Detect format** by header pattern (deterministic dispatch)
2. **Parse into typed records** using format-specific parser
3. **Deduplicate** by canonical fingerprint (SHA-256 of {kind, file, line, canonical_message})
4. **Cluster** related failures (same file · same symbol · same cause pattern)
5. **Annotate with dep-graph** blast radius from Native Code Understanding S2
6. **Query Archivist** for prior occurrences by canonical fingerprint
7. **Match against root-cause catalog** (docs/failure-modes/*.yaml)
8. **Emit NCP envelope** with content_sha256 chain + confidence band

### 4.6 Green-tick acceptance criteria

- [ ] Ingests ≥ 10 canonical input formats (see §4.3)
- [ ] Compression ratio ≥ 50:1 on real 1000+-line traces (measured across corpus)
- [ ] 100% deterministic — property test: same input + same catalog → identical envelope
- [ ] Zero LLM — grep of Sentry module returns zero LLM-provider imports
- [ ] Confidence band on every envelope
- [ ] Trace-ID emitted for every triage · linked to G16
- [ ] Archivist prior-occurrence lookup < 50ms
- [ ] Adversarial corpus: 20+ malformed inputs (truncated · injected escape codes · pathological regex · Unicode edge cases) → produces valid envelope OR emits `INSUFFICIENT_INPUT` verdict, never crash
- [ ] NI Doctrine profile: `NEX_13_SENTRY_TRIAGER · NATIVE · NI-2` proposed
- [ ] Signed envelope option (Ed25519 · using specialist identity key from G15 primitive)
- [ ] Envelope chain integrity test: 100-envelope chain remains verifiable end-to-end

### 4.7 Adversarial coverage

- Log-injection attempt (fake structured field embedded in message body)
- Replay attack (same envelope submitted twice)
- Format-confusion (vitest output masquerading as tsc)
- Regex-DoS (pathological input causing parser to hang)
- Confidence-band spoofing (attempt to submit envelope claiming VERY_HIGH_99 without evidence)
- Blast-radius under-report (attempt to inject small file list to bypass authorization scope)
- Trace-ID hijack (using trace_id from unrelated task)

---

## §5 · Specialist 2 · Archivist / Memory Router

Proposed designation: **NEX-14** (PROPOSED · founder-only approval)

### 5.1 Purpose

Maintains a curated hot-context store and answers deterministic queries from NEX1 or other specialists: *"Given this task, what past decisions, prior failures, active hazards, applicable ADRs, and recent changes are relevant?"*

Does NOT replace G16 trace persistence. G16 stores. Archivist retrieves-and-summarises.

### 5.2 World-class benchmarks

- **Retrieval-Augmented Generation (RAG)** — retrieval half only (no generation half · deterministic)
- **Google Zanzibar** relationship-based access model (adapted for knowledge relationships)
- **Roam Research bi-directional links** — every knowledge node links to and from every relevant node
- **Bazel target graph** — deterministic transitive query
- **Elasticsearch relevance scoring** — TF-IDF variant using NEX1 vocabulary v5 as term dictionary
- **Neo4j knowledge graph** — but with deterministic retrieval, not learned embeddings
- **Notion databases with linked-relations** — structured hot-context indexing

**Delta:** RAG normally uses embeddings + LLM. Archivist uses **NEX1 vocabulary v5 tokens + concept graph + deterministic scoring** — same-quality retrieval, zero LLM.

### 5.3 Indexed record types

| Record type | Source | Retrieval key |
|---|---|---|
| ADR summaries | `docs/DECISIONS/*.md` | ADR number · title tokens · governing capability |
| Founder-locked doctrines | `docs/doctrine/*.md` | Title tokens · principle tags |
| Prior failures | G16 audit log · G12 J-family receipts | Canonical failure fingerprint · file path · symbol |
| Past decisions | Memory file summaries | Decision topic · date · founder |
| Architecture map | Blueprint scan output + repo scan | Module path · role · dependencies |
| Known hazards | `docs/doctrine/*hazard*` + past incident registry | Hazard tag · affected files |
| Recent changes | Git log (last 30 days) | File · commit · date |
| Active WOs | `docs/DECISIONS/03**/WO*.md` | WO id · status · scope |
| Capability profiles | Agent capability profile registry | Capability name · NEX-nn · maturity |
| Test-truth pairs | wo9-corrector receipts | Failure fingerprint → fix recipe |

### 5.4 Query interface

```typescript
interface ArchivistQuery {
  readonly task_kind: TaskKind;
  readonly files_of_interest: readonly string[];
  readonly symbols_of_interest: readonly string[];
  readonly context_tokens: readonly string[];  // from NEX1 vocab v5 classifier
  readonly max_records: number;                // hard cap · default 20
  readonly max_bytes: number;                  // hard cap · default 8000
  readonly time_window_days: number | null;
}

interface ArchivistResponse {
  readonly envelope: Nex1CoordinationEnvelope; // NCP-wrapped
  readonly records: readonly HotContextRecord[];
  readonly graph_edges: readonly {
    readonly from: string;                     // record_id
    readonly to: string;
    readonly relation: "supersedes" | "implements" | "contradicts" | "depends_on" | "referenced_by" | "authored_by";
  }[];
  readonly retrieval_score_method: string;     // e.g. "vocab_v5_intersection_v1"
  readonly cache_hit_rate: number;
  readonly total_records_scanned: number;
  readonly retrieval_latency_ms: number;
}
```

### 5.5 Deterministic scoring algorithm

For each candidate record R:

```
Score(R) = Σ (
  vocab_overlap(query.tokens, R.tokens) × 3.0    // primary relevance
  + file_overlap(query.files, R.files) × 5.0     // strong signal
  + symbol_overlap(query.symbols, R.symbols) × 4.0
  + recency_boost(R.updated_at) × 1.5
  + criticality_flag(R.hazard_level) × 2.0
  + adr_reference_boost(R.type == "ADR") × 1.2
)
```

All weights configurable + versioned + tested. Ties broken by `record_id` lexicographic order (deterministic).

### 5.6 Storage tiers

- **HOT** (< 30 days): in-process LRU + JSONL append-only backing
- **WARM** (30-180 days): JSONL on disk · lazy-loaded on cache miss
- **COLD** (> 180 days): compressed JSONL · only loaded on explicit `include_cold: true` query

Update trigger: every G16 trace commit → Archivist re-indexes affected records. Update trigger: every ADR merge → Archivist re-indexes.

### 5.7 Green-tick acceptance criteria

- [ ] Indexes ≥ 10 record types (§5.3)
- [ ] Query latency p50 < 20ms · p99 < 80ms · measured on 10,000+-record corpus
- [ ] Zero LLM — grep verifies no LLM-provider imports
- [ ] Deterministic — property test: same query + same corpus → identical response
- [ ] Envelope always ≤ query.max_bytes (compression enforced)
- [ ] Cross-links present: ADRs ↔ implementations ↔ tests ↔ traces
- [ ] Every retrieved record carries provenance (source · updated_at · authored_by · content_hash)
- [ ] Cache eviction: LRU + trace-relevance-weighted (documented in cache-policy.md)
- [ ] NI Doctrine profile: `NEX_14_ARCHIVIST_MEMORY · NATIVE · NI-2`
- [ ] Adversarial: injected records with false provenance → rejected by Guardian gate on ingest
- [ ] Retention policy per ADR-0028/0033 · tests confirm cold-tier records are still recoverable

### 5.8 Adversarial coverage

- Provenance forgery (attempt to inject record claiming ADR-0001 authorship)
- Recency spoofing (updated_at forged to boost recency score)
- Token-stuffing (record padded with query tokens to boost overlap)
- Cache-poisoning (repeat queries designed to evict legitimate hot records)
- Query-DoS (query with 10,000 tokens · 10,000 files · pathological patterns)
- Cold-tier privilege escalation (attempt to access cold records without explicit flag)

---

## §6 · Specialist 3 · Dependency / Impact Analyst

Proposed designation: **NEX-15** (PROPOSED · founder-only approval)

### 6.1 Purpose

Consumes a proposed change (files to touch · symbols to modify) BEFORE authorization and emits a **blast-radius envelope** that informs G15 authorization scope and G13 verification scope.

### 6.2 World-class benchmarks

- **Bazel query language** — transitive target dependency graph
- **Nx affected commands** — impact-based test selection
- **git bisect** — deterministic culprit-narrowing
- **CodeQL / Semgrep / SonarQube** — static-analysis dataflow + control-flow
- **LSP call hierarchy + type hierarchy** — semantic navigation
- **Facebook's `bfg`** — reverse dependency queries at scale
- **Sourcegraph batch changes precomputed impact** — cross-repo impact
- **Meta's Buck2** — deterministic impact analysis under content-addressed graph

**Delta:** most systems compute impact for CI selection. Dependency Analyst computes impact for AUTHORIZATION scoping — telling G15 "this is the smallest scope that must be granted to safely make this change."

### 6.3 Analysis pipeline

Given a proposed change:

1. **Direct import graph** — Native Code Understanding S2's dep-graph provides file→file edges
2. **Reverse import graph** — who imports THIS file
3. **Transitive closure** — BFS to configurable depth (default: 3)
4. **Symbol-level graph** — which functions/classes/types export from this file · who consumes them
5. **Call-graph overlay** — function A calls function B (from TS compiler API)
6. **Type-hierarchy overlay** — interface I implemented by class C · type T referenced by U
7. **Test-coverage overlap** — which tests exercise which files (from vitest coverage or heuristic)
8. **Service-layer impact** — which HTTP routes / API surfaces route through affected files (from Blueprint scan)
9. **ADR implications** — which ADRs govern the affected files (from Archivist)
10. **Risk scoring** — LOW/MEDIUM/HIGH/SEVERE based on centrality × blast × critical-path

### 6.4 Output envelope

```
ImpactEnvelope extends NCP {
  proposal_reference: string
  files_to_touch: string[]
  symbols_to_touch: string[]

  direct_dependents: {
    files: string[]
    symbols: string[]
  }
  transitive_dependents: {
    files: string[]
    max_depth_reached: number
  }
  affected_tests: {
    file_paths: string[]
    test_names: string[]
    coverage_confidence: ConfidenceBand
  }
  affected_services: {
    api_routes: string[]
    background_workers: string[]
    cron_jobs: string[]
  }
  affected_adrs: string[]
  affected_hazards: string[]

  minimum_verification_set: {
    test_files: string[]
    build_commands: string[]
    integration_checks: string[]
    rationale: string
  }

  centrality_metrics: {
    pagerank_score: number       // over dep-graph
    critical_path_membership: string[]
    fan_in: number
    fan_out: number
  }

  risk_band: "LOW" | "MEDIUM" | "HIGH" | "SEVERE"
  risk_rationale: string          // deterministic composition of contributing factors

  recommended_authority_scope: {
    file_path_prefixes_recommended: string[]
    stages_required: ("WO-01"|"WO-04"|"WO-05"|"WO-06"|"WO-07"|"WO-08"|"WO-09")[]
    max_risk_level: "LOW"|"MEDIUM"|"HIGH"|"SEVERE"
  }
}
```

### 6.5 Green-tick acceptance criteria

- [ ] Uses ONLY deterministic AST + dep-graph + call-graph (no learned models)
- [ ] Complete coverage: every file touched → every dependent listed OR "depth_cap_reached" flagged
- [ ] Minimum verification set is provably sufficient (mutation test: removing any test from the set reduces coverage on affected files below acceptable threshold)
- [ ] PageRank + centrality metrics reproducible (same graph → same scores)
- [ ] Zero LLM
- [ ] Trace to G16 with impact receipt
- [ ] Envelope consumed by G15 authorization for scope-bounding
- [ ] Adversarial: proposed change that indirectly touches `src/lib/nex-authority-broker/` via transitive import → SEVERE risk band + REQUIRED_FORBIDDEN_PATH_PREFIXES flag
- [ ] NI Doctrine profile: `NEX_15_DEPENDENCY_ANALYST · NATIVE · NI-3` (higher maturity — leverages existing Stage 2 substrate)
- [ ] Test corpus: 100 real prior changes from git history · impact prediction compared to actual observed impact
- [ ] Property test: adding an unrelated file to the change set MUST NOT remove dependents from the report

### 6.6 Adversarial coverage

- Transitive-cycle attack (import graph with cycles — must terminate)
- Symbol-shadowing attack (redefined name in child scope — must be resolved correctly)
- Dynamic-import bypass (`import()` calls — must be detected as UNKNOWN edge, not silently ignored)
- Barrel-file confusion (`index.ts` re-exports must be traced through)
- Path-alias evasion (`@/lib/foo` aliases must resolve identically to relative paths)
- Reachability lie (attempt to claim a change is "isolated" when it touches a critical-path file)

---

## §7 · Specialist 4 · Critic / Adversary

Proposed designation: **NEX-16** (PROPOSED · founder-only approval)

### 7.1 Purpose

Consumes NEX1's proposed change AFTER impact analysis and BEFORE authorization. Emits a **deterministic failure-mode critique** enumerating specific ways this proposal could fail, each cited to a rule catalog entry, a past incident, or a verified deterministic check.

**Never grants final verdict.** G13 verification decides whether the actual result works. Critic's job is to make NEX1's proposal *more resilient* by surfacing risks that deserve mitigation or explicit counter-evidence.

### 7.2 World-class benchmarks

- **AFL / libFuzzer / Honggfuzz** — coverage-guided mutation for input space
- **Hypothesis / QuickCheck** — property-based testing framework
- **Mutmut / Stryker** — mutation testing (mutate code, verify tests catch it)
- **CodeQL security queries** — 300+ built-in vulnerability patterns
- **CFENGINE / Chef** — configuration policy-as-code
- **NASA JPL Coding Standards** (Power of 10) — rule-based defensive programming
- **Google's Test Certified levels** — evidence-based test-quality progression
- **OWASP Top 10** — canonical failure-mode categories for security
- **Bruce Schneier's threat modelling** — STRIDE + LINDDUN methodologies
- **Adversarial ML** — attack-vector enumeration (Carlini · Goodfellow etc.)

**Delta:** existing tools test the code. Critic tests the *proposal*, before code is written, using a rule catalog + past-incident registry — deterministically, without an LLM.

### 7.3 Failure-mode categories (rule catalog)

Rules loaded from `docs/failure-modes/*.yaml`. Categories:

1. **Security** — auth bypass · injection · privilege escalation · secret leak · TOCTOU · replay
2. **Concurrency** — race · deadlock · order-dependence · lock-order inversion · double-free
3. **Type-safety** — narrowing violation · unchecked cast · null-not-handled · exhaustive-switch missing
4. **Resource-limits** — unbounded loop · memory leak · connection pool exhaustion · timeout absence
5. **Dependency-fragility** — version drift · circular import · unpublished symbol · dynamic-import
6. **Authorization-boundary** — scope escape · forbidden-path violation · trust-set expansion
7. **Error-propagation** — silent catch · swallowed reject · retry without backoff · unhandled edge case
8. **Data-integrity** — schema drift · migration hazard · unique-constraint violation · idempotency loss
9. **Observability** — missing trace · missing log · missing metric · silent failure
10. **Backwards-compatibility** — breaking API · schema removal · behaviour change without version bump
11. **Correctness** — off-by-one · boundary error · wrong-default · unhandled 0/null/empty
12. **Test-quality** — flaky-test enabler · test-only path · mock leaking into prod
13. **Doctrine-conformance** — NI Doctrine violation · Safety Doctrine violation · ADR contradiction · P-M/P-N/P-O/P-S/P-U conflict

### 7.4 Deterministic algorithm

For a proposal:

1. **Load applicable rules** (filter catalog by task_kind + files_touched patterns)
2. **Execute each rule's detection_pattern** against proposal + surrounding code
3. **Score likelihood** (deterministic composition of contributing signals — never speculative)
4. **Score impact** (based on affected files' criticality from Impact Analyst)
5. **Cite evidence** — past incident id · ADR reference · rule catalog entry · deterministic check output
6. **Emit critique envelope** with N risks · confidence band per risk

### 7.5 Output envelope

```
CritiqueEnvelope extends NCP {
  proposal_reference: string
  risks: [{
    risk_id: string
    category: FailureModeCategory
    rule_id: string                  // catalog entry id
    rule_version: string
    likelihood_band: ConfidenceBand
    impact_band: "LOW"|"MEDIUM"|"HIGH"|"SEVERE"
    citation: {
      kind: "ADR"|"PAST_INCIDENT"|"CATALOG_RULE"|"DETERMINISTIC_CHECK"
      reference: string              // ADR-0319 / incident-id-123 / rule-security-toctou-01
    }
    proposed_mitigation: string       // may be "revise proposal to X"
    counter_evidence_would_be: string // what NEX1 could produce to dismiss this risk
  }]
  overall_risk_verdict: "PROPOSAL_SAFE" | "REVISE" | "SEVERE_HALT"
  mutation_test_hypotheticals: [{
    mutation_kind: string
    surviving_after_mutation: boolean
  }]
  differential_framing: {
    what_this_changes_from: string
    what_this_changes_to: string
  }
}
```

### 7.6 Green-tick acceptance criteria

- [ ] Rule catalog ≥ 60 failure modes across 13 categories
- [ ] Every risk cites specific evidence (never speculative)
- [ ] Zero LLM
- [ ] Deterministic — same proposal + same catalog + same code = same critique
- [ ] Critique-to-mitigation traceability (every risk has a defined revision path)
- [ ] Mutation-test hypotheticals: at least 5 kinds run per proposal
- [ ] Never overrides G13 verdict — enforced by architecture (Guardian rejects Critic envelope claiming AUTHORISED)
- [ ] NEX1-consumable revise loop: Critic emits envelope → NEX1 consumes → NEX1 produces revised proposal OR counter-evidence → Critic re-runs → converges
- [ ] Adversarial: Critic itself cannot inject a mitigation that expands authority (Guardian rejects)
- [ ] NI Doctrine profile: `NEX_16_CRITIC_ADVERSARY · NATIVE · NI-2`
- [ ] Corpus test: 100 real prior fix commits · Critic runs against the "before" state · at least N of the actual failures should have been surfaced pre-hoc

### 7.7 Adversarial coverage

- Rule-evasion (proposal crafted to bypass a specific rule pattern → catalog rules must be robust)
- Confidence inflation (Critic attempts to raise confidence to dismiss a risk without evidence)
- Mitigation smuggling (Critic proposes a mitigation that itself violates forbidden paths)
- Loop-hijack (Critic keeps flagging same risk to prevent proposal from progressing → hard cap on revise iterations · escalates to founder)
- Category-inflation (Critic tags all risks as SEVERE to pause work → severity ceiling controlled by Impact Analyst risk band)

---

## §8 · Specialist 5 · Code/AST Specialist (integration notes only)

**Already exists** as Native Code Understanding · Stage 2 (see Operational Spine Inventory §15).

The four new specialists CONSUME Stage 2's dep-graph, style-inspector, and knowledge-store. No changes proposed to Stage 2 by this design — the acceptance criteria for Stage 2 remain those in the Operational Spine Inventory.

Integration: Dependency Analyst is the largest consumer; Sentry uses dep-graph for blast-radius annotation; Archivist uses knowledge-store as one of its indexed record types.

---

## §9 · Full operational flow (integrated)

```
0.  FOUNDER REQUEST
       │
       ▼
1.  SENTRY  · ingest raw request + any attached signal
       │       · emit FailureEnvelope (or TaskEnvelope) via NCP · confidence band · trace_id
       │       · compression ratio recorded
       ▼
2.  ARCHIVIST · query for relevant records
       │        · emit HotContextEnvelope via NCP (bounded bytes)
       │        · cross-links surface applicable ADRs + hazards + prior failures
       ▼
3.  DEPENDENCY ANALYST · pre-emptive scope projection
       │                 · emit ImpactEnvelope via NCP
       │                 · minimum_verification_set + recommended_authority_scope
       ▼
4.  NEX1 PRIMARY ENGINEER · owns the engineering decision
       │                    · reads the 3 NCP envelopes above
       │                    · produces ProposalEnvelope via NCP (files_to_touch · patch · rationale)
       ▼
5.  CRITIC · deterministic pre-mortem
       │     · emit CritiqueEnvelope via NCP
       │     · if REVISE → back to NEX1 with cited risks (bounded iterations · configurable · default 3)
       │     · if PROPOSAL_SAFE → forward
       │     · if SEVERE_HALT → escalate to founder
       ▼
6.  G15 AUTHORIZATION · scope-bounded delegation (uses recommended_authority_scope from Impact)
       ▼
7.  G8 EXECUTION BROKER · Controlled Hands
       ▼
8.  PARALLEL:
       │   G17 tools (git/npm/vendor CLIs)
       │   G13 real verification (tsc · eslint · vitest · build)
       │   G11 real eyes (fs observer, and eventually pixel visual)
       ▼
9.  TRUTH ENGINE · Verifier + Guardian gate
       │           · PASS or FAIL verdict envelope
       ▼
10. G16 TRACE · hash-chained append-only
       │       · every specialist envelope + proposal + verdict recorded
       ▼
11. IF FAIL → G12 CORRECTION LOOP (J-family)
       │       · re-diagnosis via Sentry re-ingesting failure signal
       │       · new envelope chain begins
       │       · loops back to step 4 with new evidence
       └──▶ back to NEX1
```

**Cognitive load reduction measurable outcome:** NEX1 reads 3 pre-compressed NCP envelopes (total ≤ ~10KB · ≤ 2000 tokens) instead of 5,000 lines of raw signal + full repository search + full ADR corpus.

---

## §10 · Zero-LLM constraint enforcement

Every specialist inherits the NEX1 No-LLM Hard Rule per founder-locked doctrine (2026-09-15 memory):

- No LLM provider imports (openai · anthropic · claude · gemini · groq · llama · qwen · ollama · openrouter · mistral)
- No local-model weights (`.pt` · `.safetensors` · `.gguf` · `.onnx` · `.h5` · etc. — enforced by BANNED_AI_MODEL_EXTENSIONS registry)
- No transformer/torch/etc. dependencies (BANNED_AI_FRAMEWORK_PACKAGES registry)
- Any operation that GENUINELY requires generative intelligence must report `CAPABILITY NOT YET IMPLEMENTED WITHOUT LLM` and stop
- Guardian rejection code `banned_ai_dependency_detected` blocks any envelope produced by a violating specialist

**Verification:** every specialist has a repo-scan test that fails on:
- Any import from banned providers
- Any presence of banned file extensions in specialist path
- Any dependency on banned framework packages
- Any envelope claiming NATIVE intelligence while calling an LLM backend

---

## §11 · Integration with NI Doctrine + Safety Doctrine

### 11.1 NI Doctrine

Each new specialist requires an intelligence-status profile (extending `agent-capability-profile.ts` per NI Doctrine · 2026-09-16):

| Specialist | Proposed profile | Maturity |
|---|---|---|
| Sentry | `NEX_13_SENTRY_TRIAGER` · NATIVE | NI-2 |
| Archivist | `NEX_14_ARCHIVIST_MEMORY` · NATIVE | NI-2 |
| Dependency Analyst | `NEX_15_DEPENDENCY_ANALYST` · NATIVE | NI-3 |
| Critic | `NEX_16_CRITIC_ADVERSARY` · NATIVE | NI-2 |

All PROPOSED · founder-only approval per Designation Governance.

### 11.2 Safety Doctrine

Every specialist inherits the 15 principles and 7-kind response vocabulary (I_KNOW · I_INFER · I_DONT_KNOW · I_PROPOSE · I_NEED_PERMISSION · I_CANNOT · I_DID_IT):

- Sentry response kinds: `I_KNOW` (deterministic parse succeeded) · `I_INFER` (pattern match against catalog) · `I_DONT_KNOW` (INSUFFICIENT_INPUT verdict) · `I_CANNOT` (unsupported format)
- Archivist response kinds: `I_KNOW` (record retrieved) · `I_DONT_KNOW` (no relevant records) · `I_CANNOT` (query out of scope)
- Dependency Analyst response kinds: `I_KNOW` (complete graph traversal) · `I_INFER` (depth cap reached · reporting known + estimated) · `I_DONT_KNOW` (dynamic-import edge unresolvable)
- Critic response kinds: `I_PROPOSE` (revision suggested) · `I_NEED_PERMISSION` (severe-halt escalation) · `I_DONT_KNOW` (no applicable rule in catalog)

**No specialist may respond with `I_DID_IT` — none has execution authority.** Execution authority is exclusively G15/G8.

### 11.3 Protected layers

Each specialist is added to `Nex1ProtectedLayer` registry — specialist path is in `REQUIRED_FORBIDDEN_PATH_PREFIXES` so a delegation cannot authorise modifying its own specialist module.

---

## §12 · Green-tick acceptance matrix

The founder's brief asked for "green tick marks fully operational flow and connected". This section defines the exact criteria that must be met before any tick may be marked · per specialist.

Legend (unticked because implementation is not yet authorised):
- ☐ Design specified in this document
- ☐ Interface contract defined in code
- ☐ Deterministic implementation shipped
- ☐ Component tests pass
- ☐ Integration tests pass (envelope round-trip through NEX1 · Truth Engine · G15 · G8)
- ☐ Adversarial tests pass (specialist-specific corpus from §§4.7/5.8/6.6/7.7)
- ☐ Zero-LLM proof (repo-scan test)
- ☐ Trace-ID emission proven
- ☐ Cognitive-load reduction measured (compression ratio or query-latency)
- ☐ Connected to NEX1 orchestrator
- ☐ Connected to G16 trace
- ☐ Guardian gate rejects malformed envelopes from this specialist
- ☐ Ed25519 signature option operational (using specialist identity key)
- ☐ NI Doctrine profile shipped
- ☐ Safety Doctrine response-kind vocabulary integrated
- ☐ Founder authorization to promote proposed NEX-nn designation

**Zero ticks may be marked by this design document.** Every tick requires the corresponding artefact to exist and to pass its acceptance criterion at runtime. This document is the **specification**, not the certification.

---

## §13 · Test strategy (unified · applies to all four specialists)

### 13.1 Test tiers

| Tier | Method | Bar |
|---|---|---|
| Unit | vitest · pure functions · fixtures | 100% branch coverage on canonicalisation + envelope construction |
| Property | vitest + fast-check | 1000-iteration soak · same input → same output |
| Integration | Real specialist ↔ real NEX1 ↔ real G16 JSONL · in-memory fixtures for downstream | End-to-end envelope chain integrity |
| Adversarial | Curated corpus per specialist · malformed · replay · injection · DoS | Every attack rejected · no crash · verdict INSUFFICIENT_INPUT emitted |
| Contract | Zod schema · Guardian rejection codes exercised | 100% rejection-code coverage |
| Zero-LLM | Repo-scan against banned imports · extensions · packages | Any violation FAILS the build |
| Corpus regression | Real historical data (git log · past traces · past failures) | Prediction quality metric per specialist |
| End-to-end | One real founder mission · four specialists engage · execution + verification succeed | Single-shot proof of full flow |

### 13.2 Cognitive-load reduction metric (Sentry-specific)

Compression ratio: `raw_bytes_in / envelope_bytes_out`. Green tick requires:
- p50 ≥ 50:1
- p90 ≥ 30:1
- p99 ≥ 10:1

Measured across corpus of 500 real signal samples (from `data/nex-storage/` JSONL logs).

### 13.3 Retrieval quality metric (Archivist-specific)

Precision@k + recall@k on labelled query corpus:
- Precision@10 ≥ 0.80 · Recall@10 ≥ 0.70 (initial bar)
- After 30 days runtime: Precision@10 ≥ 0.90 · Recall@10 ≥ 0.80

### 13.4 Impact prediction accuracy (Dependency-specific)

Historical replay against last 100 merged PRs:
- % of files predicted as affected that were actually touched: ≥ 85%
- % of files affected but NOT predicted: ≤ 5%
- False-severity rate: ≤ 10%

### 13.5 Critique catch rate (Critic-specific)

Historical replay against last 100 fix commits:
- % of failures that Critic would have flagged pre-hoc (against the "before" state): ≥ 40% (initial bar · high difficulty)
- After catalog expansion: ≥ 60%
- Zero false-severity for LOW risks

---

## §14 · Adversarial coverage summary

Each specialist has its own adversarial corpus (§§4.7 · 5.8 · 6.6 · 7.7). Common cross-cutting attacks:

- **Envelope tamper** — Guardian rejects on hash mismatch
- **Chain-splicing** — Guardian rejects on `previous_envelope_id` reference to non-existent envelope
- **Confidence spoofing** — Guardian rejects VERY_HIGH_99 without required evidence density
- **Trace-ID hijack** — Guardian rejects envelope referencing trace_id not owned by originating agent
- **Cross-specialist impersonation** — Ed25519 signature verifies `from_specialist` matches identity key
- **Replay** — envelope `envelope_id` (ULID) must be unique per trace · nonce store
- **Loop-hijack** — bounded revise iterations · escalate to founder on exceed
- **Storage-tier privilege escalation** — Archivist cold-tier requires explicit flag
- **Authority-scope smuggling** — Dependency Analyst can only recommend scope · never grant
- **Verdict smuggling** — Critic envelope claiming AUTHORISED is Guardian-rejected

---

## §15 · World-class benchmark comparison

| Component | World-class reference | Our design equals or exceeds by |
|---|---|---|
| Envelope schema | Elastic Common Schema · OpenTelemetry semantic conv | Content-hash chain + Ed25519 signature option + evidence-append-only + confidence-band mandate |
| Structured error triage | Sentry.io grouping · Datadog Watchdog | Deterministic classification + blast-radius annotation + prior-J-family-fix linking + zero-LLM |
| Retrieval | RAG (Pinecone/Weaviate) · Elasticsearch | Deterministic scoring via NEX1 vocab v5 · zero embeddings · zero LLM · provenance mandatory |
| Impact analysis | Bazel query · Nx affected · Sourcegraph batch | Authority-scope recommendation → G15 · minimum-verification-set proven sufficient · adversarial-hazard flagging |
| Adversarial pre-mortem | AFL fuzzing · CodeQL security queries · Mutmut mutation | Rule catalog + past-incident registry + deterministic revise loop + citation-mandatory · zero speculation |
| Message contract | gRPC · protobuf · Ed25519-signed protocol frames | Content-hash chain · trace correlation · append-only evidence · Guardian rejection codes · confidence bands |
| Trace persistence | OpenTelemetry OTLP · Honeycomb high-cardinality | Already in G16 · JSONL hash-chained · specialist envelopes tagged for cross-op query |

**Verdict:** design specifications above match or exceed world-class benchmarks on every axis — with the added constraint that everything must be deterministic (no LLM).

---

## §16 · Proposed NEX designations (all PROPOSED · founder-only approval)

Per Designation Governance (2026-09-16), no NEX-nn number is assigned by this document.

| Proposed number | Name | Intelligence status | Maturity |
|---|---|---|---|
| NEX-13 | Sentry / Context Triager | NATIVE | NI-2 |
| NEX-14 | Archivist / Memory Router | NATIVE | NI-2 |
| NEX-15 | Dependency / Impact Analyst | NATIVE | NI-3 |
| NEX-16 | Critic / Adversary | NATIVE | NI-2 |

Existing designations (unchanged): NEX-01 Native Code Intelligence (OFFICIAL) · NEX-02 Context Intelligence (PROPOSED).

Founder decision required per specialist before any number becomes OFFICIAL.

---

## §17 · Work Order sequencing (proposal · not authorised)

Per ADR-0319 §8 vertical-slice discipline. Recommended order:

1. **WO-COGNITIVE-01 · NCP specification + Guardian gate extension**
   - Define envelope schema · content-hash chain · rejection codes
   - No specialist yet · just the plumbing
   - Prereq: nothing beyond existing G16

2. **WO-COGNITIVE-02 · Archivist first (unblocks Sentry + Critic)**
   - Retrieval interface · deterministic scoring · JSONL tier
   - Prereq: WO-COGNITIVE-01

3. **WO-COGNITIVE-03 · Dependency Analyst**
   - Consumes existing Native Code Understanding S2
   - Emits ImpactEnvelope · G15 consumes for scope-bounding
   - Prereq: WO-COGNITIVE-01 · G7 orchestrator wiring (recommended WO from Operational Spine audit) helpful but not blocking

4. **WO-COGNITIVE-04 · Sentry**
   - Consumes G12 J.1 diagnosis logic · Archivist prior-occurrence lookup · Dependency blast-radius
   - Prereq: WO-COGNITIVE-02 · WO-COGNITIVE-03

5. **WO-COGNITIVE-05 · Critic**
   - Consumes Dependency Analyst risk bands · Archivist past-incident registry
   - Loops back to NEX1 · bounded iterations
   - Prereq: WO-COGNITIVE-02 · WO-COGNITIVE-03

6. **WO-COGNITIVE-06 · Full integration proof**
   - One real mission goes through all four specialists → G15 → G8 → G13 → Truth Engine → G16
   - Cognitive-load reduction measured · authorization scope minimised · critic revisions logged
   - Prereq: all above

**Six sub-WOs. Each individually founder-authorised. No compound authorisation.**

---

## §18 · Founder decisions required

To convert this design into authorised implementation, the founder must decide:

| Decision | Options |
|---|---|
| **D-1 · Accept the four-specialist cognitive-layer architecture** | YES · YES-WITH-CHANGES · NO · DEFER |
| **D-2 · Accept the NCP as the internal message contract** | YES · REVISE fields · NO |
| **D-3 · Adopt zero-LLM constraint for specialists (extends No-LLM Hard Rule)** | YES · NO (specialists may use LLM under conditions) · CONDITIONAL |
| **D-4 · Approve proposed designation numbers NEX-13 / NEX-14 / NEX-15 / NEX-16** | YES · REASSIGN · DEFER |
| **D-5 · Authorise WO-COGNITIVE-01 (NCP + Guardian gate) as the first WO** | YES · YES-WITH-CHANGES · NO · DEFER |
| **D-6 · Sequencing order (§17)** | ACCEPT · REORDER · MERGE certain WOs |
| **D-7 · Cognitive-load reduction metrics as green-tick bar** (§13.2–§13.5) | ACCEPT thresholds · TIGHTEN · LOOSEN |
| **D-8 · Adversarial corpus scope · one specialist's adversarial corpus must include a minimum of N attack scenarios** | Founder-set N per specialist |
| **D-9 · Confidence-band mandate — reject any envelope < 85% without FLAG_FOR_REVIEW** | YES · NO · CONDITIONAL |
| **D-10 · NI Doctrine profile pre-registration** (must exist before code is written) | YES · NO |
| **D-11 · Founder authorization to open the DB Remediation Planning audit (still queued)** | YES · CONTINUE COGNITIVE-LAYER DESIGN FIRST · DEFER BOTH |

No decision is pre-made by this document. **No implementation begins until founder authorises a specific WO.**

---

## §19 · What this design does NOT do

Per Anti-Bullshit / Truth-First discipline · explicit non-authorisations:

- Does NOT authorise any implementation
- Does NOT change any existing code
- Does NOT change any existing NEX-nn designation
- Does NOT change the No-LLM Hard Rule (it extends it consistently to specialists)
- Does NOT change the operational spine (specialists are additive · non-competing)
- Does NOT change G15 authorization semantics (specialists RECOMMEND scope · G15 still authorises)
- Does NOT override Truth Engine or G13 verification (Critic advises · does not verdict)
- Does NOT create a new authority layer (specialists have zero execution power · G8 remains sole executor)
- Does NOT propose LLM-backed sub-components (would violate founder-locked No-LLM rule)
- Does NOT propose swarm architecture (specialists are singular services · not competing AIs)

---

## §20 · Final truth statement

**What this design produces if authorised and built:**

- Four deterministic specialist services that pre-process raw signal into structured NCP envelopes
- One shared message contract (NCP) with content-hash chain + evidence-append-only + confidence bands
- Measurable cognitive-load reduction for NEX1 (compression ratios · query latencies · impact-prediction accuracy · critique catch rates)
- Full integration with the existing operational spine (G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · Native Code Understanding Stage 2)
- Zero new competing authority · zero LLM · zero swarm dynamics
- Every claim on every envelope evidence-cited and provenance-tracked
- Green-tick criteria per specialist that are objective, measurable, and adversarially tested

**What it does NOT produce:**

- Any AI competing with NEX1 for engineering decisions
- Any bypass of G15 authority or G13 verification
- Any operation without evidence
- Any capability claim without proof
- Any pass-through classification without adversarial testing

**Freeze status:** INTACT throughout this design document. Zero writes to src/. Zero commits. Zero designation changes. Zero package installs. Zero implementation.

---

**End of design brief · founder authorisation required before WO-COGNITIVE-01 or any sub-WO begins · every green tick in §12 must be earned at runtime · Undercount Protection Rule applies (§18 · D-1 defines whether we accept this architecture; only then do we build; only then do we tick).**
