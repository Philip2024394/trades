// NEX App Builder · Phase 19B · Evidence-Based Worker State (Philip 2026-08-14).
//
// Acceptance test for the eight-state evidence model applied to the six
// workers (Validation, Data-model, Integration, Design-image, Visual-QA,
// Provenance-surface).
//
// Central rule tested:
//   state → evidence → diagnosis → decision
//   NEVER: state → guess → restart
//
// Locked scope (Philip 2026-08-14):
//   - LOCAL workers only
//   - No Fly, no cloud-worker reactivation
//   - No deployment changes
//   - No new external dependency
//
// Non-negotiable criteria:
//   1. Every worker returns a WorkerReport with a `verdict: EvidenceVerdict`.
//   2. The verdict state is one of the 8 lawful values.
//   3. Every verdict carries evidence[] AND diagnosis AND decision.
//   4. PENDING checks NEVER get a fabricated PASS.
//   5. Downstream (provenance-surface) cites upstream verdicts as evidence.
//   6. FAILED or UNKNOWN upstream propagates to a corresponding downstream state.
//   7. Constitutional silence-over-fabrication: BLOCKED_INPUT / BLOCKED_CONFIG
//      is the correct verdict when required facts / env vars are missing.
//   8. The additive contract: existing coarse WorkerStatus is preserved.

await import("../../src/lib/studio/sections/index.ts");

const raw = await import("../../src/lib/app-builder/examples/staircase-company.ts");
const completed = await import("../../src/lib/app-builder/examples/staircase-company-completed.ts");
const orch = await import("../../src/lib/app-builder/workers/orchestrator.ts");
const workers = await import("../../src/lib/app-builder/workers/index.ts");

const LAWFUL_STATES = new Set([
  "HEALTHY",
  "DEGRADED",
  "BLOCKED_INPUT",
  "BLOCKED_CONFIG",
  "BLOCKED_UPSTREAM",
  "FAILED",
  "PENDING",
  "UNKNOWN"
]);

const LAWFUL_SOURCES = new Set([
  "blueprint",
  "env",
  "adapter",
  "hero-library",
  "playwright",
  "upstream",
  "runtime",
  "registry"
]);

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else { console.error("FAIL:", msg); failures.push(msg); fail++; }
}

function assertVerdict(report, workerName) {
  assert(!!report.verdict, `${workerName} · report carries a verdict`);
  if (!report.verdict) return;

  const v = report.verdict;
  assert(LAWFUL_STATES.has(v.state), `${workerName} · verdict.state is one of the 8 lawful values (got ${v.state})`);
  assert(Array.isArray(v.evidence) && v.evidence.length > 0, `${workerName} · verdict.evidence[] is non-empty (${v.evidence?.length ?? 0} records)`);
  assert(typeof v.diagnosis === "string" && v.diagnosis.length > 0, `${workerName} · verdict.diagnosis is a non-empty string`);
  assert(typeof v.decision === "string" && v.decision.length > 0, `${workerName} · verdict.decision is a non-empty string`);

  // Every evidence record must have a lawful source + human-readable observation.
  let evidenceOk = true;
  for (const [i, e] of v.evidence.entries()) {
    if (!e || typeof e.observation !== "string" || e.observation.length === 0) {
      console.error(`  ${workerName} · evidence[${i}] missing observation`);
      evidenceOk = false;
    }
    if (!e || !LAWFUL_SOURCES.has(e.source)) {
      console.error(`  ${workerName} · evidence[${i}] has invalid source: ${e?.source}`);
      evidenceOk = false;
    }
  }
  assert(evidenceOk, `${workerName} · every evidence record is well-formed`);
}

// ═══════════════════════════════════════════════════════════════
// A. RAW BLUEPRINT (required customer facts missing → BLOCKED_INPUT)
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("A. Raw staircase Blueprint (customer facts missing)");
console.log("─".repeat(60));

const rawResult = await orch.runBlueprintWorkers(raw.staircaseCompanyBlueprint);

