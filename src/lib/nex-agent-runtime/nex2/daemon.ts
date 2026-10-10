// WO-NEX-RUNTIME-04 · NEX2 daemon composition.
//
// Founder-locked 2026-09-13. NEX2 is a SEPARATE OS process with its
// own persistent Ed25519 identity, its own memory (implicit via
// signed review records), and its own review reasoning.
//
// It polls the CAP-engineering-proposals collection for proposals
// that have no NEX2 review yet, and produces a signed review record
// for each. It does NOT modify NEX1's outputs.

import { getStorage } from "@/lib/nex/storage/registry";
import { createOrLoadIdentity, type AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { makeAgentDaemon, type AgentDaemonHandle } from "@/lib/nex-agent-runtime/process/daemon";
import { AGENT_IDENTITY_COLLECTION, type AgentIdentityRecord } from "@/lib/nex-agent-runtime/process/types";
import { loadAllProposals } from "@/lib/nex-cap/nex1-engineer";
import { nex2ReviewProposal } from "./review";
import { NEX2_REVIEW_COLLECTION, type Nex2ReviewRecord } from "./types";

export interface Nex2DaemonSpec {
  readonly agent_id?: string;                       // default "nex2"
  readonly repoRoot: string;
  readonly heartbeat_interval_ms?: number;
  readonly max_reviews_per_tick?: number;           // default 5
  readonly _test_unref_heartbeat?: boolean;
}

export interface Nex2TickResult {
  readonly kind: "idle" | "reviewed" | "errored";
  readonly reviews_produced: number;
  readonly detail: string;
}

export async function startNex2Daemon(spec: Nex2DaemonSpec): Promise<{
  handle: AgentDaemonHandle;
  identity: AgentIdentity;
  tick: () => Promise<Nex2TickResult>;
  stop: () => Promise<void>;
}> {
  const agent_id = spec.agent_id ?? "nex2";
  const maxPerTick = spec.max_reviews_per_tick ?? 5;

  const idResult = await createOrLoadIdentity({ repoRoot: spec.repoRoot, agent_id });
  if (!idResult.ok) throw new Error(`nex2 identity load failed: ${idResult.reason_code} · ${idResult.reason}`);
  const identity = idResult.identity;

  // Defence in depth: NEX2's identity keypair MUST NOT match ANY
  // OTHER agent's published identity. This catches stolen/copied keys
  // regardless of what NEX1's specific agent_id is.
  try {
    const otherIdentities = await getStorage().query<AgentIdentityRecord>(AGENT_IDENTITY_COLLECTION, {
      limit: 500,
    }).catch(() => [] as AgentIdentityRecord[]);
    for (const other of otherIdentities) {
      if (other.agent_id === agent_id) continue;
      if (other.public_key_der_hex === identity.public_key_der_hex) {
        throw new Error(`nex2 identity keypair matches agent "${other.agent_id}" · that would collapse team independence · refusing to start`);
      }
    }
  } catch (e) {
    if ((e as Error).message.includes("collapse team independence")) throw e;
    // Storage-read errors do not gate startup · they are logged upstream
  }

  const handle = await makeAgentDaemon({
    agent_id, repoRoot: spec.repoRoot,
    heartbeat_interval_ms: spec.heartbeat_interval_ms ?? 5_000,
    _test_unref_heartbeat: spec._test_unref_heartbeat,
    onMission: async () => ({ kind: "COMPLETED", detail: "nex2 uses tick() not receiveMission" }),
  });

  const tick = async (): Promise<Nex2TickResult> => {
    try {
      // Find proposals with no NEX2 review yet · newest first · bounded
      const proposals = await loadAllProposals();
      // Pull recent proposals (last 200) and skip those we've already reviewed
      const recent = proposals.slice(0, 200);
      if (recent.length === 0) return { kind: "idle", reviews_produced: 0, detail: "no proposals" };

      const reviewedIds = new Set<string>();
      for (const p of recent) {
        const rows = await getStorage().query<Nex2ReviewRecord>(NEX2_REVIEW_COLLECTION, {
          where: { proposal_id: p.proposal_id, reviewed_by_agent_id: agent_id }, limit: 1,
        }).catch(() => [] as Nex2ReviewRecord[]);
        if (rows.length > 0) reviewedIds.add(p.proposal_id);
      }
      const toReview = recent.filter((p) => !reviewedIds.has(p.proposal_id)).slice(0, maxPerTick);
      if (toReview.length === 0) return { kind: "idle", reviews_produced: 0, detail: "no unreviewed proposals" };

      let count = 0;
      for (const p of toReview) {
        try {
          await nex2ReviewProposal({ identity, instance_id: handle.instance_id, proposal_id: p.proposal_id });
          count++;
        } catch { /* skip that one · continue */ }
      }
      return { kind: "reviewed", reviews_produced: count, detail: `NEX2 produced ${count} independent review(s)` };
    } catch (e) {
      return { kind: "errored", reviews_produced: 0, detail: (e as Error).message };
    }
  };

  return { handle, identity, tick, stop: handle.stop };
}
