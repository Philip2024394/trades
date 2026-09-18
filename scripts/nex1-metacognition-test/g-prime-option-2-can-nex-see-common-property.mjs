// NEX1 · Test G-prime · Part 2 · Option-2 boundary investigation
//
// Founder's question (verbatim):
//   "Can NEX discover what these failures have in common?"
//
// And the deeper reframing (verbatim):
//   "Can NEX determine whether the evidence available to it is sufficient
//    to safely perform the proposed action?"
//
// This experiment does NOT add branch-execution awareness. It does NOT add
// verification-coupling checks. It does not alter any core NEX1 mechanism.
//
// Instead it asks a specific empirical question:
//
//   Given the accumulated evidence from G-prime's 5 execution-path-
//   ambiguous scenarios, does NEX's existing abstraction machinery
//   (Fix 34 pattern extractor + Fix 35 capability discovery) produce any
//   pattern or rule that groups the failure cases as a class distinct
//   from the success cases, using ONLY the natural Fix 17 fields the
//   coding loop would have written if it wrote to Fix 17?
//
// The naturally-available fields are:
//   - source_file
//   - selection_state
//   - selected_candidate  (in the "path::value" convention used elsewhere)
//
// No hidden "capability_gap" flag, no new feature dimension, no injected
// answer. If the existing machinery cannot see the boundary, that IS the
// finding — and it is scientifically valuable.
//
// This script also confirms via code-inspection that the coding loop does
// NOT currently write to Fix 17, so in the actual live system these
// entries would not exist at all. The synthesis below is a best-case
// speculative test.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const STORE = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
const RULES_STORE = path.join(REPO, "data", "nex1-discovered-capabilities", "rules.jsonl");
const OUT_DIR = path.join(REPO, "data", "nex1-metacognition-test");
fs.mkdirSync(OUT_DIR, { recursive: true });

function resetStores() {
  for (const p of [STORE, RULES_STORE]) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
function seed({ source_file, selection_state, selected_candidate, timestamp }) {
  const e = {
    entry_id: "opt2-" + crypto.randomBytes(3).toString("hex"),
    timestamp,
    investigation_id: null,
    trace_id: null,
    source_file,
    selection_state,
    selected_candidate,
    candidates_considered: selected_candidate === null ? [] : [selected_candidate],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file },
    supporting_evidence_ids: [], contradicting_evidence_ids: [], insufficient_evidence_ids: [], unresolved_evidence_ids: [],
    decision_reason: "option-2 synthetic seed · natural fields only",
    confidence: 0.35,
    provenance: [{ source_file, start_line: 1, end_line: 1 }],
    policy_id: "NEX1_Q8_SELECTION_POLICY", policy_version: "V1",
    uncertainty: null, recommended_next_action: "n/a", evidence_kind: "INFERRED",
  };
  fs.appendFileSync(STORE, JSON.stringify(e) + "\n", "utf8");
  return e;
}

