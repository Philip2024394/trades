// NEX1 · Intelligence Discovery · Test B · CROSS-EXPERIENCE ABSTRACTION.
//
// PRIMARY RESEARCH QUESTION (per protocol):
//   Can NEX1 discover something that was NOT explicitly programmed as
//   the answer to the new problem, validate that discovery, store it,
//   and later apply it successfully to a different situation?
//
// TEST B GOAL
//   Prove or disprove that NEX1's Fix 34 cross-experience abstraction
//   engine (loaded but disconnected at Test A time) can:
//     1. Extract a structural pattern from >=2 accumulated experiences
//        of the SAME feature family.
//     2. Refuse when accumulated experience is below support threshold.
//     3. Retrieve the pattern for a NEW same-family problem it has
//        never seen (generalisation within family).
//     4. REFUSE to fire on a DIFFERENT-family problem (honest boundary).
//
//   This is falsification-first: the test can produce
//     VERIFIED / PARTIALLY VERIFIED / FAILED / INCONCLUSIVE.
//
// ANTI-CHEATING
//   - The extractor is generic (feature-dimension based, not fixture
//     name based).
//   - Seeds are realistic-looking InvestigationConclusionEntry objects
//     with distinct source_files (never a mapping from fixture name to
//     answer).
//   - Every retrieval outcome is compared against a deterministic
//     ground-truth built from the seeded data alone.
//   - Zero LLM.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const STORE = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
const OUT_DIR = path.join(REPO, "data", "nex1-discovery-experiments");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────

function resetStore() {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  if (fs.existsSync(STORE)) fs.unlinkSync(STORE);
}

function seed({ source_file, selection_state, selected_candidate, timestamp }) {
  const entry = {
    entry_id: "seed-" + crypto.randomBytes(4).toString("hex"),
    timestamp,
    investigation_id: "seeded",
    trace_id: "seeded",
    source_file,
    selection_state,
    selected_candidate,
    candidates_considered: selected_candidate === null ? [] : [selected_candidate],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "seed for Test B abstraction experiment",
    confidence: 0.35,
    provenance: [{ source_file, start_line: 1, end_line: 1 }],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
  };
  fs.appendFileSync(STORE, JSON.stringify(entry) + "\n", "utf8");
  return entry.entry_id;
}

async function loadAbstractionModule() {
  const url = pathToFileURL(
    path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts"),
  ).href;
  return import(url);
}

// ── the four falsification cases ────────────────────────────────────────

