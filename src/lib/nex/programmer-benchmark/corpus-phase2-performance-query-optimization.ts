// src/lib/nex/programmer-benchmark/corpus-phase2-performance-query-optimization.ts
//
// Phase 2 · Cross-kind corpus for EXPERIENCE candidate
// Domain: performance.query_optimization (different from Phase 1's network and Phase 2's security)
// Philip 2026-09-07 · AUTHORIZE Phase 2

import { freezeCorpus } from "./corpus";
import { createHash } from "node:crypto";
import type { BenchmarkCase, BenchmarkCorpus } from "./types";

export const CORPUS_VERSION_P2_PERF_QUERY = "phase2-performance-query-optimization-v1";
export const PHASE2_EXPERIENCE_ID = "exp_p2_query_optimization";

function baseCase(over: Partial<BenchmarkCase>): BenchmarkCase {
  return {
    case_id: over.case_id!,
    corpus_version: CORPUS_VERSION_P2_PERF_QUERY,
    defect_class: over.defect_class ?? "temporal.timing_boundary",
    difficulty: over.difficulty ?? "INTERMEDIATE",
    requirement: over.requirement!,
    request: over.request!,
    ground_truth: over.ground_truth ?? "DEFECTIVE",
    expected_verdict: over.expected_verdict ?? "NEEDS_CHANGES",
    expected_finding_categories: over.expected_finding_categories ?? ["insufficient_evidence"],
    ground_truth_evidence: over.ground_truth_evidence!,
    provenance: over.provenance ?? "phase-2-performance-query-optimization-v1 · philip-authored 2026-09-07 · sources PostgreSQL-Performance-Tips + Use-the-Index-Luke",
  };
}

