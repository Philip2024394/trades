// Journey node · Goal
// Records a GoalReached event. If `next` is set, advances to it;
// otherwise completes the journey (terminal goal).

import type { GoalNode, TickInput, TickOutput } from "../types";

export function evalGoal(node: GoalNode, ctx: TickInput): TickOutput {
  const goalEvent = { event_type: "GoalReached" as const, from_node_id: node.id, to_node_id: node.next ?? null, emitted_command: null, metadata: { goal_key: node.goal_key } };
  if (node.next) {
    return {
      next_state: { current_node_id: node.next, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null },
      events: [goalEvent],
      commands: [],
    };
  }
  return {
    next_state: { current_node_id: node.id, status: "completed", last_transition_at: ctx.now.toISOString(), wait_until: null, completed_at: ctx.now.toISOString() },
    events: [
      goalEvent,
      { event_type: "JourneyCompleted", from_node_id: node.id, to_node_id: null, emitted_command: null, metadata: { via: "goal", goal_key: node.goal_key } },
    ],
    commands: [{ kind: "complete", state_id: ctx.state.state_id, goal_key: node.goal_key }],
  };
}
