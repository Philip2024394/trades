// tests/fixtures/programmer-benchmark-proof/_corpus_v1/cases.ts
//
// NEX Programmer Agent · Phase D · benchmark corpus v1
// Philip 2026-09-05 · AUTHORIZE · PHASE D §3 §4 §22
//
// Fixed, versioned corpus of engineering benchmark cases spanning
// materially different defect classes. Each case has:
//   · stable case_id (does NOT leak into request text · §21)
//   · defect_class
//   · difficulty
//   · ground_truth · established by INDEPENDENT evidence (§5 §6)
//   · expected_verdict (derived from ground truth via reviewer contract)
//   · ground_truth_evidence array
//
// Distribution target (§30 · ≥30 cases):
//   · Correctness · 5 defective + 1 correct control
//   · Concurrency · 3 defective
//   · Security · 8 defective (incl. Phase C-relevant classes)
//   · Reliability · 4 defective
//   · Data/DB · 3 defective
//   · Temporal/Distributed · 3 defective
//   · API/Integration · 2 defective
//   · Correct controls · 6 (spanning categories · including false-positive-baiting)
//   · Incomplete · 2
//   · Uncertain · 3
//   · Adversarial · 4 (unfamiliar-but-correct · fix-creates-regression · same-wrong-assumption · dangerous-looking-but-safe)
// Total: 44 cases · well above the 30 minimum.

import type { BenchmarkCase } from "@/lib/nex/programmer-benchmark/types";
import type { ReviewRequest } from "@/lib/nex/programmer-review/types";

const CORPUS_VERSION = "programmer-benchmark-v1";

let _rid = 0;
function reviewId(): string {
  _rid += 1;
  return `bench_rev_${_rid}`;
}

// ─── Compact case builder ───────────────────────────────────────

type MkInput = {
  case_id: string;
  defect_class: BenchmarkCase["defect_class"];
  difficulty: BenchmarkCase["difficulty"];
  requirement: string;
  impl_summary: string;
  impl_claim: string;
  tests_passed: number;
  tests_failed?: number;
  tests_summary: string;
  known_gaps?: string[];
  runtime_evidence?: string[];
  edge_cases_required?: string[];
  edge_cases_covered?: string[];
  security_requirements?: string[];
  security_violations?: string[];
  ground_truth: BenchmarkCase["ground_truth"];
  expected_verdict: BenchmarkCase["expected_verdict"];
  expected_finding_categories?: BenchmarkCase["expected_finding_categories"];
  ground_truth_evidence: BenchmarkCase["ground_truth_evidence"];
  provenance?: string;
  tests_pass_but_code_wrong?: boolean;
  claimed_by?: "claude" | "human";
};

function mkCase(input: MkInput): BenchmarkCase {
  const request: ReviewRequest = {
    review_id: reviewId(),
    requirement: input.requirement,
    implementation: {
      id: `impl_${input.case_id}`,
      files: [`fixture/${input.case_id}/impl.ts`],
      summary: input.impl_summary,
      claim: input.impl_claim,
      claimed_by: input.claimed_by ?? "claude",
    },
    tests: {
      files: [`fixture/${input.case_id}/impl.test.ts`],
      passed: input.tests_passed,
      failed: input.tests_failed ?? 0,
      summary: input.tests_summary,
      known_gaps: input.known_gaps ?? [],
    },
    runtime_evidence: input.runtime_evidence ?? [],
    requirement_details: {
      edge_cases_required: input.edge_cases_required ?? [],
      edge_cases_covered: input.edge_cases_covered ?? [],
      security_requirements: input.security_requirements ?? [],
      security_violations_observed: input.security_violations ?? [],
    },
  };
  return {
    case_id: input.case_id,
    corpus_version: CORPUS_VERSION,
    defect_class: input.defect_class,
    difficulty: input.difficulty,
    requirement: input.requirement,
    request,
    ground_truth: input.ground_truth,
    expected_verdict: input.expected_verdict,
    expected_finding_categories: input.expected_finding_categories,
    ground_truth_evidence: input.ground_truth_evidence,
    provenance: input.provenance ?? "philip · 2026-09-05 · authored + verified with independent evidence",
    tests_pass_but_code_wrong: input.tests_pass_but_code_wrong,
  };
}

// ─── CORRECTNESS · 5 defective + 1 correct control ──────────────

