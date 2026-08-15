// NEX App Builder · Phase 19C · Operator Verdict Surface (Philip 2026-08-14).
//
// Proves that the six workers' EvidenceVerdicts (Phase 19B) reach the
// Studio operator UI unchanged AND that the adapter never invents,
// re-orders, or leaks credential values on the way through.
//
// Central rule tested:
//   worker.EvidenceVerdict  ==>  UI-safe WorkerVerdictSummary
//   (state / diagnosis / decision preserved · secrets scrubbed · order stable)
//
// Non-negotiable criteria:
//   1. toOperatorVerdicts returns exactly 6 verdicts in canonical order.
//   2. Every summary preserves state / diagnosis / decision verbatim.
//   3. Every summary carries a status from the 4-state closed set.
//   4. When a worker is missing (null in OrchestratorResult), the summary
//      is state=UNKNOWN with a non-empty diagnosis — never dropped.
//   5. State counts round-trip correctly (sum == 6, per-state matches).
//   6. Credential scrub: any evidence value shaped like a secret is dropped
//      from safeValue, but the observation string is preserved.
//   7. Env-key names (STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY) may
//      appear in observation text (that's the whole point of the diagnosis)
//      but the ADAPTER MUST NOT SYNTHESISE a value into safeValue for them.
//   8. The UI shape matches AppBuilderChat's TypeScript signature (a soft
//      contract check — every field the UI reads exists).

process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890";

await import("../../src/lib/studio/sections/index.ts");

const raw       = await import("../../src/lib/app-builder/examples/staircase-company.ts");
const completed = await import("../../src/lib/app-builder/examples/staircase-company-completed.ts");
const orch      = await import("../../src/lib/app-builder/workers/orchestrator.ts");
const surface   = await import("../../src/lib/app-builder/workers/verdict-surface.ts");

const CANONICAL_ORDER = [
  "validation",
  "dataModel",
  "integration",
  "design",
  "visualQA",
  "provenanceSurface"
];

const LAWFUL_STATES = new Set([
  "HEALTHY", "DEGRADED",
  "BLOCKED_INPUT", "BLOCKED_CONFIG", "BLOCKED_UPSTREAM",
  "FAILED", "PENDING", "UNKNOWN"
]);
const LAWFUL_STATUS = new Set(["ok", "warn", "blocked", "failed"]);

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else { console.error("FAIL:", msg); failures.push(msg); fail++; }
}

// ═══════════════════════════════════════════════════════════════
// A. RAW BLUEPRINT — most workers should be BLOCKED_*
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("A. Raw blueprint (many upstream verdicts should be BLOCKED_*)");
console.log("─".repeat(60));

const rawRun    = await orch.runBlueprintWorkers(raw.staircaseCompanyBlueprint);
const rawView   = surface.toOperatorVerdicts(rawRun);

assert(rawView.verdicts.length === 6, `raw · verdicts.length === 6 (got ${rawView.verdicts.length})`);

for (let i = 0; i < CANONICAL_ORDER.length; i++) {
  assert(
    rawView.verdicts[i]?.worker === CANONICAL_ORDER[i],
    `raw · verdict[${i}] is ${CANONICAL_ORDER[i]} (got ${rawView.verdicts[i]?.worker})`
  );
}

for (const v of rawView.verdicts) {
  assert(LAWFUL_STATES.has(v.state),   `raw · ${v.worker} state within taxonomy (${v.state})`);
  assert(LAWFUL_STATUS.has(v.status),  `raw · ${v.worker} status within {ok,warn,blocked,failed} (${v.status})`);
  assert(typeof v.diagnosis === "string" && v.diagnosis.length > 0,
    `raw · ${v.worker} diagnosis non-empty`);
  assert(typeof v.decision === "string" && v.decision.length > 0,
    `raw · ${v.worker} decision non-empty`);
  assert(typeof v.displayName === "string" && v.displayName.length > 0,
    `raw · ${v.worker} displayName non-empty`);
  assert(typeof v.evidenceCount === "number" && v.evidenceCount >= 0,
    `raw · ${v.worker} evidenceCount is a non-negative number (${v.evidenceCount})`);
  assert(Array.isArray(v.evidenceHighlights),
    `raw · ${v.worker} evidenceHighlights is an array`);
  assert(v.evidenceHighlights.length <= 5,
    `raw · ${v.worker} evidenceHighlights capped at 5 (${v.evidenceHighlights.length})`);
  for (const h of v.evidenceHighlights) {
    assert(typeof h.observation === "string" && h.observation.length > 0,
      `raw · ${v.worker} highlight has observation`);
    assert(typeof h.source === "string" && h.source.length > 0,
      `raw · ${v.worker} highlight has source (${h.source})`);
  }
}

