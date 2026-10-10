// WO-NEX-RUNTIME-03 · NEX1 daemon composition.
//
// Founder-locked 2026-09-13. NEX1 is a real independent OS process
// (RUNTIME-01 primitive) that:
//   - claims missions from the RUNTIME-02 queue
//   - runs the deterministic brain on each mission
//   - records observations + analysis + evidence + a signed
//     MissionContextChain
//   - hands off to founder authorisation (via the CapEngineeringProposal
//     unsigned slot) · never executes workstation mutation itself

import { makeAgentDaemon, type AgentDaemonHandle } from "@/lib/nex-agent-runtime/process/daemon";
import { createOrLoadIdentity, type AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { claimMission, markMissionInProgress, completeMission, failMission, pickNextMission, DEFAULT_QUEUE_CONFIG } from "@/lib/nex-runtime-queue/queue";
import { nex1BrainProcessMission } from "./brain";

export interface Nex1DaemonSpec {
  readonly agent_id?: string;                           // default "nex1"
  readonly repoRoot: string;
  readonly heartbeat_interval_ms?: number;              // default 5000
  readonly available_capabilities?: readonly string[];  // workforce catalog · default ["typescript"]
  readonly _test_unref_heartbeat?: boolean;
}

export interface Nex1TickResult {
  readonly kind: "idle" | "processed" | "errored";
  readonly detail: string;
  readonly mission_id?: string;
  readonly verdict_kind?: string;
  readonly context_id?: string | null;
}

/**
 * Start a NEX1 daemon. Returns a handle plus a `tick()` function that
 * pulls one mission from the queue, runs the brain, and reports back.
 * In production the daemon's own timer calls `tick()` on a cadence; for
 * tests we call it explicitly for deterministic control.
 */
export async function startNex1Daemon(spec: Nex1DaemonSpec): Promise<{
  handle: AgentDaemonHandle;
  identity: AgentIdentity;
  tick: () => Promise<Nex1TickResult>;
  stop: () => Promise<void>;
}> {
  const agent_id = spec.agent_id ?? "nex1";
  const available = spec.available_capabilities ?? ["typescript", "vitest", "next-app-router", "sql", "eslint"];

  // Load (or create) the persistent identity ONCE; both the underlying
  // RUNTIME-01 daemon and the brain use the same keypair.
  const idResult = await createOrLoadIdentity({ repoRoot: spec.repoRoot, agent_id });
  if (!idResult.ok) throw new Error(`nex1 identity load failed: ${idResult.reason_code} · ${idResult.reason}`);
  const identity = idResult.identity;

  const handle = await makeAgentDaemon({
    agent_id, repoRoot: spec.repoRoot,
    heartbeat_interval_ms: spec.heartbeat_interval_ms ?? 5_000,
    _test_unref_heartbeat: spec._test_unref_heartbeat,
    onMission: async () => ({ kind: "COMPLETED", detail: "nex1 uses tick() not receiveMission" }),
  });

  const tick = async (): Promise<Nex1TickResult> => {
    // 1 · Ask the scheduler for the next best mission
    const scheduling = await pickNextMission({
      config: { ...DEFAULT_QUEUE_CONFIG, available_capabilities: available },
    });
    if (!scheduling.winner) return { kind: "idle", detail: "scheduler produced no winner" };
    const winner = scheduling.winner;

    // 2 · Claim
    const claim = await claimMission({ mission_id: winner.mission_id, agent_id, instance_id: handle.instance_id, lease_ms: 60_000 });
    if (!claim.ok) return { kind: "idle", detail: `claim refused: ${claim.reason_code} · ${claim.reason}`, mission_id: winner.mission_id };

    // 3 · Mark in-progress
    await markMissionInProgress(winner.mission_id);

    // 4 · Run the brain (deterministic P-S)
    let brainOutput;
    try {
      brainOutput = await nex1BrainProcessMission({
        identity, instance_id: handle.instance_id,
        repo_root: spec.repoRoot,
        mission: winner,
      });
    } catch (e) {
      await failMission(winner.mission_id, claim.claim_id, (e as Error).message);
      return { kind: "errored", detail: `brain threw: ${(e as Error).message}`, mission_id: winner.mission_id };
    }

    // 5 · Handoff. RUNTIME-03 NEVER marks a production mission COMPLETED
    //     on its own · that requires downstream verification (NEX2 +
    //     Security + workstation). The queue transitions here reflect
    //     "brain finished analysing" not "mutation applied".
    switch (brainOutput.verdict.kind) {
      case "PROPOSED_TO_BROKER":
        await completeMission(winner.mission_id, claim.claim_id);   // brain phase complete
        return { kind: "processed", detail: brainOutput.verdict.detail, mission_id: winner.mission_id, verdict_kind: brainOutput.verdict.kind, context_id: brainOutput.context_id };
      case "ESCALATED_TO_FOUNDER":
        await failMission(winner.mission_id, claim.claim_id, brainOutput.verdict.detail);
        return { kind: "processed", detail: brainOutput.verdict.detail, mission_id: winner.mission_id, verdict_kind: brainOutput.verdict.kind, context_id: brainOutput.context_id };
      case "PREPARED_HANDOFF":
        await completeMission(winner.mission_id, claim.claim_id);
        return { kind: "processed", detail: brainOutput.verdict.detail, mission_id: winner.mission_id, verdict_kind: brainOutput.verdict.kind, context_id: brainOutput.context_id };
      case "REFUSED":
        await failMission(winner.mission_id, claim.claim_id, brainOutput.verdict.reason);
        return { kind: "processed", detail: brainOutput.verdict.reason, mission_id: winner.mission_id, verdict_kind: brainOutput.verdict.kind };
    }
  };

  return { handle, identity, tick, stop: handle.stop };
}
