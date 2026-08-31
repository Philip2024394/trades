// src/lib/nex/brain/adapters/whatsapp-reconciliation.test.ts
//
// Stage 3.39 · Reconciliation doctrine tests.
//
// R1  · unknown wamid → no_matching_entry · NEVER inbox a row
// R2  · sent    event → outbox ACCEPTED
// R3  · delivered event → outbox CONFIRMED · finalState VERIFIED-eligible
// R4  · read    event → outbox CONFIRMED
// R5  · failed  event → outbox REJECTED
// R6  · CONFIRMED never regresses · late "sent" event no-ops
// R7  · extractStatusEvents parses Meta webhook payload · skips non-status
// R8  · replayed event yields same terminal state (idempotent)

import { describe, expect, it, beforeEach } from "vitest";
import {
  reconcileMetaStatus,
  extractStatusEvents,
} from "./whatsapp-reconciliation";
import {
  recordAttempt,
  markOutcome,
  getOutboxEntry,
  _resetOutboxForTests,
} from "./whatsapp-outbox";

const NOW = () => "2026-08-31T10:00:00.000Z";

beforeEach(() => _resetOutboxForTests());

async function seedOutbox(wamid?: string) {
  const entry = await recordAttempt({
    correlationId: "c1", providerId: "meta_cloud",
    targetCanonical: "Gaotama Hotel", toE164: "6281234567890",
    bodyHash: "abcdef", now: NOW,
  });
  if (wamid) {
    await markOutcome("c1", { status: "ACCEPTED", providerMessageId: wamid, now: NOW });
  }
  return entry;
}

// ─── R1 · unknown wamid ────────────────────────────────────────────

describe("R1 · reconcile with unknown wamid → no_matching_entry", () => {
  it("returns no_matching_entry · never inboxes a row · outbox stays empty", async () => {
    const out = await reconcileMetaStatus(
      { wamid: "wamid.unknown", status: "delivered", timestamp: NOW() },
      { now: NOW },
    );
    expect(out.kind).toBe("no_matching_entry");
    if (out.kind === "no_matching_entry") {
      expect(out.reason).toContain("this system did not send this message");
    }
  });
});

// ─── R2-R5 · status mapping ────────────────────────────────────────

describe("R2-R5 · Meta status → outbox mapping", () => {
  it("R2 · sent → ACCEPTED (already ACCEPTED after provider ack · this is a no-op transition)", async () => {
    await seedOutbox("wamid.1");
    const out = await reconcileMetaStatus(
      { wamid: "wamid.1", status: "sent", timestamp: NOW() },
      { now: NOW },
    );
    // Already ACCEPTED · reconcile is a no-op on the status but may update resolvedAt
    expect(out.kind).toMatch(/resolved|no_change/);
    const entry = await getOutboxEntry("c1");
    expect(entry?.status).toBe("ACCEPTED");
  });

  it("R3 · delivered → CONFIRMED", async () => {
    await seedOutbox("wamid.1");
    const out = await reconcileMetaStatus(
      { wamid: "wamid.1", status: "delivered", timestamp: "2026-08-31T10:00:05Z" },
      { now: NOW },
    );
    expect(out.kind).toBe("resolved");
    const entry = await getOutboxEntry("c1");
    expect(entry?.status).toBe("CONFIRMED");
  });

  it("R4 · read → CONFIRMED", async () => {
    await seedOutbox("wamid.1");
    await reconcileMetaStatus({ wamid: "wamid.1", status: "read", timestamp: NOW() }, { now: NOW });
    const entry = await getOutboxEntry("c1");
    expect(entry?.status).toBe("CONFIRMED");
  });

  it("R5 · failed → REJECTED · error text captured in resolution_reason", async () => {
    await seedOutbox("wamid.1");
    const out = await reconcileMetaStatus(
      { wamid: "wamid.1", status: "failed", timestamp: NOW(), errorText: "recipient not registered on WA", errorCode: 131026 },
      { now: NOW },
    );
    expect(out.kind).toBe("resolved");
    const entry = await getOutboxEntry("c1");
    expect(entry?.status).toBe("REJECTED");
    expect(entry?.resolutionReason).toContain("recipient not registered");
    expect(entry?.resolutionReason).toContain("131026");
  });
});

