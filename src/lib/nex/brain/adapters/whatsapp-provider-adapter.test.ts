// src/lib/nex/brain/adapters/whatsapp-provider-adapter.test.ts
//
// Stage 3.38 · Provider-backed WhatsApp adapter · state-machine
// isolation tests (Philip 2026-08-31).
//
// CONSTITUTIONAL guarantees (must ALL stay green):
//   P1  Provider "accepted"  → chain finalState UNKNOWN (never VERIFIED)
//   P2  Provider "delivered" (with proof) → chain finalState VERIFIED
//   P3  Provider "rejected"  → chain finalState FAILED
//   P4  Provider throws      → chain finalState FAILED via "unreachable"
//   P5  Provider TIMEOUT     → chain finalState UNKNOWN (NEVER FAILED)
//   P6  Second execute call for same correlationId  → adapter returns
//                              "unreachable" with IdempotencyNotAvailable
//                              message. No auto-retry. Chain FAILED.
//   P7  Outbox records every attempt with correct status
//   P8  Missing contact channel / phone / body → rejected (never sent)
//   P9  Adapter never invokes provider a second time for the same
//                              correlationId
//   P10 Composer G7 · UNKNOWN reply never claims success

import { describe, expect, it, beforeEach } from "vitest";
import { runActionChain } from "../action-chain";
import { makeWhatsAppProviderAdapter } from "./whatsapp-provider-adapter";
import {
  _resetOutboxForTests,
  getOutboxEntry,
  outboxSizeForTests,
} from "./whatsapp-outbox";
import type { WhatsAppProvider, ProviderSendOutcome } from "./whatsapp-provider";
import type { ActionChainTarget, AuthorizationState } from "../action-audit";
import { findSuccessLanguageLeaks } from "../action-composer";
import { composeActionReply } from "../action-composer";

// ─── Fixtures ──────────────────────────────────────────────────────

const NOW = () => "2026-08-31T10:00:00.000Z";
const grantedAuth: AuthorizationState = {
  state: "GRANTED", source: "user_reply", at: NOW(), evidence: "user said yes",
};
const target: ActionChainTarget = {
  canonical: "Gaotama Hotel", refId: "biz_g",
  contactChannel: { kind: "whatsapp", value: "+62 812 3456 7890", source: "world_record" },
  resolvedAt: NOW(),
};

function makeProvider(outcome: ProviderSendOutcome | Error, spy = { calls: 0 }): WhatsAppProvider {
  return {
    id: "test",
    supportsIdempotencyKey: false,
    async send() {
      spy.calls += 1;
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
}

beforeEach(() => _resetOutboxForTests());

// ─── P1 · accepted → UNKNOWN ───────────────────────────────────────

describe("P1 · provider accepted → chain UNKNOWN (never VERIFIED)", () => {
  it("adapter returns accepted with pending{webhook} · chain finalState = UNKNOWN", async () => {
    const spy = { calls: 0 };
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({ kind: "accepted", providerMessageId: "wamid.abc", providerRawStatus: "queued" }, spy),
      now: NOW,
    });
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "yes send it",
      target,
      authorization: grantedAuth,
      adapter,
      payload: { body: "Hello, do you have a room tonight?" },
      now: NOW,
    });
    expect(spy.calls).toBe(1);
    expect(audit.finalState).toBe("UNKNOWN");
    expect(audit.execution.state).toBe("EXECUTED");
    expect(audit.execution.outcome?.kind).toBe("accepted");
    // Outbox reflects the state
    const entry = await getOutboxEntry(audit.execution.correlationId!);
    expect(entry?.status).toBe("ACCEPTED");
    expect(entry?.providerMessageId).toBe("wamid.abc");
    // Reply must be honest
    const reply = composeActionReply(audit, "en");
    expect(findSuccessLanguageLeaks(reply)).toEqual([]);
    expect(reply.toLowerCase()).toContain("don't have delivery confirmation");
  });
});

// ─── P2 · delivered → VERIFIED ─────────────────────────────────────

describe("P2 · provider delivered with proof → chain VERIFIED", () => {
  it("adapter maps to delivered · delivery_receipt proof carries provider id", async () => {
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({
        kind: "delivered",
        providerMessageId: "wamid.d1",
        providerRawStatus: "delivered",
        deliveredAt: "2026-08-31T10:00:05.000Z",
      }),
      now: NOW,
    });
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "yes",
      target,
      authorization: grantedAuth,
      adapter,
      payload: { body: "hi" },
      now: NOW,
    });
    expect(audit.finalState).toBe("VERIFIED");
    expect(audit.verification.evidence[0].kind).toBe("delivery_receipt");
    expect(audit.verification.evidence[0].externalId).toBe("wamid.d1");
    const entry = await getOutboxEntry(audit.execution.correlationId!);
    expect(entry?.status).toBe("CONFIRMED");
  });
});

// ─── P3 · rejected → FAILED ────────────────────────────────────────

