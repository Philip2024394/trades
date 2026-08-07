// Journey node · experiment · Phase 5.2 · A/B routing
//
// Reads (or creates) the sticky assignment for this (experiment_id,
// contact_id), records the assignment onto the journey_state's
// snapshot so downstream Send nodes can propagate metadata, and
// routes to the variant's target_node_id.
//
// Charter §12 · invariant #13. Pure of side effects outside its own
// tables (experiments/variants/assignments). No compliance writes,
// no provider calls, no journey_state mutations beyond snapshot.

import { getOrAssign } from "../../experiments/assignment";
import { getExperiment } from "../../experiments/registry";
import type { ActiveExperiment } from "../../experiments/types";
import type { ExperimentNode, TickInput, TickOutput } from "../types";

export async function evalExperiment(node: ExperimentNode, ctx: TickInput): Promise<TickOutput> {
  const bundle = await getExperiment(node.experiment_id);
  if (!bundle || bundle.experiment.status !== "active" || bundle.variants.length === 0) {
    // Fallback path OR stop
    const fallback = node.fallback_node_id;
    if (fallback) {
      return {
        next_state: { current_node_id: fallback, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null },
        events: [{ event_type: "BranchTaken", from_node_id: node.id, to_node_id: fallback, emitted_command: null, metadata: { kind: "experiment", reason: bundle ? `status=${bundle.experiment.status}` : "not_found", taken: "fallback" } }],
        commands: [],
      };
    }
    return {
      next_state: { current_node_id: node.id, status: "stopped", last_transition_at: ctx.now.toISOString(), wait_until: null, completed_at: ctx.now.toISOString(), stopped_reason: `experiment ${node.experiment_id} unavailable and no fallback_node_id` },
      events: [{ event_type: "JourneyStopped", from_node_id: node.id, to_node_id: null, emitted_command: null, metadata: { reason: "experiment_unavailable" } }],
      commands: [{ kind: "stop", state_id: ctx.state.state_id, reason: "experiment_unavailable" }],
    };
  }

  // Sticky assignment · invariant #13 (INSERT ON CONFLICT DO NOTHING · read back on conflict)
  const { variant_id, was_new, computed_hash } = await getOrAssign(bundle.experiment, bundle.variants, ctx.state.contact_id);
  const variant = bundle.variants.find((v) => v.variant_id === variant_id) ?? bundle.variants[0];

  // Route target · scope=journey_node uses variant.target_node_id · scope=campaign
  // falls back to fallback_node_id (campaign-scope experiments swap the campaign
  // via send node config in a future phase)
  const target = variant.target_node_id ?? node.fallback_node_id ?? null;
  if (!target) {
    return {
      next_state: { current_node_id: node.id, status: "stopped", last_transition_at: ctx.now.toISOString(), wait_until: null, completed_at: ctx.now.toISOString(), stopped_reason: `variant ${variant_id} has no target_node_id and no fallback` },
      events: [{ event_type: "JourneyStopped", from_node_id: node.id, to_node_id: null, emitted_command: null, metadata: { reason: "no_target", variant_id } }],
      commands: [{ kind: "stop", state_id: ctx.state.state_id, reason: `variant ${variant_id} unreachable` }],
    };
  }

  // Record on snapshot · downstream Send nodes read this to attach
  // experiment metadata to their command payloads.
  const active: ActiveExperiment = { experiment_id: node.experiment_id, variant_id, assigned_at: ctx.now.toISOString() };
  const existing = (ctx.state.snapshot?.active_experiments as ActiveExperiment[] | undefined) ?? [];
  const filtered = existing.filter((x) => x.experiment_id !== node.experiment_id);
  const nextSnapshot = { ...(ctx.state.snapshot ?? {}), active_experiments: [...filtered, active] };

  return {
    next_state: { current_node_id: target, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null, snapshot: nextSnapshot },
    events: [
      { event_type: "BranchTaken", from_node_id: node.id, to_node_id: target, emitted_command: null,
        metadata: { kind: "experiment", experiment_id: node.experiment_id, variant_id, was_new_assignment: was_new, computed_hash, allocation_pct: variant.allocation_pct } },
    ],
    commands: [],
  };
}