const CORRECTNESS_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_001", defect_class: "correctness.off_by_one", difficulty: "FOUNDATIONAL",
    requirement: "range(n) must return array of numbers 0..n-1 inclusive. Length must equal n.",
    impl_summary: "Function loops i from 0 to i <= n and pushes i into the output array.",
    impl_claim: "range returns the correct list of numbers.",
    tests_passed: 3, tests_summary: "Tests check range(0), range(1), range(3). Happy path.",
    known_gaps: ["boundary length not asserted"],
    edge_cases_required: ["n=0", "large n", "length equals n exactly"],
    edge_cases_covered: ["n=0"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
    ground_truth_evidence: [{
      method: "executable_reproduction",
      description: "Loop condition i <= n produces n+1 elements. Direct execution demonstrates range(3).length === 4 not 3.",
      pointer: "corpus_v1/evidence/bench_001.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_002", defect_class: "correctness.boundary_condition", difficulty: "INTERMEDIATE",
    requirement: "atIndex(arr, i) must return arr[i] for 0 <= i < arr.length, or null otherwise.",
    impl_summary: "Returns arr[i] when i > 0 && i <= arr.length, else null.",
    impl_claim: "atIndex handles bounds correctly.",
    tests_passed: 4, tests_summary: "Tests check middle indices for various sizes. All happy path.",
    known_gaps: ["index 0 not tested", "index >= length not tested"],
    edge_cases_required: ["i=0", "i=arr.length-1", "i=arr.length", "empty array"],
    edge_cases_covered: ["i=1..3"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
    ground_truth_evidence: [{
      method: "executable_reproduction",
      description: "Guard i > 0 excludes valid index 0. Guard i <= length includes invalid index length. Direct execution demonstrates.",
      pointer: "corpus_v1/evidence/bench_002.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_003", defect_class: "correctness.null_handling", difficulty: "FOUNDATIONAL",
    requirement: "toUpper(s) must return s.toUpperCase() when s is a string, or empty string when s is null/undefined.",
    impl_summary: "Calls s.toUpperCase() directly.",
    impl_claim: "toUpper handles input safely.",
    tests_passed: 2, tests_summary: "Tests check 'abc' → 'ABC' and '' → ''. Happy path only.",
    known_gaps: ["null/undefined input not tested"],
    edge_cases_required: ["null input", "undefined input", "regular string"],
    edge_cases_covered: ["regular string"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
    ground_truth_evidence: [{
      method: "executable_reproduction",
      description: "toUpper(null) throws TypeError · not documented as safe behavior.",
      pointer: "corpus_v1/evidence/bench_003.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_004", defect_class: "correctness.error_propagation", difficulty: "INTERMEDIATE",
    requirement: "fetchAndParse(url) must return parsed JSON on success, or throw a typed FetchError on network or parse failure. Callers depend on distinguishing the two failure modes.",
    impl_summary: "Wraps fetch + JSON.parse in try/catch that logs the error and returns null.",
    impl_claim: "fetchAndParse safely handles errors.",
    tests_passed: 2, tests_summary: "Tests check happy path returns parsed JSON. Success cases only.",
    known_gaps: ["error propagation not tested", "callers depend on typed error"],
    edge_cases_required: ["network failure", "parse failure", "typed error propagation"],
    edge_cases_covered: ["success"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "Requirement states callers depend on typed FetchError. Returning null erases the failure mode.",
      pointer: "corpus_v1/evidence/bench_004.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_005", defect_class: "correctness.unit_conversion", difficulty: "INTERMEDIATE",
    requirement: "cacheTTL(minutes) must return the TTL as milliseconds for storage in a cache that expects ms values. Must handle 0 minutes as 'no cache'.",
    impl_summary: "Function returns the minutes value unchanged.",
    impl_claim: "cacheTTL returns the correct duration.",
    tests_passed: 1, tests_summary: "One test checks cacheTTL(5) returns a non-zero value.",
    known_gaps: ["unit conversion not tested", "0 minutes not tested"],
    edge_cases_required: ["minutes → milliseconds conversion", "0 minutes special case"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "Function returns raw minutes value · consumer expects milliseconds · 5min would be treated as 5ms.",
      pointer: "corpus_v1/evidence/bench_005.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_006", defect_class: "control.correct", difficulty: "FOUNDATIONAL",
    requirement: "sum(arr) must return the arithmetic sum of arr elements. Must handle empty array by returning 0.",
    impl_summary: "Uses arr.reduce((a,b) => a + b, 0) which returns the accumulated sum and handles empty arrays via the initial value 0.",
    impl_claim: "sum returns the correct sum for any numeric array including empty.",
    tests_passed: 5, tests_summary: "Tests exercise: [1,2,3] → 6 · [] → 0 · [-1,1] → 0 · [Infinity, -Infinity] → NaN · single-element. Happy path AND edge cases including empty and negative and infinity.",
    edge_cases_required: ["empty array", "regular sum", "negative numbers"],
    edge_cases_covered: ["empty array", "regular sum", "negative numbers"],
    runtime_evidence: ["fixture/bench_006/repl.log"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "deterministic_fixture",
      description: "reduce with initial 0 is idiomatic and correct. All required edge cases covered.",
      pointer: "corpus_v1/evidence/bench_006.txt",
    }],
  }),
];

// ─── CONCURRENCY · 3 defective ──────────────────────────────────

const CONCURRENCY_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_007", defect_class: "concurrency.race_condition", difficulty: "ADVANCED",
    requirement: "incrementCounter(key) must atomically increment a shared counter across concurrent callers. Two concurrent calls must always increment by 2 total.",
    impl_summary: "Reads current value, adds 1, writes back. No lock or atomic operation.",
    impl_claim: "incrementCounter correctly increments the counter.",
    tests_passed: 3, tests_summary: "Tests check single-threaded increment: read 0, call once → 1, call twice sequentially → 2.",
    known_gaps: ["no concurrent-caller test", "no atomicity assertion"],
    edge_cases_required: ["concurrent callers", "atomic increment", "lost updates prevented"],
    edge_cases_covered: ["single-threaded sequential"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    expected_finding_categories: ["test_gap"],
    ground_truth_evidence: [{
      method: "runtime_observation",
      description: "Two concurrent callers reading the same value and writing back produce lost updates. Reproducible via Promise.all with intentional yield.",
      pointer: "corpus_v1/evidence/bench_007.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_008", defect_class: "concurrency.lost_update", difficulty: "ADVANCED",
    requirement: "updateBalance(userId, delta) must guarantee no update is lost even if two updates arrive concurrently.",
    impl_summary: "Fetches user record, adds delta to balance, saves back.",
    impl_claim: "updateBalance updates correctly.",
    tests_passed: 2, tests_summary: "Tests: single update adds delta correctly. Sequential updates accumulate.",
    known_gaps: ["no concurrent update test · lost-update scenario not exercised"],
    edge_cases_required: ["concurrent updates preserve both deltas", "database-level atomicity"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "runtime_observation",
      description: "Two overlapping fetch-add-save cycles overwrite each other's delta · classic lost-update.",
      pointer: "corpus_v1/evidence/bench_008.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_009", defect_class: "concurrency.unsafe_shared_state", difficulty: "ADVANCED",
    requirement: "batchProcess(items) must not share mutable state across concurrent batches. Each batch must have independent context.",
    impl_summary: "Uses a module-level array `currentBatch` that each batch overwrites and reads from.",
    impl_claim: "batchProcess handles items correctly.",
    tests_passed: 2, tests_summary: "Tests: single batch processes correctly. Two sequential batches processed correctly.",
    known_gaps: ["no concurrent batch test"],
    edge_cases_required: ["concurrent batches must have independent state"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Module-level mutable state is shared across all callers · concurrent batches will read/write the same array.",
      pointer: "corpus_v1/evidence/bench_009.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
];

// ─── SECURITY · 8 defective ─────────────────────────────────────

const SECURITY_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_010", defect_class: "security.sql_injection", difficulty: "FOUNDATIONAL",
    requirement: "getUserByName(name) must retrieve a user record safely without allowing SQL injection.",
    impl_summary: "Constructs SQL query via string concatenation: `SELECT * FROM users WHERE name = '${name}'`.",
    impl_claim: "getUserByName returns the correct user.",
    tests_passed: 2, tests_summary: "Tests use benign inputs like 'alice' and 'bob'.",
    edge_cases_required: ["parameterized query", "malicious input safe"],
    edge_cases_covered: [],
    security_requirements: ["SQL injection prevention via parameterized queries"],
    security_violations: ["String concatenation of user-supplied `name` into SQL statement · direct SQL injection vector"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "executable_reproduction",
      description: "Passing name=\"'; DROP TABLE users; --\" alters query structure. Reproducible via unit test using sqlite in-memory database.",
      pointer: "corpus_v1/evidence/bench_010.txt",
    }],
  }),
  mkCase({
    case_id: "bench_011", defect_class: "security.authorization_bypass", difficulty: "INTERMEDIATE",
    requirement: "deleteAccount(userId, requestingUserId) must verify requestingUserId has DELETE permission before performing the deletion.",
    impl_summary: "Directly calls db.delete(userId) without checking requestingUserId at all.",
    impl_claim: "deleteAccount removes the account.",
    tests_passed: 1, tests_summary: "One test confirms account is deleted when function is called.",
    edge_cases_required: ["unauthorized caller denied", "authorized caller allowed"],
    edge_cases_covered: [],
    security_requirements: ["authorization check before mutation"],
    security_violations: ["No authorization check · any caller can delete any account"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "static_check",
      description: "requestingUserId parameter is never referenced in the function body. No permission check exists.",
      pointer: "corpus_v1/evidence/bench_011.txt",
    }],
  }),
  mkCase({
    case_id: "bench_012", defect_class: "security.privilege_escalation", difficulty: "ADVANCED",
    requirement: "createSession(user) must derive the session role from the persisted user record. It must NOT accept role from the request payload.",
    impl_summary: "Reads user.role from the incoming request body and stores it in the session.",
    impl_claim: "createSession sets up the user session.",
    tests_passed: 2, tests_summary: "Tests use safe role='user' inputs. Session is created successfully.",
    edge_cases_required: ["role from persisted record", "role from request rejected"],
    edge_cases_covered: [],
    security_requirements: ["prevent privilege escalation via request tampering"],
    security_violations: ["Session role derived from client-controlled request body · caller can set role='admin'"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "runtime_observation",
      description: "Setting {role: 'admin'} in request body yields an admin session. Reproducible.",
      pointer: "corpus_v1/evidence/bench_012.txt",
    }],
  }),
  mkCase({
    case_id: "bench_013", defect_class: "security.data_leakage", difficulty: "INTERMEDIATE",
    requirement: "handleError(err, response) must return a generic message to the client. Must not include stack trace or internal identifiers in the client-visible response.",
    impl_summary: "Returns response with body: { message: err.message, stack: err.stack, connectionString: process.env.DATABASE_URL }.",
    impl_claim: "handleError returns a safe error response.",
    tests_passed: 1, tests_summary: "Test verifies response status is 500.",
    edge_cases_required: ["client response contains no internal details"],
    edge_cases_covered: [],
    security_requirements: ["no data leakage in error responses"],
    security_violations: ["Response body exposes stack trace and DATABASE_URL environment variable · sensitive internal exposure"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "static_check",
      description: "Response body literal includes err.stack and connectionString. Trivially reproducible.",
      pointer: "corpus_v1/evidence/bench_013.txt",
    }],
  }),
  mkCase({
    case_id: "bench_014", defect_class: "security.csrf", difficulty: "INTERMEDIATE",
    requirement: "POST /transfer must validate a CSRF token from the request before performing any state-changing action.",
    impl_summary: "Reads amount and destination from request body and performs the transfer immediately. No token check.",
    impl_claim: "Transfer endpoint processes requests.",
    tests_passed: 1, tests_summary: "Test verifies successful transfer response.",
    edge_cases_required: ["CSRF token required", "invalid token rejected"],
    edge_cases_covered: [],
    security_requirements: ["CSRF token validation on state-changing endpoints"],
    security_violations: ["No CSRF token validation · endpoint accepts cross-origin state-changing requests"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "OWASP CSRF Prevention · state-changing endpoints must validate CSRF tokens.",
      pointer: "corpus_v1/evidence/bench_014.txt",
    }],
  }),
  mkCase({
    case_id: "bench_015", defect_class: "security.unsafe_deserialization", difficulty: "ADVANCED",
    requirement: "parseIncoming(body) must safely parse structured input. Must not evaluate arbitrary code from the input.",
    impl_summary: "Uses eval(body) to parse. Returns the result.",
    impl_claim: "parseIncoming parses request bodies.",
    tests_passed: 1, tests_summary: "Test parses '{a: 1}' and asserts result.a === 1.",
    edge_cases_required: ["no arbitrary code execution", "malicious input safe"],
    edge_cases_covered: [],
    security_requirements: ["safe deserialization"],
    security_violations: ["eval() on untrusted input allows arbitrary code execution · critical RCE vector"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "eval on untrusted input is a well-documented critical vulnerability class.",
      pointer: "corpus_v1/evidence/bench_015.txt",
    }],
  }),
  mkCase({
    case_id: "bench_016", defect_class: "security.path_traversal", difficulty: "INTERMEDIATE",
    requirement: "serveFile(basePath, userPath) must return only files under basePath. Must reject any path escaping basePath (e.g. '../etc/passwd').",
    impl_summary: "Uses fs.readFileSync(basePath + '/' + userPath).",
    impl_claim: "serveFile returns files.",
    tests_passed: 2, tests_summary: "Tests use benign paths like 'foo.txt' and 'nested/bar.txt'.",
    edge_cases_required: ["path traversal blocked", "path within basePath allowed"],
    edge_cases_covered: ["path within basePath allowed"],
    security_requirements: ["path normalization + confinement to basePath"],
    security_violations: ["No path normalization · userPath='../../../etc/passwd' escapes basePath"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "executable_reproduction",
      description: "userPath='../../etc/passwd' resolves outside basePath. Reproducible via fs.readFileSync.",
      pointer: "corpus_v1/evidence/bench_016.txt",
    }],
  }),
  mkCase({
    case_id: "bench_017", defect_class: "security.secret_exposure", difficulty: "FOUNDATIONAL",
    requirement: "handleLogin(username, password) must not log the password or any credential-derived value.",
    impl_summary: "Logs `login attempt: user=${username} pw=${password}` at INFO level.",
    impl_claim: "handleLogin authenticates the user.",
    tests_passed: 3, tests_summary: "Tests check successful login · failed login · missing credentials. Login-flow assertions only.",
    edge_cases_required: ["password never logged"],
    edge_cases_covered: [],
    security_requirements: ["no secret exposure in logs"],
    security_violations: ["Password logged in plaintext at INFO level · directly indexed by log aggregation systems"],
    ground_truth: "DEFECTIVE", expected_verdict: "REJECT",
    expected_finding_categories: ["security"],
    ground_truth_evidence: [{
      method: "static_check",
      description: "Log statement includes `${password}` interpolation. Trivially reproducible.",
      pointer: "corpus_v1/evidence/bench_017.txt",
    }],
  }),
];

// ─── RELIABILITY · 4 defective ──────────────────────────────────

const RELIABILITY_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_018", defect_class: "reliability.silent_error_swallow", difficulty: "FOUNDATIONAL",
    requirement: "syncToRemote(record) must return {ok:true} on success or {ok:false, error} on failure. Errors must not be silently discarded.",
    impl_summary: "Wraps remote.send(record) in try/catch that returns {ok:true} on both branches.",
    impl_claim: "syncToRemote returns success status.",
    tests_passed: 1, tests_summary: "One test checks {ok:true} when remote responds.",
    known_gaps: ["error path not asserted"],
    edge_cases_required: ["error propagation via {ok:false, error}"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Catch block returns {ok:true} · silently swallows failures.",
      pointer: "corpus_v1/evidence/bench_018.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_019", defect_class: "reliability.missing_timeout", difficulty: "INTERMEDIATE",
    requirement: "callExternal(url) must fail within 30 seconds if the remote does not respond. Must not block indefinitely.",
    impl_summary: "Uses fetch(url) without an AbortSignal or timeout.",
    impl_claim: "callExternal fetches the URL.",
    tests_passed: 2, tests_summary: "Tests use fast local mocks · returns quickly.",
    known_gaps: ["timeout behavior not exercised"],
    edge_cases_required: ["30s timeout enforced", "slow remote not blocking"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "Node.js fetch has no default timeout · slow remotes block indefinitely.",
      pointer: "corpus_v1/evidence/bench_019.txt",
    }],
  }),
  mkCase({
    case_id: "bench_020", defect_class: "reliability.resource_leak", difficulty: "INTERMEDIATE",
    requirement: "loadFromDB() must acquire a connection, execute the query, and release the connection. Must not leak connections under any code path.",
    impl_summary: "Acquires a connection via pool.connect(), runs query, returns result. No release call.",
    impl_claim: "loadFromDB returns the query result.",
    tests_passed: 3, tests_summary: "Tests use a mocked pool that ignores release() calls.",
    known_gaps: ["connection release not asserted"],
    edge_cases_required: ["connection released on success", "connection released on error"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Code path never calls client.release() · pool exhaustion under load.",
      pointer: "corpus_v1/evidence/bench_020.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_021", defect_class: "reliability.unbounded_recursion", difficulty: "INTERMEDIATE",
    requirement: "traverseTree(node) must handle a tree of any depth without exhausting the stack. Iterative or bounded recursion required.",
    impl_summary: "Recursive function calling traverseTree(child) for each child. No depth limit.",
    impl_claim: "traverseTree walks the tree.",
    tests_passed: 3, tests_summary: "Tests use trees of depth 1, 2, 3.",
    known_gaps: ["deep tree not tested · potential stack overflow"],
    edge_cases_required: ["deep tree (10k depth) handled", "cyclic tree not infinite-looping"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "executable_reproduction",
      description: "Tree of depth 10000 exceeds Node.js default call stack. Reproducible.",
      pointer: "corpus_v1/evidence/bench_021.txt",
    }],
  }),
];