describe("P3 · provider rejected → chain FAILED", () => {
  it("reason propagates through the audit", async () => {
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({ kind: "rejected", reason: "invalid recipient" }),
      now: NOW,
    });
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "yes",
      target,
      authorization: grantedAuth,
      adapter,
      payload: { body: "hi" },
      now: NOW,
    });
    expect(audit.finalState).toBe("FAILED");
    expect(audit.verification.reason).toContain("invalid recipient");
    expect((await getOutboxEntry(audit.execution.correlationId!))?.status).toBe("REJECTED");
  });
});

// ─── P4 · provider throws → FAILED via unreachable ─────────────────

describe("P4 · provider throws → chain FAILED via unreachable", () => {
  it("error captured · adapter returns unreachable · executor maps to FAILED", async () => {
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider(new Error("network down")),
      now: NOW,
    });
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "yes",
      target,
      authorization: grantedAuth,
      adapter,
      payload: { body: "hi" },
      now: NOW,
    });
    expect(audit.finalState).toBe("FAILED");
    expect(audit.execution.outcome?.kind).toBe("unreachable");
    expect((await getOutboxEntry(audit.execution.correlationId!))?.status).toBe("UNKNOWN");
  });
});

// ─── P5 · timeout → UNKNOWN (never FAILED) ─────────────────────────

describe("P5 · provider hangs past timeout → chain UNKNOWN · NEVER FAILED", () => {
  it("adapter returns accepted{webhook} on timeout · chain UNKNOWN · outbox TIMED_OUT", async () => {
    const hangingProvider: WhatsAppProvider = {
      id: "hang",
      supportsIdempotencyKey: false,
      // Never resolves within our timeout budget.
      async send() {
        return new Promise<ProviderSendOutcome>(() => { /* never resolve */ });
      },
    };
    const adapter = makeWhatsAppProviderAdapter({
      provider: hangingProvider,
      timeoutMs: 25,          // tiny budget for test speed
      now: NOW,
    });
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "yes",
      target,
      authorization: grantedAuth,
      adapter,
      payload: { body: "hi" },
      now: NOW,
    });
    // CRITICAL: timeout MUST NOT become FAILED
    expect(audit.finalState).toBe("UNKNOWN");
    expect(audit.execution.outcome?.kind).toBe("accepted");
    expect((await getOutboxEntry(audit.execution.correlationId!))?.status).toBe("TIMED_OUT");
    // User-facing reply is the honest UNKNOWN phrasing
    const reply = composeActionReply(audit, "en");
    expect(findSuccessLanguageLeaks(reply)).toEqual([]);
    expect(reply.toLowerCase()).toContain("don't have delivery confirmation");
  });
});

// ─── P6 · P9 · replay guard at the outbox layer ────────────────────

describe("P6 · P9 · second send for same correlationId → no auto-retry · adapter returns unreachable", () => {
  it("provider called ONCE across two adapter invocations with identical correlationId", async () => {
    const spy = { calls: 0 };
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({ kind: "accepted", providerMessageId: "wamid.1", providerRawStatus: "queued" }, spy),
      now: NOW,
    });
    const correlationId = "corr_test_fixed";
    // First direct invocation · succeeds
    const first = await adapter.execute({
      target,
      payload: { body: "hi" },
      correlationId,
    });
    expect(first.kind).toBe("accepted");
    // Second direct invocation with the SAME correlationId · outbox refuses
    const second = await adapter.execute({
      target,
      payload: { body: "hi" },
      correlationId,
    });
    expect(second.kind).toBe("unreachable");
    if (second.kind === "unreachable") {
      expect(second.reason).toContain("Cannot retry");
      expect(second.reason).toContain(correlationId);
    }
    // Provider called ONLY ONCE
    expect(spy.calls).toBe(1);
  });
});

// ─── P7 · outbox observability ────────────────────────────────────

describe("P7 · outbox records every attempt with the correct status", () => {
  it("one attempt per correlationId · status matches provider outcome", async () => {
    const cases: Array<{ outcome: ProviderSendOutcome | Error; expectStatus: string }> = [
      { outcome: { kind: "accepted",  providerMessageId: "m1", providerRawStatus: "queued" },   expectStatus: "ACCEPTED" },
      { outcome: { kind: "delivered", providerMessageId: "m2", providerRawStatus: "delivered", deliveredAt: NOW() }, expectStatus: "CONFIRMED" },
      { outcome: { kind: "rejected",  reason: "bad number" }, expectStatus: "REJECTED" },
      { outcome: { kind: "unreachable", reason: "dns down" }, expectStatus: "UNKNOWN" },
    ];
    for (const c of cases) {
      _resetOutboxForTests();
      const adapter = makeWhatsAppProviderAdapter({ provider: makeProvider(c.outcome), now: NOW });
      await adapter.execute({ target, payload: { body: "hi" }, correlationId: "corr_" + c.expectStatus });
      const entry = await getOutboxEntry("corr_" + c.expectStatus);
      expect(entry?.status).toBe(c.expectStatus);
      expect(outboxSizeForTests()).toBe(1);
    }
  });
});

