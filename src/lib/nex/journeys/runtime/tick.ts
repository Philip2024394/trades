// NEX Journey Engine · tick loop
//
// The single entry point for periodic advancement. Reads every state
// whose wait_until is past (or NULL for active-but-just-entered),
// loads its journey, and hands to the dispatcher.
//
// Time is read ONCE at tick entry and passed to every advanceOne call ·
// determinism doctrine §6 "no Date.now() inside the runtime".

import { withClient } from "@/lib/nex/delivery/db";
import { advanceOne, type AdvanceOutcome } from "./dispatcher";
import { rowToJourney } from "../definition/versioning";
import type { Journey, JourneyState } from "../types";
import { dispatchAllTriggers, type DispatchResult } from "../triggers/dispatcher";

export type TickResult = {
  ok: boolean;
  ran_at: string;
  triggers: DispatchResult | null;
  states_evaluated: number;
  advanced: number;
  errors: number;
  outcomes: Array<AdvanceOutcome & { state_id: string; error?: string }>;
};

const MAX_STATES_PER_TICK = 200;

export async function tickJourneys(): Promise<TickResult> {
  const now = new Date();

  // Phase 5.1.2 · run trigger evaluators FIRST so newly-materialised
  // journey states get advanced in the same tick.
  let triggers: DispatchResult | null = null;
  try { triggers = await dispatchAllTriggers(now); } catch { /* triggers are best-effort · never block the tick */ }

  const pending = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.journey_states
       WHERE status IN ('active','waiting')
         AND (wait_until IS NULL OR wait_until <= $1::timestamptz)
       ORDER BY last_transition_at ASC
       LIMIT ${MAX_STATES_PER_TICK}
       FOR UPDATE SKIP LOCKED`,
      [now.toISOString()],
    );
    return res.rows.map(rowToState);
  }) ?? [];

  const journeysById = new Map<string, Journey>();
  const outcomes: Array<AdvanceOutcome & { state_id: string; error?: string }> = [];
  let advanced = 0, errors = 0;

  for (const state of pending) {
    try {
      let journey = journeysById.get(state.journey_id);
      if (!journey) {
        const jr = await withClient(async (c) => {
          const res = await c.query(`SELECT * FROM nex.journeys WHERE journey_id = $1`, [state.journey_id]);
          return res.rows[0] ? rowToJourney(res.rows[0]) : null;
        });
        if (jr) { journey = jr; journeysById.set(state.journey_id, jr); }
      }
      if (!journey) { errors++; outcomes.push({ state_id: state.state_id, advanced: false, events_recorded: 0, commands_executed: 0, command_results: [], from_node_id: state.current_node_id, to_node_id: state.current_node_id, status: state.status, error: "journey_not_found" }); continue; }

      const outcome = await advanceOne(journey, state, now);
      if (outcome.advanced) advanced++;
      outcomes.push({ ...outcome, state_id: state.state_id });
    } catch (e) {
      errors++;
      outcomes.push({ state_id: state.state_id, advanced: false, events_recorded: 0, commands_executed: 0, command_results: [], from_node_id: state.current_node_id, to_node_id: state.current_node_id, status: state.status, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    ok: errors === 0,
    ran_at: now.toISOString(),
    triggers,
    states_evaluated: pending.length,
    advanced,
    errors,
    outcomes,
  };
}

// ── Row mapping ──────────────────────────────────────────────────
export function rowToState(r: Record<string, unknown>): JourneyState {
  return {
    state_id: String(r.state_id),
    journey_id: String(r.journey_id),
    journey_slug: String(r.journey_slug),
    journey_version: Number(r.journey_version),
    contact_id: String(r.contact_id),
    current_node_id: String(r.current_node_id),
    status: r.status as JourneyState["status"],
    entered_at: String(r.entered_at),
    last_transition_at: String(r.last_transition_at),
    wait_until: (r.wait_until as string | null) ?? null,
    random_seed: Number(r.random_seed),
    snapshot: (r.snapshot as Record<string, unknown>) ?? {},
    completed_at: (r.completed_at as string | null) ?? null,
    stopped_reason: (r.stopped_reason as string | null) ?? null,
    last_command: (r.last_command as JourneyState["last_command"]) ?? null,
  };
}
