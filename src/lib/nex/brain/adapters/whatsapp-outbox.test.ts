// src/lib/nex/brain/adapters/whatsapp-outbox.test.ts
//
// Stage 3.38 · Outbox unit tests · idempotency contract lives here.
// Stage 3.39 · API is now async (driver abstraction). Tests still cover
// the memory driver (default) · pg driver has its own test file.

import { describe, expect, it, beforeEach } from "vitest";
import {
  recordAttempt,
  markOutcome,
  getOutboxEntry,
  outboxSizeForTests,
  _resetOutboxForTests,
  IdempotencyNotAvailableError,
} from "./whatsapp-outbox";

const NOW = () => "2026-08-31T10:00:00.000Z";

beforeEach(() => _resetOutboxForTests());

describe("recordAttempt · first record", () => {
  it("creates a PENDING entry with attempts=1", async () => {
    const e = await recordAttempt({
      correlationId: "c1", providerId: "test",
      targetCanonical: "X", toE164: "+62812",
      bodyHash: "abc", now: NOW,
    });
    expect(e.status).toBe("PENDING");
    expect(e.attempts).toBe(1);
    expect(await getOutboxEntry("c1")).toEqual(e);
  });
});

describe("recordAttempt · duplicate correlationId → IdempotencyNotAvailableError", () => {
  it("throws with a specific message · no silent overwrite · no retry", async () => {
    await recordAttempt({
      correlationId: "c1", providerId: "test",
      targetCanonical: "X", toE164: "+62812",
      bodyHash: "abc", now: NOW,
    });
    await expect(recordAttempt({
      correlationId: "c1", providerId: "test",
      targetCanonical: "X", toE164: "+62812",
      bodyHash: "abc", now: NOW,
    })).rejects.toThrow(IdempotencyNotAvailableError);
    expect(outboxSizeForTests()).toBe(1);
  });
});

describe("markOutcome · state transitions", () => {
  it("PENDING → ACCEPTED · provider message id stored", async () => {
    await recordAttempt({
      correlationId: "c1", providerId: "test",
      targetCanonical: "X", toE164: "+62812",
      bodyHash: "abc", now: NOW,
    });
    const e = await markOutcome("c1", { status: "ACCEPTED", providerMessageId: "m1", now: NOW });
    expect(e.status).toBe("ACCEPTED");
    expect(e.providerMessageId).toBe("m1");
    expect(e.resolvedAt).toBe(NOW());
  });

  it("markOutcome without recordAttempt · throws (programmer error)", async () => {
    await expect(markOutcome("c-nonexistent", { status: "ACCEPTED", now: NOW })).rejects.toThrow(/no outbox entry/);
  });

  it("CONFIRMED never regresses · late-arriving 'sent' cannot overwrite 'delivered' (Stage 3.39 guarantee)", async () => {
    await recordAttempt({ correlationId: "c1", providerId: "t", targetCanonical: "X", toE164: "+62", bodyHash: "a", now: NOW });
    await markOutcome("c1", { status: "CONFIRMED", providerMessageId: "wamid.1", now: NOW });
    const after = await markOutcome("c1", { status: "ACCEPTED", now: NOW });
    expect(after.status).toBe("CONFIRMED"); // regression blocked
  });
});

describe("reset helper isolates tests", () => {
  it("_resetOutboxForTests clears everything", async () => {
    await recordAttempt({ correlationId: "c1", providerId: "t", targetCanonical: "X", toE164: "+62", bodyHash: "a", now: NOW });
    expect(outboxSizeForTests()).toBe(1);
    _resetOutboxForTests();
    expect(outboxSizeForTests()).toBe(0);
  });
});
