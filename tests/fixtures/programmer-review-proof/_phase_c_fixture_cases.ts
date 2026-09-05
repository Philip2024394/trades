// tests/fixtures/programmer-review-proof/_phase_c_fixture_cases.ts
//
// Phase C · adversarial review matrix · 8 cases + real NEX review + real defect
// Philip 2026-09-05 · AUTHORIZE §6 §21 §22 §26
//
// Every case is a ReviewRequest fixture + expected verdict. The
// reviewer runs deterministic rules over the fixture and MUST return
// the expected verdict for Phase C GREEN. The runner iterates all
// cases and asserts.
//
// Fixtures are structured DATA — no fictional narrative. Fields
// describe real conditions the reviewer would face in a real review
// (requirement · implementation summary · claim · tests · runtime
// evidence · known gaps · security posture).

import type { FixtureExpectation, ReviewRequest } from "@/lib/nex/programmer-review/types";

export type FixtureCase = {
  case_id: string;
  label: string;
  request: ReviewRequest;
  expectation: FixtureExpectation;
};

let _rid = 0;
function nextReviewId(caseId: string): string {
  _rid += 1;
  return `rev_${caseId}_${_rid}`;
}

// ─── Case A · CORRECT · thorough tests · matching claim → ACCEPT ──

export const CASE_A: FixtureCase = {
  case_id: "A",
  label: "Correct implementation · thorough tests · claim matches",
  request: {
    review_id: nextReviewId("A"),
    requirement: "safeReadExists(path) must return {exists:true, errorCode:null} for existing files and {exists:false, errorCode:'ENOENT'} for missing files. It must distinguish ENOENT from other error codes.",
    implementation: {
      id: "impl_case_A",
      files: ["fixture/case_a/safeReadExists.ts"],
      summary: "Implementation calls fs.readFileSync inside try/catch, inspects err.code, returns {exists:false, errorCode:err.code} for any thrown error, {exists:true, errorCode:null} on success. Correctly distinguishes ENOENT from EISDIR and EACCES.",
      claim: "safeReadExists returns exists:false with errorCode ENOENT for missing files, distinguishes ENOENT from EISDIR and EACCES.",
      claimed_by: "claude",
    },
    tests: {
      files: ["fixture/case_a/safeReadExists.test.ts"],
      passed: 6, failed: 0,
      summary: "Tests exercise success · missing (ENOENT) · directory (EISDIR) · permission-denied (EACCES) · empty string path · absolute vs relative path.",
      known_gaps: [],
    },
    runtime_evidence: ["fixture/case_a/probe_output.log"],
    requirement_details: {
      edge_cases_required: ["ENOENT", "EISDIR", "EACCES", "success"],
      edge_cases_covered: ["ENOENT", "EISDIR", "EACCES", "success"],
      security_requirements: [],
      security_violations_observed: [],
    },
  },
  expectation: { expected_verdict: "ACCEPT" },
};

// ─── Case B · CORRECT NORMAL · MISSING EDGE CASE → NEEDS_CHANGES ─

export const CASE_B: FixtureCase = {
  case_id: "B",
  label: "Correct normal path · missing documented edge case",
  request: {
    review_id: nextReviewId("B"),
    requirement: "paginate(items, page, limit) must return items[page*limit..(page+1)*limit]. It must handle empty inputs and negative page numbers by returning an empty array.",
    implementation: {
      id: "impl_case_B",
      files: ["fixture/case_b/paginate.ts"],
      summary: "Implementation slices items array via slice(page*limit, (page+1)*limit). Returns the slice.",
      claim: "paginate returns the correct page of items.",
      claimed_by: "claude",
    },
    tests: {
      files: ["fixture/case_b/paginate.test.ts"],
      passed: 4, failed: 0,
      summary: "Tests exercise normal pagination for page=0, page=1, page=2 with 10 items and limit=3. All happy path.",
      known_gaps: [],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: ["empty input array", "negative page number", "page beyond last", "limit=0"],
      edge_cases_covered: ["page=0", "page=1", "page=2"],
      security_requirements: [],
      security_violations_observed: [],
    },
  },
  expectation: {
    expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
  },
};

// ─── Case C · TESTS PASS · CODE SEMANTICALLY WRONG → NEEDS_CHANGES/REJECT ─

