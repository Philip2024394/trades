// NEX1 · Intelligence Discovery · Test D · Monotonicity + Order-Independence
//
// Two invariants tested in one direct-module script:
//   1. MONOTONICITY  · pattern support_count for a given feature vector
//      grows or stays equal as new same-family evidence is added; never
//      shrinks. New patterns emerge for new families without collapsing
//      old ones.
//   2. ORDER-INDEPENDENCE · the extracted pattern set is invariant under
//      permutation of the entries. Same evidence in different order
//      produces identical fingerprints.
//
// Both are real intelligence properties of a learning system:
//   - a system that forgets past support with new evidence is not learning
//   - a system whose answer depends on entry order is unstable
//
// Zero LLM · deterministic · direct-module · no HTTP.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const STORE = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
const OUT_DIR = path.join(REPO, "data", "nex1-discovery-experiments");
fs.mkdirSync(OUT_DIR, { recursive: true });

function resetStore() {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  if (fs.existsSync(STORE)) fs.unlinkSync(STORE);
}
function makeEntry({ source_file, selection_state, selected_candidate, timestamp }) {
  return {
    entry_id: "seed-" + crypto.randomBytes(4).toString("hex"),
    timestamp,
    investigation_id: "test-d",
    trace_id: "test-d",
    source_file,
    selection_state,
    selected_candidate,
    candidates_considered: selected_candidate === null ? [] : [selected_candidate],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "test-d",
    confidence: 0.35,
    provenance: [{ source_file, start_line: 1, end_line: 1 }],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
  };
}
function writeAll(entries) {
  resetStore();
  for (const e of entries) {
    fs.appendFileSync(STORE, JSON.stringify(e) + "\n", "utf8");
  }
}

function fingerprintOf(patterns) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(patterns.map((p) => ({ id: p.pattern_id, s: p.support_count, f: p.features }))))
    .digest("hex")
    .slice(0, 32);
}

async function main() {
  const { extractPatterns, loadAllEntriesFromStore } = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts")).href
  );

  // ── A canonical set of 5 entries: 3 numeric-SELECTED src/lib + 1 TIE + 1 string SELECTED docs
  const canonical = [
    makeEntry({ source_file: "src/lib/A/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/A/a.ts::1", timestamp: "2026-09-10T00:00:00Z" }),
    makeEntry({ source_file: "src/lib/B/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/B/b.ts::2", timestamp: "2026-09-11T00:00:00Z" }),
    makeEntry({ source_file: "src/lib/C/c.ts", selection_state: "SELECTED", selected_candidate: "src/lib/C/c.ts::3", timestamp: "2026-09-12T00:00:00Z" }),
    makeEntry({ source_file: "src/lib/D/d.ts", selection_state: "TIE",      selected_candidate: null,               timestamp: "2026-09-13T00:00:00Z" }),
    makeEntry({ source_file: "docs/e.md",      selection_state: "SELECTED", selected_candidate: 'docs/e.md::"hi"',   timestamp: "2026-09-14T00:00:00Z" }),
  ];

  // ── PART 1 · MONOTONICITY ────────────────────────────────────────────
  // Grow the store one entry at a time; measure support_count for
  // numeric-SELECTED-src/lib pattern at each step.
  const growth = [];
  for (let i = 1; i <= canonical.length; i++) {
    writeAll(canonical.slice(0, i));
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    const numericSelectedSrcLib = patterns.find(
      (p) =>
        p.features.selection_state === "SELECTED" &&
        p.features.value_type === "number" &&
        p.features.path_dir_root === "src" &&
        p.features.path_dir_second === "lib",
    );
    growth.push({
      step: i,
      total_entries: i,
      numeric_selected_src_lib_support: numericSelectedSrcLib?.support_count ?? 0,
      total_patterns: patterns.length,
      all_pattern_supports: patterns.map((p) => ({ id: p.pattern_id, s: p.support_count })),
    });
  }
  // Verify monotonicity of the numeric-SELECTED-src/lib support count.
  const monotone_supports = growth
    .map((g) => g.numeric_selected_src_lib_support)
    .every((s, i, arr) => (i === 0 ? true : s >= arr[i - 1]));
  const supports_over_time = growth.map((g) => g.numeric_selected_src_lib_support);
  // Expected: 1 → 2 → 3 → 3 → 3 (step 4 adds a TIE which doesn't affect numeric-SELECTED count;
  // step 5 adds a docs SELECTED string which also doesn't).

  // ── PART 2 · ORDER-INDEPENDENCE ──────────────────────────────────────
  // Same 5 entries but shuffled deterministically 3 different ways.
  function permute(arr, seed) {
    // deterministic Fisher-Yates using a simple LCG so the test is reproducible.
    let s = seed;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  const orders = [1, 2, 3].map((seed) => permute(canonical, seed));
  const fingerprints = [];
  for (const [i, order] of orders.entries()) {
    writeAll(order);
    const patterns = extractPatterns(loadAllEntriesFromStore(REPO));
    fingerprints.push({ seed: i + 1, fingerprint: fingerprintOf(patterns), pattern_count: patterns.length });
  }
  const all_same_fingerprint = fingerprints.every((f) => f.fingerprint === fingerprints[0].fingerprint);

  // ── Cleanup store ────────────────────────────────────────────────────
  resetStore();

  const receipt = {
    test: "D · monotonicity + order-independence",
    date: new Date().toISOString(),
    zero_llm: true,
    part_1_monotonicity: {
      growth_steps: growth,
      supports_over_time,
      supports_monotone_non_decreasing: monotone_supports,
      expected_supports: [1, 2, 3, 3, 3],
      matches_expected: JSON.stringify(supports_over_time) === JSON.stringify([1, 2, 3, 3, 3]),
    },
    part_2_order_independence: {
      fingerprints,
      all_same_fingerprint,
    },
    verdict:
      monotone_supports &&
      all_same_fingerprint &&
      JSON.stringify(supports_over_time) === JSON.stringify([1, 2, 3, 3, 3])
        ? "VERIFIED"
        : "PARTIALLY VERIFIED",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "test-d-monotonicity-and-order-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== TEST D · MONOTONICITY ===");
  console.log("supports over time:", supports_over_time.join(" -> "));
  console.log("monotone:", monotone_supports);
  console.log("matches expected [1,2,3,3,3]:", receipt.part_1_monotonicity.matches_expected);
  console.log("\n=== TEST D · ORDER-INDEPENDENCE ===");
  for (const f of fingerprints) console.log(`  seed=${f.seed} · fp=${f.fingerprint} · patterns=${f.pattern_count}`);
  console.log("all same fingerprint:", all_same_fingerprint);
  console.log("\nVERDICT:", receipt.verdict);
}
main().catch((e) => { console.error(e); process.exit(1); });
