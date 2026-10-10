// WO-NEX-RUNTIME-03 · NEX1 brain.
//
// Founder-locked 2026-09-13.
// "NEX1's brain can propose an engineering solution. The Workstation is
//  still the thing allowed to perform governed mutation."
//
// The brain is deterministic (P-S · no LLM). It:
//   1. reads the mission
//   2. uses read-only tools to observe the repository
//   3. consults NEX1 memory + knowledge
//   4. produces a deterministic analysis
//   5. writes a mission-context chain (auditable "why?")
//   6. optionally creates an UNSIGNED CapEngineeringProposal if the
//      mission has an associated CAP kind supported by the resolver
//
// The brain does NOT:
//   - execute code
//   - modify files
//   - reach the workstation
//   - grant founder authority
//   - contact the Internet

import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import type { EngineeringMission } from "@/lib/nex-runtime-queue/types";
import { loadCap } from "@/lib/nex-cap/registry";
import { nex1EngineerProposeFor } from "@/lib/nex-cap/nex1-engineer";
import { writeMemory } from "./memory";
import { MissionContextBuilder } from "./mission-context";
import {
  toolInspectRepository,
  toolInspectDependencies,
  toolReadFile,
  toolSearchCode,
  toolRunTestsInterface,
  toolRecordEvidence,
  type ToolContext,
} from "./tools";

export interface BrainInput {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly repo_root: string;
  readonly mission: EngineeringMission;
}

export type BrainVerdict =
  | { readonly kind: "PROPOSED_TO_BROKER";        readonly proposal_id: string; readonly context_id: string; readonly detail: string }
  | { readonly kind: "ESCALATED_TO_FOUNDER";      readonly cap_id: string;      readonly context_id: string; readonly detail: string }
  | { readonly kind: "PREPARED_HANDOFF";          readonly context_id: string;  readonly detail: string }
  | { readonly kind: "REFUSED";                   readonly reason: string };

export interface BrainOutput {
  readonly verdict: BrainVerdict;
  readonly evidence_refs: readonly string[];
  readonly context_id: string | null;
}

/**
 * Process one mission. Deterministic. Never mutates protected code.
 * Returns a verdict + evidence chain + audit context id.
 */
