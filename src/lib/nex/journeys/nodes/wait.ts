// Journey node · Wait
// If the state is entering the Wait node · set wait_until = now + wait_seconds and status = 'waiting'.
// If wait_until has passed (dispatcher only tick()s ready states) · advance to `next`.

import type { TickInput, TickOutput, WaitNode } from "../types";

export function evalWait(node: WaitNode, ctx: TickInput): TickOutput {
  const state = ctx.state;
  // If we already have a wait_until on THIS node · we're past it (dispatcher filters) · advance.
  if (state.current_node_id === node.id && state.wait_until && new Date(state.wait_until) <= ctx.now) {
    return {
      next_state: { current_node_id: node.next, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null },
      events: [{ event_type: "WaitExpired", from_node_id: node.id, to_node_id: node.next, emitted_command: null, metadata: { wait_seconds: node.wait_seconds } }],
      commands: [],
    };
  }
  // Just entered · arm the wait
  const wait_until = new Date(ctx.now.getTime() + node.wait_seconds * 1000).toISOString();
  return {
    next_state: { current_node_id: node.id, status: "waiting", last_transition_at: ctx.now.toISOString(), wait_until },
    events: [{ event_type: "WaitEntered", from_node_id: state.current_node_id, to_node_id: node.id, emitted_command: null, metadata: { wait_seconds: node.wait_seconds, wait_until } }],
    commands: [],
  };
}