// The 6 counts must sum to 6.
const rawSum = Object.values(rawView.counts).reduce((a, b) => a + b, 0);
assert(rawSum === 6, `raw · counts sum to 6 (got ${rawSum})`);

// Per-state count matches the actual verdicts.
for (const state of Object.keys(rawView.counts)) {
  const actual = rawView.verdicts.filter((v) => v.state === state).length;
  assert(rawView.counts[state] === actual,
    `raw · counts.${state} matches actual (${rawView.counts[state]} vs ${actual})`);
}

// Overall must match orchestrator.
assert(rawView.overall === rawRun.overall,
  `raw · view.overall === run.overall (${rawView.overall})`);

// runId + ranAt preserved verbatim.
assert(rawView.runId === rawRun.runId, `raw · runId preserved`);
assert(rawView.ranAt === rawRun.ranAt, `raw · ranAt preserved`);

// Diagnosis/decision preserved verbatim from the underlying worker.
for (const [key, r] of Object.entries(rawRun.workerReports)) {
  if (!r) continue;
  const v = rawView.verdicts.find((x) => x.worker === key);
  assert(v, `raw · view has verdict for ${key}`);
  if (v) {
    assert(v.state === r.verdict.state,
      `raw · ${key} state verbatim (${v.state} === ${r.verdict.state})`);
    assert(v.diagnosis === r.verdict.diagnosis,
      `raw · ${key} diagnosis verbatim`);
    assert(v.decision === r.verdict.decision,
      `raw · ${key} decision verbatim`);
  }
}

// ═══════════════════════════════════════════════════════════════
// B. MISSING WORKER (short-circuit) → UNKNOWN, not dropped
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("B. Missing workers surface as UNKNOWN (not dropped)");
console.log("─".repeat(60));

// Simulate a failed validation short-circuit by nulling downstream reports.
const shortCircuited = {
  ...rawRun,
  workerReports: {
    validation: rawRun.workerReports.validation,
    dataModel: null,
    integration: null,
    design: null,
    visualQA: null,
    provenanceSurface: null
  },
  overall: "FAILED"
};

const shortView = surface.toOperatorVerdicts(shortCircuited);
assert(shortView.verdicts.length === 6,
  `short-circuit · verdicts.length === 6 (missing workers surfaced as UNKNOWN)`);

const missingWorkers = shortView.verdicts.filter((v) => v.worker !== "validation");
for (const v of missingWorkers) {
  assert(v.state === "UNKNOWN",
    `short-circuit · ${v.worker} surfaces as UNKNOWN (got ${v.state})`);
  assert(v.diagnosis.length > 0,
    `short-circuit · ${v.worker} diagnosis explains the short-circuit`);
  assert(v.decision.length > 0,
    `short-circuit · ${v.worker} decision offers a next step`);
  assert(v.evidenceCount === 0,
    `short-circuit · ${v.worker} evidenceCount === 0 (no worker ran)`);
  assert(v.evidenceHighlights.length === 0,
    `short-circuit · ${v.worker} evidenceHighlights === [] (no worker ran)`);
}

// Validation itself is preserved as-is.
const shortValidation = shortView.verdicts.find((v) => v.worker === "validation");
assert(
  shortValidation.state === rawRun.workerReports.validation.verdict.state,
  `short-circuit · validation state preserved (${shortValidation.state})`
);

