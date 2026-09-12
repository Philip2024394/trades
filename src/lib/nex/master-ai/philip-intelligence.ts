// src/lib/nex/master-ai/philip-intelligence.ts
//
// NEX Master AI Engineer · M9 · Philip intelligence layer
// Philip 2026-09-07 · AUTHORIZE
//
// Structured claim tagging so Philip never sees raw logs. Every claim
// carries: classification (FACT/OBSERVATION/INFERENCE/ESTIMATE/FORECAST/
// SCENARIO/UNKNOWN) + supporting refs + uncertainty note + category.
//
// PRESERVATION:
//   · Read-only output layer · never mutates observation / knowledge /
//     capability records that it summarizes.
//   · Enforces classification via type-guard on write. Unclassified
//     claims REJECTED.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { philipIntelClaimsPath } from "./paths";
import type {
  PhilipIntelClaim,
  ClaimClassification,
  PhilipIntelCategory,
} from "./types";

const VALID_CLASSIFICATIONS: ReadonlySet<ClaimClassification> = new Set([
  "FACT", "OBSERVATION", "INFERENCE", "ESTIMATE", "FORECAST", "SCENARIO", "UNKNOWN",
]);

const VALID_CATEGORIES: ReadonlySet<PhilipIntelCategory> = new Set([
  "COMPARISON", "TREND", "OPPORTUNITY", "RISK",
  "PERFORMANCE_SUMMARY", "AGENT_COMPARISON", "IMPROVEMENT_SUMMARY",
]);

export class InvalidClaimError extends Error {
  constructor(reason: string) { super(`invalid_claim:${reason}`); }
}

/** Emit a Philip-facing intelligence claim. Classification MUST be one
 *  of the 7 canonical values. INFERENCE/ESTIMATE/FORECAST/SCENARIO
 *  claims MUST carry an uncertainty_note (structural rule per doctrine
 *  §14: never present inference as fact). */
export function emitClaim(input: Omit<PhilipIntelClaim, "claim_id" | "created_at_iso">): PhilipIntelClaim {
  if (!VALID_CLASSIFICATIONS.has(input.classification)) {
    throw new InvalidClaimError(`classification:${String(input.classification)}`);
  }
  if (!VALID_CATEGORIES.has(input.category)) {
    throw new InvalidClaimError(`category:${String(input.category)}`);
  }
  if (!input.statement || input.statement.trim().length < 3) {
    throw new InvalidClaimError("statement_too_short");
  }
  const softClassifications: ReadonlySet<ClaimClassification> = new Set(["INFERENCE", "ESTIMATE", "FORECAST", "SCENARIO"]);
  if (softClassifications.has(input.classification) && !input.uncertainty_note) {
    throw new InvalidClaimError(`uncertainty_note_required_for:${input.classification}`);
  }
  if (input.classification === "FACT" && input.supporting_refs.length === 0) {
    throw new InvalidClaimError("fact_requires_supporting_refs");
  }

  const claim: PhilipIntelClaim = {
    ...input,
    claim_id: randomUUID(),
    created_at_iso: new Date().toISOString(),
  };
  appendJsonLine(philipIntelClaimsPath(), claim);
  return claim;
}

export function readAllClaims(): PhilipIntelClaim[] {
  return readJsonlAll<PhilipIntelClaim>(philipIntelClaimsPath());
}

export function listClaims(filter?: {
  classification?: ClaimClassification;
  category?: PhilipIntelCategory;
}): PhilipIntelClaim[] {
  return readAllClaims()
    .filter((c) => !filter?.classification || c.classification === filter.classification)
    .filter((c) => !filter?.category || c.category === filter.category);
}

export function _resetClaimsForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(philipIntelClaimsPath())) fs.unlinkSync(philipIntelClaimsPath()); } catch { /* ignore */ }
}