const rawReports = rawResult.workerReports;
for (const [name, report] of Object.entries(rawReports)) {
  if (!report) { assert(false, `raw · ${name} report missing`); continue; }
  assertVerdict(report, `raw.${name}`);
}

// Validation on the raw blueprint MUST be BLOCKED_INPUT (customer facts missing).
const rawValidation = rawReports.validation.verdict;
assert(rawValidation.state === "BLOCKED_INPUT",
  `raw · validation.verdict = BLOCKED_INPUT (customer facts missing) · got ${rawValidation.state}`);

// The validation evidence MUST cite specific missing fact paths (not vague).
const citesRequiredFactPath = rawValidation.evidence.some((e) =>
  typeof e.path === "string" && e.path.startsWith("identity."));
assert(citesRequiredFactPath, "raw · validation evidence cites at least one identity.* required-fact path");

// Data model worker MUST be BLOCKED_INPUT because 'products' has no seed.
const rawDataModel = rawReports.dataModel.verdict;
assert(rawDataModel.state === "BLOCKED_INPUT" || rawDataModel.state === "DEGRADED",
  `raw · dataModel.verdict = BLOCKED_INPUT|DEGRADED (products model needs input) · got ${rawDataModel.state}`);

// Integration worker MUST be BLOCKED_INPUT (google-maps radius centre missing)
// OR BLOCKED_CONFIG (env vars missing) — either is honest.
const rawIntegration = rawReports.integration.verdict;
assert(
  rawIntegration.state === "BLOCKED_INPUT" ||
  rawIntegration.state === "BLOCKED_CONFIG" ||
  rawIntegration.state === "DEGRADED",
  `raw · integration.verdict = BLOCKED_* or DEGRADED · got ${rawIntegration.state}`);

// Integration MUST NOT emit CONNECTED without a live call.
const anyFakeConnected = rawReports.integration.data.integrations.some(
  (i) => i.status === "CONNECTED"
);
assert(!anyFakeConnected, "raw · no integration is CONNECTED without evidence (silence-over-fabrication)");

// Visual QA MUST be PENDING or FAILED — never HEALTHY without a live run.
const rawVisualQA = rawReports.visualQA.verdict;
assert(
  rawVisualQA.state === "PENDING" || rawVisualQA.state === "FAILED",
  `raw · visualQA.verdict = PENDING|FAILED (no live run yet) · got ${rawVisualQA.state}`);

// No visual QA check may be PASS without live execution.
const anyFakePass = rawReports.visualQA.data.checks.some((c) => c.status === "PASS");
assert(!anyFakePass, "raw · no visual QA check is PASS without live execution");

// Provenance surface MUST cite upstream verdicts as evidence.
const rawSurface = rawReports.provenanceSurface.verdict;
const upstreamCites = rawSurface.evidence.filter((e) => e.source === "upstream").length;
assert(upstreamCites >= 5, `raw · provenanceSurface cites ${upstreamCites} upstream verdicts as evidence (expected ≥ 5)`);

// Provenance surface state must reflect the worst upstream state deterministically.
const rawUpstreamStates = [
  rawReports.validation.verdict.state,
  rawReports.dataModel.verdict.state,
  rawReports.integration.verdict.state,
  rawReports.design.verdict.state,
  rawReports.visualQA.verdict.state
];
const worstIsBlocked = rawUpstreamStates.some(
  (s) => s === "BLOCKED_INPUT" || s === "BLOCKED_CONFIG"
);
if (worstIsBlocked) {
  assert(
    rawSurface.state === "BLOCKED_INPUT" ||
    rawSurface.state === "BLOCKED_CONFIG" ||
    rawSurface.state === "BLOCKED_UPSTREAM" ||
    rawSurface.state === "PENDING",
    `raw · surface state reflects upstream blockage · got ${rawSurface.state} · upstream=${rawUpstreamStates.join(",")}`
  );
}

