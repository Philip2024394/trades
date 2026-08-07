// Journey node · SendCampaignAndWait · Phase 5.1.4
//
// Two phases in one evaluator:
//   FIRST ENTRY (no execution row yet)
//     · INSERT execution row (idempotent via UNIQUE constraint)
//     · Emit enqueue_send_batch command · existing worker delivers
//     · Set state to 'waiting' with wait_until = poll_interval
//     · Stay on the same node · CampaignCommandEmitted event
//
//   POLL (execution row exists · status still in_flight)
//     · Read nex.campaign_recipients.send_status (canonical · Philip rule #1)
//     · sent                     → completed → next_on_completion
//     · failed / suppressed / bounced → failed_permanent → next_on_failure (or Stop)
//     · pending / skipped_window → remain waiting (temporary failure ≠ done)
//     · timeout exceeded         → timed_out → next_on_failure (or Stop)
//
// Never polls providers. Reads only the kernel's canonical recipient
// state. Idempotency guaranteed by UNIQUE(journey_state_id) on the
// executions table (Philip rule #3).

import type { JourneyCommand, SendCampaignAndWaitNode, TickInput, TickOutput } from "../types";
import { bumpPollAndUpdate, createExecution, getExecutionForState, getRecipientStatusForExecution, markExecutionCompleted } from "../executions";

const DEFAULT_POLL_INTERVAL_SEC = 30;
const DEFAULT_TIMEOUT_SEC = 86_400;                                        // 24 hours

// send_status buckets · charter §5.1.4 completion semantics
const COMPLETE = new Set(["sent"]);
const PERMANENT_FAIL = new Set(["failed", "suppressed", "bounced"]);
const TEMPORARY = new Set(["pending", "skipped_window", "not_yet_snapshot", "unreachable"]);

export async function evalSendCampaignAndWait(node: SendCampaignAndWaitNode, ctx: TickInput): Promise<TickOutput> {
  const pollInterval = Math.max(5, Math.min(3600, node.poll_interval_seconds ?? DEFAULT_POLL_INTERVAL_SEC));
  const timeout = Math.max(60, node.timeout_seconds ?? DEFAULT_TIMEOUT_SEC);

  // ── First entry · attempt to create execution row (idempotent) ──
  const existing = await getExecutionForState(ctx.state.state_id);
  if (!existing) {
    const created = await createExecution({
      journey_state_id: ctx.state.state_id,
      journey_id: ctx.journey.journey_id,
      journey_slug: ctx.journey.slug,
      journey_version: ctx.journey.version,
      node_id: node.id,
      campaign_id: node.campaign_id,
      contact_id: ctx.state.contact_id,
    });
    if (!created) {
      // Race · execution was created between our read and write · treat as poll on next tick
      const wait_until = new Date(ctx.now.getTime() + pollInterval * 1000).toISOString();
      return {
        next_state: { current_node_id: node.id, status: "waiting", last_transition_at: ctx.now.toISOString(), wait_until },
        events: [],
        commands: [],
      };
    }
    // Phase 5.2 · propagate active experiment metadata into payload
    const active = Array.isArray(ctx.state.snapshot?.active_experiments)
      ? (ctx.state.snapshot.active_experiments as Array<{ experiment_id: string; variant_id: string }>)
      : [];
    const primary = active[active.length - 1];
    const command: JourneyCommand = {
      kind: "enqueue_send_batch",
      campaign_id: node.campaign_id,
      contact_id: ctx.state.contact_id,
      payload: {
        journey_id: ctx.journey.journey_id, journey_slug: ctx.journey.slug, journey_version: ctx.journey.version,
        node_id: node.id, state_id: ctx.state.state_id,
        execution_id: created.execution_id, wait_for_completion: true,
        ...(primary ? { experiment_id: primary.experiment_id, variant_id: primary.variant_id } : {}),
        ...(active.length > 0 ? { active_experiments: active } : {}),
      },
    };
    const wait_until = new Date(ctx.now.getTime() + pollInterval * 1000).toISOString();
    return {
      next_state: { current_node_id: node.id, status: "waiting", last_transition_at: ctx.now.toISOString(), wait_until },
      events: [{
        event_type: "CampaignCommandEmitted",
        from_node_id: node.id, to_node_id: node.id, emitted_command: command,
        metadata: { campaign_id: node.campaign_id, execution_id: created.execution_id, wait_for_completion: true, poll_interval_seconds: pollInterval, timeout_seconds: timeout },
      }],
      commands: [command],
    };
  }

  // ── Poll · execution exists · already-final states are advanced through immediately ──
  if (existing.status === "completed") {
    return advance(node, ctx, node.next_on_completion, "completion", "completed");
  }
  if (existing.status === "failed_permanent" || existing.status === "timed_out") {
    return advanceFailure(node, ctx, existing.status, existing.outcome_reason ?? "");
  }

  // ── Poll the canonical recipient state (never a provider) ──
  const status = await getRecipientStatusForExecution(existing);
  await bumpPollAndUpdate(existing.execution_id, status);

  if (COMPLETE.has(status)) {
    await markExecutionCompleted(existing.execution_id, "completed", `recipient status=${status}`);
    return advance(node, ctx, node.next_on_completion, "completion", "completed", { recipient_status: status });
  }
  if (PERMANENT_FAIL.has(status)) {
    await markExecutionCompleted(existing.execution_id, "failed_permanent", `recipient status=${status}`);
    return advanceFailure(node, ctx, "failed_permanent", `recipient status=${status}`);
  }
  if (!TEMPORARY.has(status)) {
    // Unknown status · treat as temporary (Philip rule #2 · don't ambiguously "finish" the campaign)
  }

  // Timeout check
  const ageMs = ctx.now.getTime() - new Date(existing.dispatched_at).getTime();
  if (ageMs > timeout * 1000) {
    await markExecutionCompleted(existing.execution_id, "timed_out", `no terminal recipient status within ${timeout}s (last=${status})`);
    return advanceFailure(node, ctx, "timed_out", `timeout ${timeout}s exceeded (last recipient status=${status})`);
  }

  // Still in flight · remain waiting · reset the wait window
  const wait_until = new Date(ctx.now.getTime() + pollInterval * 1000).toISOString();
  return {
    next_state: { current_node_id: node.id, status: "waiting", last_transition_at: ctx.now.toISOString(), wait_until },
    events: [],
    commands: [],
  };
}