export const P2_PERF_QUERY_CASES: readonly BenchmarkCase[] = Object.freeze([
  baseCase({
    case_id: "p2_perf_001",
    difficulty: "INTERMEDIATE",
    requirement: "the query optimization helper should retrieve booking records efficiently for large tenants.",
    request: {
      review_id: "p2_perf_001_req",
      requirement: "the query optimization helper should retrieve booking records efficiently for large tenants.",
      implementation: { id: "impl_p2_p001", files: ["src/performance/query-booking.ts"], summary: "query helper that retrieves booking records for the tenant and returns the full array of results to the caller for processing.", claim: "retrieves records", claimed_by: "claude" },
      tests: { files: ["src/performance/query-booking.test.ts"], passed: 1, failed: 0, summary: "checks that the query helper returns the booking records array to the caller.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_experience_ids: [PHASE2_EXPERIENCE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Use the Index, Luke · Ch. 7 pagination — unbounded queries against large tables must include pagination and index-supported filtering.", pointer: "https://use-the-index-luke.com/no-offset" }],
  }),
  baseCase({
    case_id: "p2_perf_002",
    difficulty: "ADVANCED",
    requirement: "the performance query helper should retrieve accommodation listings efficiently for the search page.",
    request: {
      review_id: "p2_perf_002_req",
      requirement: "the performance query helper should retrieve accommodation listings efficiently for the search page.",
      implementation: { id: "impl_p2_p002", files: ["src/performance/query-listings.ts"], summary: "performance query helper that iterates through accommodation ids and issues a query per id to fetch each listing details.", claim: "fetches listings per id", claimed_by: "claude" },
      tests: { files: ["src/performance/query-listings.test.ts"], passed: 1, failed: 0, summary: "checks that the performance query helper returns the listing details after iterating the id set.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_experience_ids: [PHASE2_EXPERIENCE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "N+1 query anti-pattern — batching required · issuing one query per id is a well-known performance defect.", pointer: "https://use-the-index-luke.com/sql/join/nested-loops-join-n1-problem" }],
  }),
  baseCase({
    case_id: "p2_perf_003",
    difficulty: "INTERMEDIATE",
    requirement: "the performance query result should paginate the accommodation booking list for the user page.",
    request: {
      review_id: "p2_perf_003_req",
      requirement: "the performance query result should paginate the accommodation booking list for the user page.",
      implementation: { id: "impl_p2_p003", files: ["src/performance/query-user-bookings.ts"], summary: "performance query result helper that fetches the full booking list for the user and returns every record for the client-side pagination.", claim: "returns full list", claimed_by: "claude" },
      tests: { files: ["src/performance/query-user-bookings.test.ts"], passed: 1, failed: 0, summary: "checks that the performance query result returns the full booking list.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_experience_ids: [PHASE2_EXPERIENCE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Server-side pagination required · returning the full list defeats the purpose and fails at scale.", pointer: "https://use-the-index-luke.com/no-offset" }],
  }),
  baseCase({
    case_id: "p2_perf_004",
    difficulty: "ADVANCED",
    requirement: "the performance query joiner should retrieve the accommodation and its related booking count efficiently.",
    request: {
      review_id: "p2_perf_004_req",
      requirement: "the performance query joiner should retrieve the accommodation and its related booking count efficiently.",
      implementation: { id: "impl_p2_p004", files: ["src/performance/query-joiner.ts"], summary: "performance query joiner that fetches each accommodation individually and then loops through to count the bookings per accommodation from the bookings collection.", claim: "joins accommodation and bookings", claimed_by: "claude" },
      tests: { files: ["src/performance/query-joiner.test.ts"], passed: 1, failed: 0, summary: "checks that the performance query joiner returns the accommodation with its booking count.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_experience_ids: [PHASE2_EXPERIENCE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "GROUP BY aggregation at the database is the correct approach · per-row loop counting is O(n²) and wrong at scale.", pointer: "https://use-the-index-luke.com/sql/aggregation" }],
  }),
  // NEGATIVE CONTROL · correctly-optimized query
  baseCase({
    case_id: "p2_perf_005",
    difficulty: "INTERMEDIATE",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    requirement: "the performance query optimizer should retrieve booking records efficiently with pagination cursor batching and indexed filters.",
    request: {
      review_id: "p2_perf_005_req",
      requirement: "the performance query optimizer should retrieve booking records efficiently with pagination cursor batching and indexed filters.",
      implementation: { id: "impl_p2_p005", files: ["src/performance/query-optimizer.ts"], summary: "performance query optimizer that must include cursor-based pagination with bounded page size and must include batched loading of related records via a single JOIN and must include indexed filter columns and must include audit trail on slow query for the observability layer.", claim: "cursor pagination and batching and indexed filters", claimed_by: "claude" },
      tests: { files: ["src/performance/query-optimizer.test.ts"], passed: 6, failed: 0, summary: "checks that the performance query optimizer returns paginated results, respects cursor boundaries, batches related loads into a single query, uses the indexed filter, handles empty pages, and logs to audit trail on slow query.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_experience_ids: [PHASE2_EXPERIENCE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "This case correctly implements the experience's proven pattern (cursor pagination + batch loading + indexed filters + audit trail). Reviewer WITH the experience should NOT fire a false positive.", pointer: "phase-2-performance-negative-control" }],
  }),
  // NEGATIVE CONTROL · non-query domain
  baseCase({
    case_id: "p2_perf_006",
    difficulty: "FOUNDATIONAL",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    requirement: "the accommodation label generator should produce a display label from the accommodation record.",
    request: {
      review_id: "p2_perf_006_req",
      requirement: "the accommodation label generator should produce a display label from the accommodation record.",
      implementation: { id: "impl_p2_p006", files: ["src/accommodation/label-generator.ts"], summary: "accommodation label generator that combines the accommodation name and city into a formatted display label and returns it for the user interface across every language.", claim: "generates label", claimed_by: "claude" },
      tests: { files: ["src/accommodation/label-generator.test.ts"], passed: 4, failed: 0, summary: "checks that the label generator handles English names, Bahasa names, Japanese names, and missing city fallback correctly.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_experience_ids: [PHASE2_EXPERIENCE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Negative control · non-query domain · R8 relevance gate must prevent experience from firing (no shared task words).", pointer: "phase-2-performance-negative-control-nonquery" }],
  }),
]);

export function freezeP2PerfQueryCorpus(): { corpus: BenchmarkCorpus; hash: string } {
  const corpus = freezeCorpus({
    version: CORPUS_VERSION_P2_PERF_QUERY,
    authored_by: "philip-phase2-performance-2026-09-07",
    cases: P2_PERF_QUERY_CASES as BenchmarkCase[],
  });
  const hash = createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex").slice(0, 16);
  return { corpus, hash };
}
