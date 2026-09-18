// Cycle 4 · Phase A · Native machinery on the outcome-experience store
//
// Founder question: can existing NEX1 abstraction machinery, without any
// new engineering, autonomously discover the discriminating pattern that
// the substrate now exposes?
//
// Honest test:
//   1. Fix 17 store · Fix 26 · Fix 34 · Fix 35 all operate on
//      InvestigationConclusionEntry shape.
//   2. Outcome-experience uses a different shape (OutcomeExperienceEntry).
//   3. Try to feed outcome-experience through Fix 34/35 verbatim.
//   4. Report whether any discriminating rule emerges from native
//      machinery alone (no schema translation, no new probes).
//
// Expected result: schema mismatch will cause native machinery to either
// error or produce non-discriminating output. That IS the finding · the
// substrate cannot become intelligence-producing without a consumer.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const OUT_DIR = path.join(REPO, "data", "nex1-cycle-4");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const oe = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-outcome-experience.ts")).href);
  const abs = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts")).href);
  const disc = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-capability-discovery.ts")).href);

  const outcomeEntries = oe.loadAllOutcomes(REPO);

  // Test 1 · Feed OutcomeExperienceEntry[] directly to Fix 34 · extractShapeFeatures
  //   Expected: schema mismatch · Fix 34 reads InvestigationConclusionEntry
  //   fields like `selected_candidate` which OutcomeExperienceEntry does
  //   not have. It may extract garbage features or throw.
  let fix34Result = null;
  let fix34Error = null;
  try {
    fix34Result = abs.extractPatterns(outcomeEntries);
  } catch (e) {
    fix34Error = e instanceof Error ? e.message.slice(0, 240) : String(e);
  }

  // Test 2 · Feed OutcomeExperienceEntry[] directly to Fix 35 · induceRules
  let fix35Result = null;
  let fix35Error = null;
  try {
    fix35Result = disc.induceRules(outcomeEntries, 2);
  } catch (e) {
    fix35Error = e instanceof Error ? e.message.slice(0, 240) : String(e);
  }

  // Analysis · did Fix 34 produce discriminating groups?
  //   The outcome-experience store contains B/C (wrong-branch), A/D
  //   (correct-target), E (no mutation but spec-verified), F (refusal).
  //   If Fix 34 produced a single collapsed group, native machinery
  //   cannot see the distinction.
  const fix34_group_count = fix34Result?.length ?? 0;
  const fix34_collapsed_or_uninformative = fix34_group_count <= 1;

  // Analysis · Fix 35 rules
  const fix35_rule_count = fix35Result?.length ?? 0;

  const finding = {
    outcome_entries_in_store: outcomeEntries.length,
    outcome_entry_keys: Object.keys(outcomeEntries[0] ?? {}).sort(),
    fix17_expected_keys: [
      "entry_id", "timestamp", "investigation_id", "trace_id",
      "source_file", "selection_state", "selected_candidate",
      "candidates_considered", "rankings_reference",
      "supporting_evidence_ids", "contradicting_evidence_ids",
      "insufficient_evidence_ids", "unresolved_evidence_ids",
      "decision_reason", "confidence", "provenance", "policy_id",
      "policy_version", "uncertainty", "recommended_next_action",
      "evidence_kind",
    ],
    schema_intersection: Object.keys(outcomeEntries[0] ?? {}).filter((k) => [
      "entry_id", "timestamp", "source_file", "selection_state",
      "selected_candidate", "evidence_kind",
    ].includes(k)),
    fix34_native: {
      threw: fix34Error !== null,
      error: fix34Error,
      pattern_count: fix34_group_count,
      collapsed_or_uninformative: fix34_collapsed_or_uninformative,
      groups: fix34Result?.map((p) => ({
        pattern_id: p.pattern_id,
        support: p.support_count,
        features: p.features,
      })) ?? [],
    },
    fix35_native: {
      threw: fix35Error !== null,
      error: fix35Error,
      rule_count: fix35_rule_count,
      rules: fix35Result?.map((r) => ({
        rule_id: r.rule_id,
        support: r.support_count,
        features: r.shape_signature,
        invariants: r.invariants.map((i) => i.kind),
      })) ?? [],
    },
  };

  const receipt = {
    experiment: "Cycle 4 · Phase A · native machinery on outcome-experience",
    date: new Date().toISOString(),
    zero_llm: true,
    engineer_source_modifications: 0,
    finding,
    honest_answer:
      finding.fix34_native.collapsed_or_uninformative && finding.fix35_native.rule_count <= 1
        ? "Native Fix 34/35 machinery is NOT architecturally extensible to the outcome-experience schema. Feeding OutcomeExperienceEntry directly to Fix 34 either produces a single collapsed group or fails to discriminate. Fix 35 induction probes hardcoded to `selected_candidate` string patterns cannot see any outcome-specific structure. The substrate exposes facts native machinery cannot consume."
        : "Native machinery DID produce discriminating output on the outcome-store. Investigate whether this is genuine cross-schema induction (Ledger A candidate) or spurious feature overlap.",
    ledger: "A · NEX1 GROWTH: unchanged (empty). B · HUMAN ENGINEERING: this Phase-A script (observation only, no new capability).",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "phase-a-native-machinery-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== CYCLE 4 · PHASE A · NATIVE MACHINERY ON OUTCOME-EXPERIENCE ===\n");
  console.log("outcome entries in store:", outcomeEntries.length);
  console.log("schema intersection with Fix 17:", finding.schema_intersection);
  console.log("\nFix 34 native call:");
  console.log("  threw:", finding.fix34_native.threw);
  console.log("  pattern count:", finding.fix34_native.pattern_count);
  console.log("  collapsed_or_uninformative:", finding.fix34_native.collapsed_or_uninformative);
  console.log("\nFix 35 native call:");
  console.log("  threw:", finding.fix35_native.threw);
  console.log("  rule count:", finding.fix35_native.rule_count);
  console.log("  rules produced:");
  for (const r of finding.fix35_native.rules) {
    console.log(`    ${r.rule_id} · support=${r.support} · invariants=[${r.invariants.join(",")}]`);
  }
  console.log("\nHONEST ANSWER:");
  console.log(receipt.honest_answer);
}
main().catch((e) => { console.error(e); process.exit(1); });
