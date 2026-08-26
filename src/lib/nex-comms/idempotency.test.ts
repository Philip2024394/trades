// src/lib/nex-comms/idempotency.test.ts

import { describe, it, expect } from "vitest";
import { checkIdempotency, composeIdempotencyKey } from "./idempotency";

describe("Idempotency · duplicate detection", () => {
  it("first-time key with no existing message → NEW", () => {
    const r = checkIdempotency({
      idempotencyKey: "driver-recruitment:candidate-1:campaign-1",
      existingMessageForKey: null,
    });
    expect(r.status).toBe("NEW");
  });

  it("existing message for same key → DUPLICATE (returns existing · never re-sends)", () => {
    const r = checkIdempotency({
      idempotencyKey: "driver-recruitment:candidate-1:campaign-1",
      existingMessageForKey: {
        messageId: "msg-1", createdAt: new Date("2026-08-23T10:00:00Z"), status: "sent",
      },
    });
    expect(r.status).toBe("DUPLICATE");
    if (r.status === "DUPLICATE") {
      expect(r.existingMessageId).toBe("msg-1");
      expect(r.existingStatus).toBe("sent");
    }
  });
});

describe("Idempotency · key format validation", () => {
  it("too-short key → REFUSED", () => {
    const r = checkIdempotency({ idempotencyKey: "short", existingMessageForKey: null });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("KEY_TOO_SHORT");
  });

  it("key without domain colon → REFUSED", () => {
    const r = checkIdempotency({ idempotencyKey: "abcdefghij", existingMessageForKey: null });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("INVALID_KEY_FORMAT");
  });

  it("well-formed multi-segment key accepted", () => {
    const r = checkIdempotency({
      idempotencyKey: "booking-confirmation:booking-42:evt-1",
      existingMessageForKey: null,
    });
    expect(r.status).toBe("NEW");
  });
});

describe("composeIdempotencyKey · deterministic + safe", () => {
  it("produces expected shape", () => {
    const k = composeIdempotencyKey("driver-recruitment", "candidate-1", "campaign-1");
    expect(k).toBe("driver-recruitment:candidate-1:campaign-1");
  });

  it("normalises unsafe characters", () => {
    const k = composeIdempotencyKey("driver-recruitment", "Budi & Co", "camp/1");
    expect(k).toBe("driver-recruitment:budi-co:camp-1");
  });
});
