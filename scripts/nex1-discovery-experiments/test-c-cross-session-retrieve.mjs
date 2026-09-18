// NEX1 · Intelligence Discovery · Test C · Session 2 · RETRIEVE
//
// This script simulates "Session 2" — a completely fresh Node process
// with no in-memory link to Session 1. Its input is ONLY the Fix 17
// JSONL file on disk. It reads the store, extracts patterns, computes
// a fingerprint, and compares against Session 1's receipt.
//
// Success criteria:
//   - fingerprints match (same patterns emerge from same data)
//   - retrieval for a novel same-family query succeeds
//   - retrieval for a different-family query correctly refuses
//   - the "learned knowledge" is deterministic, cross-session, zero-LLM

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const STORE = path.join(REPO, "data", "nex1-investigation-conclusions", "entries.jsonl");
const OUT_DIR = path.join(REPO, "data", "nex1-discovery-experiments");

async function main() {
  // Session 2 · fresh process · read Session 1's receipt for fingerprint compare
  const s1_receipt_path = path.join(OUT_DIR, "test-c-session-1-receipt.json");
  if (!fs.existsSync(s1_receipt_path)) {
    console.error("Session 1 receipt missing at", s1_receipt_path);
    process.exit(1);
  }
  const s1 = JSON.parse(fs.readFileSync(s1_receipt_path, "utf8"));

  const { extractPatterns, loadAllEntriesFromStore, retrievePattern, EXPERIENCE_ABSTRACTION_VERSION } = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts")).href
  );

  const entries_s2 = loadAllEntriesFromStore(REPO);
  const patterns_s2 = extractPatterns(entries_s2);
  const fingerprint_s2 = crypto
    .createHash("sha256")
    .update(JSON.stringify(patterns_s2.map((p) => ({ id: p.pattern_id, s: p.support_count, f: p.features }))))
    .digest("hex")
    .slice(0, 32);

  const fingerprints_match = fingerprint_s2 === s1.session_1_fingerprint;

  // Retrieval · same-family novel query (should succeed since Session 1 seeded 3 same-family experiences)
  const same_family_query = {
    target_features: {
      has_signature_format: true,
      value_type: "number",
      path_dir_root: "src",
      path_dir_second: "lib",
      selection_state: "SELECTED",
    },
    min_support: 2,
  };
  const same_family_match = retrievePattern(patterns_s2, same_family_query);

  // Retrieval · different-family query (should refuse)
  const different_family_query = {
    target_features: {
      has_signature_format: false,
      value_type: "other",
      path_dir_root: "src",
      path_dir_second: "lib",
      selection_state: "SELECTED",
    },
    min_support: 2,
  };
  const different_family_match = retrievePattern(patterns_s2, different_family_query);

  const receipt = {
    session: 2,
    date: new Date().toISOString(),
    same_process_as_session_1: false, // this script is a fresh process
    input_channel: "Fix 17 JSONL store · disk only",
    store_entries_read: entries_s2.length,
    session_2_pattern_count: patterns_s2.length,
    session_2_fingerprint: fingerprint_s2,
    session_1_fingerprint: s1.session_1_fingerprint,
    fingerprints_match,
    same_family_query,
    same_family_retrieval: {
      matched: same_family_match !== null,
      match_kind: same_family_match?.match_kind ?? null,
      support: same_family_match?.pattern?.support_count ?? null,
    },
    different_family_query,
    different_family_retrieval: {
      matched: different_family_match !== null,
      match_kind: different_family_match?.match_kind ?? null,
    },
    abstraction_version: EXPERIENCE_ABSTRACTION_VERSION,
    correct_all: fingerprints_match && same_family_match !== null && different_family_match === null,
    verdict:
      fingerprints_match && same_family_match !== null && different_family_match === null
        ? "VERIFIED"
        : fingerprints_match
          ? "PARTIALLY VERIFIED"
          : "FAILED",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "test-c-session-2-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== SESSION 2 · CROSS-SESSION RETRIEVAL ===");
  console.log("fingerprints_match:", receipt.fingerprints_match);
  console.log("same_family_retrieval:", receipt.same_family_retrieval);
  console.log("different_family_retrieval:", receipt.different_family_retrieval);
  console.log("VERDICT:", receipt.verdict);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
