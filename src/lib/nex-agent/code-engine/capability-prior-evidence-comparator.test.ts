// src/lib/nex-agent/code-engine/capability-prior-evidence-comparator.test.ts
//
// NEX1 · Fix 30B · Prior-Evidence Comparator · Unit Tests.
// Deterministic. Zero I/O. Every branch of PriorRelationship exercised
// with fixtures. R11-B marker asserted on every result.

import { describe, it, expect } from "vitest";
import {
  comparePriorToCurrent,
  signatureFor,
  PRIOR_EVIDENCE_COMPARATOR_VERSION,
} from "./capability-prior-evidence-comparator";
import type { InvestigationConclusionEntry } from "./investigation-conclusion-store";

const TARGET = "src/lib/nex1-fix24-fixtures/s1-niladic.ts";

function makeEntry(
  overrides: Partial<InvestigationConclusionEntry>,
): InvestigationConclusionEntry {
  return {
    entry_id: "e-" + Math.random().toString(36).slice(2, 10),
    timestamp: "2026-09-18T00:00:00Z",
    investigation_id: "inv-1",
    trace_id: "tr-1",
    source_file: TARGET,
    selection_state: "SELECTED",
    selected_candidate: `${TARGET}::3`,
    candidates_considered: [`${TARGET}::3`],
    rankings_reference: {
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
      source_file: TARGET,
    },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "test fixture",
    confidence: 0.35,
    provenance: [{ source_file: TARGET, start_line: 1, end_line: 1 }],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
    ...overrides,
  };
}

