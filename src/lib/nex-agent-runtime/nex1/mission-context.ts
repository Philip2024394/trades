// WO-NEX-RUNTIME-03 · mission context chain builder.
//
// Founder-locked 2026-09-13. Every mission NEX1 processes produces a
// reconstructible audit chain so NEX2 (later) can ask "why did NEX1
// propose this change?" and get an evidence-backed answer, not a
// prompt string.

import { randomUUID, sign as ed25519Sign } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import {
  type MissionContextChain,
  type MissionChainLink,
  NEX1_MISSION_CONTEXT_COLLECTION,
} from "./types";

function canonicaliseChain(chain: Omit<MissionContextChain, "signature_hex">): Buffer {
  const ordered = {
    record_type: chain.record_type,
    context_id: chain.context_id,
    agent_id: chain.agent_id,
    instance_id: chain.instance_id,
    mission_id: chain.mission_id,
    observations: chain.observations.map((o) => ({ at: o.at, kind: o.kind, detail: o.detail, evidence_ref: o.evidence_ref })),
    knowledge_used: chain.knowledge_used.map((o) => ({ at: o.at, kind: o.kind, detail: o.detail, evidence_ref: o.evidence_ref })),
    analysis: chain.analysis.map((o) => ({ at: o.at, kind: o.kind, detail: o.detail, evidence_ref: o.evidence_ref })),
    files_considered: [...chain.files_considered].sort(),
    tests_considered: [...chain.tests_considered].sort(),
    proposed_solution: chain.proposed_solution ? { at: chain.proposed_solution.at, kind: chain.proposed_solution.kind, detail: chain.proposed_solution.detail, evidence_ref: chain.proposed_solution.evidence_ref } : null,
    evidence_refs: [...chain.evidence_refs],
    handoff: chain.handoff,
    started_at: chain.started_at,
    closed_at: chain.closed_at,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

/** In-memory builder that accumulates chain links as NEX1 processes a
 *  mission. `.close()` persists the signed chain and returns it. */
export class MissionContextBuilder {
  private observations: MissionChainLink[] = [];
  private knowledge_used: MissionChainLink[] = [];
  private analysis: MissionChainLink[] = [];
  private files_considered = new Set<string>();
  private tests_considered = new Set<string>();
  private proposed_solution: MissionChainLink | null = null;
  private evidence_refs: string[] = [];
  private closed = false;
  private readonly context_id: string;
  private readonly started_at: string;

  constructor(
    private readonly identity: AgentIdentity,
    private readonly instance_id: string,
    private readonly mission_id: string,
  ) {
    this.context_id = `CTX-${identity.agent_id}-${mission_id}-${randomUUID().slice(0, 8)}`;
    this.started_at = new Date().toISOString();
  }

  observe(kind: string, detail: string, evidence_ref: string | null = null): void {
    this.observations.push({ at: new Date().toISOString(), kind, detail, evidence_ref });
  }
  useKnowledge(kind: string, detail: string, evidence_ref: string | null = null): void {
    this.knowledge_used.push({ at: new Date().toISOString(), kind, detail, evidence_ref });
  }
  addAnalysis(kind: string, detail: string, evidence_ref: string | null = null): void {
    this.analysis.push({ at: new Date().toISOString(), kind, detail, evidence_ref });
  }
  fileConsidered(path: string): void { this.files_considered.add(path); }
  testConsidered(target: string): void { this.tests_considered.add(target); }
  addEvidence(evidence_ref: string): void { this.evidence_refs.push(evidence_ref); }
  setProposedSolution(detail: string, evidence_ref: string | null = null): void {
    this.proposed_solution = { at: new Date().toISOString(), kind: "proposed_solution", detail, evidence_ref };
  }

  async close(handoff: MissionContextChain["handoff"]): Promise<MissionContextChain> {
    if (this.closed) throw new Error("MissionContextBuilder already closed");
    this.closed = true;
    const base = {
      record_type: "NEX1_MISSION_CONTEXT_CHAIN" as const,
      context_id: this.context_id,
      agent_id: this.identity.agent_id,
      instance_id: this.instance_id,
      mission_id: this.mission_id,
      observations: Object.freeze([...this.observations]) as readonly MissionChainLink[],
      knowledge_used: Object.freeze([...this.knowledge_used]) as readonly MissionChainLink[],
      analysis: Object.freeze([...this.analysis]) as readonly MissionChainLink[],
      files_considered: Object.freeze([...this.files_considered]) as readonly string[],
      tests_considered: Object.freeze([...this.tests_considered]) as readonly string[],
      proposed_solution: this.proposed_solution,
      evidence_refs: Object.freeze([...this.evidence_refs]) as readonly string[],
      handoff,
      started_at: this.started_at,
      closed_at: new Date().toISOString(),
    };
    const sig = ed25519Sign(null, canonicaliseChain(base), this.identity.private).toString("hex");
    const chain: MissionContextChain = { ...base, signature_hex: sig };
    await getStorage().save(NEX1_MISSION_CONTEXT_COLLECTION, chain);
    return chain;
  }
}

// ── Read ───────────────────────────────────────────────────────────────

export async function loadMissionContextChain(mission_id: string): Promise<MissionContextChain | null> {
  const rows = await getStorage().query<MissionContextChain>(NEX1_MISSION_CONTEXT_COLLECTION, {
    where: { mission_id }, limit: 20, order_by: "closed_at", order_dir: "desc",
  }).catch(() => [] as MissionContextChain[]);
  return rows[0] ?? null;
}
