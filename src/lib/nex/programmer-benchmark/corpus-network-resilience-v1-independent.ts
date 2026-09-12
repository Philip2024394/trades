// src/lib/nex/programmer-benchmark/corpus-network-resilience-v1-independent.ts
//
// Y-W5-1-a-2 · Independent Second Network-Resilience Corpus
// Philip 2026-09-07 · AUTHORIZE Phase 1 · W5-1-a-2
//
// SEPARATE ATTRIBUTION: this file is W5-1-a-2 (Phase 1) ONLY.
// Sibling of `corpus-network-resilience-v1.ts` but with cases
// authored independently — new scenarios, new source material bias
// toward TIER_1/2 sources (AWS Well-Architected · Google SRE · Netflix
// Hystrix · Microsoft Reliable Web App), new case wording, new
// negative controls.
//
// INDEPENDENCE DISCIPLINE APPLIED
//   · No case in this corpus is a paraphrase of a v1 case
//   · Cases test the SAME defect classes (reliability.*) — that IS the
//     domain being replicated — but through different scenarios and
//     different failure modes
//   · Different negative controls (v1 used date-parser; this v2 uses
//     a pure-computation helper + a UI state reducer)
//   · Cases target failure MODES from published resilience literature
//     that were NOT the ones surfaced by v1's research (bulkhead ·
//     rate limiting · idempotency · deadline propagation · connection
//     pooling · queue backpressure · graceful degradation)
//   · Corpus author did not re-read v1's per-case results before
//     authoring these cases — the shape is derived from the CANDIDATE's
//     domain (resilience.network) not from v1's specific per-case
//     verdicts

import { freezeCorpus } from "./corpus";
import { createHash } from "node:crypto";
import type { BenchmarkCase, BenchmarkCorpus } from "./types";

export const CORPUS_VERSION_NETWORK_RESILIENCE_V1_INDEPENDENT = "network-resilience-v1-independent";
export const CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT = "know_w5_1_ebba7bd5";

function baseCase(over: Partial<BenchmarkCase>): BenchmarkCase {
  return {
    case_id: over.case_id!,
    corpus_version: CORPUS_VERSION_NETWORK_RESILIENCE_V1_INDEPENDENT,
    defect_class: over.defect_class ?? "reliability.missing_timeout",
    difficulty: over.difficulty ?? "INTERMEDIATE",
    requirement: over.requirement!,
    request: over.request!,
    ground_truth: over.ground_truth ?? "DEFECTIVE",
    expected_verdict: over.expected_verdict ?? "NEEDS_CHANGES",
    expected_finding_categories: over.expected_finding_categories ?? ["insufficient_evidence"],
    ground_truth_evidence: over.ground_truth_evidence!,
    provenance: over.provenance ?? "y-w5-1-a-2-network-resilience-v1-independent · philip-authored 2026-09-07 · sources AWS-Well-Architected-reliability + Google-SRE-Book-ch22 + Netflix-Hystrix-docs + MS-Reliable-web-app-pattern",
  };
}