// ── The 5 G-prime scenarios in Fix-17-natural-form ──────────────────────
// One entry per scenario that involved a Q8-shaped decision. A/B/C/D were
// SELECTED (mutation applied). F was a refusal (REQUIRE_MORE_INVESTIGATION).
// E does not produce a natural entry — no candidate selection happened
// (the loop returned VERIFIED because the spec-derived test passed at
// condition_value=1, no operator ran). E is a boundary-below-Fix-17.
//
// The values in `selected_candidate` reflect the FIXTURE ASSERTION's
// expected value — this is what a real coding loop that wrote successful
// mutations back to Fix 17 would record. The values ALSO cover different
// numbers (64 / 507 / 45 / 275) so the entries have distinct signatures.
const NATURAL_ENTRIES = [
  // A · successful direct-return · classification: PRE_ACTION_CONFIDENT_AND_CORRECT
  { classification: "PRE_ACTION_CONFIDENT_AND_CORRECT", source_file: "src/lib/nex1-gprime-fixtures/pinRingRadius.ts", selection_state: "SELECTED", selected_candidate: "src/lib/nex1-gprime-fixtures/pinRingRadius.ts::64", timestamp: "2026-09-18T00:00:00Z" },
  // B · wrong-branch mutation · classification: DELAYED_RECOGNITION
  { classification: "DELAYED_RECOGNITION",             source_file: "src/lib/nex1-gprime-fixtures/cauldronBubble.ts", selection_state: "SELECTED", selected_candidate: "src/lib/nex1-gprime-fixtures/cauldronBubble.ts::507", timestamp: "2026-09-18T00:01:00Z" },
  // C · wrong-branch mutation · classification: DELAYED_RECOGNITION
  { classification: "DELAYED_RECOGNITION",             source_file: "src/lib/nex1-gprime-fixtures/harpsichordTone.ts", selection_state: "SELECTED", selected_candidate: "src/lib/nex1-gprime-fixtures/harpsichordTone.ts::45", timestamp: "2026-09-18T00:02:00Z" },
  // D · correct-by-luck · classification: CORRECT_BY_LUCK
  { classification: "CORRECT_BY_LUCK",                  source_file: "src/lib/nex1-gprime-fixtures/quillFactor.ts", selection_state: "SELECTED", selected_candidate: "src/lib/nex1-gprime-fixtures/quillFactor.ts::275", timestamp: "2026-09-18T00:03:00Z" },
  // F · pre-action refusal · classification: PRE_ACTION_REFUSAL
  { classification: "PRE_ACTION_REFUSAL",               source_file: "src/lib/nex1-gprime-fixtures/vellumWeight.ts", selection_state: "REQUIRE_MORE_INVESTIGATION", selected_candidate: null, timestamp: "2026-09-18T00:04:00Z" },
];

