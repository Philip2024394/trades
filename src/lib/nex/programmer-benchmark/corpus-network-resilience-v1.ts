// src/lib/nex/programmer-benchmark/corpus-network-resilience-v1.ts
//
// Y-W5-1-a · Network-Resilience Frozen Benchmark Corpus v1
// Philip 2026-09-07 · AUTHORIZE Y-W5-1-a
//
// SEPARATE ATTRIBUTION: this file is Y-W5-1-a ONLY.
//   · defines cases + freezes the corpus + records version+hash
//   · does NOT know about the candidate injection mechanism
//   · does NOT know about the A/B harness (that is Y-W5-1-b)
//   · does NOT run measurements
//
// The candidate whose knowledge these cases exist to test is
// cand_d032110b-99af-4a58-82fd-26bc101c201b (proposed_knowledge id
// know_w5_1_ebba7bd5). Cases NOMINATE that knowledge_id in each
// request's relevant_knowledge_ids because that IS the knowledge
// chain a competent engineer would consult for the defect domain
// each case exhibits. Whether that knowledge_id resolves to an
// actual item in the knowledge store is what BEFORE/AFTER measures.
//
// Cases are hand-authored from canonical sources:
//   · Wikipedia · Circuit breaker design pattern (TIER_3)
//   · Wikipedia · Fault tolerance (TIER_3)
// Cases are NOT designed post-hoc to make the candidate pass. Cases
// target real network-resilience defect classes from the existing
// DefectClass enum. Two NEGATIVE CONTROLS are included to prove
// knowledge does not fire false positives.
//
// FROZEN. Do not modify cases after any evaluation has been run.

import { freezeCorpus } from "./corpus";
import { createHash } from "node:crypto";
import type { BenchmarkCase, BenchmarkCorpus } from "./types";

export const CORPUS_VERSION_NETWORK_RESILIENCE_V1 = "network-resilience-v1";

// The knowledge_id the candidate's proposed_knowledge carries.
// The corpus references this ID from case requests because a
// competent engineer consulting knowledge for these defects would
// consult exactly this ID. Whether it resolves is the measurement.
export const CANDIDATE_PROPOSED_KNOWLEDGE_ID = "know_w5_1_ebba7bd5";

function baseCase(over: Partial<BenchmarkCase>): BenchmarkCase {
  return {
    case_id: over.case_id!,
    corpus_version: CORPUS_VERSION_NETWORK_RESILIENCE_V1,
    defect_class: over.defect_class ?? "reliability.missing_timeout",
    difficulty: over.difficulty ?? "INTERMEDIATE",
    requirement: over.requirement!,
    request: over.request!,
    ground_truth: over.ground_truth ?? "DEFECTIVE",
    expected_verdict: over.expected_verdict ?? "NEEDS_CHANGES",
    expected_finding_categories: over.expected_finding_categories ?? ["insufficient_evidence"],
    ground_truth_evidence: over.ground_truth_evidence!,
    provenance: over.provenance ?? "y-w5-1-a-network-resilience-v1 · philip-authored 2026-09-07 · based on Wikipedia Circuit_breaker_design_pattern and Fault_tolerance",
  };
}

