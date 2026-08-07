// Journey node · Stop
// Marks the journey stopped with an optional reason.

import type { StopNode, TickInput, TickOutput } from "../types";

export function evalStop(node: StopNode, ctx: TickInput): TickOutput {
  const reason = node.reason ?? "stopped by definition";
  return {
    next_state: { current_node_id: node.id, status: "stopped", last_transition_at: ctx.now.toISOString(), wait_until: null, completed_at: ctx.now.toISOString(), stopped_reason: reason },
    events: [{ event_type: "JourneyStopped", from_node_id: node.id, to_node_id: null, emitted_command: null, metadata: { reason } }],
    commands: [{ kind: "stop", state_id: ctx.state.state_id, reason }],
  };
}