function advance(node: SendCampaignAndWaitNode, ctx: TickInput, next: string, taken: "completion" | "failure", outcome: string, extra?: Record<string, unknown>): TickOutput {
  return {
    next_state: { current_node_id: next, status: "active", last_transition_at: ctx.now.toISOString(), wait_until: null },
    events: [
      { event_type: "CampaignCompleted", from_node_id: node.id, to_node_id: node.id, emitted_command: null, metadata: { outcome, campaign_id: node.campaign_id, ...(extra ?? {}) } },
      { event_type: "BranchTaken",       from_node_id: node.id, to_node_id: next,    emitted_command: null, metadata: { taken, kind: "send_campaign_and_wait" } },
    ],
    commands: [],
  };
}

function advanceFailure(node: SendCampaignAndWaitNode, ctx: TickInput, outcome: "failed_permanent" | "timed_out", reason: string): TickOutput {
  const next = node.next_on_failure;
  if (next) return advance(node, ctx, next, "failure", outcome, { reason });

  // No failure branch · stop the journey (Philip rule #2)
  return {
    next_state: { current_node_id: node.id, status: "stopped", last_transition_at: ctx.now.toISOString(), wait_until: null, completed_at: ctx.now.toISOString(), stopped_reason: `send_campaign_and_wait ${outcome} · ${reason} · no failure branch configured` },
    events: [
      { event_type: "CampaignCompleted", from_node_id: node.id, to_node_id: node.id, emitted_command: null, metadata: { outcome, campaign_id: node.campaign_id, reason } },
      { event_type: "JourneyStopped",    from_node_id: node.id, to_node_id: null,    emitted_command: null, metadata: { outcome, reason } },
    ],
    commands: [{ kind: "stop", state_id: ctx.state.state_id, reason: `send_campaign_and_wait ${outcome}` }],
  };
}