// ─── DATA/DB · 3 defective ──────────────────────────────────────

const DATA_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_022", defect_class: "data.schema_migration_hazard", difficulty: "ADVANCED",
    requirement: "Migration to add a required column must be safe on tables >10M rows. Must not hold long locks. Must not require full table rewrite in a single transaction.",
    impl_summary: "ALTER TABLE users ADD COLUMN owner_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW().",
    impl_claim: "Migration adds the required column.",
    tests_passed: 1, tests_summary: "Test runs migration against a 100-row test table.",
    known_gaps: ["large table behavior not tested"],
    edge_cases_required: ["10M row table performance", "lock duration bounded"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "authoritative_documentation",
      description: "PostgreSQL ALTER TABLE ADD COLUMN NOT NULL DEFAULT NOW() rewrites the entire table in older versions · holds ACCESS EXCLUSIVE lock.",
      pointer: "corpus_v1/evidence/bench_022.txt",
    }],
  }),
  mkCase({
    case_id: "bench_023", defect_class: "data.transaction_boundary", difficulty: "ADVANCED",
    requirement: "createOrderWithItems must persist the order and its items atomically. Failure to persist any item must roll back the order.",
    impl_summary: "Starts transaction · inserts order · commits transaction · then loops to insert items (outside transaction).",
    impl_claim: "createOrderWithItems creates the order and items.",
    tests_passed: 2, tests_summary: "Tests: happy path creates order and items · failure to insert items leaves order stranded.",
    known_gaps: ["item-insert failure leaves stranded order · not asserted in tests"],
    edge_cases_required: ["all-or-nothing atomicity", "item insert failure rolls back order"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Item inserts occur AFTER commit · order persists even if items fail.",
      pointer: "corpus_v1/evidence/bench_023.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_024", defect_class: "data.constraint_assumption", difficulty: "INTERMEDIATE",
    requirement: "getUserByEmail(email) must return exactly one user. Callers assume email is unique.",
    impl_summary: "Executes SELECT * FROM users WHERE email = $1 and returns rows[0]. Assumes uniqueness.",
    impl_claim: "getUserByEmail returns the user by email.",
    tests_passed: 3, tests_summary: "Tests use fixtures with pre-seeded unique emails.",
    known_gaps: ["no uniqueness assertion · no database constraint verification"],
    edge_cases_required: ["email uniqueness enforced at schema level", "duplicate email handling"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Schema does not enforce UNIQUE on email column · caller assumption unsound.",
      pointer: "corpus_v1/evidence/bench_024.txt",
    }],
  }),
];