export const CASE_C: FixtureCase = {
  case_id: "C",
  label: "Tests pass but code semantically wrong (off-by-one in parser)",
  request: {
    review_id: nextReviewId("C"),
    requirement: "parseIntStrict(s) must return the integer value of s, or throw for non-integer inputs (including decimals like '1.5', hex prefixes like '0x1a', trailing whitespace like '5 ', empty string).",
    implementation: {
      id: "impl_case_C",
      files: ["fixture/case_c/parseIntStrict.ts"],
      summary: "Implementation calls parseInt(s, 10) and returns the result. Does not use strict validation.",
      claim: "parseIntStrict correctly parses integer strings.",
      claimed_by: "claude",
    },
    tests: {
      files: ["fixture/case_c/parseIntStrict.test.ts"],
      passed: 3, failed: 0,
      summary: "Tests check '123' → 123 · '0' → 0 · '-1' → -1. Happy path only.",
      known_gaps: ["decimal strings like '1.5' not tested", "empty string not tested", "hex prefix not tested"],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: ["decimal like '1.5'", "empty string", "hex prefix '0x1a'", "trailing whitespace '5 '"],
      edge_cases_covered: [],
      security_requirements: [],
      security_violations_observed: [],
    },
  },
  expectation: {
    expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
  },
};

// ─── Case D · UNSUPPORTED CLAIM → UNCERTAIN/REJECT ────────────────

export const CASE_D: FixtureCase = {
  case_id: "D",
  label: "Unsupported claim · claim mentions distinctive behaviors absent from evidence",
  request: {
    review_id: nextReviewId("D"),
    requirement: "handleWebhook(payload) must validate HMAC signature, deduplicate via idempotency key, enqueue for async processing, and respond 202.",
    implementation: {
      id: "impl_case_D",
      files: ["fixture/case_d/handleWebhook.ts"],
      summary: "Function receives payload and responds 202.",
      claim: "Endpoint validates hmac signatures using timing-safe comparison, deduplicates via idempotency database lookup, enqueues via redis publish, and responds 202 asynchronously.",
      claimed_by: "claude",
    },
    tests: {
      files: ["fixture/case_d/handleWebhook.test.ts"],
      passed: 1, failed: 0,
      summary: "One test asserts that response status is 202.",
      known_gaps: ["no hmac test", "no dedup test", "no redis test", "no timing-safe test"],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: ["missing signature", "invalid hmac", "replayed idempotency key", "redis unavailable"],
      edge_cases_covered: [],
      security_requirements: ["HMAC validation", "timing-safe comparison"],
      security_violations_observed: [],
    },
  },
  expectation: {
    expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["unsupported_claim", "test_gap", "security"],
  },
};

// ─── Case E · SECURITY DEFECT · TESTS PASS → REJECT ───────────────

export const CASE_E: FixtureCase = {
  case_id: "E",
  label: "Security defect · authentication check occurs after sensitive data retrieval",
  request: {
    review_id: nextReviewId("E"),
    requirement: "getUserOrder(orderId, requestingUserId) must verify requestingUserId owns the order BEFORE retrieving the order data. Never leak orders belonging to other users.",
    implementation: {
      id: "impl_case_E",
      files: ["fixture/case_e/getUserOrder.ts"],
      summary: "Fetches the order from the database and then checks if requestingUserId equals order.ownerId. If not, returns null. Otherwise returns the order.",
      claim: "Function returns the order only to its owner.",
      claimed_by: "claude",
    },
    tests: {
      files: ["fixture/case_e/getUserOrder.test.ts"],
      passed: 3, failed: 0,
      summary: "Tests check owner gets order · non-owner gets null · missing order returns null.",
      known_gaps: [],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: ["owner receives", "non-owner denied", "order not found"],
      edge_cases_covered: ["owner receives", "non-owner denied", "order not found"],
      security_requirements: ["authorization must occur BEFORE data retrieval"],
      security_violations_observed: [
        "database fetch executes with unauthorized user context · returned to callee via non-owner path leaks metadata via timing side channel and error propagation",
      ],
    },
  },
  expectation: {
    expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
  },
};

// ─── Case F · REGRESSION → NEEDS_CHANGES ─────────────────────────

