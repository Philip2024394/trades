// src/lib/nex-standards-feed/engine.ts
// NEX Standards Feed · append-only · founder-authorised admission only.
// v0.2.0 controller.

import { sha256Prefix, newId, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type StandardState = "PROPOSED" | "APPROVED" | "SUPERSEDED" | "DEPRECATED" | "REJECTED";

export interface ApprovedStandard {
  readonly standard_id: string;
  readonly title: string;
  readonly state: StandardState;
  readonly version: string;
  readonly authored_by: string;                     // founder identity
  readonly authored_at: string;
  readonly scope: string;
  readonly applicability: readonly string[];
  readonly exclusion_list: readonly string[];
  readonly cited_evidence_ids: readonly string[];   // AuthoritativeEvidenceRecord ids
  readonly arbitration_id: string;                  // NEX3 arbitration id
  readonly rollback_reference: string;
  readonly provenance_chain: readonly string[];     // ordered list: specialist → validation → NEX2 → NEX3 → founder
  readonly founder_authorisation_token: string;
}

export type AdmitResult = { readonly admitted: true; readonly standard: ApprovedStandard } | { readonly admitted: false; readonly reason: string };

const FEED: ApprovedStandard[] = [];  // in-memory · v0.2.0 · deliberately not persisted (founder-authorised follow-up for persistence)
const guard = makeForbiddenVocabGuard();

function validateProposal(std: ApprovedStandard): string | null {
  if (!std.standard_id) return "standard_id missing";
  if (!std.title) return "title missing";
  if (!std.arbitration_id) return "arbitration_id missing · NEX3 arbitration required";
  if (!std.founder_authorisation_token) return "founder_authorisation_token missing";
  if (std.cited_evidence_ids.length === 0) return "cited_evidence_ids empty · must reference AuthoritativeEvidenceRecord ids";
  if (!std.rollback_reference) return "rollback_reference missing · every standard must be reversible";
  if (!std.provenance_chain.includes("nex2") || !std.provenance_chain.includes("nex3") || !std.provenance_chain.includes("founder")) return "provenance_chain must include nex2 · nex3 · founder";
  const chk = guard.walkForForbiddenVocab(std);
  if (chk.hit) return `forbidden vocabulary "${chk.word}" at ${chk.where}`;
  return null;
}

export function admitStandard(std: ApprovedStandard): AdmitResult {
  const err = validateProposal(std);
  if (err) return { admitted: false, reason: err };
  // Append-only enforcement · existing APPROVED entries are never mutated
  const existing = FEED.find((s) => s.standard_id === std.standard_id);
  if (existing && existing.state === "APPROVED") return { admitted: false, reason: `standard_id ${std.standard_id} already APPROVED · admission blocked · use a NEW standard_id for SUPERSEDED entries` };
  FEED.push(std);
  return { admitted: true, standard: std };
}

export function listStandards(): readonly ApprovedStandard[] { return FEED.slice(); }
export function clearFeedForTests(): void { FEED.length = 0; }

// Deterministic feed hash for reproducibility
export function feedIntegrityHash(): string {
  return sha256Prefix(FEED.map((s) => s.standard_id + ":" + s.state + ":" + s.version).sort().join("|"));
}
