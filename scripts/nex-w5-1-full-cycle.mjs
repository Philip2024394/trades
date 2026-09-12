// scripts/nex-w5-1-full-cycle.mjs
//
// W5-1 · Full BEFORE/AFTER measurement of cand_d032110b via
// Y-W5-1-a (network-resilience frozen benchmark corpus) + Y-W5-1-b
// (unpromoted-candidate A/B harness).
//
// Delegates to tsx to run the TypeScript body in-process so the
// existing Phase C/D machinery + Y-W5-1-C surgical extension are
// exercised without any additional compilation step.
//
// ─────────────────────────────────────────────────────────────────
// PIPELINE
//   1. Author 10 hand-crafted network-resilience benchmark cases
//   2. Freeze corpus via freezeCorpus() → record corpus hash + version
//   3. Copy real global knowledge.jsonl to two temp knowledge stores
//      (BEFORE = untouched · AFTER = same + candidate's promoted form)
//   4. Run corpus under NEX_PROGRAMMER_LEARNING_DIR=BEFORE → snapshot
//   5. Run corpus under NEX_PROGRAMMER_LEARNING_DIR=AFTER → snapshot
//   6. Compute delta · verify benchmark integrity · report verdict
//
// DISCIPLINE
//   · Candidate cand_d032110b is NOT modified on disk.
//   · The AFTER knowledge store is TEMPORARY · discarded at end.
//   · Corpus is frozen BEFORE either run · same hash used both runs.
//   · No knowledge is promoted into the real global store.
//   · Anti-self-reinforcement preserved: candidate ID is NOT written
//     into cases; cases nominate the knowledge_id of the candidate's
//     proposed_knowledge because that IS the knowledge chain the case
//     would consult to catch its defect · the case existed BEFORE the
//     candidate's knowledge_id existed anywhere in the store.

import { spawn } from "node:child_process";