export const NETWORK_RESILIENCE_V1_INDEPENDENT_CASES: readonly BenchmarkCase[] = Object.freeze([
  // Case 1 · Different scenario · bulkhead isolation missing (v1 had none of this)
  baseCase({
    case_id: "nri_v1_001",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVANCED",
    requirement: "the accommodation network worker should isolate slow upstream calls from fast upstream calls so a slow upstream does not exhaust the shared thread pool.",
    request: {
      review_id: "nri_v1_001_req",
      requirement: "the accommodation network worker should isolate slow upstream calls from fast upstream calls so a slow upstream does not exhaust the shared thread pool.",
      implementation: { id: "impl_nri_001", files: ["src/accommodation/network-worker.ts"], summary: "accommodation network worker that dispatches upstream calls from a single shared queue and returns the payload from each completed call.", claim: "dispatches network calls", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-worker.test.ts"], passed: 1, failed: 0, summary: "checks that the network worker returns payload after dispatching a single call.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Netflix Hystrix documentation + AWS Well-Architected Reliability Pillar — the bulkhead pattern isolates pools per upstream so a slow one does not exhaust shared resources; a single shared queue violates this.", pointer: "https://github.com/Netflix/Hystrix/wiki/How-it-Works#bulkhead" }],
  }),

  // Case 2 · Different scenario · rate limiting outbound to protect upstream
  baseCase({
    case_id: "nri_v1_002",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network client should rate limit its outbound calls to the third party booking upstream so it does not exceed the upstream published quota.",
    request: {
      review_id: "nri_v1_002_req",
      requirement: "the accommodation network client should rate limit its outbound calls to the third party booking upstream so it does not exceed the upstream published quota.",
      implementation: { id: "impl_nri_002", files: ["src/accommodation/network-outbound.ts"], summary: "accommodation network outbound client that fires the upstream request whenever a caller asks and returns the response body from the successful call.", claim: "fires upstream request", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-outbound.test.ts"], passed: 1, failed: 0, summary: "checks that the network outbound client returns response body after firing the upstream request.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Google SRE Book Chapter 22 · Handling Overload — client-side rate limiting protects both the caller and the upstream from cascading failures under load; unbounded outbound violates this.", pointer: "https://sre.google/sre-book/handling-overload/" }],
  }),

  // Case 3 · idempotency missing on retryable network call
  baseCase({
    case_id: "nri_v1_003",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVANCED",
    requirement: "the accommodation network booking creator should use idempotency keys so a retried creation call does not create duplicate bookings.",
    request: {
      review_id: "nri_v1_003_req",
      requirement: "the accommodation network booking creator should use idempotency keys so a retried creation call does not create duplicate bookings.",
      implementation: { id: "impl_nri_003", files: ["src/accommodation/network-create-booking.ts"], summary: "accommodation network booking creator that posts the booking payload to the upstream and returns the created booking id from the response body.", claim: "creates a booking upstream", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-create-booking.test.ts"], passed: 1, failed: 0, summary: "checks that the network booking creator returns the created booking id after posting to the upstream.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Microsoft Azure Architecture Center · Reliable Web App Pattern — idempotency keys required on POST-like network operations to make retries safe; without them a network timeout retry creates duplicates.", pointer: "https://learn.microsoft.com/en-us/azure/architecture/patterns/retry" }],
  }),

  // Case 4 · deadline propagation missing (different from v1 timeout case)
  baseCase({
    case_id: "nri_v1_004",
    defect_class: "reliability.missing_timeout",
    difficulty: "ADVANCED",
    requirement: "the accommodation network chain should propagate the caller deadline to every downstream network call so no downstream keeps running after the caller has given up.",
    request: {
      review_id: "nri_v1_004_req",
      requirement: "the accommodation network chain should propagate the caller deadline to every downstream network call so no downstream keeps running after the caller has given up.",
      implementation: { id: "impl_nri_004", files: ["src/accommodation/network-chain.ts"], summary: "accommodation network chain that makes a sequence of upstream calls and returns the final response payload from the last successful call.", claim: "chains upstream calls", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-chain.test.ts"], passed: 1, failed: 0, summary: "checks that the network chain returns the response payload after sequential upstream calls.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Google SRE Book · deadline propagation — each downstream must inherit the remaining budget so no downstream continues after caller gave up; a bare chained call does not propagate deadlines.", pointer: "https://sre.google/sre-book/addressing-cascading-failures/" }],
  }),

  // Case 5 · connection pool exhaustion (no pooling discipline)
  baseCase({
    case_id: "nri_v1_005",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network client should reuse a bounded connection pool so it does not exhaust file descriptors or upstream connection limits.",
    request: {
      review_id: "nri_v1_005_req",
      requirement: "the accommodation network client should reuse a bounded connection pool so it does not exhaust file descriptors or upstream connection limits.",
      implementation: { id: "impl_nri_005", files: ["src/accommodation/network-connect.ts"], summary: "accommodation network connect helper that opens a fresh connection on every call and returns the response body after reading it from the connection.", claim: "opens fresh connection each call", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-connect.test.ts"], passed: 1, failed: 0, summary: "checks that the network connect helper returns response body from the freshly opened connection.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "AWS Well-Architected Reliability Pillar · connection reuse pattern — HTTP clients should reuse a bounded connection pool; opening a fresh connection per call exhausts fd/socket resources and upstream connection limits.", pointer: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html" }],
  }),

  // Case 6 · queue backpressure missing
  baseCase({
    case_id: "nri_v1_006",
    defect_class: "reliability.unbounded_recursion",
    difficulty: "ADVANCED",
    requirement: "the accommodation network ingester should apply backpressure to the upstream producer when the local processing queue is full.",
    request: {
      review_id: "nri_v1_006_req",
      requirement: "the accommodation network ingester should apply backpressure to the upstream producer when the local processing queue is full.",
      implementation: { id: "impl_nri_006", files: ["src/accommodation/network-ingester.ts"], summary: "accommodation network ingester that accepts every upstream event from the network producer and enqueues it into a growing internal buffer for later processing.", claim: "ingests events from upstream", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-ingester.test.ts"], passed: 1, failed: 0, summary: "checks that the network ingester accepts and enqueues events from the upstream producer.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Reactive Streams specification + Netflix Hystrix docs — an unbounded buffer accepting every upstream event leads to memory exhaustion; backpressure signals must be applied to the producer.", pointer: "https://www.reactive-streams.org/" }],
  }),

  // Case 7 · graceful degradation missing
  baseCase({
    case_id: "nri_v1_007",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVANCED",
    requirement: "the accommodation network recommender should degrade gracefully to a cached list when the upstream recommendation service is unavailable.",
    request: {
      review_id: "nri_v1_007_req",
      requirement: "the accommodation network recommender should degrade gracefully to a cached list when the upstream recommendation service is unavailable.",
      implementation: { id: "impl_nri_007", files: ["src/accommodation/network-recommender.ts"], summary: "accommodation network recommender that fetches the recommendation list from the upstream service and returns the fresh list from the response body.", claim: "returns fresh recommendation list", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-recommender.test.ts"], passed: 1, failed: 0, summary: "checks that the network recommender returns the fresh recommendation list after fetching from the upstream service.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "AWS Well-Architected Reliability Pillar · graceful degradation — non-critical dependencies must degrade to a cached or default response when unavailable; a bare fetch that only handles the happy path violates this.", pointer: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-your-workload-service-architecture.html" }],
  }),

  // Case 8 · NEGATIVE CONTROL · correctly-implemented full-stack resilience
  baseCase({
    case_id: "nri_v1_008",
    defect_class: "reliability.missing_timeout",
    difficulty: "ADVANCED",
    requirement: "the accommodation network gateway should reliably invoke the upstream booking API with timeout deadline propagation retry backoff jitter circuit breaker rate limit connection pool bulkhead idempotency and graceful degradation.",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    request: {
      review_id: "nri_v1_008_req",
      requirement: "the accommodation network gateway should reliably invoke the upstream booking API with timeout deadline propagation retry backoff jitter circuit breaker rate limit connection pool bulkhead idempotency and graceful degradation.",
      implementation: { id: "impl_nri_008", files: ["src/accommodation/network-gateway.ts"], summary: "accommodation network gateway that invokes the upstream booking API with a bounded timeout of 5000ms, propagates the caller deadline to downstream, retries transient failures with exponential backoff plus jitter capped at 4 attempts, opens a circuit breaker after 3 consecutive failures and remains open for 30 seconds, applies a token bucket rate limit of 50 requests per second, reuses a bounded connection pool of 20 sockets, isolates slow upstream via a dedicated bulkhead pool, applies idempotency keys per POST operation, and gracefully degrades to a cached response when the upstream is unavailable.", claim: "full resilience stack applied", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-gateway.test.ts"], passed: 12, failed: 0, summary: "checks that the network gateway returns payload on success, applies timeout of 5000ms, propagates deadline, retries with exponential backoff and jitter up to 4 attempts, opens the circuit breaker after 3 consecutive failures, applies rate limit of 50 rps, reuses connection pool of 20, isolates via bulkhead, uses idempotency keys, and degrades to cache when upstream is unavailable.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "This case implements ALL 10 resilience disciplines that the candidate's proposed knowledge covers (plus additional ones from v1-independent's sources). Reviewer WITH the knowledge should NOT fire a false positive because every required pattern IS evidenced.", pointer: "y-w5-1-a-2-negative-control-full-stack" }],
  }),

  // Case 9 · NEGATIVE CONTROL · pure-computation helper (different from v1's date-parser)
  baseCase({
    case_id: "nri_v1_009",
    defect_class: "reliability.missing_timeout",
    difficulty: "FOUNDATIONAL",
    requirement: "the accommodation price calculator should compute the discounted rate from base rate and discount percentage.",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    request: {
      review_id: "nri_v1_009_req",
      requirement: "the accommodation price calculator should compute the discounted rate from base rate and discount percentage.",
      implementation: { id: "impl_nri_009", files: ["src/accommodation/price-calculator.ts"], summary: "accommodation price calculator that multiplies the base rate by one minus the discount percentage divided by one hundred and returns the discounted rate rounded to two decimal places across all reasonable inputs.", claim: "computes discounted rate", claimed_by: "claude" },
      tests: { files: ["src/accommodation/price-calculator.test.ts"], passed: 5, failed: 0, summary: "checks that the price calculator returns the correct discounted rate for zero discount, standard discount, maximum discount, negative base rate rejection, and out-of-range discount rejection.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Negative control · pure computation with no network involvement. Even with the resilience knowledge injected, R6's domain-relevance gate must prevent it from firing (word 'network' does not appear in the request).", pointer: "y-w5-1-a-2-negative-control-pure-computation" }],
  }),

  // Case 10 · NEGATIVE CONTROL · UI state reducer (further from network domain)
  baseCase({
    case_id: "nri_v1_010",
    defect_class: "reliability.missing_timeout",
    difficulty: "FOUNDATIONAL",
    requirement: "the accommodation booking form reducer should update the form state when a field changes.",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    request: {
      review_id: "nri_v1_010_req",
      requirement: "the accommodation booking form reducer should update the form state when a field changes.",
      implementation: { id: "impl_nri_010", files: ["src/accommodation/booking-form-reducer.ts"], summary: "accommodation booking form reducer that returns a new state object with the changed field updated and every other field preserved for every dispatched field change action across every field type.", claim: "updates form state", claimed_by: "claude" },
      tests: { files: ["src/accommodation/booking-form-reducer.test.ts"], passed: 4, failed: 0, summary: "checks that the reducer updates the changed field, preserves other fields, handles empty input, and handles rapid successive dispatches correctly.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Negative control · UI state reducer · no network involvement whatsoever. Reviewer with resilience knowledge must NOT fire because domain-relevance gate blocks non-network requests.", pointer: "y-w5-1-a-2-negative-control-ui-reducer" }],
  }),

  // Case 11 · ADVERSARIAL · looks-like-network-but-isnt (word "network" absent)
  baseCase({
    case_id: "nri_v1_011",
    defect_class: "reliability.missing_timeout",
    difficulty: "ADVERSARIAL",
    requirement: "the accommodation upstream helper should invoke the remote booking API with reliable delivery guarantees.",
    request: {
      review_id: "nri_v1_011_req",
      requirement: "the accommodation upstream helper should invoke the remote booking API with reliable delivery guarantees.",
      implementation: { id: "impl_nri_011", files: ["src/accommodation/upstream-helper.ts"], summary: "accommodation upstream helper that invokes the remote booking API and returns the response payload from the successful call.", claim: "invokes upstream API", claimed_by: "claude" },
      tests: { files: ["src/accommodation/upstream-helper.test.ts"], passed: 1, failed: 0, summary: "checks that the upstream helper returns response payload after invoking the remote booking API.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth: "DEFECTIVE",
    expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Adversarial case · deliberately does NOT use the word 'network' in requirement or summary · instead uses 'upstream' and 'remote' and 'API'. Tests whether R6's domain-relevance gate is robust to synonymous vocabulary. Reviewer SHOULD still catch this (the underlying defect is real) but R6 may not fire if the gate is too strict on the word 'network'. Honest outcome test.", pointer: "y-w5-1-a-2-adversarial-vocabulary" }],
  }),

  // Case 12 · authentic full-gap network sync with retry-cap missing
  baseCase({
    case_id: "nri_v1_012",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network daily sync should pull the daily booking snapshot from the upstream reliably.",
    request: {
      review_id: "nri_v1_012_req",
      requirement: "the accommodation network daily sync should pull the daily booking snapshot from the upstream reliably.",
      implementation: { id: "impl_nri_012", files: ["src/accommodation/network-daily-sync.ts"], summary: "accommodation network daily sync that pulls the booking snapshot from the upstream once per day and stores it into the local snapshot cache.", claim: "syncs daily snapshot", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-daily-sync.test.ts"], passed: 1, failed: 0, summary: "checks that the network daily sync stores the snapshot after the upstream pull.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Fault tolerance discipline — daily sync must include timeout + retry with backoff + circuit breaker + fail-closed behavior. This case shows the happy-path only pattern.", pointer: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html" }],
  }),
]);

/** Freeze the corpus and return a stable-hashed snapshot. */
export function freezeNetworkResilienceCorpusV1Independent(): { corpus: BenchmarkCorpus; hash: string } {
  const corpus = freezeCorpus({
    version: CORPUS_VERSION_NETWORK_RESILIENCE_V1_INDEPENDENT,
    authored_by: "philip-y-w5-1-a-2-2026-09-07",
    cases: NETWORK_RESILIENCE_V1_INDEPENDENT_CASES as BenchmarkCase[],
  });
  const hash = createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex").slice(0, 16);
  return { corpus, hash };
}
