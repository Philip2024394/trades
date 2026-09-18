// src/lib/nex-agent/code-engine/capability-investigation-programming-bridge.ts
//
// NEX1 · Fix 18 · Investigation → Programming Bridge.
// Founder-authorized 2026-09-17 · Fix 18 Gap 3 (bridge from
// InvestigationEvidencePacket to programming-loop input).
//
// PURPOSE
//   Read an InvestigationEvidencePacket and either:
//     (a) produce a TARGET PROPOSAL (candidate file path · evidence)
//         when investigation reached SELECTED or a legitimate SINGLETON,
//     (b) return REQUIRE_MORE_INVESTIGATION with a truthful reason
//         when the packet lacks sufficient certainty.
//
// AUTHORITY BOUNDARY (§10 of Fix 18 authorization)
//   · NEVER invokes runNativeProgrammingLoop
//   · NEVER modifies files
//   · NEVER executes code
//   · NEVER authorizes anything
//   · PRODUCES a proposal · the TEST OPERATOR (human or authorized agent)
//     is responsible for the explicit authorization step
//
// NO HIDDEN TARGET SELECTION (§7 of Fix 18 authorization)
//   · Consumes Q8 candidate_selection if present · does not re-select
//   · If Q8 emitted SELECTED · uses that verbatim
//   · If Q8 emitted TIE / NO_SELECTION / INSUFFICIENT / UNRESOLVED /
//     REQUIRE_MORE_INVESTIGATION → returns REQUIRE_MORE_INVESTIGATION
//   · Falls back to candidate_files ONLY when Q8 selection is empty
//     AND falls back honestly · with explicit "no-Q8-selection" note
//   · Never picks based on filename / candidate_id / array-order
//   · Never picks based on external-model input (there is no LLM here)

import type { InvestigationEvidencePacket } from "./native-investigation-mode";

// ── Public shape ─────────────────────────────────────────────────────────

export type BridgeState =
  | "TARGET_PROPOSED"
  | "REQUIRE_MORE_INVESTIGATION"
  | "NO_INVESTIGATION_DATA";

export interface TargetProposal {
  readonly target_test_file: string;
  readonly target_line: number | null;
  readonly candidate_id: string | null;
  readonly source: "Q8_SELECTED" | "SINGLE_CANDIDATE_FILE" | "TOP_RANKED_CANDIDATE_FILE";
  readonly evidence_summary: {
    readonly matched_concept_tags: readonly string[];
    readonly score: number;
    readonly supporting_evidence_ids: readonly string[];
    readonly contradicting_evidence_ids: readonly string[];
  };
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];
  /** Deterministic templated reason · never natural-language prose. */
  readonly reason: string;
}

export interface BridgeResult {
  readonly ok: true;
  readonly state: BridgeState;
  readonly target_proposal: TargetProposal | null;
  readonly investigation_id: string | null;
  readonly trace_id: string | null;
  readonly original_problem: string | null;
  readonly note: string;
  readonly zero_llm: true;
  readonly authorization_required: true;
  readonly evidence_kind: "INFERRED";
}

export interface BridgeInput {
  readonly packet: InvestigationEvidencePacket;
}

// ── Forbidden causal vocabulary (mirror Fix 13/14/15/16 defence-in-depth) ─
const FORBIDDEN_CAUSAL_TOKENS = [
  "causes",
  "caused by",
  "therefore",
  "root cause is",
  "responsible for",
  "leads to",
  "results in",
  "because",
];

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

// ── Bridge logic ─────────────────────────────────────────────────────────

/** Return the Q8 selection with state === "SELECTED" if any · else null.
 *  Never chooses a candidate arbitrarily · consumes Q8's authoritative
 *  selection verbatim. */
