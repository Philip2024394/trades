// Vitest suite for Fix 26 · 28 · 29 · 30 · 31.
// Founder-authorised 2026-09-18.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  retrieveExperience,
  countExperience,
  EXPERIENCE_RETRIEVAL_VERSION,
} from "./capability-experience-retrieval";
import {
  buildPriorContext,
  CROSS_SESSION_LEARNING_VERSION,
} from "./capability-cross-session-learning";
import {
  composeTargetedClarification,
  TARGETED_CLARIFICATION_VERSION,
} from "./capability-targeted-clarification";
import {
  inferSpeakerIntent,
  SPEAKER_INTENT_VERSION,
} from "./capability-speaker-intent";
import {
  subscribeFeedback,
  unsubscribeFeedback,
  broadcastFeedback,
  _resetForTests,
  ERROR_BROADCAST_VERSION,
} from "./capability-error-broadcast";

// ─── Fix 26 · retrieval ──────────────────────────────────────────────────

describe("Fix 26 · retrieveExperience", () => {
  let tmp: string;
  const jsonlPath = () =>
    path.join(tmp, "data", "nex1-investigation-conclusions", "entries.jsonl");
  const writeEntries = (rows: unknown[]) => {
    fs.mkdirSync(path.dirname(jsonlPath()), { recursive: true });
    fs.writeFileSync(
      jsonlPath(),
      rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
      "utf8",
    );
  };
  const mkEntry = (over: Record<string, unknown> = {}) => ({
    entry_id: "e-" + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString(),
    investigation_id: "inv-1",
    trace_id: "tr-1",
    source_file: "src/lib/x.ts",
    selection_state: "SELECTED",
    selected_candidate: "cand-1",
    candidates_considered: ["cand-1", "cand-2"],
    rankings_reference: {
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
      source_file: "src/lib/x.ts",
    },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "test",
    confidence: 0.35,
    provenance: [],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
    ...over,
  });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fix26-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("R26-1 · refuses empty query", () => {
    const r = retrieveExperience({ repo_root: tmp });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("empty_query_would_return_everything");
  });

  it("R26-2 · refuses when store not found", () => {
    const r = retrieveExperience({ repo_root: tmp, source_file: "src/x.ts" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("store_not_found");
  });

  it("R26-3 · returns entries when filter matches", () => {
    writeEntries([mkEntry({ source_file: "src/lib/x.ts" }), mkEntry({ source_file: "src/lib/y.ts" })]);
    const r = retrieveExperience({ repo_root: tmp, source_file: "src/lib/x.ts" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].source_file).toBe("src/lib/x.ts");
    expect(r.r11b_marker).toBe(
      "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    );
  });

  it("R26-4 · filters by selection_state", () => {
    writeEntries([
      mkEntry({ selection_state: "SELECTED" }),
      mkEntry({ selection_state: "TIE" }),
    ]);
    const r = retrieveExperience({
      repo_root: tmp,
      source_file: "src/lib/x.ts",
      selection_state: "TIE",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].selection_state).toBe("TIE");
  });

  it("R26-5 · skips malformed lines without throwing", () => {
    fs.mkdirSync(path.dirname(jsonlPath()), { recursive: true });
    fs.writeFileSync(
      jsonlPath(),
      "not-json\n" + JSON.stringify(mkEntry()) + "\n",
      "utf8",
    );
    const r = retrieveExperience({ repo_root: tmp, source_file: "src/lib/x.ts" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entries.length).toBe(1);
  });

  it("R26-6 · count returns number when store readable", () => {
    writeEntries([mkEntry(), mkEntry(), mkEntry({ source_file: "src/other.ts" })]);
    const c = countExperience({ repo_root: tmp, source_file: "src/lib/x.ts" });
    expect(c).toBe(2);
  });

  it("R26-7 · version marker", () => {
    expect(EXPERIENCE_RETRIEVAL_VERSION).toBe("fix26.v1");
  });
});

// ─── Fix 30 · cross-session learning ─────────────────────────────────────

describe("Fix 30 · buildPriorContext", () => {
  let tmp: string;
  const jsonlPath = () =>
    path.join(tmp, "data", "nex1-investigation-conclusions", "entries.jsonl");
  const mkE = (over: Record<string, unknown> = {}) => ({
    entry_id: "e-" + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString(),
    investigation_id: "inv-1",
    trace_id: "tr-1",
    source_file: "src/lib/x.ts",
    selection_state: "SELECTED",
    selected_candidate: "cand-1",
    candidates_considered: ["cand-1"],
    rankings_reference: {
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
      source_file: "src/lib/x.ts",
    },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "t",
    confidence: 0.35,
    provenance: [],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
    ...over,
  });
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fix30-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("R30-1 · store missing → STORE_UNAVAILABLE", () => {
    const c = buildPriorContext({ repo_root: tmp, source_file: "src/lib/x.ts" });
    expect(c.status).toBe("STORE_UNAVAILABLE");
    expect(c.r11b_marker).toBe(
      "PRIOR_EXPERIENCE_INFORMS_BUT_DOES_NOT_AUTHORISE",
    );
  });

  it("R30-2 · store present with matching entries → PRIOR_EXPERIENCE_INFORM_ONLY", () => {
    fs.mkdirSync(path.dirname(jsonlPath()), { recursive: true });
    fs.writeFileSync(
      jsonlPath(),
      [mkE({ selection_state: "SELECTED", timestamp: "2026-09-17T00:00:00Z" }),
        mkE({ selection_state: "TIE", timestamp: "2026-09-18T00:00:00Z" })]
        .map((r) => JSON.stringify(r)).join("\n") + "\n",
      "utf8",
    );
    const c = buildPriorContext({ repo_root: tmp, source_file: "src/lib/x.ts" });
    expect(c.status).toBe("PRIOR_EXPERIENCE_INFORM_ONLY");
    expect(c.total_prior_entries).toBe(2);
    expect(c.recent[0].timestamp).toBe("2026-09-18T00:00:00Z"); // sorted DESC
    expect(c.state_counts.SELECTED).toBe(1);
    expect(c.state_counts.TIE).toBe(1);
  });

  it("R30-3 · version marker", () => {
    expect(CROSS_SESSION_LEARNING_VERSION).toBe("fix30.v1");
  });
});

// ─── Fix 28 · targeted clarification ─────────────────────────────────────

describe("Fix 28 · composeTargetedClarification", () => {
  it("R28-1 · TARGET_FILE slot", () => {
    const r = composeTargetedClarification({ missing_slot: "TARGET_FILE" });
    expect(r.slot).toBe("TARGET_FILE");
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.evidence_kind).toBe("COMPOSED");
  });
  it("R28-2 · EXPECTED_VALUE includes function name when given", () => {
    const r = composeTargetedClarification({
      missing_slot: "EXPECTED_VALUE",
      context: { discovered_function: "compute", target_file: "x.ts" },
    });
    expect(r.text).toContain("compute");
    expect(r.text).toContain("x.ts");
  });
  it("R28-3 · AMBIGUOUS_CANDIDATE lists paths", () => {
    const r = composeTargetedClarification({
      missing_slot: "AMBIGUOUS_CANDIDATE",
      context: { candidate_paths: ["a.ts", "b.ts", "c.ts"] },
    });
    expect(r.text).toContain("a.ts");
    expect(r.text).toContain("b.ts");
  });
  it("R28-4 · version marker", () => {
    expect(TARGETED_CLARIFICATION_VERSION).toBe("fix28.v1");
  });
});

// ─── Fix 29 · speaker intent ─────────────────────────────────────────────

describe("Fix 29 · inferSpeakerIntent", () => {
  it("R29-1 · analytical prose with fix marker → CODING_FIX_REQUEST", () => {
    const r = inferSpeakerIntent({
      user_message: "Analyse this file and propose a correction.",
    });
    expect(r.intent).toBe("CODING_FIX_REQUEST");
    expect(r.confidence).toBeGreaterThan(0.5);
  });
  it("R29-2 · pure investigation prose → INVESTIGATION_ONLY", () => {
    const r = inferSpeakerIntent({
      user_message: "Please explain the architecture of this module.",
    });
    expect(r.intent).toBe("INVESTIGATION_ONLY");
  });
  it("R29-3 · investigative verb without fix cue → INVESTIGATION_ONLY", () => {
    const r = inferSpeakerIntent({
      user_message: "Analyse this file.",
    });
    expect(r.intent).toBe("INVESTIGATION_ONLY");
  });
  it("R29-4 · classifier FIX + investigative surface → CODING_FIX_REQUEST", () => {
    const r = inferSpeakerIntent({
      user_message: "Investigate this and act.",
      classifier_verb_families: ["FIX"],
    });
    expect(r.intent).toBe("CODING_FIX_REQUEST");
  });
  it("R29-5 · unclear when message has no cue", () => {
    const r = inferSpeakerIntent({ user_message: "hello" });
    expect(r.intent).toBe("UNCLEAR");
  });
  it("R29-6 · empty message", () => {
    const r = inferSpeakerIntent({ user_message: "" });
    expect(r.intent).toBe("UNCLEAR");
    expect(r.confidence).toBe(0);
  });
  it("R29-7 · version marker", () => {
    expect(SPEAKER_INTENT_VERSION).toBe("fix29.v1");
  });
});

// ─── Fix 31 · error broadcast ────────────────────────────────────────────

describe("Fix 31 · broadcastFeedback", () => {
  beforeEach(() => _resetForTests());

  it("R31-1 · delivers to subscriber for matching kind", async () => {
    const received: unknown[] = [];
    subscribeFeedback("sub-a", ["test_exit_code_zero"], (e) => {
      received.push(e);
    });
    const r = await broadcastFeedback({
      kind: "test_exit_code_zero",
      source: "vitest",
      payload: { exit_code: 0 },
    });
    expect(r.delivered_to).toContain("sub-a");
    expect(received.length).toBe(1);
  });

  it("R31-2 · skips subscriber not listening for kind", async () => {
    subscribeFeedback("sub-b", ["preservation_regressed"], () => {});
    const r = await broadcastFeedback({
      kind: "coding_loop_verified",
      source: "loop",
      payload: {},
    });
    expect(r.skipped).toContain("sub-b");
    expect(r.delivered_to.length).toBe(0);
  });

  it('R31-3 · "all" subscriber receives every kind', async () => {
    let count = 0;
    subscribeFeedback("all-sub", "all", () => {
      count++;
    });
    await broadcastFeedback({ kind: "test_exit_code_zero", source: "x", payload: {} });
    await broadcastFeedback({ kind: "preservation_regressed", source: "x", payload: {} });
    expect(count).toBe(2);
  });

  it("R31-4 · throwing subscriber is isolated · error captured", async () => {
    subscribeFeedback("thrower", "all", () => {
      throw new Error("boom");
    });
    subscribeFeedback("good", "all", () => {});
    const r = await broadcastFeedback({
      kind: "coding_loop_verified",
      source: "x",
      payload: {},
    });
    expect(r.errors.length).toBe(1);
    expect(r.errors[0].id).toBe("thrower");
    expect(r.delivered_to).toContain("good");
  });

  it("R31-5 · unsubscribe removes listener", async () => {
    let count = 0;
    subscribeFeedback("s", "all", () => {
      count++;
    });
    unsubscribeFeedback("s");
    await broadcastFeedback({
      kind: "coding_loop_verified",
      source: "x",
      payload: {},
    });
    expect(count).toBe(0);
  });

  it("R31-6 · version marker", () => {
    expect(ERROR_BROADCAST_VERSION).toBe("fix31.v1");
  });
});