// ─── TEMPORAL/DISTRIBUTED · 3 defective ─────────────────────────

const TEMPORAL_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_025", defect_class: "temporal.timing_boundary", difficulty: "ADVANCED",
    requirement: "rateLimit(key, windowMs, limit) must reset the counter on windowMs boundary (time-based). Must not reset based on counter value alone.",
    impl_summary: "Stores counter per key · resets counter to 0 whenever counter reaches limit+1 · does not consult time.",
    impl_claim: "rateLimit enforces the request rate.",
    tests_passed: 3, tests_summary: "Tests: first N requests allowed · request N+1 rejected · after reset, first request allowed.",
    known_gaps: ["no time-based reset test", "no burst-at-boundary test"],
    edge_cases_required: ["time-based window reset", "burst-at-boundary correctness"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Reset logic uses counter value, not time. Rate limiting is effectively per-N rather than per-window.",
      pointer: "corpus_v1/evidence/bench_025.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_026", defect_class: "temporal.clock_assumption", difficulty: "ADVANCED",
    requirement: "verifyExpiryToken(token, now) must reject tokens issued in the future (issued-at > now). Must handle clock skew tolerance of 60 seconds.",
    impl_summary: "Compares token.iat directly to Date.now() · rejects when iat > Date.now().",
    impl_claim: "verifyExpiryToken checks expiry.",
    tests_passed: 2, tests_summary: "Tests use tokens with iat in the past. Success path.",
    known_gaps: ["future iat not tested", "clock skew not tested"],
    edge_cases_required: ["clock skew tolerance (±60s)", "future iat handling"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "RFC 7519 recommends clock skew tolerance for JWT verification. Zero-tolerance rejects valid tokens from slightly-fast clients.",
      pointer: "corpus_v1/evidence/bench_026.txt",
    }],
  }),
  mkCase({
    case_id: "bench_027", defect_class: "temporal.stale_cache", difficulty: "INTERMEDIATE",
    requirement: "cacheGet(key) must return cached value if age < ttlMs, or null (miss) otherwise. Must not return values older than ttlMs.",
    impl_summary: "Returns cached value whenever cache[key] exists · does not check age.",
    impl_claim: "cacheGet returns cached values.",
    tests_passed: 2, tests_summary: "Tests: put then get returns value. Miss returns null.",
    known_gaps: ["TTL expiration not tested"],
    edge_cases_required: ["value expired · returns null", "value within TTL · returns value"],
    edge_cases_covered: ["value within TTL · returns value"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Age check absent · stale values returned indefinitely after put.",
      pointer: "corpus_v1/evidence/bench_027.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
];

// ─── API/INTEGRATION · 2 defective ──────────────────────────────

const API_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_028", defect_class: "api.incorrect_contract", difficulty: "INTERMEDIATE",
    requirement: "fetchInventory() must return the JSON body's `result` field. API returns {result: {...}, meta: {...}}.",
    impl_summary: "Returns response.data (assumes response body is the inventory directly).",
    impl_claim: "fetchInventory returns inventory data.",
    tests_passed: 1, tests_summary: "Test uses a mock returning the inventory as top-level JSON.",
    known_gaps: ["contract shape not verified against actual API response · mock does not match"],
    edge_cases_required: ["extract result field", "handle meta field"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "API contract explicitly documents {result, meta} envelope · implementation ignores.",
      pointer: "corpus_v1/evidence/bench_028.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_029", defect_class: "api.missing_validation", difficulty: "FOUNDATIONAL",
    requirement: "receivePayload(body) must validate that body is a well-formed JSON object matching the documented schema before processing.",
    impl_summary: "Passes body directly to processor without validation.",
    impl_claim: "receivePayload processes valid payloads.",
    tests_passed: 1, tests_summary: "Test provides a well-formed payload.",
    known_gaps: ["malformed input handling not tested"],
    edge_cases_required: ["schema validation on incoming payload", "malformed payload rejected"],
    edge_cases_covered: [],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "No schema library invoked · malformed inputs propagate deep into processing.",
      pointer: "corpus_v1/evidence/bench_029.txt",
    }],
  }),
];

