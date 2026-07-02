// Platform Runtime — event bus.
//
// Two publish paths:
//
//   publishEvent(event, payload)
//     • In-process broadcast only. Synchronous. No durability.
//     • Used by Runtime internals + tests that don't want to touch
//       the DB.
//
//   publishDurableEvent({ event, payload, merchantId?, publishedByApp? })
//     • Writes to platform_events first, then broadcasts in-process.
//     • Async. Failed durability = no broadcast.
//     • This is what SDK.publish wraps — App events are always
//       durable so consumers in later requests can replay them.
//
// Subscription is process-local. Persistent cross-request delivery
// belongs to Phase 6.5 (delivery worker); for now late subscribers
// use runtime.replayEvents to catch up from a stored cursor.
//
// Design principle preserved: the SDK's publish/subscribe signatures
// don't change when Phase 6.5 lands. The Runtime facade grows;
// consumers stay stable.

export type EventHandler = (payload: unknown) => void | Promise<void>;

export type EventSubscription = {
  unsubscribe: () => void;
};

const busInternal = new Map<string, Set<EventHandler>>();

/** Fire an event to every subscriber. Synchronous — control returns
 *  once every handler has been called (not awaited). Handlers that
 *  return promises have their errors swallowed to keep the bus
 *  isolated from handler faults. */
export function publishEvent(event: string, payload?: unknown): void {
  const handlers = busInternal.get(event);
  if (!handlers) return;
  for (const handler of handlers) {
    try {
      const r = handler(payload);
      if (r instanceof Promise) {
        r.catch((err) => {
          console.warn(
            `eventBus: async handler for "${event}" rejected:`,
            (err as Error).message
          );
        });
      }
    } catch (err) {
      console.warn(
        `eventBus: sync handler for "${event}" threw:`,
        (err as Error).message
      );
    }
  }
}

/** Register a handler. Returns an unsubscribe object — callers should
 *  hold on to it and call .unsubscribe() at teardown to prevent
 *  handler leaks across hot reloads / long-lived processes. */
export function subscribeEvent(
  event: string,
  handler: EventHandler
): EventSubscription {
  const set = busInternal.get(event) ?? new Set<EventHandler>();
  set.add(handler);
  busInternal.set(event, set);
  return {
    unsubscribe: (): void => {
      set.delete(handler);
    }
  };
}

/** Count of active subscribers for an event kind. Useful for tests
 *  and for the future Event Bus dashboard. */
export function subscriberCount(event: string): number {
  return busInternal.get(event)?.size ?? 0;
}

/** Reset the bus. Test-only escape hatch. */
export function _resetEventBusForTests(): void {
  busInternal.clear();
}

// ─── Durable publish ──────────────────────────────────────────────
//
// Wraps writeEvent + publishEvent. If the durable write fails, the
// in-process broadcast does NOT fire — durability is the primary
// contract of the durable path. Callers who want fire-and-forget
// use publishEvent directly.

import { writeEvent, type StoredEvent } from "./eventLog";

export type PublishDurableArgs = {
  event: string;
  payload?: Record<string, unknown> | null;
  merchantId?: string | null;
  publishedByApp?: string | null;
};

export async function publishDurableEvent(
  args: PublishDurableArgs
): Promise<StoredEvent> {
  const stored = await writeEvent({
    event: args.event,
    payload: args.payload ?? null,
    merchantId: args.merchantId ?? null,
    publishedByApp: args.publishedByApp ?? null
  });
  // Broadcast the stored form (includes seq + id) so in-process
  // subscribers see the same shape as future durable-worker deliveries.
  publishEvent(args.event, stored);
  return stored;
}
