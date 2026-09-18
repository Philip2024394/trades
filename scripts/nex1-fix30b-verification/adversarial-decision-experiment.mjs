// NEX1 · Fix 30B · Adversarial Decision-Effect Experiment
// Founder-authorised 2026-09-18.
//
// Objective: measure whether prior experience CAN change NEX1's downstream
// decision (state / refusal_kind), while the prior remains evidence and
// never becomes authority. Runs the A/B/C/D/E adversarial matrix + ablation
// + repeatability. Writes a receipt JSON.
//
// STRICT RULES:
//   - ZERO LLM
//   - No hard-coded lookup: the SAME label (SELECTED) produces DIFFERENT
//     downstream outcomes depending on RELATIONSHIP with current evidence
//   - Current evidence remains independently evaluated in every scenario
//   - Prior TIE / SELECTED-matching do NOT block promotion
//   - Prior SELECTED-with-different-signature DOES preserve conflict (HOLD)
//
// Uses server on port 3008. Reads/writes:
//   data/nex1-investigation-conclusions/entries.jsonl (Fix 17 store)
//   src/lib/nex1-fix24-fixtures/s1-niladic.ts (target fixture)
//   data/nex1-fix30b/*.json (receipts)

import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const REPO = "C:/Users/Victus/trades";
const STORE = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
const OUT_DIR = path.join(REPO, "data", "nex1-fix30b");
const TARGET_REL = "src/lib/nex1-fix24-fixtures/s1-niladic.ts";
const OTHER_FILE_REL = "src/lib/nex1-fix24-fixtures/other-file.ts";
const PROMPT = "Analyse computeWorkerPool and propose a correction.";
const CURRENT_EXPECTED = "3"; // matches assertion in s1-niladic.assertion.ts
const CURRENT_SIG = `${TARGET_REL}::${CURRENT_EXPECTED}`;
const DIFFERENT_SIG = `${TARGET_REL}::99`;

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── helpers ─────────────────────────────────────────────────────────────

function resetStore() {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  if (fs.existsSync(STORE)) fs.unlinkSync(STORE);
}
function resetFixture() {
  const src = path.join(REPO, TARGET_REL);
  fs.writeFileSync(
    src,
    `// FIXTURE · reset by Fix 30B adversarial experiment.
export interface WorkerPoolResult { readonly size: number; }
export function computeWorkerPool(): WorkerPoolResult {
  const size = 8;
  return { size };
}
`,
    "utf8",
  );
}
function seedPrior({ source_file, selection_state, selected_candidate, timestamp }) {
  const entry = {
    entry_id: "seed-" + Math.random().toString(36).slice(2, 10),
    timestamp,
    investigation_id: "seeded-inv",
    trace_id: "seeded-tr",
    source_file,
    selection_state,
    selected_candidate,
    candidates_considered: selected_candidate === null ? [] : [selected_candidate],
    rankings_reference: {
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
      source_file,
    },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "Fix 30B adversarial experiment seed",
    confidence: 0.35,
    provenance: [{ source_file, start_line: 1, end_line: 1 }],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
  };
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.appendFileSync(STORE, JSON.stringify(entry) + "\n", "utf8");
  return entry.entry_id;
}
async function post(convId, message) {
  const res = await fetch("http://localhost:3008/api/nex1/chat/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message }),
  });
  return res.json();
}

function extractSignals(r) {
  const trace = Array.isArray(r.trace) ? r.trace : [];
  return {
    state: r.state,
    refusal_kind: r.summary?.refusal_kind ?? null,
    verb_family: r.summary?.verb_family ?? null,
    rationale: r.summary?.rationale ?? null,
    fix30_trace: trace.filter((x) => x.includes("fix30") || x.includes("fix30b")),
    fix25_trace: trace.filter((x) => x.includes("fix25")),
    comparator_relationship_line: trace.find((x) => x.includes("fix30b · comparator")) ?? null,
    hold_line: trace.find((x) => x.includes("fix30b · HOLD")) ?? null,
    promoted: r.state === "understood" && r.summary?.verb_family === "FIX",
  };
}

