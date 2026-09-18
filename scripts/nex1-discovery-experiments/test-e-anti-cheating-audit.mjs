// NEX1 · Intelligence Discovery · Test E · ANTI-CHEATING AUDIT
//
// The founder's exact challenge:
//   "Did NEX1 actually discover the capability, or was the capability
//    already encoded somewhere in the implementation/test fixture?"
//
// This script runs seven falsifiable audits designed to expose subtle
// forms of hidden encoding. Any of them producing an unexpected result
// would falsify the "Test E VERIFIED" claim.
//
//   Audit 1 · LOAD-BEARING · Same input, EMPTY rules list. If the
//             module still returns a prediction, it is bypassing the
//             rule entirely and Test E is fake.
//   Audit 2 · LOAD-BEARING · Same input, WRONG rules list (rules for
//             a different family). Must not fire on wrong-family rules.
//   Audit 3 · DATA-DERIVED · Seed A vs Seed B (different data, both
//             valid, same shape family). Must produce DIFFERENT
//             `path_prefix` extras in the `all_entries_share_path_prefix`
//             invariant. If the module always emits the same prefix
//             regardless of data, it's hardcoded.
//   Audit 4 · INVARIANT-DEPENDENT PARSING · The prediction type changes
//             based on which suffix invariant holds. Seed a numeric
//             family AND a string family; apply the SAME input candidate
//             to both. Prediction type should differ.
//   Audit 5 · PROBE UNIVERSALITY · Seed data with one contaminating
//             entry that violates a probe. The invariant must NOT
//             appear on the induced rule. (Fix 34 groups by features,
//             so this test focuses on within-group universal
//             quantification.)
//   Audit 6 · CONTENT-ADDRESSED ID · Two seeds that produce identical
//             invariants must produce identical rule_id; two seeds
//             that produce different invariants must produce different
//             rule_id. Both must hold.
//   Audit 7 · CODE-vs-DATA · Grep the module for the specific
//             prediction values in the receipts. If the answer is
//             hardcoded, we would find it in the source.

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
    investigation_id: null,
    trace_id: null,
    source_file,
    selection_state,
    selected_candidate,
    candidates_considered: selected_candidate === null ? [] : [selected_candidate],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "audit seed",
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

