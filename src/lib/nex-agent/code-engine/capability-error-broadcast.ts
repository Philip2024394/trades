// src/lib/nex-agent/code-engine/capability-error-broadcast.ts
//
// NEX1 · Fix 31 · Distributed Error / Feedback Broadcast.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Deterministic in-process broadcast of preservation / vitest / coding-loop
//   outcomes to registered subscribers. Biological analogue: dopaminergic
//   RPE broadcast. Engineering translation: pub-sub with typed events.
//
//   Zero LLM. Zero external network. Deterministic delivery order.
//
//   CONSTITUTIONAL PRESERVATION
//   - No subscriber may modify Fix 23a/b/c, Q7/Q8, Schema V1, or the
//     conversation head. Subscribers may only READ the event and record.
//   - Subscriber failures are isolated (a throwing subscriber does not
//     poison the broadcast to others; the error is recorded).
//   - Broadcast is fire-and-forget from the caller's perspective; return
//     value carries the subscriber verdicts for audit.

export type FeedbackEventKind =
  | "coding_loop_verified"
  | "coding_loop_refused"
  | "preservation_regressed"
  | "test_exit_code_zero"
  | "test_exit_code_nonzero"
  | "investigation_verdict"
  | "class2_bridge_used"
  | "target_discovery_hit"
  | "target_discovery_miss";

export interface FeedbackEvent {
  readonly kind: FeedbackEventKind;
  readonly timestamp: string;
  readonly source: string; // module id that fired the event
  readonly payload: Readonly<Record<string, unknown>>;
}

export type FeedbackSubscriber = (event: FeedbackEvent) => void | Promise<void>;

interface SubscriberEntry {
  readonly id: string;
  readonly fn: FeedbackSubscriber;
  readonly kinds: readonly FeedbackEventKind[] | "all";
}

// ── Module-level registry (deterministic order) ─────────────────────────

const subscribers: SubscriberEntry[] = [];

export function subscribeFeedback(
  id: string,
  kinds: readonly FeedbackEventKind[] | "all",
  fn: FeedbackSubscriber,
): void {
  // Overwrite if same id already registered — deterministic.
  const i = subscribers.findIndex((s) => s.id === id);
  const entry: SubscriberEntry = { id, kinds, fn };
  if (i >= 0) subscribers[i] = entry;
  else subscribers.push(entry);
}

export function unsubscribeFeedback(id: string): void {
  const i = subscribers.findIndex((s) => s.id === id);
  if (i >= 0) subscribers.splice(i, 1);
}

export function listSubscribers(): readonly string[] {
  return subscribers.map((s) => s.id);
}

/** Reset for tests. Not exported at public runtime. */
export function _resetForTests(): void {
  subscribers.length = 0;
}

export interface BroadcastReport {
  readonly event: FeedbackEvent;
  readonly delivered_to: readonly string[];
  readonly skipped: readonly string[];
  readonly errors: readonly { readonly id: string; readonly message: string }[];
}

export async function broadcastFeedback(
  eventInput: Omit<FeedbackEvent, "timestamp"> & { readonly timestamp?: string },
): Promise<BroadcastReport> {
  const event: FeedbackEvent = {
    kind: eventInput.kind,
    source: eventInput.source,
    payload: eventInput.payload,
    timestamp: eventInput.timestamp ?? new Date().toISOString(),
  };
  const delivered: string[] = [];
  const skipped: string[] = [];
  const errors: { id: string; message: string }[] = [];
  for (const s of subscribers) {
    const listens =
      s.kinds === "all" || (Array.isArray(s.kinds) && s.kinds.includes(event.kind));
    if (!listens) {
      skipped.push(s.id);
      continue;
    }
    try {
      await s.fn(event);
      delivered.push(s.id);
    } catch (err) {
      errors.push({
        id: s.id,
        message: err instanceof Error ? err.message.slice(0, 200) : String(err),
      });
    }
  }
  return {
    event,
    delivered_to: delivered,
    skipped,
    errors,
  };
}

export const ERROR_BROADCAST_VERSION = "fix31.v1";