// ═══════════════════════════════════════════════════════════════
// B. COMPLETED BLUEPRINT (facts supplied → verdict improves)
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("B. Completed staircase Blueprint (facts supplied)");
console.log("─".repeat(60));

const completedResult = await orch.runBlueprintWorkers(completed.staircaseCompletedBlueprint);
const compReports = completedResult.workerReports;
for (const [name, report] of Object.entries(compReports)) {
  if (!report) { assert(false, `completed · ${name} report missing`); continue; }
  assertVerdict(report, `completed.${name}`);
}

// Validation on the completed blueprint MUST NOT be BLOCKED_INPUT.
const compValidation = compReports.validation.verdict;
assert(
  compValidation.state === "HEALTHY" || compValidation.state === "DEGRADED",
  `completed · validation.verdict = HEALTHY|DEGRADED (customer facts supplied) · got ${compValidation.state}`
);

// Data model on the completed blueprint MUST NOT be BLOCKED_INPUT anymore.
const compDataModel = compReports.dataModel.verdict;
assert(
  compDataModel.state === "HEALTHY" || compDataModel.state === "DEGRADED",
  `completed · dataModel.verdict = HEALTHY|DEGRADED (products seeded) · got ${compDataModel.state}`
);

// ═══════════════════════════════════════════════════════════════
// C. THE CONTRACT: evidence-first, decision explicit
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("C. Contract properties (evidence → diagnosis → decision)");
console.log("─".repeat(60));

// Every verdict's `decision` must be actionable (mentions "proceed", "fix",
// "resolve", "run", "provide", "supply", "install", "collect", "trigger",
// "address", "investigate", "add", "queue", "either" or similar action verbs).
const ACTION_WORDS = /\b(proceed|fix|resolve|run|provide|supply|install|collect|trigger|address|investigate|add|queue|either|studio|adapter|surface|require|attempt|reset)\b/i;
for (const result of [rawResult, completedResult]) {
  for (const [name, report] of Object.entries(result.workerReports)) {
    if (!report) continue;
    assert(
      ACTION_WORDS.test(report.verdict.decision),
      `${name} · verdict.decision is actionable ("${report.verdict.decision.slice(0, 80)}...")`
    );
  }
}

// The 8 lawful states are a closed set — no verdict may emit anything else.
for (const result of [rawResult, completedResult]) {
  for (const [name, report] of Object.entries(result.workerReports)) {
    if (!report) continue;
    assert(
      LAWFUL_STATES.has(report.verdict.state),
      `${name} · verdict.state within the 8-state taxonomy (got ${report.verdict.state})`
    );
  }
}