// Counts still sum to 6.
const shortSum = Object.values(shortView.counts).reduce((a, b) => a + b, 0);
assert(shortSum === 6, `short-circuit · counts sum to 6 (got ${shortSum})`);

// ═══════════════════════════════════════════════════════════════
// C. CREDENTIAL SCRUB — no secret-shaped value survives
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("C. Credential scrub · no secret leaks into UI");
console.log("─".repeat(60));

// Simulate a worker whose evidence carries plausibly secret-shaped values.
// We build a synthetic OrchestratorResult from the real integration report
// but rewrite one evidence record's value to include tokens/keys.
const forgedIntegration = {
  ...rawRun.workerReports.integration,
  verdict: {
    ...rawRun.workerReports.integration.verdict,
    evidence: [
      // Real evidence (should survive)
      {
        observation: "Integration \"stripe\" status=MISSING_CONFIGURATION · env keys not present",
        source: "blueprint",
        path: "integrations.stripe",
        value: { envPresent: ["STRIPE_WEBHOOK_SECRET"], envMissing: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"] }
      },
      // Adversarial evidence: value contains a plausible token
      {
        observation: "Forged evidence · token in raw value",
        source: "runtime",
        path: "adversarial.token",
        value: { session: "s3cr3tSessionValueThatShouldNeverAppearInUI0123456789abcdef", nested: { password: "hunter2hunter2hunter2hunter2hunter2" } }
      },
      // Adversarial evidence: bare string looking like an entropy token
      {
        observation: "Forged evidence · bare token string",
        source: "runtime",
        path: "adversarial.rawToken",
        value: "FIXTURE-FAKE-TOKEN-not-a-real-key-adversarial-test-only-do-not-scan-01234"
      }
    ]
  }
};

const forgedRun = {
  ...rawRun,
  workerReports: { ...rawRun.workerReports, integration: forgedIntegration }
};

const forgedView = surface.toOperatorVerdicts(forgedRun);
const forgedIntSummary = forgedView.verdicts.find((v) => v.worker === "integration");
assert(forgedIntSummary, "forged · integration summary present");

// Observation strings are preserved verbatim (they may name secret keys).
const observations = forgedIntSummary.evidenceHighlights.map((h) => h.observation);
assert(
  observations.some((o) => o.includes("STRIPE_SECRET_KEY") || o.includes("MISSING_CONFIGURATION") || o.includes("Forged")),
  "forged · observation strings preserved verbatim (they name env keys as context)"
);

// The adversarial safeValue MUST NOT contain the raw secret-shaped string.
const highlightForRawToken = forgedIntSummary.evidenceHighlights.find((h) => h.path === "adversarial.rawToken");
assert(highlightForRawToken, "forged · adversarial.rawToken highlight present");
if (highlightForRawToken) {
  assert(
    highlightForRawToken.safeValue === undefined,
    `forged · adversarial.rawToken safeValue is scrubbed (got ${JSON.stringify(highlightForRawToken.safeValue)})`
  );
}

const highlightForNestedToken = forgedIntSummary.evidenceHighlights.find((h) => h.path === "adversarial.token");
assert(highlightForNestedToken, "forged · adversarial.token highlight present");
if (highlightForNestedToken) {
  const sv = highlightForNestedToken.safeValue;
  const svStr = JSON.stringify(sv ?? {});
  assert(
    !svStr.includes("s3cr3tSessionValue"),
    `forged · session raw value scrubbed from safeValue (got ${svStr})`
  );
  assert(
    !svStr.includes("hunter2"),
    `forged · password raw value scrubbed from safeValue (got ${svStr})`
  );
}

// The real evidence (env key names as an array of strings, presence booleans)
// SHOULD survive — those are UI-safe.
const highlightForRealEvidence = forgedIntSummary.evidenceHighlights.find((h) => h.path === "integrations.stripe");
assert(highlightForRealEvidence, "forged · real integration evidence highlight present");
if (highlightForRealEvidence) {
  const sv = highlightForRealEvidence.safeValue;
  assert(
    sv && typeof sv === "object" && (Array.isArray(sv.envMissing) || Array.isArray(sv.envPresent)),
    `forged · real evidence preserves envMissing/envPresent arrays (got ${JSON.stringify(sv)})`
  );
  if (sv && Array.isArray(sv.envMissing)) {
    assert(
      sv.envMissing.includes("STRIPE_SECRET_KEY"),
      `forged · envMissing includes STRIPE_SECRET_KEY (env-key name is UI-safe context)`
    );
  }
}

// Full-view audit: nowhere in the UI-facing view does the adversarial token appear.
const fullViewText = JSON.stringify(forgedView);
assert(
  !fullViewText.includes("s3cr3tSessionValue"),
  "forged · adversarial session token never appears anywhere in the view"
);
assert(
  !fullViewText.includes("hunter2"),
  "forged · adversarial password never appears anywhere in the view"
);
assert(
  !fullViewText.includes("FIXTURE-FAKE-TOKEN"),
  "forged · adversarial bare token never appears anywhere in the view"
);

// ═══════════════════════════════════════════════════════════════
// D. COMPLETED BLUEPRINT — verdicts improve, order stable
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("D. Completed blueprint · verdicts improve · order stable");
console.log("─".repeat(60));

const compRun  = await orch.runBlueprintWorkers(completed.staircaseCompletedBlueprint);
const compView = surface.toOperatorVerdicts(compRun);

for (let i = 0; i < CANONICAL_ORDER.length; i++) {
  assert(
    compView.verdicts[i]?.worker === CANONICAL_ORDER[i],
    `completed · verdict[${i}] is ${CANONICAL_ORDER[i]} (order stable across runs)`
  );
}

// Data model on completed blueprint should be HEALTHY or DEGRADED (not BLOCKED_INPUT).
const compDataModel = compView.verdicts.find((v) => v.worker === "dataModel");
assert(
  compDataModel.state === "HEALTHY" || compDataModel.state === "DEGRADED",
  `completed · dataModel improves off BLOCKED_INPUT (got ${compDataModel.state})`
);

// Every completed verdict has non-empty diagnosis + decision.
for (const v of compView.verdicts) {
  assert(v.diagnosis.length > 0, `completed · ${v.worker} diagnosis non-empty`);
  assert(v.decision.length > 0,  `completed · ${v.worker} decision non-empty`);
}

// ═══════════════════════════════════════════════════════════════
// E. UI CONTRACT · every field AppBuilderChat consumes exists
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("─".repeat(60));
console.log("E. UI contract · AppBuilderChat can render every field");
console.log("─".repeat(60));

// Fields AppBuilderChat's VerdictPanel reads from the surface:
//   surface.overall · surface.totalDurationMs · surface.runId
//   surface.verdicts[].worker · displayName · state · diagnosis · decision
//   surface.verdicts[].evidenceCount · evidenceHighlights[]
//   evidenceHighlights[].observation · source · path

for (const view of [rawView, compView]) {
  assert(typeof view.overall === "string" && view.overall.length > 0,
    "ui-contract · view.overall present");
  assert(typeof view.totalDurationMs === "number",
    "ui-contract · view.totalDurationMs present");
  assert(typeof view.runId === "string" && view.runId.length > 0,
    "ui-contract · view.runId present");

  for (const v of view.verdicts) {
    assert(typeof v.worker === "string",       `ui-contract · ${v.worker} .worker`);
    assert(typeof v.displayName === "string",  `ui-contract · ${v.worker} .displayName`);
    assert(typeof v.state === "string",        `ui-contract · ${v.worker} .state`);
    assert(typeof v.diagnosis === "string",    `ui-contract · ${v.worker} .diagnosis`);
    assert(typeof v.decision === "string",     `ui-contract · ${v.worker} .decision`);
    assert(typeof v.evidenceCount === "number",`ui-contract · ${v.worker} .evidenceCount`);
    assert(Array.isArray(v.evidenceHighlights),`ui-contract · ${v.worker} .evidenceHighlights`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log("");
console.log("=".repeat(60));
console.log(`Phase 19C · operator verdict surface · ${pass} passed · ${fail} failed`);
console.log("=".repeat(60));
if (fail > 0) {
  console.error("");
  console.error("Failures:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
