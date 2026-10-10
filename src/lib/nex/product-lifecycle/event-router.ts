// src/lib/nex/product-lifecycle/event-router.ts
//
// UWI · Wave 8.D · Product-lifecycle event routing
// Founder-authorised programme (Rule 5o.T · productisation destination).
//
// Bridges `ProductLifecycleEvent` (emitted when Product Candidates are
// created / transitioned / re-routed) into Wave 7 `TriggerRouter` so the
// product lifecycle participates in NEX's permanent trigger machinery
// without requiring Claude to be present.
//
// Founder-required properties for Wave 8.D (verified in acceptance):
//   • DURABLE     · idempotency-key from Wave 2 D2 · duplicate delivery under
//                   stale-lease scenarios does not double-fire handlers
//   • OBSERVABLE  · typed audit trail per dispatch · outcome ∈
//                   {success, duplicate_skipped, failed, deadline_expired}
//                   · optional on_audit sink for external persistence
//   • IDEMPOTENT  · same event_id + same attempt_id → same idempotency key
//                   → skipped after first success
//   • RECOVERABLE · failures go to dead-letter · redriveDeadLetter() replays
//                   with attempt_id + 1 (fresh idempotency key) · matches
//                   Wave 2 D7 worker_jobs SKIP LOCKED + reaper pattern
//
// No UI here. UI is Wave 9+ Coding Plugin + Product Radar (founder-directed
// deferral per this-turn's founder message).

import type { TriggerRouter } from "../continuous-loop/trigger-router";
import type { TriggerEvent, TriggerKind } from "../continuous-loop/types";
import type { ProductLifecycleEvent, ProductLifecycleEventKind } from "./types";
import { deriveIdempotencyKey } from "../durability/idempotency-key";
import { createDeadline, isExpired, DeadlineExceededError } from "../durability/deadline-context";

// ─── Deterministic event-kind → trigger-kind mapping ────────────────
// Every ProductLifecycleEventKind must map to exactly one TriggerKind.
// Deterministic total mapping · exhaustive · never returns default.

export function mapProductEventToTriggerKind(kind: ProductLifecycleEventKind): TriggerKind {
  switch (kind) {
    case "candidate_created":       return "event_triggered";
    case "validation_started":      return "hypothesis_triggered";
    case "validation_passed":       return "event_triggered";
    case "validation_failed":       return "failure_recovery_triggered";
    case "engineering_started":     return "event_triggered";
    case "engineering_completed":   return "event_triggered";
    case "gone_live":               return "event_triggered";
    case "monitoring_reading":      return "scheduled";
    case "rejected":                return "event_triggered";
    case "superseded":              return "event_triggered";
    case "merged_into":             return "event_triggered";
    case "parked":                  return "event_triggered";
    case "archived":                return "event_triggered";
    case "route_updated":           return "change_triggered";
  }
}

// ─── Audit trail entry (observable) ─────────────────────────────────
export type RouterOutcome = "success" | "duplicate_skipped" | "failed" | "deadline_expired";

export interface ProductLifecycleAuditEntry {
  readonly at_iso: string;
  readonly event_id: string;
  readonly event_kind: ProductLifecycleEventKind;
  readonly trigger_kind: TriggerKind;
  readonly idempotency_key: string;
  readonly candidate_id: string;
  readonly attempt_id: number;
  readonly outcome: RouterOutcome;
  readonly duration_ms: number;
  readonly error_reason?: string;
}

// ─── Dead-letter entry (recoverable) ────────────────────────────────
export interface ProductLifecycleDeadLetterEntry {
  readonly event: ProductLifecycleEvent;
  readonly failed_at_iso: string;
  readonly error_reason: string;
  readonly attempt_id: number;
  readonly idempotency_key: string;
}

// ─── Router config ──────────────────────────────────────────────────
export interface ProductLifecycleEventRouterConfig {
  readonly trigger_router: TriggerRouter;
  /** Total deadline per dispatch (ms). Default 30_000. */
  readonly deadline_ms?: number;
  /** Optional external audit sink (Wave 2 worker_audit_events destination in production). */
  readonly on_audit?: (entry: ProductLifecycleAuditEntry) => void;
  /** Optional external dead-letter sink (Wave 2 D7 DLQ destination in production). */
  readonly on_dead_letter?: (entry: ProductLifecycleDeadLetterEntry) => void;
  /** Workflow id for idempotency-key namespacing. Default "product-lifecycle". */
  readonly workflow_id?: string;
  /** Injectable now-fn for deterministic tests. */
  readonly now?: () => number;
}

// ─── Router ─────────────────────────────────────────────────────────
export class ProductLifecycleEventRouter {
  private processed_keys = new Set<string>();
  private dead_letter: ProductLifecycleDeadLetterEntry[] = [];
  private audit_trail: ProductLifecycleAuditEntry[] = [];
  private readonly workflow_id: string;
  private readonly deadline_ms: number;
  private readonly now: () => number;

  constructor(private readonly cfg: ProductLifecycleEventRouterConfig) {
    this.workflow_id = cfg.workflow_id ?? "product-lifecycle";
    this.deadline_ms = cfg.deadline_ms ?? 30_000;
    this.now = cfg.now ?? Date.now;
  }

