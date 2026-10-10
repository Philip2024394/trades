// src/lib/nex/master-ai/known-nex-designations.ts
//
// Founder-authorised 2026-09-16 · NEX designation family · founding record.
//
// Governance rule (from agent-designation.ts):
//   Identity first → evidence → capability → maturity.
//
// This file holds the CURRENT known designation state. It is a snapshot,
// not a persistent registry — future persistence to append-only JSONL is a
// separate architectural concern.
//
// Only OFFICIAL designations may claim public NEX-nn identity in NEX outputs.
// PROPOSED designations exist for governance transparency but MUST NOT be
// represented to users as official NEX identities.

import type { Nex1AgentDesignation } from "./agent-designation";

const FOUNDING_ISO = "2026-09-16T00:00:00.000Z";

// ─── NEX-01 · Native Code Intelligence · OFFICIAL ────────────────────────────
//
// The founding designation. Historically known as "NEX1" — the code brain
// that lives at src/lib/nex-agent/**. Predates the doctrine, so the founder
// is recorded as both proposer and approver on the same day the doctrine
// was written.

export const NEX_01_DESIGNATION: Nex1AgentDesignation = Object.freeze({
  agent_id: "nex1_code_intelligence",
  status: "OFFICIAL",
  proposed_number: "NEX-01",
  official_number: "NEX-01",
  proposed_purpose: "Native Code Intelligence · engineering brain · deterministic zero-LLM programming intelligence",
  proposed_by: "founder",
  proposed_at_iso: FOUNDING_ISO,
  approved_by: "founder",
  approved_at_iso: FOUNDING_ISO,
  rejected_reason: null,
  relationships: [],
  taught_by: "master_ai_engineer",
});

// ─── NEX-02 · Context Intelligence · PROPOSED ────────────────────────────────
//
// Proposed 2026-09-16 in response to Section 8 audit findings. NEX1's audit
// discovered a system-level defect pattern: token-only classification across
// four extractors (VERB / DELIVERABLE / REQUIREMENT / CONCEPT). Founder
// directed: build a reusable deterministic Context Evidence Gate rather than
// patching four defects independently. That reusable gate is the candidate
// for NEX-02.
//
// STATUS RULES (per founder governance):
//   - Currently PROPOSED. Not yet OFFICIAL.
//   - MUST NOT claim to be NEX-02 in any NEX output until founder approves.
//   - NI status is UNKNOWN until implementation proves it (via intelligence-status.ts).
//   - The intelligence_status axis is INDEPENDENT of this designation.
//
// Evidence backing this proposal (as of registration):
//   - Section 8 audit probes (54 real classifier runs) confirmed context-blindness
//   - Documented at docs/doctrine/nex-safety-doctrine.md (future §12) + memory
//   - Alpha.4 already shipped one instance (isPathVerbTerminal for path detection);
//     the CEG is the generalisation.

export const NEX_02_DESIGNATION: Nex1AgentDesignation = Object.freeze({
  agent_id: "nex2_context_intelligence",
  status: "PROPOSED",
  proposed_number: "NEX-02",
  official_number: null,
  proposed_purpose: "Context Intelligence · reusable deterministic context-evidence gate for classifier decisions (verb/deliverable/requirement/concept)",
  proposed_by: "nex1",
  proposed_at_iso: FOUNDING_ISO,
  approved_by: null,
  approved_at_iso: null,
  rejected_reason: null,
  relationships: [
    { to_designation: "NEX-01", relationship_kind: "extends" }, // NEX-02 extends NEX-01's classifier
  ],
  taught_by: "master_ai_engineer",
});

// ─── Registry of known designations ─────────────────────────────────────────
//
// Keyed by NEX number (the human-facing identity). Contains ALL known
// designations regardless of status so number-conflict checks work correctly.

export const NEX_DESIGNATION_FAMILY: ReadonlyMap<string, Nex1AgentDesignation> = new Map([
  ["NEX-01", NEX_01_DESIGNATION],
  ["NEX-02", NEX_02_DESIGNATION],
]);

/**
 * Return only designations with status=OFFICIAL. These are the ones that may
 * be represented in NEX outputs as official identities.
 */
export function officialDesignations(): readonly Nex1AgentDesignation[] {
  return Array.from(NEX_DESIGNATION_FAMILY.values()).filter((d) => d.status === "OFFICIAL");
}

/**
 * Return all designations regardless of status (governance view).
 */
export function allKnownDesignations(): readonly Nex1AgentDesignation[] {
  return Array.from(NEX_DESIGNATION_FAMILY.values());
}
