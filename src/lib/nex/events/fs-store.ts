// NEX Enterprise Event Bus · now backed by the Storage Contract
//
// PURPOSE
// The universal event object doctrine
// (`feedback_nex_worker_state_correction_and_intelligence_event_2026_08_07.md`)
// requires every important action to produce an Intelligence Event.
//
// WEEK 1 PILOT MIGRATION (2026-08-07)
// This service was the first to be migrated onto the StorageBackend
// abstraction (`src/lib/nex/storage/*`). Every read and write now goes
// through `getStorage()` instead of touching the filesystem directly.
//
// ON-DISK LAYOUT UNCHANGED
// The JSONL adapter's LEGACY_PATHS map routes the "events" collection to
// the existing `data/nex-events/events.jsonl` file. Zero data movement
// this turn — that risk comes only when the Postgres adapter arrives and
// we run dual-write + parity checks (see NEX_INFRASTRUCTURE_RUNTIME.md §7).
//
// SAFETY
// Fire-and-forget writes must never crash the caller. Reads swallow parse
// errors line-by-line via the adapter · one bad row can't kill the stream.
//
// Doctrine cross-refs:
// · feedback_nex_worker_state_correction_and_intelligence_event_2026_08_07.md
// · docs/NEX_INFRASTRUCTURE_RUNTIME.md

import { randomUUID } from "node:crypto";
import { getStorage } from "../storage/registry";
import { COLLECTIONS } from "../storage/types";

const COLLECTION = COLLECTIONS.events;

// ── Event type ────────────────────────────────────────────────────

/**
 * The universal Intelligence Event stored in the event bus.
 * Wide-open · `event_type` is a string so future event kinds don't
 * require a schema change. Callers should follow the doctrine list
 * (knowledge_dumped · job_started · worker_completed · etc.).
 */
export type IntelligenceEvent = {
  event_id: string;
  event_type: string;
  source: "human" | "worker" | "brain" | "executive_layer" | "cron" | "system";
  actor_id: string | null;         // admin username · worker_id · brain_id
  timestamp: string;               // ISO
  // Tenancy · NULL = system-level (cron, platform event, unowned).
  // Otherwise the UUID of the owning business. Contract §2 principle 6.
  business_id: string | null;
  related_department: string | null;
  related_brain: string | null;
  related_job: string | null;
  related_contact: string | null;
  outcome: "success" | "failure" | "pending" | "informational";
  payload: Record<string, unknown>;
  reversible: boolean;
  reverse_of: string | null;
  supersedes: string | null;
};

/** Input shape · everything optional except event_type + source. */
export type EmitInput = {
  event_type: string;
  source: IntelligenceEvent["source"];
  actor_id?: string | null;
  /** Tenant scope · omit for system-level rows. See Contract §2 principle 6. */
  business_id?: string | null;
  related_department?: string | null;
  related_brain?: string | null;
  related_job?: string | null;
  related_contact?: string | null;
  outcome?: IntelligenceEvent["outcome"];
  payload?: Record<string, unknown>;
  reversible?: boolean;
  reverse_of?: string | null;
  supersedes?: string | null;
};

// ── Emit · goes through StorageBackend.save ───────────────────────

/**
 * Emit one event. Returns the assigned event_id on success · throws only on
 * catastrophic storage failure (caller in fire-and-forget mode should
 * still wrap in try/catch or use `emitEventSafe`).
 */
export async function emitEvent(input: EmitInput): Promise<string> {
  const event: IntelligenceEvent = {
    event_id: randomUUID(),
    event_type: input.event_type,
    source: input.source,
    actor_id: input.actor_id ?? null,
    timestamp: new Date().toISOString(),
    business_id: input.business_id ?? null,
    related_department: input.related_department ?? null,
    related_brain: input.related_brain ?? null,
    related_job: input.related_job ?? null,
    related_contact: input.related_contact ?? null,
    outcome: input.outcome ?? "informational",
    payload: input.payload ?? {},
    reversible: input.reversible ?? false,
    reverse_of: input.reverse_of ?? null,
    supersedes: input.supersedes ?? null,
  };
  await getStorage().save(COLLECTION, event);
  return event.event_id;
}

/** Fire-and-forget wrapper · never throws · never blocks. */
export function emitEventSafe(input: EmitInput): void {
  void emitEvent(input).catch((err) => {
    console.warn(`[nex-events] emit failed (${input.event_type}):`, err instanceof Error ? err.message : err);
  });
}

// ── Read · through StorageBackend.query ───────────────────────────

export type ListOptions = {
  limit?: number;                  // default 50 · max 500
  event_type?: string;
  source?: IntelligenceEvent["source"];
  related_job?: string;
  related_department?: string;
  since_ms?: number;               // trailing window · defaults to 24h
};

/**
 * Return most-recent events matching the filter · newest first.
 * All filter logic + tolerant parsing lives in the storage adapter now.
 */
export async function listEvents(options: ListOptions = {}): Promise<IntelligenceEvent[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 500);
  const sinceMs = options.since_ms ?? 24 * 60 * 60 * 1000;
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();

  const where: Record<string, unknown> = {};
  if (options.event_type)          where.event_type = options.event_type;
  if (options.source)              where.source = options.source;
  if (options.related_job)         where.related_job = options.related_job;
  if (options.related_department)  where.related_department = options.related_department;

  return getStorage().query<IntelligenceEvent>(COLLECTION, {
    where: Object.keys(where).length > 0 ? where : undefined,
    since: sinceIso,
    order_by: "timestamp",
    order_dir: "desc",
    limit,
  });
}

/** Total event count · use sparingly (dashboard tiles). */
export async function countEvents(): Promise<number> {
  return getStorage().count(COLLECTION);
}