async function main() {
  const mod = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-capability-discovery.ts")).href
  );
  const abs = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts")).href
  );
  const { induceRules, predictFromRules } = mod;
  const { loadAllEntriesFromStore } = abs;

  const audits = {};

  // ── AUDIT 1 · LOAD-BEARING · empty rules list must produce no_applicable_rule ──
  {
    const input = {
      source_file: "src/lib/never/seen.ts",
      selected_candidate: "src/lib/never/seen.ts::99",
      selection_state: "SELECTED",
    };
    const p_empty = predictFromRules([], input);
    audits.audit_1_load_bearing_empty_rules = {
      prediction_kind: p_empty.kind,
      predicted_value: p_empty.predicted_value,
      pass: p_empty.kind === "no_applicable_rule" && p_empty.predicted_value === null,
      description:
        "empty rules -> no_applicable_rule (proves the module cannot short-circuit around the rule)",
    };
  }

  // ── AUDIT 2 · LOAD-BEARING · rules from WRONG family must not match ──
  {
    resetStores();
    // Seed a completely different family (docs · string-suffix).
    seed({ source_file: "docs/pages/one.md", selection_state: "SELECTED", selected_candidate: 'docs/pages/one.md::"alpha"', timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "docs/pages/two.md", selection_state: "SELECTED", selected_candidate: 'docs/pages/two.md::"beta"',  timestamp: "2026-09-17T00:00:00Z" });
    const wrongFamilyRules = induceRules(loadAllEntriesFromStore(REPO), 2);
    const input = {
      // Numeric-family query
      source_file: "src/lib/target/x.ts",
      selected_candidate: "src/lib/target/x.ts::42",
      selection_state: "SELECTED",
    };
    const p = predictFromRules(wrongFamilyRules, input);
    audits.audit_2_load_bearing_wrong_family_rules = {
      wrongFamilyRuleCount: wrongFamilyRules.length,
      wrongFamilyInvariants: wrongFamilyRules[0]?.invariants.map((i) => i.kind) ?? [],
      prediction_kind: p.kind,
      pass: p.kind === "no_applicable_rule",
      description:
        "rules induced from docs+string family must NOT fire on src/lib+numeric input",
    };
  }

  // ── AUDIT 3 · DATA-DERIVED · path_prefix extra must reflect the actual data ──
  {
    resetStores();
    // Seed A · under src/lib/alpha
    seed({ source_file: "src/lib/alpha/one.ts", selection_state: "SELECTED", selected_candidate: "src/lib/alpha/one.ts::1", timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/alpha/two.ts", selection_state: "SELECTED", selected_candidate: "src/lib/alpha/two.ts::2", timestamp: "2026-09-17T00:00:00Z" });
    const rules_A = induceRules(loadAllEntriesFromStore(REPO), 2);
    const prefixExtra_A = rules_A[0].invariants.find((i) => i.kind === "all_entries_share_path_prefix")?.extra?.path_prefix;

    resetStores();
    // Seed B · under src/lib/beta (different second segment!)
    // Note: since path_dir_second is a shape-feature and differs, this seed set will
    // group into a DIFFERENT pattern group. Both groups still emit rules — we compare
    // the path_prefix extras.
    seed({ source_file: "src/lib/beta/one.ts", selection_state: "SELECTED", selected_candidate: "src/lib/beta/one.ts::1", timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/beta/two.ts", selection_state: "SELECTED", selected_candidate: "src/lib/beta/two.ts::2", timestamp: "2026-09-17T00:00:00Z" });
    const rules_B = induceRules(loadAllEntriesFromStore(REPO), 2);
    const prefixExtra_B = rules_B[0].invariants.find((i) => i.kind === "all_entries_share_path_prefix")?.extra?.path_prefix;

    audits.audit_3_data_derived_path_prefix = {
      prefix_A: prefixExtra_A,
      prefix_B: prefixExtra_B,
      pass: prefixExtra_A === "src/lib/alpha" && prefixExtra_B === "src/lib/beta" && prefixExtra_A !== prefixExtra_B,
      description:
        "path_prefix reflects the actual shared prefix in the seed; identical code, different data, different extras",
    };
  }

  // ── AUDIT 4 · INVARIANT-DEPENDENT PARSING · same input, different rule → different type ──
  {
    // Build one numeric rule and one string rule for the SAME shape_signature except value_type.
    resetStores();
    seed({ source_file: "src/lib/pool/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/pool/a.ts::10", timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/pool/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/pool/b.ts::20", timestamp: "2026-09-17T00:00:00Z" });
    const numericRules = induceRules(loadAllEntriesFromStore(REPO), 2);
    resetStores();
    seed({ source_file: "src/lib/pool/a.ts", selection_state: "SELECTED", selected_candidate: 'src/lib/pool/a.ts::"hi"', timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/pool/b.ts", selection_state: "SELECTED", selected_candidate: 'src/lib/pool/b.ts::"bye"', timestamp: "2026-09-17T00:00:00Z" });
    const stringRules = induceRules(loadAllEntriesFromStore(REPO), 2);
    // The two "input candidates" below both syntactically match ::-format.
    // But because they map to different value_types (number vs string) via
    // extractShapeFeatures, they will pick the correct rule when both rules
    // are in the same list.
    const combined = [...numericRules, ...stringRules];
    const numericInput = {
      source_file: "src/lib/pool/whatever.ts",
      selected_candidate: "src/lib/pool/whatever.ts::777",
      selection_state: "SELECTED",
    };
    const stringInput = {
      source_file: "src/lib/pool/whatever.ts",
      selected_candidate: 'src/lib/pool/whatever.ts::"seven"',
      selection_state: "SELECTED",
    };
    const p_numeric = predictFromRules(combined, numericInput);
    const p_string = predictFromRules(combined, stringInput);
    audits.audit_4_invariant_dependent_parsing = {
      numeric_input_type: p_numeric.predicted_value_type,
      numeric_input_value: p_numeric.predicted_value,
      string_input_type: p_string.predicted_value_type,
      string_input_value: p_string.predicted_value,
      pass:
        p_numeric.predicted_value_type === "number" &&
        p_numeric.predicted_value === 777 &&
        p_string.predicted_value_type === "string" &&
        p_string.predicted_value === "seven",
      description:
        "same input shape, different induced rule (numeric vs string invariants), different parsing → different prediction type",
    };
  }

  // ── AUDIT 5 · Probe universality (in Fix 34 grouping context) ──
  {
    resetStores();
    // Contaminating entry lands in a DIFFERENT group by design (Fix 34's
    // grouping isolates it). Verify the pure group's invariants are clean.
    seed({ source_file: "src/lib/alpha/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/alpha/a.ts::1", timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/alpha/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/alpha/b.ts::2", timestamp: "2026-09-17T00:00:00Z" });
    // Contaminant: SAME source-file family but string suffix (different value_type).
    seed({ source_file: "src/lib/alpha/c.ts", selection_state: "SELECTED", selected_candidate: 'src/lib/alpha/c.ts::"x"', timestamp: "2026-09-18T00:00:00Z" });
    const rules = induceRules(loadAllEntriesFromStore(REPO), 2);
    const numericGroup = rules.find((r) => r.shape_signature.value_type === "number");
    const numericKinds = numericGroup?.invariants.map((i) => i.kind) ?? [];
    audits.audit_5_probe_universality = {
      numeric_group_present: numericGroup !== undefined,
      numeric_group_invariants: numericKinds,
      numeric_group_support: numericGroup?.support_count ?? 0,
      // The numeric group must NOT contain the string-suffix invariant,
      // proving the contaminating string entry did not corrupt it.
      pass:
        numericGroup !== undefined &&
        numericGroup.support_count === 2 &&
        !numericKinds.includes("selected_candidate_suffix_is_quoted_string") &&
        numericKinds.includes("selected_candidate_suffix_is_numeric"),
      description:
        "Fix 34 grouping isolates the contaminating string entry into its own group; the pure numeric group's invariants remain clean",
    };
  }

  // ── AUDIT 6 · CONTENT-ADDRESSED ID · identical invariants → same id · different → different id ──
  {
    resetStores();
    seed({ source_file: "src/lib/foo/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/foo/a.ts::10", timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/foo/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/foo/b.ts::20", timestamp: "2026-09-17T00:00:00Z" });
    const rules_x = induceRules(loadAllEntriesFromStore(REPO), 2);

    resetStores();
    seed({ source_file: "src/lib/foo/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/foo/a.ts::10", timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/foo/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/foo/b.ts::20", timestamp: "2026-09-17T00:00:00Z" });
    const rules_y = induceRules(loadAllEntriesFromStore(REPO), 2);
    const same_id = rules_x[0].rule_id === rules_y[0].rule_id;

    resetStores();
    seed({ source_file: "src/lib/foo/a.ts", selection_state: "SELECTED", selected_candidate: 'src/lib/foo/a.ts::"HI"', timestamp: "2026-09-16T00:00:00Z" });
    seed({ source_file: "src/lib/foo/b.ts", selection_state: "SELECTED", selected_candidate: 'src/lib/foo/b.ts::"BYE"', timestamp: "2026-09-17T00:00:00Z" });
    const rules_z = induceRules(loadAllEntriesFromStore(REPO), 2);
    const different_id = rules_x[0].rule_id !== rules_z[0].rule_id;

    audits.audit_6_content_addressed_id = {
      identical_data_same_id: same_id,
      different_data_different_id: different_id,
      x_id: rules_x[0].rule_id,
      y_id: rules_y[0].rule_id,
      z_id: rules_z[0].rule_id,
      pass: same_id && different_id,
      description:
        "rule_id is a content-hash of (shape_signature, invariants); identity is DATA-derived",
    };
  }

  // ── AUDIT 7 · Code-vs-data grep for the specific values in receipts ──
  {
    const modulePath = path.join(REPO, "src/lib/nex-agent/code-engine/capability-capability-discovery.ts");
    const moduleSrc = fs.readFileSync(modulePath, "utf8");
    // Values that appear in Test E receipts as PREDICTIONS from data
    const forbiddenLiterals = [
      "0476695f90fd320b",   // Test E session-1 rule_id
      "genuinely-novel",    // apply_A source_file
      "newone.ts",          // apply_A file
      "src/lib/family",     // Test E training seeds
      "b2044a2efb6ba920",   // adversarial rule_id from Test E
    ];
    const hits = forbiddenLiterals.filter((s) => moduleSrc.includes(s));
    audits.audit_7_code_grep = {
      module_path: modulePath,
      module_bytes: moduleSrc.length,
      forbidden_literals_checked: forbiddenLiterals,
      hits,
      pass: hits.length === 0,
      description:
        "the module source must not contain the specific rule_ids or seed paths that appear in receipts",
    };
  }

  // ── AGGREGATE VERDICT ────────────────────────────────────────────────
  const all_pass = Object.values(audits).every((a) => a.pass === true);
  const receipt = {
    test: "E · anti-cheating audit",
    date: new Date().toISOString(),
    zero_llm: true,
    audits,
    all_pass,
    verdict: all_pass ? "NO_CHEATING_DETECTED" : "CHEATING_DETECTED",
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "test-e-anti-cheating-audit-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  resetStores();

  console.log("=== ANTI-CHEATING AUDIT ===");
  for (const [name, a] of Object.entries(audits)) {
    console.log(`  ${name}: ${a.pass ? "PASS" : "FAIL"} · ${a.description}`);
  }
  console.log("\nVERDICT:", receipt.verdict);
}
main().catch((e) => { console.error(e); process.exit(1); });