describe("comparePriorToCurrent (Fix 30B)", () => {
  it("returns NO_PRIOR when no priors supplied", () => {
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [],
    });
    expect(r.relationship).toBe("NO_PRIOR");
    expect(r.matched_prior_entry_id).toBe(null);
    expect(r.r11b_marker).toBe(
      "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    );
    expect(r.evidence_kind).toBe("INFERRED");
  });

  it("returns PRIOR_UNRELATED when no prior matches the source_file", () => {
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [makeEntry({ source_file: "src/other/file.ts" })],
    });
    expect(r.relationship).toBe("PRIOR_UNRELATED");
    expect(r.matched_prior_entry_id).toBe(null);
  });

  it("returns PRIOR_MATCHES_CURRENT when SELECTED signature agrees", () => {
    const sig = signatureFor(TARGET, 3);
    const entry = makeEntry({
      selection_state: "SELECTED",
      selected_candidate: sig,
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: sig,
      priors: [entry],
    });
    expect(r.relationship).toBe("PRIOR_MATCHES_CURRENT");
    expect(r.matched_prior_entry_id).toBe(entry.entry_id);
    expect(r.prior_signature).toBe(sig);
  });

  it("returns PRIOR_CONFLICTS_CURRENT when SELECTED signature diverges", () => {
    const currentSig = signatureFor(TARGET, 3);
    const priorSig = signatureFor(TARGET, 99);
    const entry = makeEntry({
      selection_state: "SELECTED",
      selected_candidate: priorSig,
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: currentSig,
      priors: [entry],
    });
    expect(r.relationship).toBe("PRIOR_CONFLICTS_CURRENT");
    expect(r.matched_prior_entry_id).toBe(entry.entry_id);
    expect(r.current_signature).toBe(currentSig);
    expect(r.prior_signature).toBe(priorSig);
  });

  it("returns PRIOR_UNRESOLVED_SAME_FILE for TIE", () => {
    const entry = makeEntry({
      selection_state: "TIE",
      selected_candidate: null,
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    expect(r.relationship).toBe("PRIOR_UNRESOLVED_SAME_FILE");
    expect(r.matched_prior_entry_id).toBe(entry.entry_id);
  });

  it("returns PRIOR_UNRESOLVED_SAME_FILE for INSUFFICIENT_EVIDENCE", () => {
    const entry = makeEntry({
      selection_state: "INSUFFICIENT_EVIDENCE",
      selected_candidate: null,
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    expect(r.relationship).toBe("PRIOR_UNRESOLVED_SAME_FILE");
  });

  it("returns PRIOR_UNRESOLVED_SAME_FILE for REQUIRE_MORE_INVESTIGATION", () => {
    const entry = makeEntry({
      selection_state: "REQUIRE_MORE_INVESTIGATION",
      selected_candidate: null,
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    expect(r.relationship).toBe("PRIOR_UNRESOLVED_SAME_FILE");
  });

  it("returns PRIOR_UNRESOLVED_SAME_FILE for NO_SELECTION", () => {
    const entry = makeEntry({
      selection_state: "NO_SELECTION",
      selected_candidate: null,
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    expect(r.relationship).toBe("PRIOR_UNRESOLVED_SAME_FILE");
  });

  it("returns PRIOR_INFORMATIONAL_ONLY when prior SELECTED but signature not structurally comparable", () => {
    const entry = makeEntry({
      selection_state: "SELECTED",
      selected_candidate: "cand-arbitrary-abcxyz",
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    expect(r.relationship).toBe("PRIOR_INFORMATIONAL_ONLY");
  });

  it("uses the MOST RECENT same-file prior (caller supplies DESC order)", () => {
    const older = makeEntry({
      entry_id: "older",
      selection_state: "SELECTED",
      selected_candidate: signatureFor(TARGET, 3),
      timestamp: "2026-09-01T00:00:00Z",
    });
    const newer = makeEntry({
      entry_id: "newer",
      selection_state: "TIE",
      selected_candidate: null,
      timestamp: "2026-09-18T00:00:00Z",
    });
    // Caller supplies DESC (newer first).
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [newer, older],
    });
    expect(r.relationship).toBe("PRIOR_UNRESOLVED_SAME_FILE");
    expect(r.matched_prior_entry_id).toBe("newer");
  });

  it("is deterministic — same input produces same output twice", () => {
    const entry = makeEntry({
      selection_state: "SELECTED",
      selected_candidate: signatureFor(TARGET, 99),
    });
    const r1 = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    const r2 = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    expect(r1).toEqual(r2);
  });

  it("does NOT treat SELECTED as universal accept — same label can produce different relationship depending on signature", () => {
    const sig = signatureFor(TARGET, 3);
    const matching = makeEntry({
      selection_state: "SELECTED",
      selected_candidate: sig,
    });
    const conflicting = makeEntry({
      selection_state: "SELECTED",
      selected_candidate: signatureFor(TARGET, 99),
    });
    const rMatch = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: sig,
      priors: [matching],
    });
    const rConflict = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: sig,
      priors: [conflicting],
    });
    expect(rMatch.relationship).toBe("PRIOR_MATCHES_CURRENT");
    expect(rConflict.relationship).toBe("PRIOR_CONFLICTS_CURRENT");
  });

  it("does NOT treat TIE as universal refuse — TIE returns UNRESOLVED, not CONFLICT", () => {
    const entry = makeEntry({
      selection_state: "TIE",
      selected_candidate: null,
    });
    const r = comparePriorToCurrent({
      current_source_file: TARGET,
      current_candidate_signature: signatureFor(TARGET, 3),
      priors: [entry],
    });
    expect(r.relationship).not.toBe("PRIOR_CONFLICTS_CURRENT");
    expect(r.relationship).toBe("PRIOR_UNRESOLVED_SAME_FILE");
  });

  it("R11-B marker present on every result", () => {
    const cases: InvestigationConclusionEntry[][] = [
      [],
      [makeEntry({})],
      [makeEntry({ source_file: "unrelated/file.ts" })],
      [makeEntry({ selection_state: "TIE", selected_candidate: null })],
      [makeEntry({ selected_candidate: "cand-arbitrary" })],
    ];
    for (const priors of cases) {
      const r = comparePriorToCurrent({
        current_source_file: TARGET,
        current_candidate_signature: signatureFor(TARGET, 3),
        priors,
      });
      expect(r.r11b_marker).toBe(
        "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
      );
      expect(r.evidence_kind).toBe("INFERRED");
    }
  });

  it("exports version tag", () => {
    expect(PRIOR_EVIDENCE_COMPARATOR_VERSION).toBe("fix30b.v1");
  });
});

describe("signatureFor", () => {
  it("produces path::value format", () => {
    expect(signatureFor("src/foo.ts", 3)).toBe("src/foo.ts::3");
    expect(signatureFor("src/foo.ts", "abc")).toBe("src/foo.ts::abc");
    expect(signatureFor("src/foo.ts", true)).toBe("src/foo.ts::true");
  });
  it("handles null and undefined by emitting empty value", () => {
    expect(signatureFor("src/foo.ts", null)).toBe("src/foo.ts::");
    expect(signatureFor("src/foo.ts", undefined)).toBe("src/foo.ts::");
  });
});
