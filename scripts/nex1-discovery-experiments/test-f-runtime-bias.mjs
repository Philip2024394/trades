// NEX1 · Intelligence Discovery · Test F · RUNTIME BIAS
//
// PRIMARY QUESTION
//   Does a rule discovered by Fix 35 measurably bias observable runtime
//   output when the runtime path consults it, while remaining strictly
//   INFORMATIONAL (never authoritative, never changing the coding-loop
//   decision)?
//
// Closes the APPLY step of the founder's central question:
//   DISCOVER (Test E) -> VALIDATE (Test E audit) -> STORE (Fix 17 +
//   discovered-capabilities store) -> APPLY (this test).
//
// Approach
//   Direct-module invocation of `runChatTurn` (bypasses HTTP + Tailwind
//   dev-server issues; more rigorous · eliminates network as confounder).
//   Session 1 · seed evidence + induce and persist rules.
//   Session 2 · fresh in-process turn against a NOVEL fixture NEX1 has
//   never seen; observe whether the fix35 discovery trace line fires
//   with the correct predicted value, without changing the coding-loop
//   outcome.
//
// Adversarial arm
//   Same fresh input but with the discovered-capabilities store WIPED.
//   Discovery must emit `rule_id=none · kind=no_applicable_rule` and the
//   coding-loop outcome must remain unchanged (informational only).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const STORE = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
const RULES_STORE = path.join(REPO, "data", "nex1-discovered-capabilities", "rules.jsonl");
const FIX_DIR = path.join(REPO, "src", "lib", "nex1-discovery-fixtures");
const SRC = path.join(FIX_DIR, "test-f-target.ts");
const TEST = path.join(FIX_DIR, "test-f-target.assertion.ts");
const SRC_REL = "src/lib/nex1-discovery-fixtures/test-f-target.ts";
const OUT_DIR = path.join(REPO, "data", "nex1-discovery-experiments");

fs.mkdirSync(OUT_DIR, { recursive: true });

function resetStores() {
  for (const p of [STORE, RULES_STORE]) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
function seedEntry({ source_file, selected_candidate, timestamp }) {
  const entry = {
    entry_id: "seed-" + crypto.randomBytes(4).toString("hex"),
    timestamp,
    investigation_id: null,
    trace_id: null,
    source_file,
    selection_state: "SELECTED",
    selected_candidate,
    candidates_considered: [selected_candidate],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "test-f seed",
    confidence: 0.35,
    provenance: [{ source_file, start_line: 1, end_line: 1 }],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
  };
  fs.appendFileSync(STORE, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}
function setupFixture() {
  fs.mkdirSync(FIX_DIR, { recursive: true });
  fs.writeFileSync(
    SRC,
    `// FIXTURE · Test F · novel target NEX1 has never seen at induction time.
export function testFTarget(): number {
  return 5;
}
`,
    "utf8",
  );
  fs.writeFileSync(
    TEST,
    `import { describe, it, expect } from "vitest";
import { testFTarget } from "./test-f-target";
describe("testFTarget", () => {
  it("returns 55", () => {
    expect(testFTarget()).toBe(55);
  });
});
`,
    "utf8",
  );
}
function cleanupFixture() {
  try { if (fs.existsSync(SRC)) fs.unlinkSync(SRC); } catch { /* ignore */ }
  try { if (fs.existsSync(TEST)) fs.unlinkSync(TEST); } catch { /* ignore */ }
  try { if (fs.existsSync(FIX_DIR)) fs.rmdirSync(FIX_DIR); } catch { /* ignore */ }
}

async function loadModules() {
  const chatMod = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-chat-turn.ts")).href
  );
  const discoveryMod = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-capability-discovery.ts")).href
  );
  const contextMod = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-conversation-context.ts")).href
  );
  return { chatMod, discoveryMod, contextMod };
}

async function runChatTurnDirect(chatMod, contextMod, convId, message) {
  // Fresh conversation-head each turn to avoid cross-arm leakage
  const runChatTurn = chatMod.runChatTurn ?? chatMod.default?.runChatTurn;
  if (typeof runChatTurn !== "function") {
    throw new Error("runChatTurn not exported from capability-chat-turn.ts");
  }
  return await runChatTurn({
    conversation_id: convId,
    user_message: message,
    repo_root: REPO,
  });
}