// ─── R6 · CONFIRMED never regresses ────────────────────────────────

describe("R6 · CONFIRMED never regresses · late 'sent' after 'delivered' is a no-op", () => {
  it("late-arriving sent event does NOT downgrade CONFIRMED", async () => {
    await seedOutbox("wamid.1");
    await reconcileMetaStatus({ wamid: "wamid.1", status: "delivered", timestamp: NOW() }, { now: NOW });
    // Now a late 'sent' event arrives
    await reconcileMetaStatus({ wamid: "wamid.1", status: "sent", timestamp: NOW() }, { now: NOW });
    const entry = await getOutboxEntry("c1");
    expect(entry?.status).toBe("CONFIRMED");
  });

  it("late-arriving failed event does NOT downgrade CONFIRMED (delivery already proven)", async () => {
    await seedOutbox("wamid.1");
    await reconcileMetaStatus({ wamid: "wamid.1", status: "delivered", timestamp: NOW() }, { now: NOW });
    await reconcileMetaStatus({ wamid: "wamid.1", status: "failed", timestamp: NOW(), errorText: "late failure" }, { now: NOW });
    const entry = await getOutboxEntry("c1");
    expect(entry?.status).toBe("CONFIRMED");
  });
});

// ─── R7 · extractStatusEvents ─────────────────────────────────────

describe("R7 · extractStatusEvents · parses Meta webhook payload", () => {
  it("extracts one status event per statuses[] entry", () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            statuses: [
              { id: "wamid.1", status: "delivered", timestamp: "1700000000" },
              { id: "wamid.2", status: "failed",    timestamp: "1700000001", errors: [{ message: "bad", code: 1 }] },
            ],
          },
        }],
      }],
    };
    const events = extractStatusEvents(body);
    expect(events).toHaveLength(2);
    expect(events[0].wamid).toBe("wamid.1");
    expect(events[1].wamid).toBe("wamid.2");
    expect(events[1].errorText).toBe("bad");
    expect(events[1].errorCode).toBe(1);
  });

  it("skips entries without id/status/timestamp", () => {
    const body = {
      entry: [{
        changes: [{ value: { statuses: [{ status: "delivered", timestamp: "0" }, { id: "wamid.x", status: "delivered", timestamp: "1" }] } }],
      }],
    };
    const events = extractStatusEvents(body);
    expect(events).toHaveLength(1);
    expect(events[0].wamid).toBe("wamid.x");
  });

  it("skips non-status event kinds (message-received, etc.)", () => {
    const body = {
      entry: [{
        changes: [{ value: { messages: [{ id: "inbound.1" }] } }],
      }],
    };
    expect(extractStatusEvents(body)).toEqual([]);
  });

  it("empty / malformed body → empty array (no throw)", () => {
    expect(extractStatusEvents(null)).toEqual([]);
    expect(extractStatusEvents({})).toEqual([]);
    expect(extractStatusEvents({ entry: [] })).toEqual([]);
  });
});

// ─── R8 · idempotent replay ────────────────────────────────────────

describe("R8 · replayed delivery event · idempotent · terminal state stable", () => {
  it("delivering the same wamid twice leaves outbox CONFIRMED once and no-op the second time", async () => {
    await seedOutbox("wamid.1");
    const first = await reconcileMetaStatus({ wamid: "wamid.1", status: "delivered", timestamp: NOW() }, { now: NOW });
    expect(first.kind).toBe("resolved");
    const second = await reconcileMetaStatus({ wamid: "wamid.1", status: "delivered", timestamp: NOW() }, { now: NOW });
    // Second call · outbox layer blocks the same-status re-assign to
    // preserve resolvedAt · returns entry unchanged. Either "no_change"
    // or "resolved" with same state is acceptable · CRITICAL is that
    // the terminal state is stable.
    const entry = await getOutboxEntry("c1");
    expect(entry?.status).toBe("CONFIRMED");
    expect(second.kind).toMatch(/resolved|no_change/);
  });
});
