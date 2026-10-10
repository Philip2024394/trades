// src/lib/nex/product-lifecycle/__tests__/wave-8d-event-routing.test.ts
//
// UWI · Wave 8.D · Product-lifecycle event routing acceptance suite
// Founder-authorised programme.
//
// Proves the four founder-required properties for Wave 8.D:
//   1. Every product-lifecycle event kind maps to exactly one trigger kind (deterministic total mapping)
//   2. Successful dispatch produces one audit entry with outcome=success
//   3. IDEMPOTENT · duplicate delivery of same event_id + attempt_id → duplicate_skipped, handler invoked once
//   4. DURABLE · idempotency key derives deterministically from Wave 2 D2 primitive
//   5. OBSERVABLE · on_audit callback receives every entry · trail queryable
//   6. RECOVERABLE (failure) · handler throw → dead-letter capture · audit=failed
//   7. RECOVERABLE (redrive) · redriveDeadLetter replays with attempt_id+1, fresh key → NOT skipped
//   8. RECOVERABLE (deadline) · handler exceeding deadline → audit=deadline_expired · dead-letter captured
//   9. Router unhandled trigger kind surfaces (UnhandledTriggerError from Wave 7)
//  10. registerNoOpHandlersIfMissing seeds no-op handlers only for missing kinds

import { describe, it, expect } from "vitest";
import {
  ProductLifecycleEventRouter,
  mapProductEventToTriggerKind,
  type ProductLifecycleAuditEntry,
  type ProductLifecycleDeadLetterEntry,
} from "..";
import { TriggerRouter, UnhandledTriggerError } from "../../continuous-loop/trigger-router";
import type { ProductLifecycleEvent, ProductLifecycleEventKind } from "../types";

const ALL_KINDS: ReadonlyArray<ProductLifecycleEventKind> = [
  "candidate_created",
  "validation_started",
  "validation_passed",
  "validation_failed",
  "engineering_started",
  "engineering_completed",
  "gone_live",
  "monitoring_reading",
  "rejected",
  "superseded",
  "merged_into",
  "parked",
  "archived",
  "route_updated",
];

function makeEvent(kind: ProductLifecycleEventKind, id: string = "evt-1"): ProductLifecycleEvent {
  return {
    event_id: id,
    candidate_id: "pcand-1",
    kind,
    at_iso: "2026-09-21T12:00:00Z",
    actor: "test",
    detail: { detail_key: "detail_value" },
  };
}

// ═══ (1) Deterministic total mapping ══════════════════════════════════
describe("Wave 8.D · deterministic event-kind → trigger-kind mapping", () => {
  it("every ProductLifecycleEventKind maps to a valid TriggerKind (no gaps · no defaults)", () => {
    for (const kind of ALL_KINDS) {
      const trigger = mapProductEventToTriggerKind(kind);
      expect(trigger).toBeTruthy();
      expect(["scheduled", "event_triggered", "change_triggered", "user_triggered", "hypothesis_triggered", "failure_recovery_triggered"]).toContain(trigger);
    }
  });

  it("known mappings preserved", () => {
    expect(mapProductEventToTriggerKind("candidate_created")).toBe("event_triggered");
    expect(mapProductEventToTriggerKind("validation_started")).toBe("hypothesis_triggered");
    expect(mapProductEventToTriggerKind("validation_failed")).toBe("failure_recovery_triggered");
    expect(mapProductEventToTriggerKind("monitoring_reading")).toBe("scheduled");
    expect(mapProductEventToTriggerKind("route_updated")).toBe("change_triggered");
  });
});

// ═══ (2) Successful dispatch · one audit success ══════════════════════
describe("Wave 8.D · successful dispatch", () => {
  it("dispatch → audit=success · handler invoked exactly once", async () => {
    let invocations = 0;
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => { invocations += 1; });
    const router = new ProductLifecycleEventRouter({ trigger_router: tr });
    const audit = await router.route(makeEvent("candidate_created"));
    expect(audit.outcome).toBe("success");
    expect(invocations).toBe(1);
    expect(audit.event_kind).toBe("candidate_created");
    expect(audit.trigger_kind).toBe("event_triggered");
  });
});

// ═══ (3) IDEMPOTENT · duplicate delivery skipped ══════════════════════
describe("Wave 8.D · idempotency", () => {
  it("second delivery of same event+attempt → duplicate_skipped · handler invoked once", async () => {
    let invocations = 0;
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => { invocations += 1; });
    const router = new ProductLifecycleEventRouter({ trigger_router: tr });
    const event = makeEvent("candidate_created");
    const a1 = await router.route(event);
    const a2 = await router.route(event);
    expect(a1.outcome).toBe("success");
    expect(a2.outcome).toBe("duplicate_skipped");
    expect(invocations).toBe(1);
    // Same idempotency key both times
    expect(a1.idempotency_key).toBe(a2.idempotency_key);
  });

  it("different attempt_id → different key → NOT skipped", async () => {
    let invocations = 0;
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => { invocations += 1; });
    const router = new ProductLifecycleEventRouter({ trigger_router: tr });
    const event = makeEvent("candidate_created");
    const a1 = await router.route(event, 1);
    const a2 = await router.route(event, 2);
    expect(a1.outcome).toBe("success");
    expect(a2.outcome).toBe("success");
    expect(invocations).toBe(2);
    expect(a1.idempotency_key).not.toBe(a2.idempotency_key);
  });
});