// ─── P8 · structural refusal · never sent ─────────────────────────

describe("P8 · missing channel/phone/body → adapter rejects · provider NEVER called · no outbox record", () => {
  it("no contact channel · provider not called · outbox untouched", async () => {
    const spy = { calls: 0 };
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({ kind: "accepted", providerMessageId: "x", providerRawStatus: "y" }, spy),
      now: NOW,
    });
    const bad: ActionChainTarget = { canonical: "X", resolvedAt: NOW() };
    const outcome = await adapter.execute({ target: bad, payload: { body: "hi" }, correlationId: "c1" });
    expect(outcome.kind).toBe("rejected");
    expect(spy.calls).toBe(0);
    expect(outboxSizeForTests()).toBe(0);
  });

  it("empty body · rejected · no send", async () => {
    const spy = { calls: 0 };
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({ kind: "accepted", providerMessageId: "x", providerRawStatus: "y" }, spy),
      now: NOW,
    });
    const outcome = await adapter.execute({ target, payload: { body: "   " }, correlationId: "c2" });
    expect(outcome.kind).toBe("rejected");
    expect(spy.calls).toBe(0);
    expect(outboxSizeForTests()).toBe(0);
  });

  it("garbage phone · rejected · never guesses", async () => {
    const spy = { calls: 0 };
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({ kind: "accepted", providerMessageId: "x", providerRawStatus: "y" }, spy),
      now: NOW,
    });
    const bad: ActionChainTarget = {
      canonical: "X",
      contactChannel: { kind: "whatsapp", value: "not-a-phone", source: "world_record" },
      resolvedAt: NOW(),
    };
    const outcome = await adapter.execute({ target: bad, payload: { body: "hi" }, correlationId: "c3" });
    expect(outcome.kind).toBe("rejected");
    expect(spy.calls).toBe(0);
    expect(outboxSizeForTests()).toBe(0);
  });
});

// ─── Provider isolation · state-machine invariant ─────────────────

describe("state-machine isolation · provider cannot force a false VERIFIED", () => {
  it("provider claims delivered but the executor's link_round_trip check is irrelevant here (whatsapp path) · VERIFIED requires DELIVERY receipt", async () => {
    // For contact_via_whatsapp the link_round_trip check does not
    // apply (that's only for open_directory). VERIFIED for whatsapp
    // requires delivery_receipt evidence · which "delivered" outcome
    // supplies. This test proves the executor does not gate whatsapp
    // VERIFIED on link_round_trip.
    const adapter = makeWhatsAppProviderAdapter({
      provider: makeProvider({
        kind: "delivered", providerMessageId: "wamid.d",
        providerRawStatus: "delivered", deliveredAt: NOW(),
      }),
      now: NOW,
    });
    const audit = await runActionChain({
      kind: "contact_via_whatsapp",
      requestedByMessage: "yes",
      target,
      authorization: grantedAuth,
      adapter,
      payload: { body: "hi" },
      now: NOW,
    });
    expect(audit.finalState).toBe("VERIFIED");
    // link_round_trip check should NOT appear for whatsapp
    expect(audit.verification.checks.some((c) => c.check === "link_round_trip")).toBe(false);
  });

  it("provider outcomes never let the adapter skip EXECUTED · every path advances through the state machine legally", async () => {
    for (const outcome of [
      { kind: "accepted",   providerMessageId: "m", providerRawStatus: "q" } as ProviderSendOutcome,
      { kind: "delivered",  providerMessageId: "m", providerRawStatus: "d", deliveredAt: NOW() } as ProviderSendOutcome,
      { kind: "rejected",   reason: "r" } as ProviderSendOutcome,
      { kind: "unreachable", reason: "u" } as ProviderSendOutcome,
    ]) {
      _resetOutboxForTests();
      const adapter = makeWhatsAppProviderAdapter({ provider: makeProvider(outcome), now: NOW });
      const audit = await runActionChain({
        kind: "contact_via_whatsapp",
        requestedByMessage: "yes",
        target,
        authorization: grantedAuth,
        adapter,
        payload: { body: "hi" },
        now: NOW,
      });
      const stages = audit.transitions.map((t) => t.to);
      // Whether the terminal is VERIFIED, UNKNOWN, or FAILED, the
      // audit must have PASSED THROUGH the legal states.
      expect(stages[0]).toBe("AUTHORIZED");
      expect(stages[1]).toBe("EXECUTING");
      // For non-throw paths, EXECUTED is always reached before terminal.
      if (outcome.kind !== "unreachable" && outcome.kind !== "rejected") {
        expect(stages).toContain("EXECUTED");
      } else {
        // rejected/unreachable outcomes at the adapter STILL come
        // through EXECUTED (they only skip EXECUTED when the
        // adapter THREW · which these do not).
        expect(stages).toContain("EXECUTED");
      }
      expect(["VERIFIED", "UNKNOWN", "FAILED"]).toContain(audit.finalState);
    }
  });
});
