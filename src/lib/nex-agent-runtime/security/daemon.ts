// WO-NEX-RUNTIME-06 · Security agent daemon.
//
// Founder-locked 2026-09-13. Independent OS process. Own Ed25519 keypair
// distinct from NEX1 · NEX2 · NEX3. Reviews proposals for security
// threats. Never modifies files. Never signs founder authority.

import { getStorage } from "@/lib/nex/storage/registry";
import { createOrLoadIdentity, type AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { makeAgentDaemon, type AgentDaemonHandle } from "@/lib/nex-agent-runtime/process/daemon";
import { AGENT_IDENTITY_COLLECTION, type AgentIdentityRecord } from "@/lib/nex-agent-runtime/process/types";
import { loadAllProposals } from "@/lib/nex-cap/nex1-engineer";
import { securityReviewProposal } from "./review";
import { SECURITY_VETO_COLLECTION, type SecurityVetoRecord } from "./types";

export interface SecurityDaemonSpec {
  readonly agent_id?: string;
  readonly repoRoot: string;
  readonly heartbeat_interval_ms?: number;
  readonly max_reviews_per_tick?: number;
  readonly _test_unref_heartbeat?: boolean;
}

export interface SecurityTickResult {
  readonly kind: "idle" | "reviewed" | "errored";
  readonly reviews_produced: number;
  readonly detail: string;
}

export async function startSecurityDaemon(spec: SecurityDaemonSpec): Promise<{
  handle: AgentDaemonHandle;
  identity: AgentIdentity;
  tick: () => Promise<SecurityTickResult>;
  stop: () => Promise<void>;
}> {
  const agent_id = spec.agent_id ?? "security";
  const maxPerTick = spec.max_reviews_per_tick ?? 10;

  const idResult = await createOrLoadIdentity({ repoRoot: spec.repoRoot, agent_id });
  if (!idResult.ok) throw new Error(`security identity load failed: ${idResult.reason_code} · ${idResult.reason}`);
  const identity = idResult.identity;

  // Defence in depth: Security's keypair must not match any other agent's
  const otherIds = await getStorage().query<AgentIdentityRecord>(AGENT_IDENTITY_COLLECTION, { limit: 500 }).catch(() => []);
  for (const other of otherIds) {
    if (other.agent_id !== agent_id && other.public_key_der_hex === identity.public_key_der_hex) {
      throw new Error(`security identity keypair matches agent "${other.agent_id}" · that would collapse veto independence · refusing to start`);
    }
  }

  const handle = await makeAgentDaemon({
    agent_id, repoRoot: spec.repoRoot,
    heartbeat_interval_ms: spec.heartbeat_interval_ms ?? 5_000,
    _test_unref_heartbeat: spec._test_unref_heartbeat,
    onMission: async () => ({ kind: "COMPLETED", detail: "security uses tick() not receiveMission" }),
  });

  const tick = async (): Promise<SecurityTickResult> => {
    try {
      const proposals = await loadAllProposals();
      const recent = proposals.slice(0, 200);
      if (recent.length === 0) return { kind: "idle", reviews_produced: 0, detail: "no proposals" };

      // Which proposals has Security already vetoed?
      const reviewedIds = new Set<string>();
      for (const p of recent) {
        const rows = await getStorage().query<SecurityVetoRecord>(SECURITY_VETO_COLLECTION, {
          where: { proposal_id: p.proposal_id, reviewed_by_agent_id: agent_id }, limit: 1,
        }).catch(() => [] as SecurityVetoRecord[]);
        if (rows.length > 0) reviewedIds.add(p.proposal_id);
      }
      const todo = recent.filter((p) => !reviewedIds.has(p.proposal_id)).slice(0, maxPerTick);
      if (todo.length === 0) return { kind: "idle", reviews_produced: 0, detail: "no unreviewed proposals" };

      let count = 0;
      for (const p of todo) {
        try {
          await securityReviewProposal({ identity, instance_id: handle.instance_id, proposal_id: p.proposal_id });
          count++;
        } catch { /* individual failure · continue */ }
      }
      return { kind: "reviewed", reviews_produced: count, detail: `Security produced ${count} veto record(s)` };
    } catch (e) {
      return { kind: "errored", reviews_produced: 0, detail: (e as Error).message };
    }
  };

  return { handle, identity, tick, stop: handle.stop };
}