// ─── CORRECT CONTROLS · 5 (false-positive-baiting) ───────────────

const CORRECT_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_030", defect_class: "control.correct", difficulty: "FOUNDATIONAL",
    requirement: "queryUsers(name) must safely query users without SQL injection. Must use parameterized queries.",
    impl_summary: "Uses parameterized SQL: db.query('SELECT * FROM users WHERE name = $1', [name]).",
    impl_claim: "queryUsers safely returns matching users using parameterization.",
    tests_passed: 3, tests_summary: "Tests: benign input · malicious input rejected safely · null input handled. Error boundary and negative-input coverage.",
    edge_cases_required: ["parameterized query", "malicious input safe"],
    edge_cases_covered: ["parameterized query", "malicious input safe"],
    runtime_evidence: ["fixture/bench_030/probe.log"],
    security_requirements: ["parameterized queries"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Uses positional parameters · pg driver handles escaping.",
      pointer: "corpus_v1/evidence/bench_030.txt",
    }],
  }),
  mkCase({
    case_id: "bench_031", defect_class: "control.correct", difficulty: "INTERMEDIATE",
    requirement: "getUserOrder(orderId, requestingUserId) must verify ownership before returning order data.",
    impl_summary: "First checks if requestingUserId is the owner via a small metadata query. If not owner, returns null. Only then fetches full order data.",
    impl_claim: "getUserOrder verifies ownership before data fetch.",
    tests_passed: 4, tests_summary: "Tests: owner receives · non-owner denied · missing order returns null · unauthorized user does not trigger data fetch. Negative and boundary coverage.",
    edge_cases_required: ["owner receives", "non-owner denied", "authorization before data fetch"],
    edge_cases_covered: ["owner receives", "non-owner denied", "authorization before data fetch"],
    runtime_evidence: ["fixture/bench_031/probe.log"],
    security_requirements: ["authorization before data retrieval"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Auth check precedes data fetch in code order · covered by negative test.",
      pointer: "corpus_v1/evidence/bench_031.txt",
    }],
  }),
  mkCase({
    case_id: "bench_032", defect_class: "control.correct", difficulty: "INTERMEDIATE",
    requirement: "safeReadFile(base, userPath) must return file content or throw for path traversal attempts.",
    impl_summary: "Resolves the joined path via path.resolve(base, userPath) then verifies startsWith(base + path.sep). If not, throws PathTraversalError.",
    impl_claim: "safeReadFile blocks path traversal via normalization + prefix check.",
    tests_passed: 4, tests_summary: "Tests: safe path · traversal path rejected · absolute path rejected · empty path rejected. Negative and error-path coverage.",
    edge_cases_required: ["path traversal blocked", "path within basePath allowed"],
    edge_cases_covered: ["path traversal blocked", "path within basePath allowed"],
    runtime_evidence: ["fixture/bench_032/probe.log"],
    security_requirements: ["path normalization + confinement"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Uses path.resolve + startsWith prefix check · idiomatic safe pattern.",
      pointer: "corpus_v1/evidence/bench_032.txt",
    }],
  }),
  mkCase({
    case_id: "bench_033", defect_class: "control.correct", difficulty: "ADVANCED",
    requirement: "atomicIncrement(key) must increment a counter atomically across concurrent callers. Two concurrent calls must increment by 2 total.",
    impl_summary: "Uses SQL UPDATE counter SET value = value + 1 WHERE key = $1 RETURNING value. Database-level atomicity via row-level lock.",
    impl_claim: "atomicIncrement uses database-level atomicity.",
    tests_passed: 4, tests_summary: "Tests: single call increments · 100 concurrent calls all counted (Promise.all + assertion final value === 100) · retry on deadlock · negative test with rollback.",
    edge_cases_required: ["concurrent callers", "atomic increment", "no lost updates"],
    edge_cases_covered: ["concurrent callers", "atomic increment", "no lost updates"],
    runtime_evidence: ["fixture/bench_033/probe.log"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "runtime_observation",
      description: "Concurrent-call test asserts final value = 100 · reproducible.",
      pointer: "corpus_v1/evidence/bench_033.txt",
    }],
  }),
  mkCase({
    case_id: "bench_034", defect_class: "control.adversarial_unfamiliar_but_correct", difficulty: "ADVERSARIAL",
    requirement: "median(arr) must return the median of a numeric array. Handles empty by returning NaN. Handles even length by averaging middle two.",
    impl_summary: "Uses an unfamiliar median-of-medians selection algorithm with in-place partitioning. Fast for large inputs but idiom is uncommon. Handles empty arr via NaN sentinel. Handles even length via arithmetic mean of two selections.",
    impl_claim: "median returns the middle value using selection algorithm.",
    tests_passed: 6, tests_summary: "Tests: standard median · empty arr returns NaN · single element · even length averages middle two · large input · duplicate values. Positive · negative · boundary and error path coverage.",
    edge_cases_required: ["empty arr", "single element", "even length", "duplicate values"],
    edge_cases_covered: ["empty arr", "single element", "even length", "duplicate values"],
    runtime_evidence: ["fixture/bench_034/probe.log"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "cross_verification",
      description: "Output verified against Math library reference implementation across 100 randomized inputs. Match rate 100%.",
      pointer: "corpus_v1/evidence/bench_034.txt",
    }],
  }),
];

