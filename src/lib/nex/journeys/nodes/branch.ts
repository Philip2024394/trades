// Journey node · Branch
//
// Deterministic branch on a canonical analytics event: `opened`,
// `clicked`, `delivered`, or their negations (`not_opened`, `not_clicked`).
//
// The check is: has THIS contact recorded an event of `condition` on
// `observe_campaign_id` (or the most recently-emitted campaign from
// this journey if none specified) within `within_seconds` of NOW?
//
// The read is against nex.analytics_events · READ-ONLY. The runtime
// does not modify anything downstream · it just picks a branch.

import type { BranchNode, TickInput, TickOutput } from "../types";

// Injected at tick time so the runtime stays pure + testable.
// Signature: (contact_id, campaign_id_or_null, event_type, since_iso) => bool
export type EventLookup = (contact_id: string, campaign_id: string | null, event_type: "opened" | "clicked" | "delivered", since_iso: string) => Promise<boolean>;

export async function evalBranch(node: BranchNode, ctx: TickInput, lookup: EventLookup, lastEmittedCampaignId: string | null): Promise<TickOutput> {
  const positive = node.condition.startsWith("not_") ? node.condition.slice(4) as "opened" | "clicked" | "delivered" : node.condition as "opened" | "clicked" | "delivered";
  const negate = node.condition.startsWith("not_");
  const observe = node.observe_campaign_id ?? lastEmittedCampaignId ?? null;

  const since_iso = new Date(ctx.now.getTime() - node.within_seconds * 1000).toISOString();
  const hit = await lookup(ctx.state.contact_id, observe, positive, since_iso);
  const taken: "yes" | "no" = (negate ? !hit : hit) ? "yes" : "no";
  const next = taken === "yes" ? node.branches.yes : node.branches.no;

  return {
    next_state: { current_node_id: next, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null },
    events: [{
      event_type: "BranchTaken",
      from_node_id: node.id,
      to_node_id: next,
      emitted_command: null,
      metadata: { condition: node.condition, within_seconds: node.within_seconds, observe_campaign_id: observe, hit, taken },
    }],
    commands: [],
  };
}