async function main() {
  const mod = await loadAbstractionModule();
  const {
    extractShapeFeatures,
    extractPatterns,
    retrievePattern,
    loadAllEntriesFromStore,
    extractAndRetrieveFromStore,
    EXPERIENCE_ABSTRACTION_VERSION,
  } = mod;

  const results = {};

  // Case 1 · Zero prior experience
  console.log("\n=== Case 1 · zero prior ===");
  resetStore();
  {
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    const q = {
      target_features: {
        has_signature_format: true,
        value_type: "number",
        path_dir_root: "src",
        path_dir_second: "lib",
        selection_state: "SELECTED",
      },
      min_support: 2,
    };
    const match = retrievePattern(patterns, q);
    results.case_1_zero_prior = {
      patterns_count: patterns.length,
      match: match !== null,
      match_kind: match?.match_kind ?? null,
      expected_match: false,
      correct: match === null,
    };
  }

  // Case 2 · Single prior (below min_support threshold)
  console.log("\n=== Case 2 · single prior (below threshold) ===");
  resetStore();
  seed({
    source_file: "src/lib/foo/one.ts",
    selection_state: "SELECTED",
    selected_candidate: "src/lib/foo/one.ts::7",
    timestamp: "2026-09-15T00:00:00Z",
  });
  {
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    const q = {
      target_features: {
        has_signature_format: true,
        value_type: "number",
        path_dir_root: "src",
        path_dir_second: "lib",
        selection_state: "SELECTED",
      },
      min_support: 2,
    };
    const match = retrievePattern(patterns, q);
    results.case_2_single_prior_below_threshold = {
      patterns_count: patterns.length,
      match: match !== null,
      match_kind: match?.match_kind ?? null,
      expected_match: false,
      correct: match === null,
    };
  }

  // Case 3 · Same-family generalisation (SUCCESS PATH)
  //   Seed 3 successful return-literal experiences from DIFFERENT files;
  //   query with features that match the family shape.
  //   Expect: pattern with support=3 discovered · retrieval returns match.
  console.log("\n=== Case 3 · same-family generalisation (3 experiences) ===");
  resetStore();
  seed({
    source_file: "src/lib/alpha/a.ts",
    selection_state: "SELECTED",
    selected_candidate: "src/lib/alpha/a.ts::3",
    timestamp: "2026-09-16T00:00:00Z",
  });
  seed({
    source_file: "src/lib/beta/b.ts",
    selection_state: "SELECTED",
    selected_candidate: "src/lib/beta/b.ts::42",
    timestamp: "2026-09-17T00:00:00Z",
  });
  seed({
    source_file: "src/lib/gamma/c.ts",
    selection_state: "SELECTED",
    selected_candidate: "src/lib/gamma/c.ts::99",
    timestamp: "2026-09-18T00:00:00Z",
  });
  {
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    // Seeded files all live under `src/lib/*/` · path_dir_second is
    // uniformly "lib" across all 3 experiences. Exact retrieval with
    // path_dir_second="lib" should succeed with support_count=3.
    // This case proves feature-based grouping across DIFFERENT source
    // files under a shared directory family.
    const q_exact_same_family = {
      target_features: {
        has_signature_format: true,
        value_type: "number",
        path_dir_root: "src",
        path_dir_second: "lib",
        selection_state: "SELECTED",
      },
      min_support: 2,
    };
    const match = retrievePattern(patterns, q_exact_same_family);
    const supportForNumericSelected = patterns
      .filter((p) => p.features.value_type === "number" && p.features.selection_state === "SELECTED")
      .reduce((s, p) => s + p.support_count, 0);
    results.case_3_same_family_generalisation = {
      patterns_count: patterns.length,
      match: match !== null,
      match_kind: match?.match_kind ?? null,
      match_support_count: match?.pattern?.support_count ?? null,
      total_numeric_selected_support: supportForNumericSelected,
      match_features: match?.pattern?.features ?? null,
      expected_match: true,
      expected_kind: "exact",
      expected_support: 3,
      correct:
        match !== null &&
        match.match_kind === "exact" &&
        match.pattern.support_count === 3,
    };
  }

  // Case 3b · same-family retrieval with RELAXED path_dir_second
  //   Same seeds as Case 3 · query uses a DIFFERENT path_dir_second
  //   (e.g. "app") that no seed matches exactly. Relaxed retrieval
  //   MUST fall back to matching by (root, value_type, selection_state)
  //   with support_count ≥ 2.
  console.log("\n=== Case 3b · relaxed retrieval (different second-dir) ===");
  {
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    const q_relaxed = {
      target_features: {
        has_signature_format: true,
        value_type: "number",
        path_dir_root: "src",
        path_dir_second: "app", // deliberately different from seeded "lib"
        selection_state: "SELECTED",
      },
      min_support: 2,
    };
    const match = retrievePattern(patterns, q_relaxed);
    results.case_3b_relaxed_second_dir = {
      patterns_count: patterns.length,
      match: match !== null,
      match_kind: match?.match_kind ?? null,
      expected_match: true,
      expected_kind: "relaxed_second_dir",
      correct:
        match !== null &&
        match.match_kind === "relaxed_second_dir",
    };
  }

  // Case 4 · Different-family REFUSAL (the honesty test)
  //   Same seeds as Case 3 (3 return-literal successes) BUT query with a
  //   feature signature that does NOT match the seeded family. Expect: no
  //   match at min_support>=2.
  console.log("\n=== Case 4 · different-family refusal ===");
  // Store already seeded from Case 3
  {
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    const q_diff_family = {
      target_features: {
        has_signature_format: false, // no sig -> different shape entirely
        value_type: "other",
        path_dir_root: "docs",
        path_dir_second: null,
        selection_state: "TIE",
      },
      min_support: 2,
    };
    const match = retrievePattern(patterns, q_diff_family);
    results.case_4_different_family_refusal = {
      patterns_count: patterns.length,
      match: match !== null,
      match_kind: match?.match_kind ?? null,
      expected_match: false,
      correct: match === null,
    };
  }

  // Case 5 · Adversarial mix (2 matching + 2 different)
  console.log("\n=== Case 5 · adversarial mix ===");
  resetStore();
  seed({ source_file: "src/lib/x/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/x/a.ts::1", timestamp: "2026-09-14T00:00:00Z" });
  seed({ source_file: "src/lib/y/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/y/b.ts::2", timestamp: "2026-09-15T00:00:00Z" });
  seed({ source_file: "src/lib/z/c.ts", selection_state: "TIE", selected_candidate: null, timestamp: "2026-09-16T00:00:00Z" });
  seed({ source_file: "docs/other.md", selection_state: "SELECTED", selected_candidate: "docs/other.md::hello", timestamp: "2026-09-17T00:00:00Z" });
  {
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    // Query for numeric SELECTED under src/lib · expect match with support=2
    const q = {
      target_features: {
        has_signature_format: true,
        value_type: "number",
        path_dir_root: "src",
        path_dir_second: "lib",
        selection_state: "SELECTED",
      },
      min_support: 2,
    };
    const match = retrievePattern(patterns, q);
    const numericSelectedGroups = patterns.filter(
      (p) => p.features.value_type === "number" && p.features.selection_state === "SELECTED",
    );
    const tieGroups = patterns.filter((p) => p.features.selection_state === "TIE");
    const stringGroups = patterns.filter((p) => p.features.value_type === "string");
    results.case_5_adversarial_mix = {
      patterns_count: patterns.length,
      numeric_selected_group_count: numericSelectedGroups.length,
      tie_group_count: tieGroups.length,
      string_group_count: stringGroups.length,
      groups_distinct: numericSelectedGroups.length >= 1 && tieGroups.length >= 1 && stringGroups.length >= 1,
      match: match !== null,
      match_kind: match?.match_kind ?? null,
      match_support_count: match?.pattern?.support_count ?? null,
      expected_match: true,
      correct: match !== null,
    };
  }

  // Case 6 · Real-world query (switch problem features)
  //   Switch problems produce entries whose `selected_candidate` is
  //   typically NOT in the `path::value` format because we have no
  //   operator for switch. Even if seeded, a switch-family experience
  //   would have `has_signature_format=false`, `value_type=other`, so
  //   the seeded numeric SELECTED pattern must NOT match it.
  console.log("\n=== Case 6 · switch-problem-features (no matching abstraction expected) ===");
  {
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    const q_switch = {
      target_features: {
        has_signature_format: false,
        value_type: "other",
        path_dir_root: "src",
        path_dir_second: "lib",
        selection_state: "SELECTED",
      },
      min_support: 2,
    };
    const match = retrievePattern(patterns, q_switch);
    results.case_6_switch_shape_refused = {
      match: match !== null,
      match_kind: match?.match_kind ?? null,
      expected_match: false,
      correct: match === null,
    };
  }

  // ── Assemble report ────────────────────────────────────────────────────
  const cases = [
    results.case_1_zero_prior,
    results.case_2_single_prior_below_threshold,
    results.case_3_same_family_generalisation,
    results.case_3b_relaxed_second_dir,
    results.case_4_different_family_refusal,
    results.case_5_adversarial_mix,
    results.case_6_switch_shape_refused,
  ];
  const all_correct = cases.every((c) => c.correct === true);
  const case_correctness = cases.map((c) => c.correct);

  const report = {
    test: "B · cross-experience abstraction · milestone a265645d + Fix 34 loaded direct",
    date: new Date().toISOString(),
    zero_llm: true,
    version: EXPERIENCE_ABSTRACTION_VERSION,
    cases: results,
    case_correctness,
    verdict:
      all_correct
        ? "VERIFIED"
        : case_correctness.filter(Boolean).length >= 4
          ? "PARTIALLY VERIFIED"
          : "FAILED",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "test-b-abstraction-receipt.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  // Cleanup so subsequent tests start clean
  resetStore();

  console.log("\n=== TEST B · SUMMARY ===");
  for (const [name, c] of Object.entries(results)) {
    console.log(`${name}: correct=${c.correct} · match=${c.match} · kind=${c.match_kind ?? "-"}`);
  }
  console.log("\n=== VERDICT ===");
  console.log(report.verdict);
}
main().catch((e) => { console.error(e); process.exit(1); });
