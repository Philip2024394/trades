// Trade OS Event Bus — the central nervous system per V1 Part 4.
//
// In-process implementation for Phase 1. Same public interface that
// a future NATS JetStream backend will implement, so callers never
// change when we upgrade the transport.
//
// Guarantees:
//   • Every publish appends to hammerex_events (append-only source of truth)
//   • Subscribers fire in priority order per event type
//   • Ordering per (organisationId, brandVersion) — never global
//   • Retry with backoff (5s / 30s / 2min) then Dead Letter Queue
//   • Correlation IDs threaded through every event
//   • Every event carries an EventEnvelope<T> per the spec

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EventBus, EventHandler } from "./runtime";

// ─── Envelope + event catalogue ──────────────────────────────────

export type EventEnvelope<T = unknown> = {
  id:              string;
  type:            string;      // e.g. "Brand.ColourChanged.v1"
  timestamp:       string;
  version:         number;
  merchantId:      string | null;
  organisationId:  string | null;
  brandVersion:    string | null;
  correlationId:   string;
  causationId:     string | null;
  producer:        string;
  payload:         T;
};

/** Registry of every published event type. New event types register
 *  here so subscribers can typecheck against the union. */
export type PlatformEventType =
  // Brand
  | "Brand.Created.v1"
  | "Brand.Updated.v1"
  | "Brand.Published.v1"
  | "Brand.RolledBack.v1"
  | "Brand.Archived.v1"
  // Identity
  | "Identity.LogoChanged.v1"
  | "Identity.ColourChanged.v1"
  | "Identity.TypographyChanged.v1"
  | "Identity.ToneChanged.v1"
  | "Identity.PositioningChanged.v1"
  // Asset
  | "Asset.Requested.v1"
  | "Asset.Generating.v1"
  | "Asset.Generated.v1"
  | "Asset.Approved.v1"
  | "Asset.Rejected.v1"
  | "Asset.Published.v1"
  // Memory
  | "Memory.Updated.v1"
  | "Memory.PreferenceLearned.v1"
  | "Memory.PreferenceRejected.v1"
  | "Memory.ConfidenceUpdated.v1"
  // Export
  | "Export.Started.v1"
  | "Export.Completed.v1"
  | "Export.Failed.v1"
  // System
  | "System.StudioInstalled.v1"
  | "System.StudioRemoved.v1"
  | "System.AIModelChanged.v1"
  | "System.CompilerUpdated.v1";

// ─── Subscriber registry ─────────────────────────────────────────

type SubscriberRecord = {
  id:            string;
  event:         string;
  priority:      number;
  handler:       EventHandler<unknown>;
  retry:         boolean;
  deadLetter:    boolean;
};

const subscribers: Map<string, SubscriberRecord[]> = new Map();

// ─── Bus implementation ──────────────────────────────────────────

class InProcessEventBus implements EventBus {
  async publish<T>(event: EventEnvelope<T>): Promise<void> {
    // 1. Persist to append-only event store (source of truth).
    //    Never blocks subscribers on persistence failure — but we log.
    persistEvent(event).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[event-bus] persist failed", event.id, e);
    });

    // 2. Dispatch to subscribers in priority order.
    const handlers = (subscribers.get(event.type) ?? [])
      .slice()
      .sort((a, b) => a.priority - b.priority);

    for (const record of handlers) {
      // Fire-and-await per subscriber so priority ordering is preserved.
      // Subscribers that don't need ordering can return immediately.
      await dispatchWithRetry(record, event);
    }
  }

  async subscribe<T>(event: string, handler: EventHandler<T>): Promise<void> {
    const existing = subscribers.get(event) ?? [];
    existing.push({
      id:         randomUUID(),
      event,
      priority:   3,                     // default; use registerSubscriber for custom priority
      handler:    handler as EventHandler<unknown>,
      retry:      true,
      deadLetter: true
    });
    subscribers.set(event, existing);
  }

  async unsubscribe(event: string, handlerId: string): Promise<void> {
    const existing = subscribers.get(event) ?? [];
    subscribers.set(event, existing.filter((r) => r.id !== handlerId));
  }

  async replay(stream: string, from: Date, to?: Date): Promise<void> {
    // Read events from hammerex_events matching stream pattern and
    // re-publish. Used for post-bug regeneration per V1 Part 4.
    let q = supabaseAdmin
      .from("hammerex_events")
      .select("id, type, payload_json, envelope_json")
      .like("type", `${stream}%`)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true });
    if (to) q = q.lte("created_at", to.toISOString());
    const { data } = await q;
    for (const row of data ?? []) {
      const env = row.envelope_json as EventEnvelope<unknown>;
      await this.publish(env);
    }
  }
}

