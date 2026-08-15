// NEX Mutations · batch (Philip 2026-08-14 · Phase 17B).
//
// Owner instruction can describe multiple changes at once. The batch layer
//   1. splits the instruction into candidate fragments
//   2. interprets each fragment
//   3. validates each proposal (via proposeMutation)
//   4. groups them under a batchId
//   5. requires a single explicit approval → applies each in order
//   6. each resulting audit entry gets `batchId`
//
// Constitutional rule preserved:
//   - If ANY fragment fails to parse, return CLARIFICATION with the specific
//     fragment(s) NEX couldn't understand · do NOT silently drop them.
//   - If ANY proposal fails validation, the whole batch is rejected up-front
//     rather than applying a partial batch.

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import type { PreparedBatch, PreparedProposal, MutationAuditEntry } from "./types";
import { interpret } from "./interpreter";
import { proposeMutation, applyProposedMutation } from "./engine";
import { getProposal, ttlMillis } from "./proposal-store";
import { registerBusiness } from "@/lib/nex/business-context/registry";

const BATCHES = new Map<string, PreparedBatch>();

// ============================================================================
// Fragment split
// ============================================================================

/** Split an owner instruction into candidate sub-instructions.
 *  Heuristics · no LLM. Recognises "and", ";", "\n", ", update", ", change",
 *  ", add", ", set", ", replace", ", make". Aggressive enough to be useful,
 *  conservative enough not to fabricate. */
export function splitInstruction(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  // 1 · newlines + semicolons
  const primary = t.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of primary) {
    // 2 · " and " (safe · number groups like "£5,500" contain no " and ")
    const andParts = part.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
    for (const ap of andParts) {
      // 3 · comma followed by a verb (whitelist-anchored to protect "£24,500")
      const commaParts = ap
        .split(/,\s+(?=(?:change|update|add|set|replace|make|feature|unfeature|remove|delete|adjust|swap|rename|move|switch|toggle|turn)\b)/i)
        .map((s) => s.trim().replace(/^,\s*/, "").replace(/,\s*$/, ""))
        .filter(Boolean);
      for (const cp of commaParts) out.push(cp);
    }
  }
  return out;
}

// ============================================================================
// Batch propose
// ============================================================================

export type ProposeBatchResult =
  | { ok: true; batch: PreparedBatch }
  | { ok: false; error: string; unclearFragments?: string[] };

export function proposeBatch(
  bp: AppBlueprint,
  businessSlug: string,
  ownerInstruction: string
): ProposeBatchResult {
  const fragments = splitInstruction(ownerInstruction);
  if (fragments.length === 0) return { ok: false, error: "empty instruction" };

  const proposals: PreparedProposal[] = [];
  const unclear: string[] = [];
  // Interpret each fragment
  const structuredProposals: Array<{ fragment: string; proposal: ReturnType<typeof interpret> }> = [];
  for (const frag of fragments) {
    structuredProposals.push({ fragment: frag, proposal: interpret(frag) });
  }
  // Any unclear fragment = clarification required (never silent drop)
  for (const sp of structuredProposals) {
    if (!sp.proposal.ok) unclear.push(sp.fragment);
  }
  if (unclear.length > 0) {
    return { ok: false, error: `Some parts of that instruction weren't clear enough to propose`, unclearFragments: unclear };
  }

  // Validate + prepare each individually · running against a WORKING copy of
  // the Blueprint so multi-mutation validation sees the intermediate state.
  let working = bp;
  for (const sp of structuredProposals) {
    if (!sp.proposal.ok) continue; // impossible here · already guarded
    const result = proposeMutation(working, businessSlug, sp.proposal.proposal);
    if (!result.ok) return { ok: false, error: `"${sp.fragment}" — ${result.error}` };
    proposals.push(result.proposal);
    // NOTE: we do NOT mutate `working` here · proposals validate against the
    // original state. Simultaneous mutations that depend on each other are
    // deferred to a later phase.
  }

  const now = Date.now();
  const batch: PreparedBatch = {
    batchId: `batch_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessSlug,
    proposals,
    unclearFragments: [],
    proposedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMillis()).toISOString(),
    requiresApproval: true,
    planDescription: proposals.map((p, i) => `${i + 1}. ${p.describe.split("\n")[0]}`).join("\n")
  };
  BATCHES.set(batch.batchId, batch);
  return { ok: true, batch };
}

export function getBatch(batchId: string): PreparedBatch | null {
  const b = BATCHES.get(batchId);
  if (!b) return null;
  if (Date.parse(b.expiresAt) < Date.now()) { BATCHES.delete(batchId); return null; }
  return b;
}

// ============================================================================
// Batch apply
// ============================================================================

export type ApplyBatchResult =
  | { ok: true; blueprint: AppBlueprint; audits: MutationAuditEntry[] }
  | { ok: false; error: string; partiallyApplied?: MutationAuditEntry[] };

export function applyBatch(
  bp: AppBlueprint,
  batchId: string,
  ownerAccountId: string
): ApplyBatchResult {
  const batch = BATCHES.get(batchId);
  if (!batch) return { ok: false, error: "batch not found or expired" };
  // Consume batch immediately
  BATCHES.delete(batchId);

  let working = bp;
  const audits: MutationAuditEntry[] = [];
  for (const prep of batch.proposals) {
    const res = applyProposedMutation(working, prep.proposalId, ownerAccountId);
    if (!res.ok) {
      return { ok: false, error: res.error, partiallyApplied: audits };
    }
    // Stamp batchId on the audit entry
    res.audit.batchId = batchId;
    audits.push(res.audit);
    working = res.blueprint;
    // Persist intermediate state to business registry so subsequent mutations
    // in the batch see the updated Blueprint (chain mutations correctly).
    registerBusiness(batch.businessSlug, working);
  }
  return { ok: true, blueprint: working, audits };
}

export function _resetBatchesForTest(): void {
  BATCHES.clear();
}