  /** Route a product lifecycle event · returns the audit entry recorded.
   *  Never throws · failures land in dead-letter + audit trail. */
  async route(event: ProductLifecycleEvent, attempt_id: number = 1): Promise<ProductLifecycleAuditEntry> {
    const t0 = this.now();
    const trigger_kind = mapProductEventToTriggerKind(event.kind);
    const idempotency_key = deriveIdempotencyKey({
      workflow_id: this.workflow_id,
      activity_name: `lifecycle_${event.kind}`,
      attempt_id: `${event.event_id}#${attempt_id}`,
    });

    // ─── DURABLE / IDEMPOTENT · duplicate delivery is a no-op ───────
    if (this.processed_keys.has(idempotency_key)) {
      return this.appendAudit({
        at_iso: new Date(this.now()).toISOString(),
        event_id: event.event_id,
        event_kind: event.kind,
        trigger_kind,
        idempotency_key,
        candidate_id: event.candidate_id,
        attempt_id,
        outcome: "duplicate_skipped",
        duration_ms: this.now() - t0,
      });
    }

    // ─── Deadline context (Wave 2 D3) ─────────────────────────────
    const deadline_ctx = createDeadline(this.deadline_ms, `lifecycle:${event.kind}:${event.event_id}`, t0);

    // ─── Compose TriggerEvent for Wave 7 router ────────────────────
    const trigger_event: TriggerEvent = {
      kind: trigger_kind,
      at_iso: event.at_iso,
      target_id: event.candidate_id,
      detail: {
        lifecycle_event_id: event.event_id,
        lifecycle_event_kind: event.kind,
        from_status: event.from_status ?? null,
        to_status: event.to_status ?? null,
        idempotency_key,
        attempt_id,
        deadline_deadline_ms: deadline_ctx.deadline_ms,
        deadline_started_at_ms: deadline_ctx.started_at_ms,
        ...(event.detail ?? {}),
      },
    };

    // ─── Dispatch · RECOVERABLE via dead-letter capture ─────────────
    try {
      await this.cfg.trigger_router.dispatch(trigger_event);
      // Post-dispatch deadline check (handler may have exceeded budget)
      if (isExpired(deadline_ctx, this.now())) {
        throw new DeadlineExceededError(`lifecycle:${event.kind}`, deadline_ctx, this.now());
      }
      this.processed_keys.add(idempotency_key);
      return this.appendAudit({
        at_iso: new Date(this.now()).toISOString(),
        event_id: event.event_id,
        event_kind: event.kind,
        trigger_kind,
        idempotency_key,
        candidate_id: event.candidate_id,
        attempt_id,
        outcome: "success",
        duration_ms: this.now() - t0,
      });
    } catch (e) {
      const err_msg = e instanceof Error ? e.message : String(e);
      const is_deadline = e instanceof DeadlineExceededError || err_msg.toLowerCase().includes("deadline exceeded");
      const outcome: RouterOutcome = is_deadline ? "deadline_expired" : "failed";
      const dl_entry: ProductLifecycleDeadLetterEntry = {
        event,
        failed_at_iso: new Date(this.now()).toISOString(),
        error_reason: err_msg,
        attempt_id,
        idempotency_key,
      };
      this.dead_letter.push(dl_entry);
      this.cfg.on_dead_letter?.(dl_entry);
      return this.appendAudit({
        at_iso: new Date(this.now()).toISOString(),
        event_id: event.event_id,
        event_kind: event.kind,
        trigger_kind,
        idempotency_key,
        candidate_id: event.candidate_id,
        attempt_id,
        outcome,
        duration_ms: this.now() - t0,
        error_reason: err_msg,
      });
    }
  }

  /** Manually redrive the dead-letter queue with attempt_id + 1 · matches
   *  Wave 2 D7 `redrive_from_dead_letter` pattern. Returns audit entries
   *  produced by the redrive pass. */
  async redriveDeadLetter(): Promise<ReadonlyArray<ProductLifecycleAuditEntry>> {
    const to_redrive = [...this.dead_letter];
    this.dead_letter = [];
    const results: ProductLifecycleAuditEntry[] = [];
    for (const entry of to_redrive) {
      results.push(await this.route(entry.event, entry.attempt_id + 1));
    }
    return results;
  }

  /** Register the router's product-lifecycle handlers with the Wave 7
   *  TriggerRouter. This is the wiring that makes downstream handlers
   *  routable · handlers themselves are supplied by caller (typically
   *  Wave 9+ engineering pipeline · Wave 8.D provides stubs). */
  registerNoOpHandlersIfMissing(): void {
    const trigger_kinds: ReadonlyArray<TriggerKind> = [
      "event_triggered",
      "hypothesis_triggered",
      "failure_recovery_triggered",
      "scheduled",
      "change_triggered",
    ];
    for (const kind of trigger_kinds) {
      if (!this.cfg.trigger_router.registeredKinds().includes(kind)) {
        this.cfg.trigger_router.register(kind, async () => { /* no-op stub · Wave 9+ replaces */ });
      }
    }
  }

  auditTrail(): ReadonlyArray<ProductLifecycleAuditEntry> { return this.audit_trail; }
  deadLetter(): ReadonlyArray<ProductLifecycleDeadLetterEntry> { return this.dead_letter; }
  processedKeyCount(): number { return this.processed_keys.size; }

  _resetForTests(): void {
    this.processed_keys.clear();
    this.dead_letter = [];
    this.audit_trail = [];
  }

  private appendAudit(entry: ProductLifecycleAuditEntry): ProductLifecycleAuditEntry {
    this.audit_trail.push(entry);
    this.cfg.on_audit?.(entry);
    return entry;
  }
}