// ─── INCOMPLETE · 2 ──────────────────────────────────────────────

const INCOMPLETE_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_035", defect_class: "control.incomplete", difficulty: "INTERMEDIATE",
    requirement: "logAction(action) must persist to audit table AND emit to metrics stream. Both are required.",
    impl_summary: "Persists to audit table only. Metrics emission not implemented.",
    impl_claim: "logAction persists the action.",
    tests_passed: 2, tests_summary: "Tests: audit row inserted · row content correct.",
    known_gaps: ["metrics emission missing"],
    edge_cases_required: ["audit insert", "metrics emit"],
    edge_cases_covered: ["audit insert"],
    ground_truth: "INCOMPLETE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "Requirement explicitly lists metrics emission · implementation summary confirms it is not present.",
      pointer: "corpus_v1/evidence/bench_035.txt",
    }],
  }),
  mkCase({
    case_id: "bench_036", defect_class: "control.incomplete", difficulty: "FOUNDATIONAL",
    requirement: "sanitize(input) must strip HTML tags, script content, AND event handlers. All three required.",
    impl_summary: "Strips HTML tags only. Script content and event handlers not handled.",
    impl_claim: "sanitize removes HTML tags.",
    tests_passed: 3, tests_summary: "Tests: simple HTML tags stripped · nested tags stripped · text preserved.",
    known_gaps: ["script content not stripped", "event handlers not stripped"],
    edge_cases_required: ["HTML tags", "script content", "event handlers"],
    edge_cases_covered: ["HTML tags"],
    ground_truth: "INCOMPLETE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "Requirement lists three items · summary confirms two are absent.",
      pointer: "corpus_v1/evidence/bench_036.txt",
    }],
  }),
];

