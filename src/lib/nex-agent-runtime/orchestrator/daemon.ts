// WO-NEX-RUNTIME-07 · Orchestrator daemon.
//
// Founder-locked 2026-09-13. Real OS process · own Ed25519 keypair
// distinct from NEX1/NEX2/NEX3/Security. Polls proposals and assembles
// signed GateReceipts. Never mutates records. Never grants authority
// its inputs don't support.

import { getStorage } from "@/lib/nex/storage/registry";
import { createOrLoadIdentity, type AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { makeAgentDaemon, type AgentDaemonHandle } from "@/lib/nex-agent-runtime/process/daemon";
import { AGENT_IDENTITY_COLLECTION, type AgentIdentityRecord } from "@/lib/nex-agent-runtime/process/types";
import { loadAllProposals } from "@/lib/nex-cap/nex1-engineer";
import { assembleGateReceipt } from "./orchestrator";
import { ORCHESTRATOR_RECEIPT_COLLECTION, type OrchestratorGateReceipt } from "./types";

export interface OrchestratorDaemonSpec {
  readonly agent_id?: string;
  readonly repoRoot: string;
  readonly heartbeat_interval_ms?: number;
  readonly max_receipts_per_tick?: number;
  readonly trusted_founder_public_keys_hex?: readonly string[];
  readonly _test_unref_heartbeat?: boolean;
}

export interface OrchestratorTickResult {
  readonly kind: "idle" | "assembled" | "errored";
  readonly receipts_produced: number;
  readonly detail: string;
}

export async function startOrchestratorDaemon(spec: OrchestratorDaemonSpec): Promise<{
  handle: AgentDaemonHandle;
  identity: AgentIdentity;
  tick: () => Promise<OrchestratorTickResult>;
  stop: () => Promise<void>;
}> {
  const agent_id = spec.agent_id ?? "orchestrator";
  const maxPerTick = spec.max_receipts_per_tick ?? 5;

  const idResult = await createOrLoadIdentity({ repoRoot: spec.repoRoot, agent_id });
  if (!idResult.ok) throw new Error(`orchestrator identity load failed: ${idResult.reason_code} · ${idResult.reason}`);
  const identity = idResult.identity;

  const otherIds = await getStorage().query<AgentIdentityRecord>(AGENT_IDENTITY_COLLECTION, { limit: 500 }).catch(() => []);
  for (const other of otherIds) {
    if (other.agent_id !== agent_id && other.public_key_der_hex === identity.public_key_der_hex) {
      throw new Error(`orchestrator identity keypair matches agent "${other.agent_id}" · refusing to start`);
    }
  }

  const handle = await makeAgentDaemon({
    agent_id, repoRoot: spec.repoRoot,
    heartbeat_interval_ms: spec.heartbeat_interval_ms ?? 5_000,
    _test_unref_heartbeat: spec._test_unref_heartbeat,
    onMission: async () => ({ kind: "COMPLETED", detail: "orchestrator uses tick() not receiveMission" }),
  });

  const tick = async (): Promise<OrchestratorTickResult> => {
    try {
      const proposals = await loadAllProposals();
      const recent = proposals.slice(0, 200);
      if (recent.length === 0) return { kind: "idle", receipts_produced: 0, detail: "no proposals" };

      // Skip proposals that already have a receipt assembled by this agent
      const done = new Set<string>();
      for (const p of recent) {
        const rows = await getStorage().query<OrchestratorGateReceipt>(ORCHESTRATOR_RECEIPT_COLLECTION, {
          where: { proposal_id: p.proposal_id, assembled_by_agent_id: agent_id }, limit: 1,
        }).catch(() => [] as OrchestratorGateReceipt[]);
        if (rows.length > 0) done.add(p.proposal_id);
      }
      const todo = recent.filter((p) => !done.has(p.proposal_id)).slice(0, maxPerTick);
      if (todo.length === 0) return { kind: "idle", receipts_produced: 0, detail: "no unassembled proposals" };

      let count = 0;
      for (const p of todo) {
        try {
          await assembleGateReceipt({
            identity, instance_id: handle.instance_id, proposal_id: p.proposal_id,
            trusted_founder_public_keys_hex: spec.trusted_founder_public_keys_hex ?? [],
          });
          count++;
        } catch { /* continue */ }
      }
      return { kind: "assembled", receipts_produced: count, detail: `Orchestrator assembled ${count} receipt(s)` };
    } catch (e) {
      return { kind: "errored", receipts_produced: 0, detail: (e as Error).message };
    }
  };

  return { handle, identity, tick, stop: handle.stop };
}