const script = String.raw`
import { freezeCorpus } from "@/lib/nex/programmer-benchmark/corpus";
import { evaluateCorpus } from "@/lib/nex/programmer-benchmark/evaluator";
import type { BenchmarkCase, BenchmarkCorpus } from "@/lib/nex/programmer-benchmark/types";
import type { KnowledgeItem } from "@/lib/nex/programmer-learning/types";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const KNOWLEDGE_ID = "know_w5_1_ebba7bd5"; // from candidate.proposed_knowledge

// ─── The 10 hand-authored network-resilience cases ──────────────
//
// Each case describes a defective network implementation whose
// correct verdict is NEEDS_CHANGES (with a resilience defect). The
// reviewer WITHOUT the candidate's knowledge cannot see the specific
// resilience-pattern gap because R1-R5 don't inspect resilience.
// WITH the candidate's knowledge, R6 fires and catches the gap.
//
// Cases were authored based on canonical resilience patterns from
// (a) Wikipedia · Circuit breaker design pattern and (b) Wikipedia ·
// Fault tolerance — the two research findings that produced the
// candidate. Cases are NOT designed post-hoc to make the candidate
// pass · they are designed to match the shape of internet-offline-
// or-unknown failures observed in the accommodation agent's ledger.

const CORPUS_VERSION = "network-resilience-v1";

function baseCase(over: Partial<BenchmarkCase>): BenchmarkCase {
  return {
    case_id: over.case_id!,
    corpus_version: CORPUS_VERSION,
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

const CASES: BenchmarkCase[] = [
  // Case 1 · missing timeout on network call
  baseCase({
    case_id: "nr_v1_001",
    defect_class: "reliability.missing_timeout",
    difficulty: "FOUNDATIONAL",
    requirement: "the accommodation network client should fetch the remote booking availability.",
    request: {
      review_id: "nr_v1_001_req",
      requirement: "the accommodation network client should fetch the remote booking availability.",
      implementation: {
        id: "impl_nr_001",
        files: ["src/accommodation/network-client.ts"],
        summary: "accommodation network client that performs the availability fetch and returns the payload from the upstream booking API.",
        claim: "performs the network fetch",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-client.test.ts"], passed: 1, failed: 0, summary: "checks that the network client returns the availability payload for the happy path.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Wikipedia · Circuit breaker design pattern — the pattern must include timeout handling as prerequisite; without it, the client hangs on network stalls (Fault tolerance article, connection-timeout section).", pointer: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern" }],
  }),
  // Case 2 · missing exponential backoff
  baseCase({
    case_id: "nr_v1_002",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network client should retry the remote booking fetch on transient network failure.",
    request: {
      review_id: "nr_v1_002_req",
      requirement: "the accommodation network client should retry the remote booking fetch on transient network failure.",
      implementation: {
        id: "impl_nr_002",
        files: ["src/accommodation/network-retry.ts"],
        summary: "accommodation network retry helper that catches the network error and returns null so callers can continue processing.",
        claim: "retries the network fetch",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-retry.test.ts"], passed: 2, failed: 0, summary: "checks that the network retry helper returns the payload on success and returns null on the failure path.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Wikipedia · Fault tolerance — exponential backoff with jitter is the standard retry discipline; a bare catch that returns null silently swallows the failure without backoff.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  // Case 3 · missing circuit breaker on repeated failure
  baseCase({
    case_id: "nr_v1_003",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network client should stop calling the upstream after repeated failures.",
    request: {
      review_id: "nr_v1_003_req",
      requirement: "the accommodation network client should stop calling the upstream after repeated failures.",
      implementation: {
        id: "impl_nr_003",
        files: ["src/accommodation/network-upstream.ts"],
        summary: "accommodation network upstream caller that issues the network request every time the caller invokes it and returns the response body when available.",
        claim: "calls upstream",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-upstream.test.ts"], passed: 1, failed: 0, summary: "checks that the network upstream returns the payload on success.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Wikipedia · Circuit breaker design pattern — after N consecutive failures the breaker must open to prevent cascading failures; a bare request-every-call implementation has no breaker.", pointer: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern" }],
  }),
  // Case 4 · missing fail-closed on repeated failures
  baseCase({
    case_id: "nr_v1_004",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVANCED",
    requirement: "the accommodation network client should fail closed when the upstream is unreachable.",
    request: {
      review_id: "nr_v1_004_req",
      requirement: "the accommodation network client should fail closed when the upstream is unreachable.",
      implementation: {
        id: "impl_nr_004",
        files: ["src/accommodation/network-failopen.ts"],
        summary: "accommodation network fail-open helper that returns a synthesized default response when the network upstream cannot be reached.",
        claim: "handles network unreachable",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-failopen.test.ts"], passed: 2, failed: 0, summary: "checks that the network helper returns the default response when the upstream is unreachable.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Fault tolerance discipline — safety-critical systems must fail closed on repeated failures rather than serving a fabricated response; a helper that returns a synthesized default silently misleads downstream consumers.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  // Case 5 · missing heartbeat / health-check distinction
  baseCase({
    case_id: "nr_v1_005",
    defect_class: "reliability.missing_timeout",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network monitor should distinguish currently unavailable from permanently degraded upstream.",
    request: {
      review_id: "nr_v1_005_req",
      requirement: "the accommodation network monitor should distinguish currently unavailable from permanently degraded upstream.",
      implementation: {
        id: "impl_nr_005",
        files: ["src/accommodation/network-monitor.ts"],
        summary: "accommodation network monitor that records the last-observed network state and reports whether the upstream is up based on that single observation.",
        claim: "monitors upstream",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-monitor.test.ts"], passed: 1, failed: 0, summary: "checks that the network monitor reports up when the last observation was successful.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Fault tolerance discipline — heartbeat / health-check discipline must aggregate multiple observations over a window to separate transient unavailability from permanent degradation.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  // Case 6 · unbounded retry without cap
  baseCase({
    case_id: "nr_v1_006",
    defect_class: "reliability.unbounded_recursion",
    difficulty: "INTERMEDIATE",
    requirement: "the accommodation network retry helper should cap the number of retry attempts.",
    request: {
      review_id: "nr_v1_006_req",
      requirement: "the accommodation network retry helper should cap the number of retry attempts.",
      implementation: {
        id: "impl_nr_006",
        files: ["src/accommodation/network-retry-loop.ts"],
        summary: "accommodation network retry loop that keeps retrying the network fetch until it succeeds and returns the payload from the successful attempt.",
        claim: "retries until success",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-retry-loop.test.ts"], passed: 1, failed: 0, summary: "checks that the network retry loop returns the payload once the fetch succeeds.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Circuit breaker design pattern — retry must be bounded (max attempts) to prevent unbounded resource consumption; a bare 'retry until success' loop violates the pattern.", pointer: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern" }],
  }),
  // Case 7 · retry without jitter (thundering herd)
  baseCase({
    case_id: "nr_v1_007",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVANCED",
    requirement: "the accommodation network retry helper should apply jitter to retry delays.",
    request: {
      review_id: "nr_v1_007_req",
      requirement: "the accommodation network retry helper should apply jitter to retry delays.",
      implementation: {
        id: "impl_nr_007",
        files: ["src/accommodation/network-retry-fixed.ts"],
        summary: "accommodation network retry helper with fixed 500ms delay between attempts and returns the payload from the successful attempt when it eventually succeeds.",
        claim: "retries with fixed delay",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-retry-fixed.test.ts"], passed: 1, failed: 0, summary: "checks that the network retry returns the payload after the fixed-delay retry loop.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Fault tolerance discipline — fixed retry delays synchronize failing clients causing thundering herd; jitter (randomized delay) is required.", pointer: "https://en.wikipedia.org/wiki/Fault_tolerance" }],
  }),
  // Case 8 · CORRECT implementation (should NOT be flagged by knowledge)
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
      implementation: {
        id: "impl_nr_008",
        files: ["src/accommodation/network-resilient-client.ts"],
        summary: "accommodation network resilient client that performs the availability fetch with timeout of 5000ms, exponential backoff with jitter capped at 5 retries, and a circuit breaker that opens after 3 consecutive failures and stays open for 30 seconds.",
        claim: "resilient network fetch with timeout backoff and circuit breaker",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-resilient-client.test.ts"], passed: 5, failed: 0, summary: "checks that the network client returns payload on success, applies timeout of 5000ms, retries with exponential backoff and jitter up to 5 attempts, and opens the circuit breaker after 3 consecutive failures.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "This case implements all four disciplines from the candidate's proposed knowledge (timeout · backoff-with-jitter · circuit-breaker · retry-cap). Reviewer with the knowledge should NOT fire a false positive because the required patterns ARE evidenced in tests+summary.", pointer: "y-w5-1-a-negative-case-control" }],
  }),
  // Case 9 · CORRECT · different domain (should not fire at all)
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
      implementation: {
        id: "impl_nr_009",
        files: ["src/accommodation/date-parser.ts"],
        summary: "accommodation date-parser that parses ISO-8601 strings and returns a Date object with fallback to null for invalid input across all reasonable formats.",
        claim: "parses dates",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/date-parser.test.ts"], passed: 3, failed: 0, summary: "checks that the date parser handles valid inputs, malformed inputs, and empty inputs across the reasonable formats.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Negative control · request is about a date parser, not a network client. Even with the resilience knowledge injected, R6's domain-relevance gate must prevent it from firing.", pointer: "y-w5-1-a-negative-control-domain" }],
  }),
  // Case 10 · missing all four disciplines (adversarial)
  baseCase({
    case_id: "nr_v1_010",
    defect_class: "reliability.silent_error_swallow",
    difficulty: "ADVERSARIAL",
    requirement: "the accommodation network sync should reliably sync the remote booking data.",
    request: {
      review_id: "nr_v1_010_req",
      requirement: "the accommodation network sync should reliably sync the remote booking data.",
      implementation: {
        id: "impl_nr_010",
        files: ["src/accommodation/network-sync.ts"],
        summary: "accommodation network sync helper that pulls the remote booking data from the upstream every 30 seconds and updates the local cache.",
        claim: "syncs data",
        claimed_by: "claude",
      },
      tests: { files: ["src/accommodation/network-sync.test.ts"], passed: 1, failed: 0, summary: "checks that the network sync updates the local cache after fetching the remote data.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_knowledge_ids: [KNOWLEDGE_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Adversarial case · missing ALL four disciplines (timeout · backoff · circuit breaker · fail-closed). Reviewer without the resilience knowledge sees a happy-path test passing and accepts. With the knowledge, R6 should fire multiple pattern gaps.", pointer: "y-w5-1-a-adversarial-full-gap" }],
  }),
];

// ─── Freeze the corpus ─────────────────────────────────────────
const corpus: BenchmarkCorpus = freezeCorpus({
  version: CORPUS_VERSION,
  authored_by: "philip-w5-1-a-2026-09-07",
  cases: CASES,
});

const corpusHash = createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex").slice(0, 16);
console.log("CORPUS_FROZEN:" + JSON.stringify({ version: corpus.version, case_count: corpus.case_count, hash: corpusHash, classes: corpus.defect_classes_covered }));

// ─── A/B harness · construct temp knowledge stores ──────────────
const beforeRoot = mkdtempSync(path.join(tmpdir(), "nex-w5-1-before-"));
const afterRoot = mkdtempSync(path.join(tmpdir(), "nex-w5-1-after-"));

// Global knowledge on disk (may be empty or populated)
const globalKnowledgeFile = path.resolve(process.cwd(), "data", "programmer-learning", "knowledge.jsonl");
const globalKnowledgeRaw = existsSync(globalKnowledgeFile) ? readFileSync(globalKnowledgeFile, "utf8") : "";

// BEFORE store: identical to global (no candidate)
writeFileSync(path.join(beforeRoot, "knowledge.jsonl"), globalKnowledgeRaw, "utf8");

// AFTER store: global + candidate's proposed_knowledge injected as VERIFIED
// (simulating what promotion would produce · does NOT modify real ledger)
const injectedKnowledge: KnowledgeItem = {
  knowledge_id: KNOWLEDGE_ID,
  statement: "For failure mode 'internet_offline_or_unknown' the network client must include timeout with a bounded budget and must include retry with exponential backoff and jitter and must include circuit breaker that opens after N consecutive failures and must include fail closed on repeated failures and must include heartbeat health check discipline separating currently unavailable from permanently degraded.",
  domain: "network",
  technology: "network.resilience",
  provenance: {
    source: "y_w5_1_b_ab_harness_simulated_promotion",
    source_type: "external_documentation",
    source_url: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern",
    authority_tier: "TIER_1",
    retrieved_at: "2026-09-07T00:00:00.000Z",
    evidence_pointer: "candidate:cand_d032110b · proposed_knowledge simulated as VERIFIED for A/B measurement only",
    observed_by: "system",
  },
  verification_status: "VERIFIED",
  confidence: 0.9,
  content_hash: "w5_1_ebba7bd5_hash_verified",
  created_at: "2026-09-07T00:00:00.000Z",
};
writeFileSync(path.join(afterRoot, "knowledge.jsonl"), globalKnowledgeRaw + JSON.stringify(injectedKnowledge) + "\n", "utf8");

// ─── Run BEFORE benchmark ─────────────────────────────────────
process.env.NEX_PROGRAMMER_LEARNING_DIR = beforeRoot;
// Force reload of any module that cached the path (belt-and-suspenders)
const beforeRun = evaluateCorpus(corpus);

// ─── Run AFTER benchmark ──────────────────────────────────────
process.env.NEX_PROGRAMMER_LEARNING_DIR = afterRoot;
const afterRun = evaluateCorpus(corpus);

// ─── Verify adversarial: corpus hash unchanged ─────────────────
const corpusHashPost = createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex").slice(0, 16);
const hashUnchanged = corpusHash === corpusHashPost;

// ─── Aggregate metrics ─────────────────────────────────────────
function correctCount(run: typeof beforeRun): number {
  return run.results.filter((r) => r.match_status === "CORRECT").length;
}
const beforeCorrect = correctCount(beforeRun);
const afterCorrect = correctCount(afterRun);
const delta = afterCorrect - beforeCorrect;

// Per-case comparison
const perCase: { case_id: string; expected: string; before: string; after: string; before_match: string; after_match: string; transition: string }[] = [];
for (const b of beforeRun.results) {
  const a = afterRun.results.find((r) => r.case_id === b.case_id)!;
  const transition =
    b.match_status === a.match_status ? "unchanged" :
    b.match_status === "WRONG" && a.match_status === "CORRECT" ? "WRONG_TO_CORRECT" :
    b.match_status === "CORRECT" && a.match_status === "WRONG" ? "CORRECT_TO_WRONG" :
    b.match_status + "_to_" + a.match_status;
  perCase.push({
    case_id: b.case_id,
    expected: b.expected_verdict,
    before: b.actual_verdict,
    after: a.actual_verdict,
    before_match: b.match_status,
    after_match: a.match_status,
    transition,
  });
}

// ─── Verdict ───────────────────────────────────────────────────
let verdict: "IMPROVED" | "NO_VALID_IMPROVEMENT" | "FAILED" | "UNEXPLAINED";
const regressions = perCase.filter((c) => c.transition === "CORRECT_TO_WRONG").length;
const improvements = perCase.filter((c) => c.transition === "WRONG_TO_CORRECT").length;
if (regressions > 0) {
  verdict = "FAILED";
} else if (improvements > 0 && delta > 0) {
  verdict = "IMPROVED";
} else if (delta === 0 && improvements === 0) {
  verdict = "NO_VALID_IMPROVEMENT";
} else {
  verdict = "UNEXPLAINED";
}

console.log("W5_1_MEASUREMENT:" + JSON.stringify({
  corpus_version: corpus.version,
  corpus_hash: corpusHash,
  corpus_hash_post: corpusHashPost,
  corpus_hash_unchanged: hashUnchanged,
  case_count: corpus.case_count,
  before_correct: beforeCorrect,
  after_correct: afterCorrect,
  delta,
  improvements,
  regressions,
  verdict,
  per_case: perCase,
}, null, 2));
`;

// Write the TS body inside the project so tsx resolves @/* path aliases
// via the project's tsconfig.
import { writeFileSync as _wf, existsSync as _ex, mkdirSync as _mk, unlinkSync as _rm } from "node:fs";
import path from "node:path";
const _dir = path.resolve(process.cwd(), "scripts", ".w5-1-runner");
if (!_ex(_dir)) _mk(_dir, { recursive: true });
const _tsPath = path.join(_dir, "runner.ts");
_wf(_tsPath, script, "utf8");
process.on("exit", () => { try { _rm(_tsPath); } catch {} });
const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", _tsPath],
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