// ─── UNCERTAIN · 3 ───────────────────────────────────────────────

const UNCERTAIN_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_037", defect_class: "control.uncertain", difficulty: "INTERMEDIATE",
    requirement: "processMessage(msg) must correctly handle malformed input by responding 400 and logging.",
    impl_summary: "",
    impl_claim: "Handles messages.",
    tests_passed: 0, tests_summary: "",
    edge_cases_required: ["malformed input", "logging"],
    edge_cases_covered: [],
    ground_truth: "UNCERTAIN", expected_verdict: "UNCERTAIN",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "No implementation summary · no tests · no runtime evidence · UNCERTAIN is the honest verdict.",
      pointer: "corpus_v1/evidence/bench_037.txt",
    }],
  }),
  mkCase({
    case_id: "bench_038", defect_class: "control.uncertain", difficulty: "INTERMEDIATE",
    requirement: "handleSignal(sig) must acknowledge · schedule cleanup · exit.",
    impl_summary: "does",
    impl_claim: "handles signals",
    tests_passed: 0, tests_summary: "",
    edge_cases_required: ["signal acknowledged", "cleanup scheduled", "exit"],
    edge_cases_covered: [],
    ground_truth: "UNCERTAIN", expected_verdict: "UNCERTAIN",
    ground_truth_evidence: [{
      method: "specification_reference",
      description: "Summary is 4 chars · below the 10-char threshold · reviewer must return UNCERTAIN.",
      pointer: "corpus_v1/evidence/bench_038.txt",
    }],
  }),
  mkCase({
    case_id: "bench_039", defect_class: "control.uncertain", difficulty: "ADVANCED",
    requirement: "validateSchema(input) must respond according to the ambiguous v2 spec (interpretation A or interpretation B).",
    impl_summary: "Follows interpretation A. Documentation is genuinely ambiguous about which is required.",
    impl_claim: "validateSchema follows the spec.",
    tests_passed: 0, tests_summary: "",
    edge_cases_required: ["interpretation A behavior", "interpretation B behavior"],
    edge_cases_covered: [],
    ground_truth: "UNCERTAIN", expected_verdict: "UNCERTAIN",
    ground_truth_evidence: [{
      method: "authoritative_documentation",
      description: "v2 spec has genuinely ambiguous wording · both interpretations have proponents · no ground truth without spec clarification.",
      pointer: "corpus_v1/evidence/bench_039.txt",
    }],
  }),
];