function extractQ8Selected(
  packet: InvestigationEvidencePacket,
): { source_file: string; candidate_id: string; evidenceIds: {
  supporting: readonly string[]; contradicting: readonly string[];
} } | null {
  for (const sel of packet.candidate_selection) {
    if (sel.selection_state === "SELECTED" && sel.selected_candidate !== null) {
      return {
        source_file: sel.source_file,
        candidate_id: sel.selected_candidate,
        evidenceIds: {
          supporting: sel.supporting_evidence_ids,
          contradicting: sel.contradicting_evidence_ids,
        },
      };
    }
  }
  return null;
}

/** Fallback: pick a target from candidate_files when Q8 emitted no SELECTED
 *  AND at least one candidate file exists. Uses deterministic tie-breakers:
 *    (1) highest score
 *    (2) most matched_concept_tags
 *  Never uses filename order · never uses candidate_id order.
 *  Only proposes if the top candidate has a clear score margin OR is unique. */
function extractFallbackCandidate(
  packet: InvestigationEvidencePacket,
): { path: string; score: number; matched: readonly string[]; source: "SINGLE_CANDIDATE_FILE" | "TOP_RANKED_CANDIDATE_FILE" } | null {
  if (packet.candidate_files.length === 0) return null;
  // Sort by (score desc · tag count desc · path asc for stable presentation).
  const sorted = [...packet.candidate_files].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matched_concept_tags.length !== a.matched_concept_tags.length) {
      return b.matched_concept_tags.length - a.matched_concept_tags.length;
    }
    return a.path.localeCompare(b.path);
  });
  const top = sorted[0];
  if (top.score <= 0) return null;
  // Uniqueness / margin check: if there's a second candidate with equal
  // score AND equal tag count · we have TIED-scoring candidates ·
  // refuse to arbitrate.
  if (sorted.length >= 2) {
    const second = sorted[1];
    if (second.score === top.score && second.matched_concept_tags.length === top.matched_concept_tags.length) {
      return null;
    }
  }
  const source = packet.candidate_files.length === 1 ? "SINGLE_CANDIDATE_FILE" : "TOP_RANKED_CANDIDATE_FILE";
  return {
    path: top.path,
    score: top.score,
    matched: top.matched_concept_tags,
    source,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────

export function bridgeInvestigationToProgrammingLoop(
  input: BridgeInput,
): BridgeResult {
  const packet = input.packet;

  // No investigation data at all → cannot bridge
  if (
    packet.candidate_files.length === 0 &&
    packet.candidate_selection.length === 0
  ) {
    return {
      ok: true,
      state: "NO_INVESTIGATION_DATA",
      target_proposal: null,
      investigation_id: packet.investigation_id,
      trace_id: packet.trace_id,
      original_problem: packet.original_problem,
      note: `verdict=${packet.verdict} · no candidate files · no Q8 selections · bridge declines to propose`,
      zero_llm: true,
      authorization_required: true,
      evidence_kind: "INFERRED",
    };
  }

  // Priority 1: consume Q8 SELECTED (authoritative)
  const q8 = extractQ8Selected(packet);
  if (q8 !== null) {
    // Derive target_test_file: candidate_id format is `<source_file>::candidate::<start_line>:<end_line>:<symbol>`.
    // The source_file IS the target · Q7/Q8 scope key. Line info is in candidate_id.
    const parts = q8.candidate_id.split("::");
    const targetLineMatch = parts.length >= 4 ? parts[3]?.split(":")[0] : undefined;
    const targetLine = targetLineMatch ? Number(targetLineMatch) : null;

    const provenance: { source_file: string; start_line: number; end_line: number }[] = [];
    // Collect provenance from the selection record for this source_file
    for (const sel of packet.candidate_selection) {
      if (sel.source_file !== q8.source_file) continue;
      for (const p of sel.provenance) provenance.push(p);
    }

    const reason =
      `Q8 SELECTED candidate ${q8.candidate_id} at ${q8.source_file} · ` +
      `V1 Q8 policy authorized selection · bridge forwards without alteration · ` +
      `authorization step remains external.`;

    // Defence-in-depth: forbidden causal vocab
    if (containsForbiddenCausal(reason) !== null) {
      return {
        ok: true,
        state: "REQUIRE_MORE_INVESTIGATION",
        target_proposal: null,
        investigation_id: packet.investigation_id,
        trace_id: packet.trace_id,
        original_problem: packet.original_problem,
        note: "bridge rejected reason containing causal vocab · declining to propose",
        zero_llm: true,
        authorization_required: true,
        evidence_kind: "INFERRED",
      };
    }

    return {
      ok: true,
      state: "TARGET_PROPOSED",
      target_proposal: {
        target_test_file: q8.source_file,
        target_line: Number.isFinite(targetLine) ? targetLine : null,
        candidate_id: q8.candidate_id,
        source: "Q8_SELECTED",
        evidence_summary: {
          matched_concept_tags: [],
          score: 1.0,
          supporting_evidence_ids: q8.evidenceIds.supporting,
          contradicting_evidence_ids: q8.evidenceIds.contradicting,
        },
        provenance,
        reason,
      },
      investigation_id: packet.investigation_id,
      trace_id: packet.trace_id,
      original_problem: packet.original_problem,
      note: "Q8 selection consumed as authoritative target",
      zero_llm: true,
      authorization_required: true,
      evidence_kind: "INFERRED",
    };
  }

  // Priority 2: Q8 emitted non-SELECTED states (TIE / NO_SELECTION / etc)
  // Preserve honest uncertainty · do NOT invent a target.
  if (packet.candidate_selection.length > 0) {
    const stateSummary = packet.candidate_selection
      .map((s) => `${s.source_file}=${s.selection_state}`)
      .slice(0, 5)
      .join(", ");
    return {
      ok: true,
      state: "REQUIRE_MORE_INVESTIGATION",
      target_proposal: null,
      investigation_id: packet.investigation_id,
      trace_id: packet.trace_id,
      original_problem: packet.original_problem,
      note: `Q8 emitted no SELECTED state for any scope · states=[${stateSummary}] · bridge preserves honest uncertainty per V1 §1`,
      zero_llm: true,
      authorization_required: true,
      evidence_kind: "INFERRED",
    };
  }

  // Priority 3: Fallback via candidate_files (only when Q8 is empty · e.g.
  // Fix 12 did not produce hypotheses · Q8 had nothing to select from).
  // Uses deterministic margin/uniqueness rule · not filename order.
  const fallback = extractFallbackCandidate(packet);
  if (fallback === null) {
    return {
      ok: true,
      state: "REQUIRE_MORE_INVESTIGATION",
      target_proposal: null,
      investigation_id: packet.investigation_id,
      trace_id: packet.trace_id,
      original_problem: packet.original_problem,
      note: `candidate_files present (${packet.candidate_files.length}) but no clear top candidate (score tie or zero score) · bridge preserves uncertainty`,
      zero_llm: true,
      authorization_required: true,
      evidence_kind: "INFERRED",
    };
  }

  const reason =
    `Fallback proposal: ${fallback.path} · matched_tags=[${fallback.matched.slice(0, 5).join(",")}] · ` +
    `score=${fallback.score.toFixed(2)} · source=${fallback.source} · ` +
    `no Q8 selection available · authorization step remains external.`;

  return {
    ok: true,
    state: "TARGET_PROPOSED",
    target_proposal: {
      target_test_file: fallback.path,
      target_line: null,
      candidate_id: null,
      source: fallback.source,
      evidence_summary: {
        matched_concept_tags: fallback.matched,
        score: fallback.score,
        supporting_evidence_ids: [],
        contradicting_evidence_ids: [],
      },
      provenance: [],
      reason,
    },
    investigation_id: packet.investigation_id,
    trace_id: packet.trace_id,
    original_problem: packet.original_problem,
    note: "Q7 candidate_files consumed as fallback · no Q8 authoritative selection · caller responsible for extra scrutiny",
    zero_llm: true,
    authorization_required: true,
    evidence_kind: "INFERRED",
  };
}
