// src/lib/nex-lab/engine.ts
// NEX Engineering Evolution LAB · v0.2.0 pipeline skeleton.
// Discovery only. Never mutates NEX1. Never self-promotes.

import { sha256Prefix, newId } from "@/lib/nex-specialist-common/helpers";

export type LabState = "DISCOVERED" | "EVIDENCE_GATHERED" | "EXPERIMENT_COMPLETE" | "AWAITING_NEX2" | "AWAITING_NEX3" | "AWAITING_FOUNDER" | "ADMITTED_TO_STANDARDS_FEED" | "REJECTED";

export interface LabCandidate {
  readonly candidate_id: string;
  readonly title: string;
  readonly state: LabState;
  readonly discovered_at: string;
  readonly research_ref?: string;
  readonly cited_evidence_ids: readonly string[];
  readonly authorisation: false;
  readonly execution: false;
}

const REGISTRY: LabCandidate[] = [];

export function registerCandidate(title: string, research_ref?: string): LabCandidate {
  const c: LabCandidate = {
    candidate_id: newId("LAB"),
    title, state: "DISCOVERED",
    discovered_at: new Date().toISOString(),
    research_ref, cited_evidence_ids: [],
    authorisation: false, execution: false,
  };
  REGISTRY.push(c);
  return c;
}

export function listCandidates(): readonly LabCandidate[] { return REGISTRY.slice(); }
export function clearLabForTests(): void { REGISTRY.length = 0; }

export function transition(candidate_id: string, next: LabState, evidence_ids?: readonly string[]): LabCandidate | null {
  const idx = REGISTRY.findIndex((c) => c.candidate_id === candidate_id);
  if (idx === -1) return null;
  const current = REGISTRY[idx];
  // Enforce forward-only lifecycle · never allow direct jump to ADMITTED without going through the full chain
  const order: LabState[] = ["DISCOVERED","EVIDENCE_GATHERED","EXPERIMENT_COMPLETE","AWAITING_NEX2","AWAITING_NEX3","AWAITING_FOUNDER","ADMITTED_TO_STANDARDS_FEED"];
  if (next === "REJECTED") {
    const updated = { ...current, state: next };
    REGISTRY[idx] = updated; return updated;
  }
  const currentIdx = order.indexOf(current.state);
  const nextIdx = order.indexOf(next);
  if (nextIdx <= currentIdx) return null;             // no backwards transition
  if (nextIdx > currentIdx + 1) return null;          // no skipping stages
  const updated: LabCandidate = { ...current, state: next, cited_evidence_ids: evidence_ids ?? current.cited_evidence_ids };
  REGISTRY[idx] = updated;
  return updated;
}

export function labIntegrityHash(): string {
  return sha256Prefix(REGISTRY.map((c) => c.candidate_id + ":" + c.state).sort().join("|"));
}
