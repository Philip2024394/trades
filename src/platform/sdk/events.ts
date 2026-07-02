// Platform SDK — event bus.
//
// Thin wrappers around the Runtime's durable event bus. Adds
// capability + permission gates so App code can't publish or
// subscribe to events it forgot to declare.
//
// SDK publish is DURABLE by default — every App-emitted event lands
// in platform_events so late subscribers (cold starts, cross-request
// consumers) can replay it. Callers wanting fire-and-forget
// broadcast use runtime.publishEvent directly.
//
// Signatures remain stable when Phase 6.5 lands the persistent
// delivery worker — Apps written today will not need to change.

import { runtime, type StoredEvent, type ReplayOptions } from "../runtime";
import type { EventHandler, EventSubscription } from "../runtime/eventBus";
import { assertCapability, assertPermission } from "./permissions";
import type { AppContext } from "./context";

/** Publish an event durably. Requires the App to have declared the
 *  `events` capability AND the `publish:events` permission. Returns
 *  the stored row (with its assigned monotonic seq) so callers can
 *  track cursors client-side. */
export async function publish(
  ctx: AppContext,
  event: string,
  payload?: Record<string, unknown>
): Promise<StoredEvent> {
  assertCapability(ctx, "events");
  assertPermission(ctx, "publish:events");
  return runtime.publishDurableEvent({
    event,
    payload: payload ?? null,
    merchantId: ctx.merchantId,
    publishedByApp: ctx.manifest.slug
  });
}

/** Subscribe to an event kind in-process. Returns an unsubscribe
 *  handle. For cross-request subscription, use `replay` on each
 *  request against a persisted cursor. */
export function subscribe(
  ctx: AppContext,
  event: string,
  handler: EventHandler
): EventSubscription {
  assertCapability(ctx, "events");
  assertPermission(ctx, "subscribe:events");
  return runtime.subscribeEvent(event, handler);
}

/** Replay events matching the filter — for late subscribers or
 *  cross-request consumers. Requires the App to have declared the
 *  `events` capability. Scoped defaults are applied: if the App
 *  declared `subscribe:events` we widen the read; otherwise the
 *  caller can still replay events they published themselves. */
export async function replay(
  ctx: AppContext,
  opts: ReplayOptions = {}
): Promise<StoredEvent[]> {
  assertCapability(ctx, "events");
  return runtime.replayEvents(opts);
}

/** The current highest event sequence. Useful when onboarding a new
 *  subscriber so the App can start consuming forward only. */
export async function currentCursor(ctx: AppContext): Promise<number> {
  assertCapability(ctx, "events");
  return runtime.currentEventCursor();
}
