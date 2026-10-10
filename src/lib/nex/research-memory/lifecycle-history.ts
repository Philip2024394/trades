// src/lib/nex/research-memory/lifecycle-history.ts
//
// UWI · Wave 5 · M19 · Immutable lifecycle_history event log per opportunity
// Founder-authorised programme.
//
// Founder-locked doctrine (ADR-0304 §5 promotion_events pattern +
// existing worker_audit_events immutability trigger):
//   State is a projection · history is truth.
//
// Every opportunity has an append-only event log. Consumers reconstruct
// current state by folding events. Never DELETE. Never UPDATE. Ever.

import type { LifecycleEvent, LifecycleEventKind, OpportunityStatus } from "./types";

/** In-memory append-only store. Production integration will back this
 *  with Postgres (mirroring worker_audit_events immutability trigger). */
export class LifecycleHistoryLog {
  private events: LifecycleEvent[] = [];

  append(event: Omit<LifecycleEvent, "event_id">): LifecycleEvent {
    const with_id: LifecycleEvent = {
      ...event,
      event_id: `evt-${this.events.length + 1}-${Date.now().toString(36)}`,
    };
    this.events.push(with_id);
    return with_id;
  }

  /** Return the full event log for one opportunity (read-only view). */
  forOpportunity(opportunity_id: string): ReadonlyArray<LifecycleEvent> {
    return this.events.filter(e => e.opportunity_id === opportunity_id);
  }

  /** Fold the event log into the current status projection. Deterministic. */
  currentStatus(opportunity_id: string): OpportunityStatus | null {
    const log = this.forOpportunity(opportunity_id);
    let status: OpportunityStatus | null = null;
    for (const e of log) {
      if (e.kind === "status_changed" && e.to_status) status = e.to_status;
      else if (e.kind === "created" && e.to_status) status = e.to_status;
      else if (e.kind === "promoted_to_idea") status = "PROMOTED";
      else if (e.kind === "merged_into") status = "MERGED";
      else if (e.kind === "superseded_by") status = "SUPERSEDED";
      else if (e.kind === "parked") status = "PARKED";
      else if (e.kind === "archived") status = "ARCHIVED";
      else if (e.kind === "rejected") status = "REJECTED";
    }
    return status;
  }

  /** Enumerate all supporting-signal additions for one opportunity. */
  supportingSignals(opportunity_id: string): ReadonlyArray<string> {
    const out: string[] = [];
    for (const e of this.forOpportunity(opportunity_id)) {
      if (e.kind === "supporting_signal_added" && typeof e.detail?.signal === "string") {
        out.push(e.detail.signal as string);
      }
    }
    return out;
  }

  /** Enumerate all contradicting-signal additions for one opportunity. */
  contradictingSignals(opportunity_id: string): ReadonlyArray<string> {
    const out: string[] = [];
    for (const e of this.forOpportunity(opportunity_id)) {
      if (e.kind === "contradicting_signal_added" && typeof e.detail?.signal === "string") {
        out.push(e.detail.signal as string);
      }
    }
    return out;
  }

  /** Absolute count of events across all opportunities. */
  size(): number { return this.events.length; }

  /** Absolute count of events for one opportunity. */
  countFor(opportunity_id: string): number {
    return this.events.filter(e => e.opportunity_id === opportunity_id).length;
  }

  /** Test-only reset. */
  _resetForTests(): void { this.events = []; }
}

/** Kind-safe factory helper for common event shapes. */
export function makeEvent(input: {
  opportunity_id: string;
  kind: LifecycleEventKind;
  actor: string;
  at_iso?: string;
  from_status?: OpportunityStatus | null;
  to_status?: OpportunityStatus | null;
  detail?: Record<string, unknown>;
}): Omit<LifecycleEvent, "event_id"> {
  return {
    opportunity_id: input.opportunity_id,
    kind: input.kind,
    actor: input.actor,
    at_iso: input.at_iso ?? new Date().toISOString(),
    from_status: input.from_status ?? null,
    to_status: input.to_status ?? null,
    detail: input.detail,
  };
}