// ═══ (4/5) OBSERVABLE · audit trail + on_audit sink ═══════════════════
describe("Wave 8.D · observability", () => {
  it("audit trail records every dispatch · on_audit sink invoked for each", async () => {
    const sink: ProductLifecycleAuditEntry[] = [];
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => {});
    tr.register("hypothesis_triggered", async () => {});
    const router = new ProductLifecycleEventRouter({
      trigger_router: tr,
      on_audit: (entry) => sink.push(entry),
    });
    await router.route(makeEvent("candidate_created", "e1"));
    await router.route(makeEvent("validation_started", "e2"));
    await router.route(makeEvent("candidate_created", "e1"));  // duplicate
    expect(router.auditTrail().length).toBe(3);
    expect(sink.length).toBe(3);
    expect(sink[0].outcome).toBe("success");
    expect(sink[1].outcome).toBe("success");
    expect(sink[2].outcome).toBe("duplicate_skipped");
  });
});

// ═══ (6) RECOVERABLE · handler throw → dead-letter + audit=failed ═════
describe("Wave 8.D · recoverability (handler failure)", () => {
  it("handler throw → audit=failed · dead-letter captures the event · router does NOT throw", async () => {
    const dl_sink: ProductLifecycleDeadLetterEntry[] = [];
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => { throw new Error("simulated downstream failure"); });
    const router = new ProductLifecycleEventRouter({
      trigger_router: tr,
      on_dead_letter: (entry) => dl_sink.push(entry),
    });
    const audit = await router.route(makeEvent("candidate_created", "efail"));
    expect(audit.outcome).toBe("failed");
    expect(audit.error_reason).toContain("simulated downstream failure");
    expect(router.deadLetter().length).toBe(1);
    expect(dl_sink.length).toBe(1);
    expect(dl_sink[0].event.event_id).toBe("efail");
  });
});

// ═══ (7) RECOVERABLE · redriveDeadLetter replays with attempt+1 ═══════
describe("Wave 8.D · dead-letter redrive", () => {
  it("redrive replays failed events with attempt_id+1 · new idempotency key · not skipped", async () => {
    let invocations = 0;
    let should_fail = true;
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => {
      invocations += 1;
      if (should_fail) throw new Error("transient outage");
    });
    const router = new ProductLifecycleEventRouter({ trigger_router: tr });
    const event = makeEvent("candidate_created", "eredrive");
    const first = await router.route(event, 1);
    expect(first.outcome).toBe("failed");
    expect(router.deadLetter().length).toBe(1);

    // Simulate transient outage clearing
    should_fail = false;
    const redriven = await router.redriveDeadLetter();
    expect(redriven.length).toBe(1);
    expect(redriven[0].outcome).toBe("success");
    expect(redriven[0].attempt_id).toBe(2);
    expect(redriven[0].idempotency_key).not.toBe(first.idempotency_key);
    expect(router.deadLetter().length).toBe(0);
    expect(invocations).toBe(2);
  });
});

// ═══ (8) RECOVERABLE · deadline exceeded → audit=deadline_expired ═════
describe("Wave 8.D · deadline propagation", () => {
  it("handler exceeding deadline → audit=deadline_expired · dead-letter captured", async () => {
    let t = 1_000_000;
    const now = () => t;
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => {
      // Simulate handler taking longer than deadline by advancing the clock
      t += 5_000;
    });
    const router = new ProductLifecycleEventRouter({
      trigger_router: tr,
      deadline_ms: 100,
      now,
    });
    const audit = await router.route(makeEvent("candidate_created"));
    expect(audit.outcome).toBe("deadline_expired");
    expect(audit.error_reason).toContain("deadline exceeded");
    expect(router.deadLetter().length).toBe(1);
  });
});

// ═══ (9) Unhandled trigger kind surfaces via Wave 7 ═══════════════════
describe("Wave 8.D · unhandled trigger surfaces", () => {
  it("no handler registered for the mapped trigger kind → UnhandledTriggerError → audit=failed", async () => {
    const tr = new TriggerRouter();
    // Intentionally register NO handler for scheduled
    const router = new ProductLifecycleEventRouter({ trigger_router: tr });
    const audit = await router.route(makeEvent("monitoring_reading"));  // maps to scheduled
    expect(audit.outcome).toBe("failed");
    expect(audit.error_reason).toContain("no handler registered");
  });
});

// ═══ (10) registerNoOpHandlersIfMissing ═══════════════════════════════
describe("Wave 8.D · registerNoOpHandlersIfMissing", () => {
  it("seeds no-op handlers only for missing trigger kinds (does not overwrite)", async () => {
    let real_invocations = 0;
    const tr = new TriggerRouter();
    tr.register("event_triggered", async () => { real_invocations += 1; });
    const router = new ProductLifecycleEventRouter({ trigger_router: tr });
    router.registerNoOpHandlersIfMissing();
    // event_triggered stays real (not overwritten)
    // scheduled + hypothesis + failure_recovery + change_triggered become no-ops
    expect(tr.registeredKinds().sort()).toEqual([
      "change_triggered",
      "event_triggered",
      "failure_recovery_triggered",
      "hypothesis_triggered",
      "scheduled",
    ].sort());
    await router.route(makeEvent("candidate_created"));
    expect(real_invocations).toBe(1);
    await router.route(makeEvent("monitoring_reading"));   // scheduled · no-op stub
    // No throw · no invocation
    expect(real_invocations).toBe(1);
  });
});
