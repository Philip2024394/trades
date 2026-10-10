// WO-NEX-RUNTIME-05 · NEX3 daemon composition.
//
// Founder-locked 2026-09-13. Own OS process · own Ed25519 keypair
// distinct from NEX1 AND NEX2 · scans NEX2 reviews for verdicts that
// indicate conflict, and arbitrates.

import { getStorage } from "@/lib/nex/storage/registry";
import { createOrLoadIdentity, type AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { makeAgentDaemon, type AgentDaemonHandle } from "@/lib/nex-agent-runtime/process/daemon";
import { AGENT_IDENTITY_COLLECTION, type AgentIdentityRecord } from "@/lib/nex-agent-runtime/process/types";
import { NEX2_REVIEW_COLLECTION, type Nex2ReviewRecord } from "@/lib/nex-agent-runtime/nex2/types";
import { nex3ArbitrateProposal } from "./arbitration";
import { NEX3_ARBITRATION_COLLECTION, type Nex3ArbitrationRecord } from "./types";

export interface Nex3DaemonSpec {
  readonly agent_id?: string;                       // default "nex3"
  readonly repoRoot: string;
  readonly heartbeat_interval_ms?: number;
  readonly max_arbitrations_per_tick?: number;      // default 5
  readonly _test_unref_heartbeat?: boolean;
}

export interface Nex3TickResult {
  readonly kind: "idle" | "arbitrated" | "errored";
  readonly arbitrations_produced: number;
  readonly detail: string;
}

/** NEX3 only arbitrates when NEX2's verdict indicates a real conflict.
 *  These are the verdicts that require NEX3 attention. */
const CONFLICT_VERDICTS: ReadonlySet<Nex2ReviewRecord["verdict"]> = new Set([
  "REJECTED_UNSAFE",
  "REJECTED_INCOMPLETE_EVIDENCE",
  "CONFLICT_WITH_NEX1",
]);

export async function startNex3Daemon(spec: Nex3DaemonSpec): Promise<{
  handle: AgentDaemonHandle;
  identity: AgentIdentity;
  tick: () => Promise<Nex3TickResult>;
  stop: () => Promise<void>;
}> {
  const agent_id = spec.agent_id ?? "nex3";
  const maxPerTick = spec.max_arbitrations_per_tick ?? 5;

  const idResult = await createOrLoadIdentity({ repoRoot: spec.repoRoot, agent_id });
  if (!idResult.ok) throw new Error(`nex3 identity load failed: ${idResult.reason_code} · ${idResult.reason}`);
  const identity = idResult.identity;

  // Defence in depth: NEX3's identity keypair MUST NOT match any other
  // published agent identity. This catches stolen/copied keys.
  const otherIds = await getStorage().query<AgentIdentityRecord>(AGENT_IDENTITY_COLLECTION, { limit: 500 }).catch(() => []);
  for (const other of otherIds) {
    if (other.agent_id !== agent_id && other.public_key_der_hex === identity.public_key_der_hex) {
      throw new Error(`nex3 identity keypair matches agent "${other.agent_id}" · that would collapse team independence · refusing to start`);
    }
  }

  const handle = await makeAgentDaemon({
    agent_id, repoRoot: spec.repoRoot,
    heartbeat_interval_ms: spec.heartbeat_interval_ms ?? 5_000,
    _test_unref_heartbeat: spec._test_unref_heartbeat,
    onMission: async () => ({ kind: "COMPLETED", detail: "nex3 uses tick() not receiveMission" }),
  });

  const tick = async (): Promise<Nex3TickResult> => {
    try {
      // Find NEX2 reviews whose verdict indicates conflict AND for which
      // NEX3 has not yet produced an arbitration.
      const recentReviews = await getStorage().query<Nex2ReviewRecord>(NEX2_REVIEW_COLLECTION, {
        limit: 200, order_by: "reviewed_at", order_dir: "desc",
      }).catch(() => [] as Nex2ReviewRecord[]);
      const conflicts = recentReviews.filter((r) => CONFLICT_VERDICTS.has(r.verdict));
      if (conflicts.length === 0) return { kind: "idle", arbitrations_produced: 0, detail: "no conflict reviews" };

      // Which have we already arbitrated?
      const arbitrated = new Set<string>();
      for (const c of conflicts) {
        const priors = await getStorage().query<Nex3ArbitrationRecord>(NEX3_ARBITRATION_COLLECTION, {
          where: { proposal_id: c.proposal_id, arbitrated_by_agent_id: agent_id }, limit: 1,
        }).catch(() => [] as Nex3ArbitrationRecord[]);
        if (priors.length > 0) arbitrated.add(c.proposal_id);
      }
      const todo = conflicts.filter((c) => !arbitrated.has(c.proposal_id)).slice(0, maxPerTick);
      if (todo.length === 0) return { kind: "idle", arbitrations_produced: 0, detail: "no unarbitrated conflicts" };

      let count = 0;
      for (const c of todo) {
        try {
          await nex3ArbitrateProposal({ identity, instance_id: handle.instance_id, proposal_id: c.proposal_id, mission_id: c.mission_id });
          count++;
        } catch { /* continue on individual failure */ }
      }
      return { kind: "arbitrated", arbitrations_produced: count, detail: `NEX3 arbitrated ${count} conflict(s)` };
    } catch (e) {
      return { kind: "errored", arbitrations_produced: 0, detail: (e as Error).message };
    }
  };

  return { handle, identity, tick, stop: handle.stop };
}
