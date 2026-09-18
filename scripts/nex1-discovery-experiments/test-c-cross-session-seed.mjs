// NEX1 · Intelligence Discovery · Test C · Session 1 · SEED
//
// This script simulates "Session 1" — it seeds the Fix 17 investigation-
// conclusion store with N distinct experiences and exits. NO in-memory
// pattern object is passed to Session 2; the only communication channel
// is the JSONL file on disk.
//
// Test C proves that learned abstractions survive session boundaries —
// the founder's exact ask: "destroy/restart the session and test whether
// NEX1 can retrieve that learned knowledge later."

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
function seed({ source_file, selection_state, selected_candidate, timestamp }) {
  const entry = {
    entry_id: "seed-" + crypto.randomBytes(4).toString("hex"),
    timestamp,
    investigation_id: "session-1",
    trace_id: "session-1",
    source_file,
    selection_state,
    selected_candidate,
    candidates_considered: selected_candidate === null ? [] : [selected_candidate],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "session-1 seed",
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

async function main() {
  resetStore();
  // Session 1 · seed 3 same-family experiences + 1 different-family entry.
  const ids = [
    seed({ source_file: "src/lib/one/a.ts", selection_state: "SELECTED", selected_candidate: "src/lib/one/a.ts::11", timestamp: "2026-09-16T00:00:00Z" }),
    seed({ source_file: "src/lib/two/b.ts", selection_state: "SELECTED", selected_candidate: "src/lib/two/b.ts::22", timestamp: "2026-09-17T00:00:00Z" }),
    seed({ source_file: "src/lib/three/c.ts", selection_state: "SELECTED", selected_candidate: "src/lib/three/c.ts::33", timestamp: "2026-09-18T00:00:00Z" }),
    seed({ source_file: "docs/other.md", selection_state: "TIE", selected_candidate: null, timestamp: "2026-09-18T01:00:00Z" }),
  ];

  const { extractPatterns, loadAllEntriesFromStore, EXPERIENCE_ABSTRACTION_VERSION } = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts")).href
  );

  // Compute a fingerprint of the extracted patterns FROM THIS SESSION.
  const patterns_s1 = extractPatterns(loadAllEntriesFromStore(REPO));
  const fingerprint_s1 = crypto
    .createHash("sha256")
    .update(JSON.stringify(patterns_s1.map((p) => ({ id: p.pattern_id, s: p.support_count, f: p.features }))))
    .digest("hex")
    .slice(0, 32);

  const receipt = {
    session: 1,
    date: new Date().toISOString(),
    seeded_ids: ids,
    store_path: STORE,
    session_1_pattern_count: patterns_s1.length,
    session_1_fingerprint: fingerprint_s1,
    session_1_patterns_summary: patterns_s1.map((p) => ({
      pattern_id: p.pattern_id,
      support: p.support_count,
      features: p.features,
    })),
    abstraction_version: EXPERIENCE_ABSTRACTION_VERSION,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "test-c-session-1-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );
  console.log("=== SESSION 1 · SEEDED + FINGERPRINTED ===");
  console.log("patterns:", patterns_s1.length);
  console.log("fingerprint:", fingerprint_s1);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