export const NETWORK_RESILIENCE_V1_CASES: readonly BenchmarkCase[] = Object.freeze([
  baseCase({
    case_id: "nr_v1_001",
    defect_class: "reliability.missing_timeout",
    difficulty: "FOUNDATIONAL",
    requirement: "the accommodation network client should fetch the remote booking availability.",
    request: {
      review_id: "nr_v1_001_req",
      requirement: "the accommodation network client should fetch the remote booking availability.",
      implementation: { id: "impl_nr_001", files: ["src/accommodation/network-client.ts"], summary: "accommodation network client that performs the availability fetch and returns the payload from the upstream booking API.", claim: "performs the network fetch", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-client.test.ts"], passed: 1, failed: 0, summary: "checks that the network client returns the availability payload for the happy path.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Wikipedia · Circuit breaker design pattern — the pattern must include timeout handling as prerequisite; without it, the client hangs on network stalls (Fault tolerance article, connection-timeout section).", pointer: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern" }],
  }),
  baseCase({
    case_id: "nr_v1_002",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network client should retry the remote booking fetch on transient network failure.",
    request: {
      review_id: "nr_v1_002_req",
      requirement: "the accommodation network client should retry the remote booking fetch on transient network failure.",
      implementation: { id: "impl_nr_002", files: ["src/accommodation/network-retry.ts"], summary: "accommodation network retry helper that catches the network error and returns null so callers can continue processing.", claim: "retries the network fetch", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-retry.test.ts"], passed: 2, failed: 0, summary: "checks that the network retry helper returns the payload on success and returns null on the failure path.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Wikipedia · Fault tolerance — exponential backoff with jitter is the standard retry discipline; a bare catch that returns null silently swallows the failure without backoff.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  baseCase({
    case_id: "nr_v1_003",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network client should stop calling the upstream after repeated failures.",
    request: {
      review_id: "nr_v1_003_req",
      requirement: "the accommodation network client should stop calling the upstream after repeated failures.",
      implementation: { id: "impl_nr_003", files: ["src/accommodation/network-upstream.ts"], summary: "accommodation network upstream caller that issues the network request every time the caller invokes it and returns the response body when available.", claim: "calls upstream", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-upstream.test.ts"], passed: 1, failed: 0, summary: "checks that the network upstream returns the payload on success.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Wikipedia · Circuit breaker design pattern — after N consecutive failures the breaker must open to prevent cascading failures; a bare request-every-call implementation has no breaker.", pointer: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern" }],
  }),
  baseCase({
    case_id: "nr_v1_004",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVANCED",
    requirement: "the accommodation network client should fail closed when the upstream is unreachable.",
    request: {
      review_id: "nr_v1_004_req",
      requirement: "the accommodation network client should fail closed when the upstream is unreachable.",
      implementation: { id: "impl_nr_004", files: ["src/accommodation/network-failopen.ts"], summary: "accommodation network fail-open helper that returns a synthesized default response when the network upstream cannot be reached.", claim: "handles network unreachable", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-failopen.test.ts"], passed: 2, failed: 0, summary: "checks that the network helper returns the default response when the upstream is unreachable.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Fault tolerance discipline — safety-critical systems must fail closed on repeated failures rather than serving a fabricated response; a helper that returns a synthesized default silently misleads downstream consumers.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  baseCase({
    case_id: "nr_v1_005",
    defect_class: "reliability.missing_timeout",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network monitor should distinguish currently unavailable from permanently degraded upstream.",
    request: {
      review_id: "nr_v1_005_req",
      requirement: "the accommodation network monitor should distinguish currently unavailable from permanently degraded upstream.",
      implementation: { id: "impl_nr_005", files: ["src/accommodation/network-monitor.ts"], summary: "accommodation network monitor that records the last-observed network state and reports whether the upstream is up based on that single observation.", claim: "monitors upstream", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-monitor.test.ts"], passed: 1, failed: 0, summary: "checks that the network monitor reports up when the last observation was successful.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Fault tolerance discipline — heartbeat / health-check discipline must aggregate multiple observations over a window to separate transient unavailability from permanent degradation.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  baseCase({
    case_id: "nr_v1_006",
    defect_class: "reliability.unbounded_recursion",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network retry helper should cap the number of retry attempts.",
    request: {
      review_id: "nr_v1_006_req",
      requirement: "the accommodation network retry helper should cap the number of retry attempts.",
      implementation: { id: "impl_nr_006", files: ["src/accommodation/network-retry-loop.ts"], summary: "accommodation network retry loop that keeps retrying the network fetch until it succeeds and returns the payload from the successful attempt.", claim: "retries until success", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-retry-loop.test.ts"], passed: 1, failed: 0, summary: "checks that the network retry loop returns the payload once the fetch succeeds.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Circuit breaker design pattern — retry must be bounded (max attempts) to prevent unbounded resource consumption; a bare 'retry until success' loop violates the pattern.", pointer: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern" }],
  }),
  baseCase({
    case_id: "nr_v1_007",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVANCED",
    requirement: "the accommodation network retry helper should apply jitter to retry delays.",
    request: {
      review_id: "nr_v1_007_req",
      requirement: "the accommodation network retry helper should apply jitter to retry delays.",
      implementation: { id: "impl_nr_007", files: ["src/accommodation/network-retry-fixed.ts"], summary: "accommodation network retry helper with fixed 500ms delay between attempts and returns the payload from the successful attempt when it eventually succeeds.", claim: "retries with fixed delay", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-retry-fixed.test.ts"], passed: 1, failed: 0, summary: "checks that the network retry returns the payload after the fixed-delay retry loop.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Fault tolerance discipline — fixed retry delays synchronize failing clients causing thundering herd; jitter (randomized delay) is required.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  // NEGATIVE CONTROL · correctly-implemented resilience
  baseCase({
    case_id: "nr_v1_008",
    defect_class: "reliability.missing_timeout",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network client should fetch the remote booking availability with timeout and exponential backoff and circuit breaker.",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    request: {
      review_id: "nr_v1_008_req",
      requirement: "the accommodation network client should fetch the remote booking availability with timeout and exponential backoff and circuit breaker.",
      implementation: { id: "impl_nr_008", files: ["src/accommodation/network-resilient-client.ts"], summary: "accommodation network resilient client that performs the availability fetch with timeout of 5000ms, exponential backoff with jitter capped at 5 retries, and a circuit breaker that opens after 3 consecutive failures and stays open for 30 seconds.", claim: "resilient network fetch with timeout backoff and circuit breaker", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-resilient-client.test.ts"], passed: 5, failed: 0, summary: "checks that the network client returns payload on success, applies timeout of 5000ms, retries with exponential backoff and jitter up to 5 attempts, and opens the circuit breaker after 3 consecutive failures.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "This case implements all four disciplines from the candidate's proposed knowledge (timeout · backoff-with-jitter · circuit-breaker · retry-cap). Reviewer with the knowledge should NOT fire a false positive because the required patterns ARE evidenced in tests+summary.", pointer: "y-w5-1-a-negative-case-control" }],
  }),
  // NEGATIVE CONTROL · non-network domain
  baseCase({
    case_id: "nr_v1_009",
    defect_class: "reliability.missing_timeout",
    difficulty: "FOUNDATIONAL",
    requirement: "the accommodation date-parser should parse ISO-8601 strings correctly.",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    request: {
      review_id: "nr_v1_009_req",
      requirement: "the accommodation date-parser should parse ISO-8601 strings correctly.",
      implementation: { id: "impl_nr_009", files: ["src/accommodation/date-parser.ts"], summary: "accommodation date-parser that parses ISO-8601 strings and returns a Date object with fallback to null for invalid input across all reasonable formats.", claim: "parses dates", claimed_by: "claude" },
      tests: { files: ["src/accommodation/date-parser.test.ts"], passed: 3, failed: 0, summary: "checks that the date parser handles valid inputs, malformed inputs, and empty inputs across the reasonable formats.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Negative control · request is about a date parser, not a network client. Even with the resilience knowledge injected, R6's domain-relevance gate must prevent it from firing.", pointer: "y-w5-1-a-negative-control-domain" }],
  }),
  baseCase({
    case_id: "nr_v1_010",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVERSARIAL",
    requirement: "the accommodation network sync should reliably sync the remote booking data.",
    request: {
      review_id: "nr_v1_010_req",
      requirement: "the accommodation network sync should reliably sync the remote booking data.",
      implementation: { id: "impl_nr_010", files: ["src/accommodation/network-sync.ts"], summary: "accommodation network sync helper that pulls the remote booking data from the upstream every 30 seconds and updates the local cache.", claim: "syncs data", claimed_by: "claude" },
      tests: { files: ["src/accommodation/network-sync.test.ts"], passed: 1, failed: 0, summary: "checks that the network sync updates the local cache after fetching the remote data.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [CANDIDATE_PROPOSED_KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Adversarial case · missing ALL four disciplines (timeout · backoff · circuit breaker · fail-closed). Reviewer without the resilience knowledge sees a happy-path test passing and accepts. With the knowledge, R6 should fire multiple pattern gaps.", pointer: "y-w5-1-a-adversarial-full-gap" }],
  }),
]);

/** Freeze the corpus and return a stable-hashed snapshot. */
export function freezeNetworkResilienceCorpusV1(): { corpus: BenchmarkCorpus; hash: string } {
  const corpus = freezeCorpus({
    version: CORPUS_VERSION_NETWORK_RESILIENCE_V1,
    authored_by: "philip-y-w5-1-a-2026-09-07",
    cases: NETWORK_RESILIENCE_V1_CASES as BenchmarkCase[],
  });
  const hash = createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex").slice(0, 16);
  return { corpus, hash };
}