// Additive contract: existing coarse WorkerStatus must still be present and lawful.
const LAWFUL_STATUS = new Set(["ok", "warn", "blocked", "failed"]);
for (const result of [rawResult, completedResult]) {
  for (const [name, report] of Object.entries(result.workerReports)) {
    if (!report) continue;
    assert(
      LAWFUL_STATUS.has(report.status),
      `${name} · WorkerStatus preserved as one of ok|warn|blocked|failed (got ${report.status})`
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// D. UPSTREAM PROPAGATION: forge a FAILED upstream and confirm the
//    surface emits BLOCKED_UPSTREAM (never fabricates a PASS).
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("D. Upstream propagation (FAILED upstream → BLOCKED_UPSTREAM surface)");
console.log("─".repeat(60));

function synthReport(worker, verdictState, data) {
  return {
    worker,
    status: verdictState === "FAILED" ? "failed" : "ok",
    data,
    messages: [],
    errors: [],
    warnings: [],
    verdict: {
      state: verdictState,
      evidence: [{ observation: `synthetic ${verdictState} verdict for propagation test`, source: "runtime" }],
      diagnosis: `synthesized ${verdictState}`,
      decision: "test-only decision"
    },
    meta: { durationMs: 0, startedAt: new Date().toISOString(), ranAt: new Date().toISOString() }
  };
}

// Take the healthy raw reports and swap validation to FAILED.
const forgedFailed = workers.runProvenanceSurfaceWorker(
  { runId: "test", blueprint: raw.staircaseCompanyBlueprint },
  {
    validation: synthReport("validation", "FAILED", rawReports.validation.data),
    dataModel: rawReports.dataModel,
    integration: rawReports.integration,
    design: rawReports.design,
    visualQA: rawReports.visualQA
  }
);
assert(
  forgedFailed.verdict.state === "BLOCKED_UPSTREAM",
  `FAILED upstream → surface.state = BLOCKED_UPSTREAM (got ${forgedFailed.verdict.state})`
);

// UNKNOWN upstream must propagate to UNKNOWN (silence-over-fabrication).
const forgedUnknown = workers.runProvenanceSurfaceWorker(
  { runId: "test", blueprint: raw.staircaseCompanyBlueprint },
  {
    validation: rawReports.validation,
    dataModel: rawReports.dataModel,
    integration: rawReports.integration,
    design: synthReport("design", "UNKNOWN", rawReports.design.data),
    visualQA: rawReports.visualQA
  }
);
assert(
  forgedUnknown.verdict.state === "UNKNOWN",
  `UNKNOWN upstream → surface.state = UNKNOWN (silence-over-fabrication) · got ${forgedUnknown.verdict.state}`
);

// All-healthy synthetic upstream → surface = HEALTHY.
const forgedHealthy = workers.runProvenanceSurfaceWorker(
  { runId: "test", blueprint: raw.staircaseCompanyBlueprint },
  {
    validation: synthReport("validation", "HEALTHY", rawReports.validation.data),
    dataModel: synthReport("dataModel", "HEALTHY", rawReports.dataModel.data),
    integration: synthReport("integration", "HEALTHY", rawReports.integration.data),
    design: synthReport("design", "HEALTHY", rawReports.design.data),
    visualQA: synthReport("visualQA", "HEALTHY", rawReports.visualQA.data)
  }
);
// The surface still computes its own action items from the actual data —
// if the healthy synthetic still has required customer facts, it will
// downgrade to DEGRADED. Either HEALTHY or DEGRADED is honest here.
assert(
  forgedHealthy.verdict.state === "HEALTHY" || forgedHealthy.verdict.state === "DEGRADED",
  `All-HEALTHY upstream → surface.state = HEALTHY|DEGRADED (got ${forgedHealthy.verdict.state})`
);

// ═══════════════════════════════════════════════════════════════
// E. NO FABRICATION AUDIT
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("E. No fabrication audit");
console.log("─".repeat(60));

// No integration verdict may claim CONNECTED without a live-verification
// evidence record.
const integrations = rawResult.workerReports.integration.data.integrations;
for (const i of integrations) {
  if (i.status === "CONNECTED") {
    assert(false, `integration ${i.provider} claims CONNECTED without a live call`);
  }
}

// No visual QA check may be PASS unless it carries evidence with a screenshotUrl
// or measurement (i.e. it was actually executed).
for (const c of rawResult.workerReports.visualQA.data.checks) {
  if (c.status === "PASS") {
    assert(
      !!(c.evidence && (c.evidence.screenshotUrl || c.evidence.measurement)),
      `QA check ${c.id} is PASS with executed evidence`
    );
  }
}

// No worker may emit an evidence record with a source outside the closed set.
for (const result of [rawResult, completedResult]) {
  for (const [name, report] of Object.entries(result.workerReports)) {
    if (!report) continue;
    for (const [i, e] of report.verdict.evidence.entries()) {
      if (!LAWFUL_SOURCES.has(e.source)) {
        assert(false, `${name} · evidence[${i}].source=${e.source} not in closed set`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("=".repeat(60));
console.log("Phase 19B · evidence worker state · " + pass + " passed · " + fail + " failed");
console.log("=".repeat(60));
if (fail > 0) {
  console.error("");
  console.error("Failures:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
