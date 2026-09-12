// src/lib/nex/master-ai/teaching.ts
//
// NEX Master AI Engineer · M7 · Cross-agent teaching · proposal router
// Philip 2026-09-07 · AUTHORIZE
//
// Proposals flow · never silent cross-agent patching:
//   DISCOVER → EVALUATE → PROPOSE → AUTHORIZE → (target-agent slice)
//
// Every proposal starts AWAITING_APPROVAL. Only a founder can
// authorize. Once authorized, Master AI generates a slice-authorization
// prompt for the target agent · Master AI never modifies the target
// agent directly.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { capabilityProposalsPath } from "./paths";
import { getAgent } from "./agent-registry";
import { getCapability } from "./capability-registry";
import type {
  CapabilityProposal,
  ProposalAuthorizationState,
  MasterAgentId,
} from "./types";

export class ProposalPreconditionError extends Error {
  constructor(reason: string) { super(`proposal_precondition:${reason}`); }
}

/** Create a proposal. Preconditions:
 *   · source agent + source capability MUST exist
 *   · target agent MUST exist
 *   · source_agent !== target_agent (cross-agent only) */
export function createProposal(input: {
  source_agent_id: MasterAgentId;
  source_capability_id: string;
  target_agent_id: MasterAgentId;
  proposed_capability_slug: string;
  hypothesis: string;
  evidence_refs: string[];
  benchmark_prediction: string | null;
  created_by: string;
}): CapabilityProposal {
  if (input.source_agent_id === input.target_agent_id) {
    throw new ProposalPreconditionError("cross_agent_only:source_equals_target");
  }
  if (!getAgent(input.source_agent_id)) throw new ProposalPreconditionError(`unknown_source_agent:${input.source_agent_id}`);
  if (!getAgent(input.target_agent_id)) throw new ProposalPreconditionError(`unknown_target_agent:${input.target_agent_id}`);

  const proposal: CapabilityProposal = {
    proposal_id: randomUUID(),
    source_agent_id: input.source_agent_id,
    source_capability_id: input.source_capability_id,
    target_agent_id: input.target_agent_id,
    proposed_capability_slug: input.proposed_capability_slug,
    hypothesis: input.hypothesis,
    evidence_refs: input.evidence_refs,
    benchmark_prediction: input.benchmark_prediction,
    authorization_state: "AWAITING_APPROVAL",
    founder_user_id: null,
    authorization_reason: "created:pending_founder_approval",
    slice_authorization_prompt: null,
    created_at_iso: new Date().toISOString(),
    resolved_at_iso: null,
  };
  appendJsonLine(capabilityProposalsPath(), proposal);
  return proposal;
}

/** Founder authorization gate. Every state change is a NEW record
 *  (append-only · matches Phase F immutable history). */
export function authorizeProposal(input: {
  proposal_id: string;
  founder_user_id: string;
  authorization_reason: string;
}): CapabilityProposal {
  const current = getProposal(input.proposal_id);
  if (!current) throw new ProposalPreconditionError(`unknown_proposal:${input.proposal_id}`);
  if (current.authorization_state !== "AWAITING_APPROVAL") {
    throw new ProposalPreconditionError(`not_awaiting_approval:${current.authorization_state}`);
  }
  const slicePrompt = renderSliceAuthorizationPrompt(current);
  const next: CapabilityProposal = {
    ...current,
    authorization_state: "AUTHORIZED",
    founder_user_id: input.founder_user_id,
    authorization_reason: input.authorization_reason,
    slice_authorization_prompt: slicePrompt,
    resolved_at_iso: new Date().toISOString(),
  };
  appendJsonLine(capabilityProposalsPath(), next);
  return next;
}

export function rejectProposal(input: {
  proposal_id: string;
  founder_user_id: string;
  authorization_reason: string;
}): CapabilityProposal {
  const current = getProposal(input.proposal_id);
  if (!current) throw new ProposalPreconditionError(`unknown_proposal:${input.proposal_id}`);
  const next: CapabilityProposal = {
    ...current,
    authorization_state: "REJECTED",
    founder_user_id: input.founder_user_id,
    authorization_reason: input.authorization_reason,
    resolved_at_iso: new Date().toISOString(),
  };
  appendJsonLine(capabilityProposalsPath(), next);
  return next;
}

function renderSliceAuthorizationPrompt(p: CapabilityProposal): string {
  const source = getAgent(p.source_agent_id);
  const target = getAgent(p.target_agent_id);
  const cap = getCapability(p.source_agent_id, p.proposed_capability_slug);
  return [
    `# NEX CROSS-AGENT CAPABILITY PROPOSAL`,
    `# ${p.proposal_id}`,
    ``,
    `Source agent: ${source?.name ?? p.source_agent_id}`,
    `Source capability: ${cap?.capability_slug ?? p.source_capability_id} (${cap?.version ?? "unknown_version"})`,
    `Target agent: ${target?.name ?? p.target_agent_id}`,
    `Proposed capability slug on target: ${p.proposed_capability_slug}`,
    ``,
    `Hypothesis:`,
    p.hypothesis,
    ``,
    `Evidence refs:`,
    ...p.evidence_refs.map((r) => `  - ${r}`),
    ``,
    `Benchmark prediction: ${p.benchmark_prediction ?? "(none)"}`,
    ``,
    `This proposal is AUTHORIZED for target-agent implementation.`,
    `The target agent must implement the capability through its own`,
    `authorized slice sequence (matching the A0/A1/A2/A3 discipline).`,
    ``,
    `Master AI does NOT modify the target agent directly.`,
  ].join("\n");
}

export function readAllProposalHistory(): CapabilityProposal[] {
  return readJsonlAll<CapabilityProposal>(capabilityProposalsPath());
}

export function getProposal(proposal_id: string): CapabilityProposal | null {
  let latest: CapabilityProposal | null = null;
  for (const p of readAllProposalHistory()) if (p.proposal_id === proposal_id) latest = p;
  return latest;
}

export function listProposals(filter?: { authorization_state?: ProposalAuthorizationState }): CapabilityProposal[] {
  const byId = new Map<string, CapabilityProposal>();
  for (const p of readAllProposalHistory()) byId.set(p.proposal_id, p);
  return Array.from(byId.values())
    .filter((p) => !filter?.authorization_state || p.authorization_state === filter.authorization_state);
}

export function _resetTeachingForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(capabilityProposalsPath())) fs.unlinkSync(capabilityProposalsPath()); } catch { /* ignore */ }
}
