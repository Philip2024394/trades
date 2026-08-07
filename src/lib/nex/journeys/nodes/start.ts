// Journey node · Start
// Pure · no I/O · no time reads (uses the injected `now`).

import type { StartNode, TickInput, TickOutput } from "../types";

export function evalStart(node: StartNode, ctx: TickInput): TickOutput {
  return {
    next_state: { current_node_id: node.next, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null },
    events: [{ event_type: "JourneyStarted", from_node_id: node.id, to_node_id: node.next, emitted_command: null, metadata: {} }],
    commands: [],
  };
}
