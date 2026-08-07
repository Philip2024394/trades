// NEX Journey Engine · state machine
//
// The pure heart of the runtime · doctrine §7 "the runtime is a compiler":
//   Input:  (Journey, JourneyState, now)  + injected lookup
//   Output: (next_state, events[], commands[])
//
// This function has ZERO side effects: no DB writes, no provider calls,
// no compliance mutations. All I/O lives in dispatcher.ts / tick.ts.
// The `lookup` and `lastEmittedCampaignId` inputs are provided by the
// dispatcher so this function stays deterministic + testable in isolation.

import type { Node, TickInput, TickOutput } from "../types";
import { evalBranch, type EventLookup } from "../nodes/branch";
import { evalGoal } from "../nodes/goal";
import { evalSendCampaign } from "../nodes/send_campaign";
import { evalStart } from "../nodes/start";
import { evalStop } from "../nodes/stop";
import { evalWait } from "../nodes/wait";
import { evalSendCampaignAndWait } from "../nodes/send_campaign_and_wait";

export async function advanceState(
  input: TickInput,
  lookup: EventLookup,
  lastEmittedCampaignId: string | null,
): Promise<TickOutput> {
  const node = input.journey.definition.nodes.find((n) => n.id === input.state.current_node_id);
  if (!node) {
    return {
      next_state: { current_node_id: input.state.current_node_id, status: "failed", last_transition_at: input.now.toISOString(), stopped_reason: `node ${input.state.current_node_id} not found in definition`, completed_at: input.now.toISOString() },
      events: [{ event_type: "JourneyFailed", from_node_id: input.state.current_node_id, to_node_id: null, emitted_command: null, metadata: { reason: "node_not_found" } }],
      commands: [{ kind: "stop", state_id: input.state.state_id, reason: `node ${input.state.current_node_id} not found` }],
    };
  }
  return dispatch(node, input, lookup, lastEmittedCampaignId);
}

// Dispatch by type · adding a new node type = new case here + new file in nodes/
// (never modify existing cases · doctrine §5 "future-proof node model").
async function dispatch(node: Node, input: TickInput, lookup: EventLookup, lastEmittedCampaignId: string | null): Promise<TickOutput> {
  switch (node.type) {
    case "start":                    return evalStart(node, input);
    case "wait":                     return evalWait(node, input);
    case "send_campaign":            return evalSendCampaign(node, input);
    case "branch":                   return evalBranch(node, input, lookup, lastEmittedCampaignId);
    case "goal":                     return evalGoal(node, input);
    case "stop":                     return evalStop(node, input);
    case "send_campaign_and_wait":   return evalSendCampaignAndWait(node, input);
  }
}
