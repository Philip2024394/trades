// NEX Mutations · proposal store (Philip 2026-08-14).
//
// Holds prepared proposals in-flight between propose() and apply().
// Proposals expire after PROPOSAL_TTL_MS · dev = 5 min.
// The apply endpoint refuses expired proposals · owner must re-propose.

import type { PreparedProposal } from "./types";

const PROPOSAL_TTL_MS = 5 * 60 * 1000;

const STORE = new Map<string, PreparedProposal>();

export function storeProposal(p: PreparedProposal): void {
  STORE.set(p.proposalId, p);
  // Expire cleanup (best-effort · not a security boundary)
  setTimeout(() => STORE.delete(p.proposalId), PROPOSAL_TTL_MS + 1000);
}

export function getProposal(proposalId: string): PreparedProposal | null {
  const p = STORE.get(proposalId);
  if (!p) return null;
  if (Date.parse(p.expiresAt) < Date.now()) {
    STORE.delete(proposalId);
    return null;
  }
  return p;
}

export function consumeProposal(proposalId: string): PreparedProposal | null {
  const p = getProposal(proposalId);
  if (p) STORE.delete(proposalId);
  return p;
}

export function ttlMillis(): number { return PROPOSAL_TTL_MS; }

export function _resetProposalsForTest(): void {
  STORE.clear();
}