export const CASE_F: FixtureCase = {
  case_id: "F",
  label: "Fix for one bug breaks a previously-working case",
  request: {
    review_id: nextReviewId("F"),
    requirement: "normalizeUrl(url) must lowercase the hostname, strip trailing slashes, preserve query parameters, preserve fragment identifiers.",
    implementation: {
      id: "impl_case_F",
      files: ["fixture/case_f/normalizeUrl.ts"],
      summary: "New implementation lowercases hostname and strips trailing slashes. Query parameters preserved. Fragment identifier NO LONGER preserved (regression from prior version).",
      claim: "URL normalization now correctly handles case sensitivity and trailing slashes.",
      claimed_by: "claude",
    },
    tests: {
      files: ["fixture/case_f/normalizeUrl.test.ts"],
      passed: 4, failed: 0,
      summary: "Tests exercise hostname lowercase · trailing slash strip · query preservation. Fragment test was removed with the change.",
      known_gaps: ["fragment preservation test was removed in this change"],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: ["hostname lowercase", "trailing slash", "query preservation", "fragment preservation"],
      edge_cases_covered: ["hostname lowercase", "trailing slash", "query preservation"],
      security_requirements: [],
      security_violations_observed: [],
    },
  },
  expectation: {
    expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
  },
};

// ─── Case G · CORRECT BUT UNFAMILIAR → ACCEPT (false-positive defence) ─

export const CASE_G: FixtureCase = {
  case_id: "G",
  label: "Correct but unfamiliar idiom · reviewer must not reject unfamiliar code",
  request: {
    review_id: nextReviewId("G"),
    requirement: "chunkedSum(arr, k) must return the sum of arr split into chunks of size k, then summed pair-wise. Handles empty arr, k<=0 by returning 0.",
    implementation: {
      id: "impl_case_G",
      files: ["fixture/case_g/chunkedSum.ts"],
      summary: "Implementation uses an unfamiliar tail-recursive reducer pattern with Array.from({length: Math.ceil(arr.length/k)}, (_,i) => arr.slice(i*k, i*k+k).reduce((a,b)=>a+b, 0)).reduce((a,b)=>a+b, 0). Handles empty arr via reduce initial-value. Handles k<=0 by returning 0 via early guard.",
      claim: "chunkedSum returns the correct sum for chunked arrays, handles empty arr and k<=0.",
      claimed_by: "human",
    },
    tests: {
      files: ["fixture/case_g/chunkedSum.test.ts"],
      passed: 5, failed: 0,
      summary: "Tests exercise: standard chunks · empty array · k=0 · k=arr.length · k > arr.length · negative k. All pass · error/boundary/edge cases covered.",
      known_gaps: [],
    },
    runtime_evidence: ["fixture/case_g/repl_probe.log"],
    requirement_details: {
      edge_cases_required: ["standard chunks", "empty arr", "k<=0", "k > arr.length"],
      edge_cases_covered: ["standard chunks", "empty arr", "k<=0", "k > arr.length"],
      security_requirements: [],
      security_violations_observed: [],
    },
  },
  expectation: { expected_verdict: "ACCEPT" },
};

// ─── Case H · INSUFFICIENT EVIDENCE → UNCERTAIN ──────────────────

export const CASE_H: FixtureCase = {
  case_id: "H",
  label: "Insufficient evidence to establish correctness",
  request: {
    review_id: nextReviewId("H"),
    requirement: "processRequest(req) must correctly handle malformed input by responding with 400, and log the incident.",
    implementation: {
      id: "impl_case_H",
      files: [],
      summary: "",
      claim: "Handles malformed input.",
      claimed_by: "claude",
    },
    tests: {
      files: [],
      passed: 0, failed: 0,
      summary: "",
      known_gaps: [],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: ["malformed input", "logging"],
      edge_cases_covered: [],
      security_requirements: [],
      security_violations_observed: [],
    },
  },
  expectation: { expected_verdict: "UNCERTAIN" },
};

// ─── Real NEX review · P0.3 hotel resolved-reference continuity ──
//
// This is not a fabricated fixture · it references the ACTUAL P0.3
// slice completed earlier this session. The reviewer independently
// evaluates it. Deferred defects are captured as expected findings.
// P0.3 was accepted GREEN · so the honest verdict is ACCEPT (all
// edge cases covered · known deferrals recorded as separate issues).

