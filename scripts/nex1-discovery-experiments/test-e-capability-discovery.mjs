// NEX1 · Intelligence Discovery · Test E
// PRIMARY QUESTION: Can NEX1 discover and create a reusable capability
// when that capability was not explicitly supplied by the developer?
//
// Two-session experiment · zero LLM · direct-module.
//
// Session 1 · SEED + INDUCE:
//   - Seeds N successful experiences of the numeric-SELECTED-src/lib
//     family into the Fix 17 store (each with a distinct source_file).
//   - Runs Fix 35 · induceRules → produces DiscoveredRule[] with
//     invariants induced from evidence alone.
//   - Persists rules to data/nex1-discovered-capabilities/rules.jsonl.
//   - Records rule_ids + invariant_kinds in a session-1 receipt.
//
// Session 2 · FRESH PROCESS · APPLY:
//   - Reads rules from disk (no shared JS heap).
//   - Applies the rules to a NOVEL input file+candidate never seen at
//     induction time (input feature signature matches the trained family).
//   - Verifies the prediction is derived from the rule's invariants
//     (not from any fixture-specific mapping).
//   - Applies the rules adversarially to an OFF-FAMILY input; expects
//     no_applicable_rule.
//
// Additional adversarial probes:
//   - Empty-store re-run  → no rules
//   - Different seed data → different rule_id (proves data-derived)
//   - Deterministic       → same seed produces same rule_id on re-run
//
// Records verdict: VERIFIED / PARTIALLY VERIFIED / FAILED / INCONCLUSIVE.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const STORE = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
const RULES_STORE = path.join(REPO, "data", "nex1-discovered-capabilities", "rules.jsonl");
const OUT_DIR = path.join(REPO, "data", "nex1-discovery-experiments");
fs.mkdirSync(OUT_DIR, { recursive: true });