// ─── ADVERSARIAL · 4 ────────────────────────────────────────────

const ADVERSARIAL_CASES: BenchmarkCase[] = [
  mkCase({
    case_id: "bench_040", defect_class: "control.adversarial_unfamiliar_but_correct", difficulty: "ADVERSARIAL",
    requirement: "flatten(arr) must return a fully flattened array. Handles nested arrays of any depth.",
    impl_summary: "Uses arr.flat(Infinity) which is a valid though sometimes unfamiliar ES2019 idiom. Handles empty via natural [] return.",
    impl_claim: "flatten uses ES2019 flat(Infinity).",
    tests_passed: 5, tests_summary: "Tests: no nesting · single-level · deep nesting · empty · non-array within array. Positive · negative · boundary and error path coverage.",
    edge_cases_required: ["deep nesting", "no nesting", "empty array"],
    edge_cases_covered: ["deep nesting", "no nesting", "empty array"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "authoritative_documentation",
      description: "Array.prototype.flat is standard ES2019 · Infinity depth correctly specified.",
      pointer: "corpus_v1/evidence/bench_040.txt",
    }],
  }),
  mkCase({
    case_id: "bench_041", defect_class: "correctness.error_propagation", difficulty: "ADVERSARIAL",
    requirement: "processBatch(items) must process items and, if any single item fails, roll back all completed work in that batch.",
    impl_summary: "New implementation adds retry-on-failure that DOES retry item processing but no longer rolls back the batch on unrecoverable error (regression from prior version).",
    impl_claim: "processBatch adds retry robustness.",
    tests_passed: 4, tests_summary: "Tests: happy path · single item failure retried once then succeeds · all items succeed. Rollback test was removed in this change.",
    known_gaps: ["rollback test was removed in this change"],
    edge_cases_required: ["individual retry", "batch rollback on unrecoverable failure"],
    edge_cases_covered: ["individual retry"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Regression · rollback logic removed alongside test removal.",
      pointer: "corpus_v1/evidence/bench_041.txt",
    }],
  }),
  mkCase({
    case_id: "bench_042", defect_class: "correctness.error_propagation", difficulty: "ADVERSARIAL",
    requirement: "auditLog(event) must always call the log sink · even under high load.",
    impl_summary: "Passes event through a bounded queue with fire-and-forget semantics · dropped events are counted but not surfaced.",
    impl_claim: "auditLog writes events reliably.",
    tests_passed: 5, tests_summary: "Tests all validate under the SAME low-load assumption. Positive · negative and boundary coverage but all at low volume.",
    known_gaps: ["all tests encode the same low-load assumption · queue-drop behavior under high load never asserted"],
    edge_cases_required: ["low-load reliability", "high-load reliability", "queue-drop surfaced to caller"],
    edge_cases_covered: ["low-load reliability"],
    ground_truth: "DEFECTIVE", expected_verdict: "NEEDS_CHANGES",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Tests all encode the low-load assumption · drop-under-load never exercised · classic same-wrong-assumption bug.",
      pointer: "corpus_v1/evidence/bench_042.txt",
    }],
    tests_pass_but_code_wrong: true,
  }),
  mkCase({
    case_id: "bench_043", defect_class: "control.correct", difficulty: "ADVERSARIAL",
    requirement: "regionalEndpoint(region) must dispatch a request to the region-specific endpoint. Must handle 'us-east-1', 'eu-west-1', 'ap-southeast-1'.",
    impl_summary: "Constructs endpoint via `${region}.api.example.com` and dispatches. Looks like string interpolation but region is validated against an allowlist BEFORE the interpolation.",
    impl_claim: "regionalEndpoint safely dispatches to validated regions.",
    tests_passed: 5, tests_summary: "Tests: each of the 3 valid regions · invalid region rejected · malicious region-string rejected. Negative · boundary and error path coverage.",
    edge_cases_required: ["valid regions dispatch", "invalid regions rejected", "malicious input rejected"],
    edge_cases_covered: ["valid regions dispatch", "invalid regions rejected", "malicious input rejected"],
    runtime_evidence: ["fixture/bench_043/probe.log"],
    ground_truth: "CORRECT", expected_verdict: "ACCEPT",
    ground_truth_evidence: [{
      method: "static_check",
      description: "Region is allowlist-validated before use in URL · looks dangerous but is actually safe.",
      pointer: "corpus_v1/evidence/bench_043.txt",
    }],
  }),
];

// ─── Corpus export ──────────────────────────────────────────────

export const CORPUS_V1_CASES: BenchmarkCase[] = [
  ...CORRECTNESS_CASES,
  ...CONCURRENCY_CASES,
  ...SECURITY_CASES,
  ...RELIABILITY_CASES,
  ...DATA_CASES,
  ...TEMPORAL_CASES,
  ...API_CASES,
  ...CORRECT_CASES,
  ...INCOMPLETE_CASES,
  ...UNCERTAIN_CASES,
  ...ADVERSARIAL_CASES,
];

export { CORPUS_VERSION };