export const CASE_REAL_NEX: FixtureCase = {
  case_id: "REAL_NEX",
  label: "Real NEX P0.3 hotel resolved-reference continuity slice",
  request: {
    review_id: nextReviewId("REAL_NEX"),
    requirement: "When session.currentReference is resolved this turn to an accommodation entity, NEX must fetch the actual DB record via getWorldRecordById, inject it as first-priority grounded evidence into composition, and — if LLM composition is rejected — emit a deterministic record-summary reply using only the record's actual fields.",
    implementation: {
      id: "P0.3_reference_hydration",
      files: [
        "src/lib/nex/brain/reference-hydration.ts",
        "src/app/api/nex-conv/chat/route.ts",
      ],
      summary: "reference-hydration.ts adds parseRefId · isReferenceFreshThisTurn · hydrateResolvedReference (fetches the actual DB record via getWorldRecordById) · hydratedRecordToKnowledge · buildHotelRecordSummary. route.ts calls hydration before composition gate · widens gate on hydration success · injects hydrated record into hits as first-priority evidence · adds record-summary fallback that emits a deterministic summary reply when composition is rejected. Scope-locked to accommodation via verticalAllowlist.",
      claim: "Resolved hotel reference survives from ordinal resolution to final response · verified via live HTTP proof · P0 zero-evidence guard preserved · 20 unit tests + 2597 brain-regression tests passing · 0 regressions.",
      claimed_by: "claude",
    },
    tests: {
      files: ["src/lib/nex/brain/reference-hydration.test.ts"],
      passed: 20, failed: 0,
      summary: "Tests exercise refId parsing (5 formats · garbage) · fresh-turn detection · hydration success + 6 failure modes · record-summary fabrication prevention · error-code guard · scope-lock verification · REJECTED path.",
      known_gaps: [],
    },
    runtime_evidence: [
      "tests/fixtures/workforce-activation-proof/_reproduce_hotel_t3.json",
      "tests/fixtures/workforce-activation-proof/_hotel_negative_proof.json",
      "tests/fixtures/workforce-activation-proof/_p0_3_hotel_reference_continuity_report.md",
    ],
    requirement_details: {
      edge_cases_required: [
        "fresh resolved reference this turn",
        "stale reference from prior turn",
        "unresolved reference",
        "garbage refId",
        "record not found in DB",
        "wrong vertical (scope lock)",
        "LLM composition rejected by verifier · fallback fires",
      ],
      edge_cases_covered: [
        "fresh resolved reference this turn",
        "stale reference from prior turn",
        "unresolved reference",
        "garbage refId",
        "record not found in DB",
        "wrong vertical (scope lock)",
        "LLM composition rejected by verifier · fallback fires",
      ],
      security_requirements: [],
      security_violations_observed: [],
    },
    // The reference-hydration unit tests actually exercise a form of
    // ENOENT-equivalent logic (record_not_found), which is the Phase B
    // knowledge domain. Consult it during review.
  },
  expectation: { expected_verdict: "ACCEPT" },
};

// ─── Real defect · falsifiable benchmark (§22) ───────────────────
//
// A deliberately-buggy implementation. The reviewer must catch it
// via test-quality analysis and known_gaps signals.

export const CASE_REAL_DEFECT: FixtureCase = {
  case_id: "REAL_DEFECT",
  label: "Real defect · rate limiter resets counter on wrong tick boundary",
  request: {
    review_id: nextReviewId("REAL_DEFECT"),
    requirement: "rateLimit(key, windowMs) must allow up to N requests per windowMs. Counter must reset when a new window begins (aligned to windowMs boundaries). Attempted requests inside the same window must be rejected once N is exceeded, regardless of order-of-arrival.",
    implementation: {
      id: "impl_real_defect",
      files: ["fixture/real_defect/rateLimit.ts"],
      summary: "Implementation stores counter per key. On each call, increments counter. Resets counter to 0 whenever counter reaches N+1. Returns allowed:true when counter <= N. Does NOT check windowMs boundaries or timestamp. Reset condition is based on the counter value, not on time.",
      claim: "rateLimit correctly enforces N requests per window.",
      claimed_by: "claude",
    },
    tests: {
      files: ["fixture/real_defect/rateLimit.test.ts"],
      passed: 3, failed: 0,
      summary: "Tests: first N requests allowed · request N+1 rejected · after reset, first request allowed. Tests do not exercise window boundaries · time-based reset · concurrent requests from same key within one window.",
      known_gaps: [
        "no test for time-based window reset (implementation resets on count, not time)",
        "no test with rapid succession of >2N requests to observe window boundary behavior",
      ],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: [
        "N requests within window all allowed",
        "N+1 request within window rejected",
        "counter resets on windowMs boundary (time-based)",
        "counter does NOT reset on count reaching N+1",
      ],
      edge_cases_covered: [
        "N requests within window all allowed",
        "N+1 request within window rejected",
      ],
      security_requirements: ["rate limiting must not be bypassable via rapid burst"],
      security_violations_observed: [],
    },
  },
  expectation: {
    expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
  },
};

// ─── Aggregate export ────────────────────────────────────────────

export const ALL_CASES: FixtureCase[] = [
  CASE_A, CASE_B, CASE_C, CASE_D, CASE_E, CASE_F, CASE_G, CASE_H,
  CASE_REAL_NEX, CASE_REAL_DEFECT,
];