// ── scenario runners ────────────────────────────────────────────────────

async function scenarioA() {
  console.log("\n=== A · no prior ===");
  resetStore(); resetFixture();
  const r = await post(`A-${Date.now()}`, PROMPT);
  return { scenario: "A", seeded: null, ...extractSignals(r), raw_state: r.state };
}
async function scenarioB() {
  console.log("\n=== B · prior SELECTED matching signature ===");
  resetStore(); resetFixture();
  const id = seedPrior({
    source_file: TARGET_REL,
    selection_state: "SELECTED",
    selected_candidate: CURRENT_SIG,
    timestamp: "2026-09-17T00:00:00Z",
  });
  const r = await post(`B-${Date.now()}`, PROMPT);
  return { scenario: "B", seeded: { id, verdict: "SELECTED", candidate: CURRENT_SIG }, ...extractSignals(r) };
}
async function scenarioC() {
  console.log("\n=== C · prior TIE (no candidate) ===");
  resetStore(); resetFixture();
  const id = seedPrior({
    source_file: TARGET_REL,
    selection_state: "TIE",
    selected_candidate: null,
    timestamp: "2026-09-17T00:00:00Z",
  });
  const r = await post(`C-${Date.now()}`, PROMPT);
  return { scenario: "C", seeded: { id, verdict: "TIE", candidate: null }, ...extractSignals(r) };
}
async function scenarioD(label = "D") {
  console.log(`\n=== ${label} · prior SELECTED DIFFERENT signature (conflict) ===`);
  resetStore(); resetFixture();
  const id = seedPrior({
    source_file: TARGET_REL,
    selection_state: "SELECTED",
    selected_candidate: DIFFERENT_SIG,
    timestamp: "2026-09-17T00:00:00Z",
  });
  const r = await post(`${label}-${Date.now()}`, PROMPT);
  return { scenario: label, seeded: { id, verdict: "SELECTED", candidate: DIFFERENT_SIG }, ...extractSignals(r) };
}
async function scenarioE() {
  console.log("\n=== E · superficial · prior SELECTED for DIFFERENT file ===");
  resetStore(); resetFixture();
  const id = seedPrior({
    source_file: OTHER_FILE_REL,
    selection_state: "SELECTED",
    selected_candidate: `${OTHER_FILE_REL}::42`,
    timestamp: "2026-09-17T00:00:00Z",
  });
  const r = await post(`E-${Date.now()}`, PROMPT);
  return { scenario: "E", seeded: { id, verdict: "SELECTED", candidate: `${OTHER_FILE_REL}::42` }, ...extractSignals(r) };
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const receipt = {
    date: new Date().toISOString(),
    version: "fix30b.v1",
    zero_llm: true,
    scenarios: {},
    ablation: {},
    repeatability: {},
    analysis: {},
    verdict: null,
  };

  // Adversarial matrix
  receipt.scenarios.A = await scenarioA(); await sleep(500);
  receipt.scenarios.B = await scenarioB(); await sleep(500);
  receipt.scenarios.C = await scenarioC(); await sleep(500);
  receipt.scenarios.D = await scenarioD("D"); await sleep(500);
  receipt.scenarios.E = await scenarioE(); await sleep(500);

  // Ablation: same seed as D vs. no seed at all (empty store)
  console.log("\n=== ABLATION · D-with-prior vs D-without-prior ===");
  const dWith = await scenarioD("D-abl-with"); await sleep(500);
  // Now run same scenario shape with NO prior seeded (store empty)
  resetStore(); resetFixture();
  const dWithoutR = await post(`D-abl-without-${Date.now()}`, PROMPT);
  const dWithout = { scenario: "D-abl-without", seeded: null, ...extractSignals(dWithoutR) };
  receipt.ablation.with_prior = dWith;
  receipt.ablation.without_prior = dWithout;
  receipt.ablation.decision_differs =
    dWith.state !== dWithout.state ||
    dWith.refusal_kind !== dWithout.refusal_kind ||
    dWith.promoted !== dWithout.promoted;

  // Repeatability: D three times with same seed
  console.log("\n=== REPEATABILITY · D x 3 ===");
  const rep = [];
  for (let i = 0; i < 3; i++) {
    rep.push(await scenarioD(`D-rep-${i + 1}`));
    await sleep(500);
  }
  receipt.repeatability.runs = rep;
  const allSameState = rep.every((r) => r.state === rep[0].state);
  const allSameRefusal = rep.every((r) => r.refusal_kind === rep[0].refusal_kind);
  receipt.repeatability.deterministic = allSameState && allSameRefusal;

  // Analysis
  const s = receipt.scenarios;
  receipt.analysis = {
    // State-level differences (the decisive test)
    A_state: s.A.state,
    B_state: s.B.state,
    C_state: s.C.state,
    D_state: s.D.state,
    E_state: s.E.state,
    A_promoted: s.A.promoted,
    B_promoted: s.B.promoted,
    C_promoted: s.C.promoted,
    D_promoted: s.D.promoted,
    E_promoted: s.E.promoted,
    D_refusal_kind: s.D.refusal_kind,
    // Adversarial checks
    B_and_D_both_SELECTED_but_different_state:
      s.B.state !== s.D.state,
    C_TIE_promotes: s.C.promoted === true,
    D_conflict_holds: s.D.state === "clarification_required" && s.D.refusal_kind === "prior_selected_conflicts_current_assertion",
    E_unrelated_promotes: s.E.promoted === true,
    A_baseline_promotes: s.A.promoted === true,
    // Anti-lookup-table check: SELECTED does NOT universally mean promote,
    // TIE does NOT universally mean refuse
    selected_label_alone_does_not_determine_state: s.B.promoted && !s.D.promoted,
    tie_label_alone_does_not_determine_state: s.C.promoted, // TIE promotes here
    // Causal check
    ablation_decision_differs: receipt.ablation.decision_differs,
    ablation_with_state: dWith.state,
    ablation_without_state: dWithout.state,
    // Repeatability
    repeatability_deterministic: receipt.repeatability.deterministic,
    // Trace evidence
    comparator_fired_in_all_scenarios: [s.A, s.B, s.C, s.D, s.E].every(
      (x) => x.comparator_relationship_line !== null,
    ),
  };

  // VERDICT
  const decisionEffectProven =
    receipt.analysis.B_and_D_both_SELECTED_but_different_state &&
    receipt.analysis.D_conflict_holds &&
    receipt.analysis.C_TIE_promotes &&
    receipt.analysis.ablation_decision_differs &&
    receipt.analysis.repeatability_deterministic;

  const antiLookupProven =
    receipt.analysis.selected_label_alone_does_not_determine_state &&
    receipt.analysis.tie_label_alone_does_not_determine_state;

  const causalityProven =
    receipt.analysis.ablation_decision_differs === true &&
    receipt.analysis.repeatability_deterministic === true;

  if (decisionEffectProven && antiLookupProven && causalityProven) {
    receipt.verdict = "DECISION_EFFECT_RUNTIME_VERIFIED";
  } else if (
    receipt.analysis.B_and_D_both_SELECTED_but_different_state ||
    receipt.analysis.ablation_decision_differs
  ) {
    receipt.verdict = "DECISION_EFFECT_PARTIALLY_VERIFIED";
  } else {
    receipt.verdict = "DECISION_EFFECT_NOT_PROVEN";
  }

  // Persist
  fs.writeFileSync(
    path.join(OUT_DIR, `adversarial-decision-experiment-receipt.json`),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  // Cleanup
  resetStore(); resetFixture();

  console.log("\n=== ANALYSIS ===");
  console.log(JSON.stringify(receipt.analysis, null, 2));
  console.log("\n=== VERDICT ===");
  console.log(receipt.verdict);
}

main().catch((e) => { console.error(e); process.exit(1); });