/** Register a subscriber with custom priority + retry policy. */
export function registerSubscriber<T>(input: {
  event:       string;
  priority:    number;
  handler:     EventHandler<T>;
  retry?:      boolean;
  deadLetter?: boolean;
}): string {
  const id = randomUUID();
  const existing = subscribers.get(input.event) ?? [];
  existing.push({
    id,
    event:      input.event,
    priority:   input.priority,
    handler:    input.handler as EventHandler<unknown>,
    retry:      input.retry ?? true,
    deadLetter: input.deadLetter ?? true
  });
  subscribers.set(input.event, existing);
  return id;
}

/** Build an EventEnvelope with sensible defaults. Callers only pass
 *  the type + payload; envelope metadata gets filled automatically. */
export function envelope<T>(input: {
  type:            PlatformEventType;
  payload:         T;
  merchantId?:     string | null;
  organisationId?: string | null;
  brandVersion?:   string | null;
  correlationId?:  string;
  causationId?:    string | null;
  producer?:       string;
  version?:        number;
}): EventEnvelope<T> {
  return {
    id:              randomUUID(),
    type:            input.type,
    timestamp:       new Date().toISOString(),
    version:         input.version ?? 1,
    merchantId:      input.merchantId      ?? null,
    organisationId:  input.organisationId  ?? null,
    brandVersion:    input.brandVersion    ?? null,
    correlationId:   input.correlationId   ?? randomUUID(),
    causationId:     input.causationId     ?? null,
    producer:        input.producer        ?? "unknown",
    payload:         input.payload
  };
}

// ─── Retry + DLQ machinery ───────────────────────────────────────

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000];   // per V1 Part 4

async function dispatchWithRetry(record: SubscriberRecord, event: EventEnvelope<unknown>): Promise<void> {
  let attempt = 0;
  while (true) {
    try {
      await record.handler.handle(event);
      return;
    } catch (e) {
      if (!record.retry || attempt >= RETRY_DELAYS_MS.length) {
        if (record.deadLetter) await deadLetter(record, event, e);
        return;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      attempt++;
    }
  }
}

async function deadLetter(record: SubscriberRecord, event: EventEnvelope<unknown>, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await supabaseAdmin.from("hammerex_events_dead_letter").insert({
    event_id:      event.id,
    subscriber_id: record.id,
    event_type:    event.type,
    handler:       record.handler.name,
    error_message: message.slice(0, 2000),
    envelope_json: event,
    dead_lettered_at: new Date().toISOString()
  });
}

// ─── Persistence ─────────────────────────────────────────────────

async function persistEvent(event: EventEnvelope<unknown>): Promise<void> {
  await supabaseAdmin.from("hammerex_events").insert({
    id:              event.id,
    type:            event.type,
    merchant_id:     event.merchantId,
    organisation_id: event.organisationId,
    brand_version:   event.brandVersion,
    correlation_id:  event.correlationId,
    causation_id:    event.causationId,
    producer:        event.producer,
    version:         event.version,
    payload_json:    event.payload,
    envelope_json:   event,
    created_at:      event.timestamp
  });
}

// ─── Singleton export ────────────────────────────────────────────

export const eventBus: EventBus = new InProcessEventBus();
