// Journey node · SendCampaign
//
// Emits a `enqueue_send_batch` command · the existing worker queue
// picks it up and drives it through the full delivery path.
// The runtime NEVER sends directly · doctrine §4 "Commands, not actions".
//
// After emitting the command, the state advances to `next` immediately
// (fire-and-track pattern). A future SendCampaign variant may WAIT for
// the campaign to complete before advancing — that would be a new node
// type (SendCampaignAndWait) added via a new dispatcher case, not a
// modification of this one.

import type { JourneyCommand, SendCampaignNode, TickInput, TickOutput } from "../types";

export function evalSendCampaign(node: SendCampaignNode, ctx: TickInput): TickOutput {
  const command: JourneyCommand = {
    kind: "enqueue_send_batch",
    campaign_id: node.campaign_id,
    contact_id: ctx.state.contact_id,
    payload: {
      journey_id: ctx.journey.journey_id,
      journey_slug: ctx.journey.slug,
      journey_version: ctx.journey.version,
      node_id: node.id,
      state_id: ctx.state.state_id,
    },
  };
  return {
    next_state: { current_node_id: node.next, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null },
    events: [{ event_type: "CampaignCommandEmitted", from_node_id: node.id, to_node_id: node.next, emitted_command: command, metadata: { campaign_id: node.campaign_id } }],
    commands: [command],
  };
}