export async function nex1BrainProcessMission(input: BrainInput): Promise<BrainOutput> {
  const { identity, instance_id, repo_root, mission } = input;

  // Refuse security-escalate missions — never route through the brain
  if (mission.security_class === "SECURITY_ESCALATION" || mission.security_class === "BLOCKED_FROM_AUTOMATION") {
    return {
      verdict: { kind: "REFUSED", reason: `mission has security_class ${mission.security_class} · founder-only manual resolution · brain refuses` },
      evidence_refs: [],
      context_id: null,
    };
  }

  const chain = new MissionContextBuilder(identity, instance_id, mission.mission_id);
  const evidence: string[] = [];
  const toolCtx: ToolContext = { identity, instance_id, repo_root, mission_id: mission.mission_id };

  // ── 1 · Working-memory record: mission received ──────────────────────
  await writeMemory({
    identity, layer: "WORKING", mission_id: mission.mission_id,
    key: "mission_received", value: { title: mission.title, priority: mission.priority, security_class: mission.security_class },
    kind: "mission_start", provenance: "brain · mission dequeued from RUNTIME-02",
  });
  chain.observe("mission_received", `${mission.priority} · ${mission.title}`);

  // ── 2 · Read-only repository inspection ──────────────────────────────
  const repoRes = await toolInspectRepository(toolCtx);
  if (repoRes.outcome === "ok" && repoRes.value) {
    chain.observe("inspect_repository", `${repoRes.value.top_level.length} top-level entries`, repoRes.invocation_id);
  } else {
    chain.observe("inspect_repository_failed", repoRes.detail, repoRes.invocation_id);
  }
  const depsRes = await toolInspectDependencies(toolCtx);
  if (depsRes.outcome === "ok" && depsRes.value) {
    chain.observe("inspect_dependencies", `${depsRes.value.deps} deps · ${depsRes.value.devDeps} devDeps`, depsRes.invocation_id);
  }

  // ── 3 · Read each affected_path (if present) ─────────────────────────
  for (const p of mission.affected_paths.slice(0, 10)) {
    const r = await toolReadFile(toolCtx, { path: p, max_bytes: 8_000 });
    chain.fileConsidered(p);
    if (r.outcome === "ok" && r.value) {
      chain.observe("read_file", `${p} · ${r.value.bytes} bytes`, r.invocation_id);
    } else {
      chain.observe(r.outcome === "denied" ? "read_file_denied" : "read_file_failed", `${p} · ${r.detail}`, r.invocation_id);
    }
  }

  // ── 4 · If mission targets CAP kind supported by resolver, produce
  //         an UNSIGNED proposal via the existing NEX1-engineer resolver
  //         (deterministic P-S, already tested by WO-CAP-01/02/03) ─────
  if (mission.cap_id) {
    chain.useKnowledge("cap_id", `mission references ${mission.cap_id}`);
    const cap = await loadCap(mission.cap_id);
    if (!cap) {
      chain.addAnalysis("cap_not_found", `CAP ${mission.cap_id} not found in registry`);
      const closed = await chain.close({ to: "NONE", reason: "cap_not_found", proposal_id: null });
      return { verdict: { kind: "REFUSED", reason: "referenced CAP not found in registry" }, evidence_refs: evidence, context_id: closed.context_id };
    }
    chain.addAnalysis("cap_diagnosis_prepared", `CAP kind ${cap.kind} · category ${cap.category} · priority ${cap.priority}`);
    const proposeResult = await nex1EngineerProposeFor(cap);
    if (proposeResult.outcome === "ESCALATE") {
      chain.addAnalysis("resolver_verdict", `ESCALATE · ${proposeResult.reason}`);
      const closed = await chain.close({ to: "FOUNDER_AUTHORIZATION", reason: proposeResult.reason, proposal_id: null });
      return { verdict: { kind: "ESCALATED_TO_FOUNDER", cap_id: cap.cap_id, context_id: closed.context_id, detail: proposeResult.reason }, evidence_refs: evidence, context_id: closed.context_id };
    }
    if (proposeResult.proposal) {
      chain.addAnalysis("resolver_verdict", `${proposeResult.outcome} · unsigned proposal ${proposeResult.proposal.proposal_id}`);
      chain.setProposedSolution(`${proposeResult.proposal.diagnosis} · fix: ${proposeResult.proposal.proposed_fix_summary}`);
      // Record an evidence marker so external verifiers can find it
      const ev = await toolRecordEvidence(toolCtx, {
        kind: "nex1.proposal.drafted",
        payload: {
          proposal_id: proposeResult.proposal.proposal_id,
          cap_id: cap.cap_id,
          resolver_outcome: proposeResult.outcome,
          founder_signature_slot: null,
          note: "RUNTIME-03: unsigned proposal · founder Ed25519 still required · workstation still gates mutation",
        },
      });
      if (ev.outcome === "ok" && ev.value) { evidence.push(ev.value.evidence_id); chain.addEvidence(ev.value.evidence_id); }

      // Also record the proposal in ENGINEERING memory so future missions
      // have a record that NEX1 previously proposed this fix.
      await writeMemory({
        identity, layer: "ENGINEERING",
        key: `proposal_for_${cap.cap_id}`,
        value: { proposal_id: proposeResult.proposal.proposal_id, cap_kind: cap.kind, outcome: proposeResult.outcome },
        kind: "past_proposal",
        provenance: `brain · deterministic resolver for ${cap.kind}`,
      });

      const closed = await chain.close({
        to: "FOUNDER_AUTHORIZATION",
        reason: "proposal drafted · awaits founder Ed25519 signature (Authority Broker gate)",
        proposal_id: proposeResult.proposal.proposal_id,
      });
      return {
        verdict: { kind: "PROPOSED_TO_BROKER", proposal_id: proposeResult.proposal.proposal_id, context_id: closed.context_id, detail: `unsigned proposal drafted for ${cap.cap_id}` },
        evidence_refs: evidence,
        context_id: closed.context_id,
      };
    }
  }

  // ── 5 · Non-CAP mission · record intent for tests + prepare handoff
  //       (RUNTIME-03 does not execute a mutation; a real mutation
  //        path is Workstation territory) ─────────────────────────────
  if (mission.required_capabilities.includes("vitest")) {
    const t = await toolRunTestsInterface(toolCtx, {
      target_globs: mission.affected_paths.length > 0 ? mission.affected_paths : ["src/**/*.test.ts"],
      reason: `NEX1 recorded test-run intent for mission ${mission.mission_id} · workstation will execute later`,
    });
    if (t.outcome === "ok" && t.value) {
      chain.testConsidered(t.value.recorded_intent_id);
      chain.addAnalysis("test_run_intent_recorded", `intent ${t.value.recorded_intent_id}`);
    }
  }

  // Search codebase for related keywords (title-based, limited)
  const searchTerm = mission.title.split(/\s+/).find((w) => w.length > 4);
  if (searchTerm) {
    const s = await toolSearchCode(toolCtx, { pattern: searchTerm, max_matches: 20 });
    if (s.outcome === "ok" && s.value) {
      chain.observe("search_code", `pattern=${searchTerm} · ${s.value.matches.length} matches`, s.invocation_id);
      for (const m of s.value.matches.slice(0, 5)) chain.fileConsidered(m.path);
    }
  }

  const ev = await toolRecordEvidence(toolCtx, {
    kind: "nex1.handoff.prepared",
    payload: {
      mission_id: mission.mission_id,
      note: "RUNTIME-03: analysis + observations recorded · no CAP proposal path applicable · mission awaits founder direction or NEX2 review",
    },
  });
  if (ev.outcome === "ok" && ev.value) { evidence.push(ev.value.evidence_id); chain.addEvidence(ev.value.evidence_id); }

  chain.addAnalysis("prepared_handoff", "no CAP kind mapped · mission analysis recorded for later review");
  const closed = await chain.close({ to: "NONE", reason: "analysis prepared · no proposal drafted", proposal_id: null });
  return {
    verdict: { kind: "PREPARED_HANDOFF", context_id: closed.context_id, detail: "analysis prepared · no autonomous proposal path applicable" },
    evidence_refs: evidence,
    context_id: closed.context_id,
  };
}
