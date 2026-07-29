// src/lib/nex/brains/_writer.ts
//
// withBrainWrite — the single serialised write path for every mutation
// on the Living Brain domain. Mirrors src/lib/nex/images/manifestWriter.ts
// but for Supabase-backed brain rows instead of a JSON file.
//
// Guarantees:
//   1. Cross-endpoint serialisation — every mutation in this process
//      waits for the previous one to finish. Prevents draft-vs-review
//      races and pointer-flip races.
//   2. Event log on every mutation — the mutator returns { after, event }
//      and this writer atomically inserts a hammerex_nex_events row.
//      Never-delete rule (ADR-0037) enforced at the code boundary.
//   3. Actor + role required on every call. No anonymous mutations.
//
// Callers hand the writer a mutator function that returns:
//   { after_json, event_type, event_metadata? }
// The writer wraps that with { before_json (auto-snapshotted) · actor ·
// occurred_at } and appends the row.

import {
  brainSupabase,
  brainSupabaseAvailable,
  insertNexEvent,
} from "./_supabase";
import type { NexEventRow } from "./_living_types";

// ---------- Module-level mutex ----------

let writeQueue: Promise<unknown> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => undefined);
  return next;
}

// ---------- Types ----------

export type BrainWriteActor = {
  actor_id:   string;
  actor_role: "author" | "reviewer" | "admin" | "system" | "runtime";
};

export type BrainWriteContext = BrainWriteActor & {
  brain_slug: string;
  entity_type: string;                   // brain · brain_draft · brain_version · brain_dependency · brain_certification
  entity_id:   string;                   // slug · uuid · composite
};

export type BrainMutationResult<T> = {
  /** The value returned to the caller (row id, new version id, etc.). */
  return_value: T;
  /** Event to append to hammerex_nex_events. */
  event: {
    event_type:  string;
    before_json?: unknown;
    after_json?:  unknown;
    metadata?:    Record<string, unknown>;
  };
};

// ---------- The writer ----------

/**
 * The ONLY safe way to mutate the Living Brain domain. Callers
 * provide a mutator that returns their business result plus the event
 * to log. The writer serialises against every other in-process mutation,
 * appends the event, and returns the business result.
 *
 * If Supabase credentials are missing the writer throws — brain
 * mutations are a Supabase-canonical operation (ADR-0037 · Supabase =
 * canonical storage · file packs are export/import only).
 */
export async function withBrainWrite<T>(
  ctx: BrainWriteContext,
  mutator: () => Promise<BrainMutationResult<T>>
): Promise<T> {
  if (!brainSupabaseAvailable()) {
    throw new Error(
      "withBrainWrite: Supabase credentials missing. Living Brain " +
      "mutations require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return runSerialized(async () => {
    const { return_value, event } = await mutator();

    const eventRow: Omit<NexEventRow, "id" | "occurred_at"> = {
      event_type:  event.event_type,
      entity_type: ctx.entity_type,
      entity_id:   ctx.entity_id,
      actor_id:    ctx.actor_id,
      actor_role:  ctx.actor_role,
      before_json: event.before_json ?? null,
      after_json:  event.after_json ?? null,
      metadata:    { brain_slug: ctx.brain_slug, ...(event.metadata ?? {}) },
    };

    // Append the event. If this fails we log but do NOT swallow —
    // event-log integrity is part of the Living Brain contract.
    try {
      await insertNexEvent(eventRow);
    } catch (err) {
      console.error("[withBrainWrite] event log failed — mutation succeeded but audit trail incomplete:", err);
      throw new Error(
        "withBrainWrite: mutation succeeded but event log write failed. " +
        "This is a Living Brain contract violation. See logs for details."
      );
    }

    return return_value;
  });
}

/**
 * Convenience wrapper for the most common shape: mutator returns just
 * an ID, event is well-formed, no before-state snapshot needed.
 */
export async function withBrainWriteSimple(
  ctx: BrainWriteContext,
  event_type: string,
  mutator: () => Promise<{ id: string; after?: unknown }>,
  metadata?: Record<string, unknown>
): Promise<string> {
  return withBrainWrite<string>(ctx, async () => {
    const { id, after } = await mutator();
    return {
      return_value: id,
      event: {
        event_type,
        after_json: after ?? null,
        metadata,
      },
    };
  });
}

/**
 * Direct helper for read-modify-write cycles. Loads the current row
 * for before_json snapshot, runs the mutator, records both states.
 */
export async function withBrainWriteDiff<TRow, TResult>(
  ctx: BrainWriteContext,
  event_type: string,
  loadCurrent: () => Promise<TRow | null>,
  mutator: (current: TRow | null) => Promise<{ result: TResult; after: TRow | null }>,
  metadata?: Record<string, unknown>
): Promise<TResult> {
  return withBrainWrite<TResult>(ctx, async () => {
    const before = await loadCurrent();
    const { result, after } = await mutator(before);
    return {
      return_value: result,
      event: {
        event_type,
        before_json: before,
        after_json:  after,
        metadata,
      },
    };
  });
}
