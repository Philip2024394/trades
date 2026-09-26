// src/lib/nex-native/intelligence/worker-manager.ts
//
// NEX Engine · autoscaling decision logic (server-only).
// ------------------------------------------------------
// Wave 3 of the 2026-09-24 Scaling Doctrine sequence.
//
// Does ONE small deterministic thing: given the current queue depth and
// the current worker count, decide the target worker count. Deployment
// specifics (K8s HPA / ECS / launching real processes) are ops-shaped,
// not architecture-shaped · this module produces the SCALE DECISION and
// leaves the actual spawning to the runtime harness/deployment layer.
//
// Rule set (env-configurable):
//   · Scale up when queued > TARGET_QUEUE_PER_WORKER × current_workers
//     AND oldest_queued_seconds > SCALE_UP_LATENCY_TRIGGER
//   · Scale down when queued < IDLE_QUEUE_THRESHOLD AND leased == 0
//   · Never exceed MAX_WORKERS · never fall below MIN_WORKERS
//   · Grace period between scale decisions to avoid flapping

import "server-only";
import { getQueueDepth } from "../generation-job-service";

export interface AutoscaleConfig {
  minWorkers: number;
  maxWorkers: number;
  targetQueuePerWorker: number;
  scaleUpLatencyTriggerSeconds: number;
  idleQueueThreshold: number;
  scaleUpStep: number;
  scaleDownStep: number;
  cooldownMs: number;
}

const DEFAULT_CONFIG: AutoscaleConfig = {
  minWorkers: Number(process.env.NEX_AUTOSCALE_MIN_WORKERS ?? "1"),
  maxWorkers: Number(process.env.NEX_AUTOSCALE_MAX_WORKERS ?? "4"),
  targetQueuePerWorker: Number(process.env.NEX_AUTOSCALE_TARGET_QUEUE_PER_WORKER ?? "3"),
  scaleUpLatencyTriggerSeconds: Number(process.env.NEX_AUTOSCALE_LATENCY_TRIGGER_SECONDS ?? "15"),
  idleQueueThreshold: Number(process.env.NEX_AUTOSCALE_IDLE_QUEUE_THRESHOLD ?? "0"),
  scaleUpStep: Number(process.env.NEX_AUTOSCALE_UP_STEP ?? "1"),
  scaleDownStep: Number(process.env.NEX_AUTOSCALE_DOWN_STEP ?? "1"),
  cooldownMs: Number(process.env.NEX_AUTOSCALE_COOLDOWN_MS ?? "20000"),
};

export type ScaleAction =
  | { action: "hold"; reason: string; target: number; observed: { queued: number; leased: number; oldestSeconds: number } }
  | { action: "scale_up"; reason: string; from: number; target: number; observed: { queued: number; leased: number; oldestSeconds: number } }
  | { action: "scale_down"; reason: string; from: number; target: number; observed: { queued: number; leased: number; oldestSeconds: number } };

export interface AutoscaleState {
  currentWorkers: number;
  lastDecisionAt: number;
}

/**
 * Compute the next scale action given current worker count + observed
 * queue metrics. Pure decision · does not mutate anything.
 */
export function decideScaleAction(
  state: AutoscaleState,
  depth: { queued: number; leased: number; oldestQueuedSeconds: number },
  cfg: AutoscaleConfig = DEFAULT_CONFIG,
  now = Date.now()
): ScaleAction {
  const current = Math.max(cfg.minWorkers, Math.min(cfg.maxWorkers, state.currentWorkers));
  const observed = { queued: depth.queued, leased: depth.leased, oldestSeconds: depth.oldestQueuedSeconds };

  if (now - state.lastDecisionAt < cfg.cooldownMs) {
    return { action: "hold", reason: "cooldown", target: current, observed };
  }

  const queuePerCurrentWorker = current > 0 ? depth.queued / current : depth.queued;

  if (
    queuePerCurrentWorker > cfg.targetQueuePerWorker &&
    depth.oldestQueuedSeconds > cfg.scaleUpLatencyTriggerSeconds &&
    current < cfg.maxWorkers
  ) {
    const target = Math.min(cfg.maxWorkers, current + cfg.scaleUpStep);
    return {
      action: "scale_up",
      reason: `queued/worker=${queuePerCurrentWorker.toFixed(1)} > ${cfg.targetQueuePerWorker} AND oldest=${depth.oldestQueuedSeconds.toFixed(0)}s > ${cfg.scaleUpLatencyTriggerSeconds}s`,
      from: current,
      target,
      observed,
    };
  }

  if (depth.queued <= cfg.idleQueueThreshold && depth.leased === 0 && current > cfg.minWorkers) {
    const target = Math.max(cfg.minWorkers, current - cfg.scaleDownStep);
    return {
      action: "scale_down",
      reason: `queued=${depth.queued} idle AND leased=0 AND current=${current} > min=${cfg.minWorkers}`,
      from: current,
      target,
      observed,
    };
  }

  return { action: "hold", reason: "stable", target: current, observed };
}

/** Convenience wrapper · fetches live queue depth then decides. */
export async function autoscaleNow(
  state: AutoscaleState,
  cfg: Partial<AutoscaleConfig> = {}
): Promise<ScaleAction> {
  const depth = await getQueueDepth();
  return decideScaleAction(state, depth, { ...DEFAULT_CONFIG, ...cfg });
}

export function defaultAutoscaleConfig(): AutoscaleConfig {
  return { ...DEFAULT_CONFIG };
}
