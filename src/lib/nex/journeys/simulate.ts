// NEX Journey Engine · dry-run simulator
//
// Walks a journey definition from Start · assumes a deterministic
// "happy path" (Wait collapses · SendCampaign always completes ·
// Branch takes 'yes' unless overridden per-node) · returns the
// sequence of steps and terminal outcome.
//
// Pure · no DB writes · no enqueueJob · no provider calls.
// Charter §11 · invariant #12 · invariant #11 all respected.

import type { JourneyDefinition, Node } from "./types";

export type SimulationStep = {
  node_id: string;
  node_type: string;
  outcome: "advanced" | "waited_collapsed" | "sent_assumed" | "sent_and_wait_completed" | "branch_taken" | "goal" | "stopped" | "failed";
  detail: string;
  next?: string;
};

export type SimulationResult = {
  ok: boolean;
  reason: string;                           // "completed" · "stopped" · "failed" · "cycle_guard_hit" · "invalid_definition"
  steps: SimulationStep[];
  terminal_node_id: string | null;
  branch_overrides_used: Record<string, "yes" | "no">;
};

export type SimulateOptions = {
  branch_overrides?: Record<string, "yes" | "no">;   // per node id · default 'yes'
  wait_and_wait_behavior?: "assume_completion" | "assume_failure";
  max_steps?: number;                                 // cycle guard · default 200
};

export function simulateJourney(def: JourneyDefinition, opts: SimulateOptions = {}): SimulationResult {
  const byId = new Map(def.nodes.map((n) => [n.id, n] as const));
  const overrides = opts.branch_overrides ?? {};
  const maxSteps = Math.max(1, opts.max_steps ?? 200);
  const swBehavior = opts.wait_and_wait_behavior ?? "assume_completion";

  const start = def.nodes.find((n) => n.type === "start");
  if (!start) return { ok: false, reason: "invalid_definition · no Start", steps: [], terminal_node_id: null, branch_overrides_used: {} };

  const steps: SimulationStep[] = [];
  const branch_overrides_used: Record<string, "yes" | "no"> = {};
  const visited = new Map<string, number>();                 // cycle count per node
  let cur: string | undefined = start.id;
  let stepsRun = 0;

  while (cur && stepsRun < maxSteps) {
    stepsRun++;
    const seen = visited.get(cur) ?? 0;
    if (seen > 3) {
      steps.push({ node_id: cur, node_type: (byId.get(cur)?.type ?? "unknown"), outcome: "failed", detail: `cycle: visited ${seen}× · aborting` });
      return { ok: false, reason: "cycle_guard_hit", steps, terminal_node_id: cur, branch_overrides_used };
    }
    visited.set(cur, seen + 1);

    const node = byId.get(cur);
    if (!node) {
      steps.push({ node_id: cur, node_type: "missing", outcome: "failed", detail: "node not found in definition" });
      return { ok: false, reason: "failed", steps, terminal_node_id: cur, branch_overrides_used };
    }

    const step = stepFor(node, overrides, branch_overrides_used, swBehavior);
    steps.push(step);
    if (step.outcome === "goal" || step.outcome === "stopped" || step.outcome === "failed") {
      return { ok: step.outcome !== "failed", reason: step.outcome === "goal" ? "completed" : step.outcome, steps, terminal_node_id: cur, branch_overrides_used };
    }
    cur = step.next;
  }

  return { ok: false, reason: "max_steps_reached", steps, terminal_node_id: cur ?? null, branch_overrides_used };
}

function stepFor(node: Node, overrides: Record<string, "yes" | "no">, used: Record<string, "yes" | "no">, swBehavior: "assume_completion" | "assume_failure"): SimulationStep {
  switch (node.type) {
    case "start":
      return { node_id: node.id, node_type: "start", outcome: "advanced", detail: `Start → ${node.next}`, next: node.next };
    case "wait":
      return { node_id: node.id, node_type: "wait", outcome: "waited_collapsed", detail: `Wait ${node.wait_seconds}s (collapsed for simulation)`, next: node.next };
    case "send_campaign":
      return { node_id: node.id, node_type: "send_campaign", outcome: "sent_assumed", detail: `Emit enqueue_send_batch · campaign_id=${node.campaign_id.slice(0, 8)}…`, next: node.next };
    case "send_campaign_and_wait": {
      if (swBehavior === "assume_completion") {
        return { node_id: node.id, node_type: "send_campaign_and_wait", outcome: "sent_and_wait_completed", detail: `Emit + wait for completion · assumed sent → ${node.next_on_completion}`, next: node.next_on_completion };
      }
      const failNext = node.next_on_failure ?? "";
      return failNext
        ? { node_id: node.id, node_type: "send_campaign_and_wait", outcome: "sent_and_wait_completed", detail: `Emit + wait · assumed permanent failure → ${failNext}`, next: failNext }
        : { node_id: node.id, node_type: "send_campaign_and_wait", outcome: "stopped", detail: "Assumed permanent failure · no failure branch → Stop" };
    }
    case "branch": {
      const choice: "yes" | "no" = overrides[node.id] ?? "yes";
      used[node.id] = choice;
      const target = choice === "yes" ? node.branches.yes : node.branches.no;
      return { node_id: node.id, node_type: "branch", outcome: "branch_taken", detail: `Branch on '${node.condition}' · assumed=${choice} → ${target}`, next: target };
    }
    case "goal":
      return { node_id: node.id, node_type: "goal", outcome: node.next ? "advanced" : "goal", detail: `Goal reached · key=${node.goal_key}${node.next ? ` → ${node.next}` : " · terminal"}`, next: node.next };
    case "stop":
      return { node_id: node.id, node_type: "stop", outcome: "stopped", detail: node.reason ?? "Stop node" };
  }
}
