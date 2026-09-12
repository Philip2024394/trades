// src/lib/nex/production-hygiene/streaming-reconnect.ts
//
// WAVE-P-4 · GAP-9 · SSE reconnection · Last-Event-ID replay
// Founder BEGIN WAVE-P-4 · 2026-09-08

import type { ReconnectRequest, ReplayResult, SseEvent } from "./types";

/** In-memory session buffer · caller may snapshot for persistence.
 *  Session_id ↔ ordered events. Bounded to prevent memory bloat. */
export class SseSessionBuffer {
  private sessions = new Map<string, { events: SseEvent[]; last_activity_iso: string; expires_at_ms: number }>();
  constructor(
    private readonly max_events_per_session: number = 1000,
    private readonly session_ttl_ms: number = 15 * 60 * 1000, // 15 min · matches owner-identity session cap
  ) {}

  private nowMs(): number { return Date.now(); }

  ensureSession(session_id: string): void {
    if (this.sessions.has(session_id)) return;
    this.sessions.set(session_id, {
      events: [],
      last_activity_iso: new Date().toISOString(),
      expires_at_ms: this.nowMs() + this.session_ttl_ms,
    });
  }

  append(session_id: string, event: Omit<SseEvent, "event_id" | "ts_iso"> & Partial<Pick<SseEvent, "event_id" | "ts_iso">>): SseEvent {
    this.ensureSession(session_id);
    const s = this.sessions.get(session_id)!;
    const next_seq = s.events.length + 1;
    const full: SseEvent = {
      event_id: event.event_id ?? String(next_seq),
      event_type: event.event_type,
      data: event.data,
      ts_iso: event.ts_iso ?? new Date().toISOString(),
    };
    s.events.push(full);
    // Trim to bounded window
    if (s.events.length > this.max_events_per_session) {
      s.events.splice(0, s.events.length - this.max_events_per_session);
    }
    s.last_activity_iso = full.ts_iso;
    s.expires_at_ms = this.nowMs() + this.session_ttl_ms;
    return full;
  }

  /** Replay events after the given last_event_id. Returns everything
   *  strictly newer than last_event_id (numeric-compared when both
   *  parse to numbers · lexicographically otherwise). */
  replay(req: ReconnectRequest): ReplayResult {
    const s = this.sessions.get(req.session_id);
    if (!s) {
      return { session_id: req.session_id, events_replayed: [], first_new_event_id: null, session_expired: true };
    }
    if (this.nowMs() >= s.expires_at_ms) {
      this.sessions.delete(req.session_id);
      return { session_id: req.session_id, events_replayed: [], first_new_event_id: null, session_expired: true };
    }
    if (!req.last_event_id) {
      // Client has nothing · replay everything
      return {
        session_id: req.session_id,
        events_replayed: [...s.events],
        first_new_event_id: s.events.length > 0 ? s.events[0].event_id : null,
        session_expired: false,
      };
    }
    // Find first event strictly newer than last_event_id
    const idx = s.events.findIndex((e) => compareEventIds(e.event_id, req.last_event_id!) > 0);
    if (idx === -1) {
      return { session_id: req.session_id, events_replayed: [], first_new_event_id: null, session_expired: false };
    }
    const events_replayed = s.events.slice(idx);
    return {
      session_id: req.session_id,
      events_replayed,
      first_new_event_id: events_replayed.length > 0 ? events_replayed[0].event_id : null,
      session_expired: false,
    };
  }

  /** For tests · clear all. */
  reset(): void {
    this.sessions.clear();
  }

  size(): number {
    return this.sessions.size;
  }
}

/** Compare two event ids · returns positive when a > b · deterministic. */
export function compareEventIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