function resetStores() {
  for (const p of [STORE, RULES_STORE]) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
function seed({ source_file, selection_state, selected_candidate, timestamp }) {
  const entry = {
    entry_id: "seed-" + crypto.randomBytes(4).toString("hex"),
    timestamp,
    investigation_id: "test-e",
    trace_id: "test-e",
    source_file,
    selection_state,
    selected_candidate,
    candidates_considered: selected_candidate === null ? [] : [selected_candidate],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "test-e seed",
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

async function loadModule() {
  return import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-capability-discovery.ts")).href
  );
}

async function main() {
  const mod = await loadModule();
  const {
    induceRules,
    predictFromRules,
    persistRules,
    loadDiscoveredRules,
    discoverAndPersistFromStore,
    CAPABILITY_DISCOVERY_VERSION,
    _INTERNAL,
  } = mod;

  // ── SESSION 1 · seed evidence & induce rules ─────────────────────────
  resetStores();
  const s1_seeds = [
    seed({ source_file: "src/lib/family/one.ts",   selection_state: "SELECTED", selected_candidate: "src/lib/family/one.ts::11",   timestamp: "2026-09-16T00:00:00Z" }),
    seed({ source_file: "src/lib/family/two.ts",   selection_state: "SELECTED", selected_candidate: "src/lib/family/two.ts::22",   timestamp: "2026-09-17T00:00:00Z" }),
    seed({ source_file: "src/lib/family/three.ts", selection_state: "SELECTED", selected_candidate: "src/lib/family/three.ts::33", timestamp: "2026-09-18T00:00:00Z" }),
  ];
  const { rules: s1_rules, path: rules_path, appended } = discoverAndPersistFromStore(2, REPO);
  const s1_receipt = {
    session: 1,
    seeded_entry_ids: s1_seeds.map((s) => s.entry_id),
    seeded_count: s1_seeds.length,
    rule_count: s1_rules.length,
    rules_summary: s1_rules.map((r) => ({
      rule_id: r.rule_id,
      support_count: r.support_count,
      shape_signature: r.shape_signature,
      invariant_kinds: r.invariants.map((i) => i.kind),
      path_prefix_extra: r.invariants.find((i) => i.kind === "all_entries_share_path_prefix")?.extra ?? null,
    })),
    rules_path,
    appended_lines: appended,
    induction_probe_count: _INTERNAL.INDUCTION_PROBES.length,
    version: CAPABILITY_DISCOVERY_VERSION,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "test-e-session-1-receipt.json"),
    JSON.stringify(s1_receipt, null, 2),
    "utf8",
  );

  // ── PROCESS BOUNDARY (simulated by clearing in-memory state) ─────────
  // Now emulate a fresh session by RELOADING rules from disk. In real
  // multi-process life this would be a separate `node` invocation; here
  // we've verified in Test C that the same disk channel works. What we
  // must verify here is that the persisted rule is applicable to a
  // novel input that was NEVER a seed and NEVER named in any code.

  const rulesFromDisk = loadDiscoveredRules(REPO);

  // Adversarial cases for APPLICATION:
  //
  // A · same-family novel input · never seen before at induction time.
  //     Expected: matched rule · numeric prediction from suffix.
  const apply_A = predictFromRules(rulesFromDisk, {
    source_file: "src/lib/genuinely-novel/newone.ts",
    selected_candidate: "src/lib/genuinely-novel/newone.ts::99",
    selection_state: "SELECTED",
  });

  // B · off-family novel input · quoted string suffix instead of numeric.
  //     Expected: no_applicable_rule.
  const apply_B = predictFromRules(rulesFromDisk, {
    source_file: "docs/pages/anything.md",
    selected_candidate: 'docs/pages/anything.md::"hello"',
    selection_state: "SELECTED",
  });

  // C · input matches path_dir_root/second but not selection_state.
  //     Expected: no_applicable_rule.
  const apply_C = predictFromRules(rulesFromDisk, {
    source_file: "src/lib/family/whatever.ts",
    selected_candidate: "src/lib/family/whatever.ts::42",
    selection_state: "TIE",
  });

  // D · input matches shape but has no `::` separator.
  //     Expected: no_applicable_rule.
  const apply_D = predictFromRules(rulesFromDisk, {
    source_file: "src/lib/family/whatever.ts",
    selected_candidate: null,
    selection_state: "SELECTED",
  });

  // ── ADVERSARIAL: DIFFERENT-DATA yields DIFFERENT-RULE ─────────────────
  // Reset store, seed DIFFERENT data (string-suffix family), induce rules,
  // and verify the rule_id differs from Session 1's.
  resetStores();
  seed({ source_file: "src/lib/other/a.ts", selection_state: "SELECTED", selected_candidate: 'src/lib/other/a.ts::"alpha"', timestamp: "2026-09-16T00:00:00Z" });
  seed({ source_file: "src/lib/other/b.ts", selection_state: "SELECTED", selected_candidate: 'src/lib/other/b.ts::"beta"',  timestamp: "2026-09-17T00:00:00Z" });
  const diff_result = discoverAndPersistFromStore(2, REPO);
  const differentSeedRuleIds = diff_result.rules.map((r) => r.rule_id);

  // ── ADVERSARIAL: DETERMINISM · same seed twice yields same rule_id ────
  resetStores();
  seed({ source_file: "src/lib/det/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/det/a.ts::1", timestamp: "2026-09-18T00:00:00Z" });
  seed({ source_file: "src/lib/det/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/det/b.ts::2", timestamp: "2026-09-18T00:00:00Z" });
  // load the entries directly from the store
  const { loadAllEntriesFromStore } = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts")).href
  );
  const detEntries = loadAllEntriesFromStore(REPO);
  const det_run1 = induceRules(detEntries, 2);
  const det_run2 = induceRules(detEntries, 2);
  const determinism_ok =
    det_run1.length === det_run2.length &&
    det_run1.every((r, i) => r.rule_id === det_run2[i].rule_id);

  // ── ADVERSARIAL: EMPTY STORE · zero rules ─────────────────────────────
  resetStores();
  const empty_rules = induceRules(loadAllEntriesFromStore(REPO), 2);

  // ── VERDICT ──────────────────────────────────────────────────────────
  const s1_ok = s1_rules.length === 1 && s1_rules[0].support_count === 3;
  const apply_A_ok = apply_A.kind === "value_from_selected_candidate_suffix" && apply_A.predicted_value === 99 && apply_A.predicted_value_type === "number";
  const apply_B_ok = apply_B.kind === "no_applicable_rule";
  const apply_C_ok = apply_C.kind === "no_applicable_rule";
  const apply_D_ok = apply_D.kind === "no_applicable_rule";
  const different_seed_ok =
    differentSeedRuleIds.length === 1 &&
    !s1_rules.map((r) => r.rule_id).includes(differentSeedRuleIds[0]);
  const empty_ok = empty_rules.length === 0;

  const all_pass = s1_ok && apply_A_ok && apply_B_ok && apply_C_ok && apply_D_ok && different_seed_ok && determinism_ok && empty_ok;

  const receipt = {
    test: "E · capability discovery · Fix 35",
    date: new Date().toISOString(),
    zero_llm: true,
    version: CAPABILITY_DISCOVERY_VERSION,
    session_1: s1_receipt,
    application: {
      A_same_family_novel: apply_A,
      B_off_family_string: apply_B,
      C_off_selection_state_TIE: apply_C,
      D_no_separator: apply_D,
    },
    different_seed_produces_different_rule: {
      session_1_rule_ids: s1_rules.map((r) => r.rule_id),
      different_seed_rule_ids: differentSeedRuleIds,
      distinct: different_seed_ok,
    },
    determinism: {
      run1_rule_ids: det_run1.map((r) => r.rule_id),
      run2_rule_ids: det_run2.map((r) => r.rule_id),
      identical: determinism_ok,
    },
    empty_store: {
      rule_count: empty_rules.length,
      correct: empty_ok,
    },
    correctness_matrix: {
      s1_ok,
      apply_A_ok,
      apply_B_ok,
      apply_C_ok,
      apply_D_ok,
      different_seed_ok,
      determinism_ok,
      empty_ok,
    },
    verdict:
      all_pass
        ? "VERIFIED"
        : Object.values({
            s1_ok, apply_A_ok, apply_B_ok, apply_C_ok, apply_D_ok, different_seed_ok, determinism_ok, empty_ok,
          }).filter(Boolean).length >= 6
          ? "PARTIALLY VERIFIED"
          : "FAILED",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "test-e-capability-discovery-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  // cleanup
  resetStores();

  console.log("=== TEST E · SUMMARY ===");
  for (const [k, v] of Object.entries(receipt.correctness_matrix)) console.log(`  ${k}: ${v}`);
  console.log("\napply_A predicted_value:", apply_A.predicted_value, "type:", apply_A.predicted_value_type);
  console.log("session_1 rule_ids:", s1_rules.map((r) => r.rule_id).join(", "));
  console.log("different_seed rule_ids:", differentSeedRuleIds.join(", "));
  console.log("\nVERDICT:", receipt.verdict);
}
main().catch((e) => { console.error(e); process.exit(1); });
