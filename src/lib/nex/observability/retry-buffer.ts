// src/lib/nex/observability/retry-buffer.ts
//
// Wave 11 · GROUP B · closes F9 (audit-log batch failures swallowed).
//
// Bounded ring buffer for events that failed to emit primary-side and
// need retry. Explicitly BOUNDED · unbounded queues in long-running
// processes leak memory. Overflow is not silent: when the buffer is
// full, oldest entries are evicted AND an `audit-emit-dropped` signal
// fires with the drop count.
//
// Contract:
//   · capacity is a compile-time constant · not caller-tunable
//   · enqueue is O(1)
//   · drain returns a snapshot for the caller to retry · buffer is
//     emptied by drain
//   · thread-safety not required (Node single-threaded event loop)
//   · SECURITY: entries are opaque to this module · the caller MUST
//     not stuff secrets into them (documented as an invariant)

import { incr } from "./counters";
import { emitSignal } from "./signals";

// Bounded capacity. If prod ever needs a larger buffer, this is a
// deliberate code change (tests catch drift).
const CAPACITY = 1000;

// Entries are opaque · the caller (audit-log.ts) supplies whatever
// shape it needs to retry. We just preserve + hand back.
type Entry<T> = {
  ts: string;                       // ISO of enqueue time · for age reasoning
  attempts: number;                 // number of retry cycles this entry has survived
  payload: T;
};

let ring: Entry<unknown>[] = [];

/**
 * Enqueue a failed event for later retry. If the buffer is at capacity,
 * the OLDEST entry is evicted and an `audit-emit-dropped` signal fires.
 * That's deliberate: newer events are more relevant, but the operator
 * MUST see the drop.
 */
export function enqueueForRetry<T>(payload: T): void {
  if (ring.length >= CAPACITY) {
    ring.shift();                        // evict oldest
    incr("audit.emit_dropped");
    emitSignal({
      subsystem: "audit-retry",
      kind: "audit-emit-dropped",
      code: "buffer-full",
      detail: `capacity=${CAPACITY} · dropped-oldest`,
    });
  }
  ring.push({ ts: new Date().toISOString(), attempts: 0, payload });
  incr("audit.emit_failed");
}

/**
 * Drain the buffer. Returns a snapshot for the caller to retry.
 * The internal ring is emptied atomically before return · if a retry
 * fails, the caller must re-enqueue individual entries.
 */
export function drainRetryBuffer<T = unknown>(): ReadonlyArray<Entry<T>> {
  const snapshot = ring as Entry<T>[];
  ring = [];
  return snapshot;
}

/** Read-only status snapshot for the health endpoint. */
export function retryBufferStatus(): { size: number; capacity: number; oldest_at: string | null } {
  return {
    size: ring.length,
    capacity: CAPACITY,
    oldest_at: ring[0]?.ts ?? null,
  };
}

/** Test-only reset · do NOT call from production code. */
export function _resetRetryBufferForTests(): void {
  ring = [];
}

/** Exposed for tests · callers should not depend on this constant. */
export function _capacityForTests(): number {
  return CAPACITY;
}