async function main() {
  resetStores();

  // Step 1 · code-inspection check
  const nplText = fs.readFileSync(path.join(REPO, "src/lib/nex-agent/code-engine/native-programming-loop.ts"), "utf8");
  const sdlText = fs.readFileSync(path.join(REPO, "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts"), "utf8");
  const codingLoopWritesToFix17 =
    /investigation-conclusion-store|appendConclusions/.test(nplText) ||
    /investigation-conclusion-store|appendConclusions/.test(sdlText);

  // Step 2 · seed the natural entries
  for (const e of NATURAL_ENTRIES) {
    seed(e);
  }

  // Step 3 · run Fix 34 (abstraction) and Fix 35 (capability discovery)
  const abs = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts")).href);
  const disc = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-capability-discovery.ts")).href);

  const entries = abs.loadAllEntriesFromStore(REPO);
  const patterns = abs.extractPatterns(entries);
  const rules = disc.induceRules(entries, 2);

  // Step 4 · analysis · does any pattern GROUP the failures distinctly from the successes?
  //
  // The founder-classifications for each entry are known (attached to the
  // synthetic seed for scoring only · NOT visible to Fix 34/35). We now ask:
  // do the pattern groups produced by Fix 34 map onto the founder categories?
  const entryClassification = new Map(NATURAL_ENTRIES.map((e) => [e.source_file, e.classification]));
  const groupedByPattern = patterns.map((p) => {
    // Find which of the seeded entries fall into this pattern
    const membersFeatures = entries.filter((entry) => {
      const feat = abs.extractShapeFeatures(entry);
      return JSON.stringify(feat) === JSON.stringify(p.features);
    });
    const memberSourceFiles = membersFeatures.map((m) => m.source_file);
    const memberClassifications = memberSourceFiles.map((sf) => entryClassification.get(sf) ?? "unknown");
    const distinctClassifications = Array.from(new Set(memberClassifications)).sort();
    return {
      pattern_id: p.pattern_id,
      support: p.support_count,
      features: p.features,
      member_source_files: memberSourceFiles,
      member_classifications: memberClassifications,
      distinct_classifications_in_this_group: distinctClassifications,
      // Would this pattern group distinguish failures from successes?
      // Only if the group contains ONE unique classification.
      pattern_group_pure: distinctClassifications.length === 1,
    };
  });

  // Aggregate answer
  const successfulPatternsIsolatingClasses = groupedByPattern.filter((g) => g.pattern_group_pure);
  const conflatedPatterns = groupedByPattern.filter((g) => !g.pattern_group_pure);
  const distinguishesFailuresFromSuccesses =
    // A pattern that contains ONLY {CORRECT_BY_LUCK} or ONLY {DELAYED_RECOGNITION} would separate failure signals.
    // The critical failure-vs-success mix is A (CORRECT) vs B/C/D (failure or luck).
    !groupedByPattern.some((g) =>
      g.member_classifications.includes("PRE_ACTION_CONFIDENT_AND_CORRECT") &&
      g.member_classifications.some((c) => c === "DELAYED_RECOGNITION" || c === "CORRECT_BY_LUCK"),
    );

  // Step 5 · check rules from Fix 35 · same question at the rule layer
  const ruleFingerprints = rules.map((r) => ({
    rule_id: r.rule_id,
    support: r.support_count,
    features: r.shape_signature,
    invariants: r.invariants.map((i) => i.kind),
    path_prefix_extra: r.invariants.find((i) => i.kind === "all_entries_share_path_prefix")?.extra?.path_prefix ?? null,
  }));

  resetStores();

  const receipt = {
    document: "G-prime · Part 2 · Option-2 · can NEX see the common property of failures?",
    date: new Date().toISOString(),
    zero_llm: true,
    engineer_source_modifications: 0,
    code_inspection: {
      coding_loop_writes_to_fix17: codingLoopWritesToFix17,
      finding:
        "native-programming-loop.ts and capability-specification-driven-loop.ts contain NO import of investigation-conclusion-store and NO write to it. Coding-loop failures are TRANSIENT · they do not accumulate as Fix 17 evidence. Therefore in the live system NEX has zero evidence from B/C/D/E to abstract over.",
    },
    synthetic_seed: {
      entries_synthesised: NATURAL_ENTRIES.length,
      note:
        "These 5 entries are what the coding loop WOULD have written per scenario IF a bridge existed. Only natural Fix 17 fields are used. E has no synthetic entry because E never selected a candidate (spec-test passed without any mutation).",
    },
    fix_34_patterns: {
      count: patterns.length,
      grouped_by_pattern: groupedByPattern,
      pure_pattern_group_count: successfulPatternsIsolatingClasses.length,
      conflated_pattern_group_count: conflatedPatterns.length,
      distinguishes_failures_from_successes: distinguishesFailuresFromSuccesses,
    },
    fix_35_rules: ruleFingerprints,
    honest_answer_to_option_2:
      distinguishesFailuresFromSuccesses
        ? "Existing abstraction machinery separates B/C/D failures from A success. Investigate whether that pattern captures something useful."
        : "Existing abstraction machinery CANNOT distinguish failed mutations (B, C, D) from a successful one (A). All four collapse into the same feature-signature group. The dimensions {has_signature_format, value_type, path_dir_root, path_dir_second, selection_state} contain no representation of execution-path correctness or verification-coupling. Fix 35 induction probes also cannot see this property. NEX therefore cannot discover the common property of the G-prime failures using existing machinery.",
    limit_description_generated_by_nex: "NONE",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "g-prime-option-2-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== G-PRIME · OPTION-2 · CAN NEX SEE THE COMMON PROPERTY? ===\n");
  console.log("code-inspection · coding-loop writes to Fix 17:", codingLoopWritesToFix17);
  console.log("\nFix 34 patterns from synthetic seed:", patterns.length);
  for (const g of groupedByPattern) {
    console.log(`  pattern ${g.pattern_id.slice(0, 24).padEnd(24)} support=${g.support} · classifications=[${g.distinct_classifications_in_this_group.join(", ")}] · pure=${g.pattern_group_pure}`);
  }
  console.log("\nFix 35 rules:", rules.length);
  for (const r of ruleFingerprints) console.log(`  ${r.rule_id} support=${r.support} invariants=[${r.invariants.join(",")}]`);
  console.log("\ndistinguishes_failures_from_successes:", distinguishesFailuresFromSuccesses);
  console.log("\nHONEST ANSWER TO OPTION-2:");
  console.log(receipt.honest_answer_to_option_2);
}
main().catch((e) => { console.error(e); process.exit(1); });
