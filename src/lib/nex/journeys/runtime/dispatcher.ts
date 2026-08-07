// NEX Journey Engine · dispatcher
//
// The dispatcher is the I/O layer around the pure state_machine.
// Doctrine §7 "the runtime is a compiler · nothing more":
//   1. Load journey + state
//   2. Provide the state_machine with (journey, state, now) + read-only
//      event lookup + last-emitted-campaign-id
//   3. Persist next_state, journey_events, and execute commands
//
// All the side effects live here. state_machine.ts stays pure.

import { withClient } from "@/lib/nex/delivery/db";
import { advanceState } from "./state_machine";
import { executeCommand, type CommandResult } from "../commands/command_factory";
import { recordEvents } from "../events/emitted";
import type { EventLookup } from "../nodes/branch";
import type { Journey, JourneyCommand, JourneyState } from "../types";

// ── Injected event lookup · read-only ────────────────────────────
const eventLookup: EventLookup = async (contact_id, campaign_id, event_type, since_iso) => {
  const r = await withClient(async (c) => {
    const params: unknown[] = [contact_id, event_type, since_iso];
    const campaignClause = campaign_id ? `AND campaign_id = $${params.push(campaign_id)}` : "";
    const res = await c.query(
      `SELECT 1 FROM nex.analytics_events
       WHERE recipient_id = $1 AND event_type = $2 AND event_timestamp >= $3::timestamptz ${campaignClause}
       LIMIT 1`,
      params,
    );
    return res.rows.length > 0;
  });
  return r === true;
};

// ── Persist next state + record events + execute commands ─────────
export type AdvanceOutcome = {
  advanced: boolean;
  events_recorded: number;
  commands_executed: number;
  command_results: CommandResult[];
  from_node_id: string;
  to_node_id: string;
  status: JourneyState["status"];
};

export async function advanceOne(journey: Journey, state: JourneyState, now: Date): Promise<AdvanceOutcome> {
  // Look up the campaign_id most recently emitted for this state so
  // Branch nodes can inspect its analytics events.
  const lastEmittedCampaignId = await lookupLastEmittedCampaign(state.state_id);

  const output = await advanceState({ journey, state, now }, eventLookup, lastEmittedCampaignId);

  // Persist next_state
  const next = output.next_state;
  await withClient(async (c) => {
    const sets: string[] = ["current_node_id = $1", "status = $2", "last_transition_at = $3"];
    const params: unknown[] = [next.current_node_id, next.status, next.last_transition_at ?? now.toISOString()];
    if (next.wait_until !== undefined)     { params.push(next.wait_until);     sets.push(`wait_until = $${params.length}`); }
    if (next.completed_at !== undefined)   { params.push(next.completed_at);   sets.push(`completed_at = $${params.length}`); }
    if (next.stopped_reason !== undefined) { params.push(next.stopped_reason); sets.push(`stopped_reason = $${params.length}`); }
    // Phase 5.2 · persist snapshot so Experiment node's active_experiments propagate to downstream Send nodes
    if (next.snapshot !== undefined)       { params.push(JSON.stringify(next.snapshot)); sets.push(`snapshot = $${params.length}::jsonb`); }
    if (output.commands.length > 0) {
      params.push(JSON.stringify(output.commands[output.commands.length - 1]));
      sets.push(`last_command = $${params.length}::jsonb`);
    }
    params.push(state.state_id);
    await c.query(`UPDATE nex.journey_states SET ${sets.join(", ")} WHERE state_id = $${params.length}`, params);
    return null;
  });

  // Record events
  await recordEvents(journey, state, output.events);

  // Execute commands (calls into the existing kernel · never into a provider directly)
  const results: CommandResult[] = [];
  for (const cmd of output.commands) {
    results.push(await executeCommand(cmd));
  }

  return {
    advanced: true,
    events_recorded: output.events.length,
    commands_executed: results.length,
    command_results: results,
    from_node_id: state.current_node_id,
    to_node_id: next.current_node_id,
    status: next.status,
  };
}

async function lookupLastEmittedCampaign(state_id: string): Promise<string | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT emitted_command FROM nex.journey_events
       WHERE state_id = $1 AND event_type = 'CampaignCommandEmitted' AND emitted_command IS NOT NULL
       ORDER BY occurred_at DESC LIMIT 1`,
      [state_id],
    );
    if (res.rows.length === 0) return null;
    const cmd = res.rows[0].emitted_command as JourneyCommand;
    return cmd.kind === "enqueue_send_batch" ? cmd.campaign_id : null;
  });
  return r ?? null;
}