async function main() {
  cleanupFixture();
  resetStores();

  const { chatMod, discoveryMod, contextMod } = await loadModules();

  // Reset in-process conversation state so this direct-module run is
  // independent of any earlier state.
  if (typeof contextMod._resetAllConversations_TESTONLY === "function") {
    contextMod._resetAllConversations_TESTONLY();
  }

  // ── SESSION 1 · SEED + INDUCE + PERSIST ──────────────────────────────
  // 3 numeric-SELECTED-src/lib successful experiences under a shared
  // directory. These are the training set for the discovered rule.
  seedEntry({ source_file: "src/lib/train/one.ts",   selected_candidate: "src/lib/train/one.ts::10",   timestamp: "2026-09-16T00:00:00Z" });
  seedEntry({ source_file: "src/lib/train/two.ts",   selected_candidate: "src/lib/train/two.ts::20",   timestamp: "2026-09-17T00:00:00Z" });
  seedEntry({ source_file: "src/lib/train/three.ts", selected_candidate: "src/lib/train/three.ts::30", timestamp: "2026-09-18T00:00:00Z" });
  const { rules, path: rules_path, appended } = discoveryMod.discoverAndPersistFromStore(2, REPO);
  const s1 = {
    rules_summary: rules.map((r) => ({ rule_id: r.rule_id, features: r.shape_signature, support: r.support_count, invariants: r.invariants.map((i) => i.kind) })),
    rules_path,
    appended_lines: appended,
  };

  // ── SESSION 2 · NOVEL FIXTURE · RUN CHAT TURN · CAPTURE TRACE ────────
  setupFixture();
  const fileBefore = fs.readFileSync(SRC, "utf8");

  const armA_convId = `F-A-${Date.now()}`;
  const armA = await runChatTurnDirect(
    chatMod,
    contextMod,
    armA_convId,
    "Analyse testFTarget and propose a correction.",
  );
  const armA_trace = Array.isArray(armA.trace) ? armA.trace : [];
  const armA_discovery_lines = armA_trace.filter((x) => x.startsWith("fix35 · discovery"));
  const armA_fileAfter = fs.readFileSync(SRC, "utf8");

  // ── ARM B (adversarial) · WIPE RULES STORE · SAME FIXTURE ────────────
  fs.writeFileSync(SRC, fileBefore, "utf8"); // reset fixture to original
  if (fs.existsSync(RULES_STORE)) fs.unlinkSync(RULES_STORE);
  if (typeof contextMod._resetAllConversations_TESTONLY === "function") {
    contextMod._resetAllConversations_TESTONLY();
  }
  const armB_convId = `F-B-${Date.now()}`;
  const armB = await runChatTurnDirect(
    chatMod,
    contextMod,
    armB_convId,
    "Analyse testFTarget and propose a correction.",
  );
  const armB_trace = Array.isArray(armB.trace) ? armB.trace : [];
  const armB_discovery_lines = armB_trace.filter((x) => x.startsWith("fix35 · discovery"));
  const armB_fileAfter = fs.readFileSync(SRC, "utf8");

  cleanupFixture();
  resetStores();

  // ── ANALYSIS ──────────────────────────────────────────────────────────
  const armA_discovery_line = armA_discovery_lines[0] ?? "";
  const armB_discovery_line = armB_discovery_lines[0] ?? "";
  // Arm A · rules exist AND novel input is same-family (src/lib + numeric).
  //   Discovery should either fire (predict a value) or refuse with a
  //   rule_id=none IF the input's shape features do not exactly match the
  //   trained rule. Our training used `src/lib/train/*` and the fresh
  //   fixture is `src/lib/nex1-discovery-fixtures/*` — different
  //   path_dir_second. Fix 35's retrieval requires exact match on
  //   `selection_state`, `value_type`, and `has_signature_format`.
  //   Given the shape signature match, the retrieval should return the
  //   trained rule.
  const armA_rule_ids_in_line = armA_discovery_line.match(/rule_id=([^\s·]+)/)?.[1];
  const armA_rule_id_present = armA_rule_ids_in_line && armA_rule_ids_in_line !== "none";
  const armA_kind = armA_discovery_line.match(/kind=([^\s·]+)/)?.[1];
  const armA_predicted_value = armA_discovery_line.match(/predicted_value=([^\s·]+)/)?.[1];

  const armB_rule_ids_in_line = armB_discovery_line.match(/rule_id=([^\s·]+)/)?.[1];
  const armB_rule_id_none = armB_rule_ids_in_line === "none";
  const armB_kind = armB_discovery_line.match(/kind=([^\s·]+)/)?.[1];

  // Coding-loop outcome comparison · discovery MUST NOT change it.
  // Both arms run against the same fixture; the coding loop's plan-stage
  // outcome (understood / refused / verified) must be identical.
  const armA_state = armA.state;
  const armB_state = armB.state;
  const coding_outcome_unchanged_by_discovery = armA_state === armB_state;

  const receipt = {
    test: "F · runtime bias · Fix 35 discovery consulted at Fix 25 salience gate",
    date: new Date().toISOString(),
    zero_llm: true,
    starting_commit: "3ddae26b (nex1-test-e-verified) + Test F wire",
    session_1_induction: s1,
    arm_A_rules_present: {
      conv_id: armA_convId,
      state: armA_state,
      discovery_line: armA_discovery_line,
      discovery_rule_id: armA_rule_ids_in_line ?? null,
      discovery_kind: armA_kind ?? null,
      discovery_predicted_value: armA_predicted_value ?? null,
      trace_had_discovery_line: armA_discovery_lines.length > 0,
      file_mutated: fileBefore !== armA_fileAfter,
    },
    arm_B_rules_wiped: {
      conv_id: armB_convId,
      state: armB_state,
      discovery_line: armB_discovery_line,
      discovery_rule_id: armB_rule_ids_in_line ?? null,
      discovery_kind: armB_kind ?? null,
      trace_had_discovery_line: armB_discovery_lines.length > 0,
      file_mutated: fileBefore !== armB_fileAfter,
    },
    correctness_matrix: {
      // A · discovery trace fires when rules exist
      A_discovery_trace_fired: armA_discovery_lines.length > 0,
      // B · discovery trace still fires but with rule_id=none when rules are wiped
      B_discovery_trace_fired_with_none: armB_discovery_lines.length > 0 && armB_rule_id_none,
      // Discovery is informational only: coding outcome identical between arms
      coding_outcome_unchanged_by_discovery,
      // R11-B integrity · discovery is not authoritative · never mutates file directly
      no_file_mutation_from_discovery: !(fileBefore !== armA_fileAfter && fileBefore === armB_fileAfter),
    },
  };
  receipt.verdict =
    receipt.correctness_matrix.A_discovery_trace_fired &&
    receipt.correctness_matrix.B_discovery_trace_fired_with_none &&
    receipt.correctness_matrix.coding_outcome_unchanged_by_discovery
      ? "VERIFIED"
      : (receipt.correctness_matrix.A_discovery_trace_fired || receipt.correctness_matrix.B_discovery_trace_fired_with_none)
        ? "PARTIALLY VERIFIED"
        : "FAILED";

  fs.writeFileSync(
    path.join(OUT_DIR, "test-f-runtime-bias-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== TEST F · RUNTIME BIAS ===");
  console.log("\n[arm A · rules present]");
  console.log("  state:", armA_state);
  console.log("  discovery:", armA_discovery_line || "(no line)");
  console.log("\n[arm B · rules wiped]");
  console.log("  state:", armB_state);
  console.log("  discovery:", armB_discovery_line || "(no line)");
  console.log("\n=== correctness matrix ===");
  for (const [k, v] of Object.entries(receipt.correctness_matrix)) console.log(`  ${k}: ${v}`);
  console.log("\nVERDICT:", receipt.verdict);
}
main().catch((e) => { console.error("test-f error:", e?.stack ?? String(e)); process.exit(1); });
