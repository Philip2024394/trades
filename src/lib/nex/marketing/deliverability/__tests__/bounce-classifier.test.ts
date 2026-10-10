// src/lib/nex/marketing/deliverability/__tests__/bounce-classifier.test.ts
//
// NEX Deliverability · Bounce/Complaint Classifier acceptance
// Founder-authorised programme · Session-6 · Part 11a · 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  classifyBounceEvent, weightForKind, DEFAULT_EVENT_WEIGHTS,
  _CLASSIFIER_NEVER_FABRICATES,
  _CLASSIFIER_NEVER_GUESSES_PROVIDER,
  _CLASSIFIER_UNSUBSCRIBE_NOT_COUNTED_AGAINST_REPUTATION,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// A · Resend payloads
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (A) Resend", () => {
  it("(A1) email.delivered → delivery", () => {
    const r = classifyBounceEvent({ payload: { type: "email.delivered", data: { email_id: "m1", to: ["a@x"] } } });
    expect(r.kind).toBe("delivery");
    expect(r.provider).toBe("resend");
    expect(r.recipient_email).toBe("a@x");
    expect(r.provider_message_id).toBe("m1");
  });
  it("(A2) email.bounced with data.bounce.type=hard → hard_bounce", () => {
    const r = classifyBounceEvent({ payload: { type: "email.bounced", data: { email_id: "m1", to: ["a@x"], bounce: { type: "hard" } } } });
    expect(r.kind).toBe("hard_bounce");
    expect(r.matched_signal).toContain("data.bounce.type=hard");
  });
  it("(A3) email.bounced with data.bounce.type=soft → soft_bounce", () => {
    const r = classifyBounceEvent({ payload: { type: "email.bounced", data: { bounce: { type: "soft" } } } });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(A4) email.bounced with UNSPECIFIED bounce type → conservatively hard", () => {
    const r = classifyBounceEvent({ payload: { type: "email.bounced", data: {} } });
    expect(r.kind).toBe("hard_bounce");
    expect(r.reason).toContain("conservatively");
  });
  it("(A5) email.complained → complaint", () => {
    const r = classifyBounceEvent({ payload: { type: "email.complained", data: {} } });
    expect(r.kind).toBe("complaint");
  });
  it("(A6) email.unsubscribed → unsubscribe", () => {
    const r = classifyBounceEvent({ payload: { type: "email.unsubscribed", data: {} } });
    expect(r.kind).toBe("unsubscribe");
  });
  it("(A7) unrecognised resend type → unknown (never guessed)", () => {
    const r = classifyBounceEvent({ payload: { type: "email.frobozzed", data: {} } });
    expect(r.kind).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · SendGrid payloads
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (B) SendGrid", () => {
  it("(B1) delivered → delivery", () => {
    const r = classifyBounceEvent({ payload: { event: "delivered", email: "a@x", sg_message_id: "m1" } });
    expect(r.kind).toBe("delivery");
    expect(r.provider).toBe("sendgrid");
  });
  it("(B2) spamreport → complaint", () => {
    const r = classifyBounceEvent({ payload: { event: "spamreport", email: "a@x" } });
    expect(r.kind).toBe("complaint");
  });
  it("(B3) bounce with reason 'no such user' → hard_bounce", () => {
    const r = classifyBounceEvent({ payload: { event: "bounce", email: "a@x", reason: "550 5.1.1 No such user" } });
    expect(r.kind).toBe("hard_bounce");
    expect(r.matched_signal).toContain("no such user");
  });
  it("(B4) dropped (invalid recipient) → hard_bounce", () => {
    const r = classifyBounceEvent({ payload: { event: "dropped", email: "a@x" } });
    expect(r.kind).toBe("hard_bounce");
  });
  it("(B5) deferred → soft_bounce (retryable)", () => {
    const r = classifyBounceEvent({ payload: { event: "deferred", email: "a@x" } });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(B6) blocked → soft_bounce", () => {
    const r = classifyBounceEvent({ payload: { event: "blocked", email: "a@x" } });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(B7) unsubscribe event → unsubscribe", () => {
    const r = classifyBounceEvent({ payload: { event: "unsubscribe", email: "a@x" } });
    expect(r.kind).toBe("unsubscribe");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Amazon SES (SNS notification)
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (C) Amazon SES", () => {
  it("(C1) Bounce · bounceType=Permanent → hard_bounce", () => {
    const r = classifyBounceEvent({
      payload: {
        notificationType: "Bounce",
        bounce: { bounceType: "Permanent", bounceSubType: "General",
                  bouncedRecipients: [{ emailAddress: "a@x" }] },
        mail: { messageId: "m1" },
      },
    });
    expect(r.kind).toBe("hard_bounce");
    expect(r.recipient_email).toBe("a@x");
    expect(r.matched_signal).toContain("bounceType=permanent");
  });
  it("(C2) Bounce · bounceType=Transient → soft_bounce", () => {
    const r = classifyBounceEvent({
      payload: { notificationType: "Bounce", bounce: { bounceType: "Transient", bouncedRecipients: [{ emailAddress: "a@x" }] } },
    });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(C3) Bounce · bounceType=Undetermined → conservatively soft_bounce", () => {
    const r = classifyBounceEvent({
      payload: { notificationType: "Bounce", bounce: { bounceType: "Undetermined", bouncedRecipients: [{ emailAddress: "a@x" }] } },
    });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(C4) Complaint notification → complaint", () => {
    const r = classifyBounceEvent({ payload: { notificationType: "Complaint" } });
    expect(r.kind).toBe("complaint");
  });
  it("(C5) Delivery notification → delivery", () => {
    const r = classifyBounceEvent({ payload: { notificationType: "Delivery", mail: { messageId: "m1" } } });
    expect(r.kind).toBe("delivery");
    expect(r.provider_message_id).toBe("m1");
  });
  it("(C6) Reject → block", () => {
    const r = classifyBounceEvent({ payload: { eventType: "Reject" } });
    expect(r.kind).toBe("block");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Mailgun
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (D) Mailgun", () => {
  it("(D1) failed · severity=permanent → hard_bounce", () => {
    const r = classifyBounceEvent({ payload: { event: "failed", severity: "permanent", recipient: "a@x" } });
    expect(r.kind).toBe("hard_bounce");
  });
  it("(D2) failed · severity=temporary → soft_bounce", () => {
    const r = classifyBounceEvent({ payload: { event: "failed", severity: "temporary", recipient: "a@x" } });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(D3) complained → complaint", () => {
    const r = classifyBounceEvent({ payload: { event: "complained", recipient: "a@x" } });
    expect(r.kind).toBe("complaint");
  });
  it("(D4) unsubscribed → unsubscribe", () => {
    const r = classifyBounceEvent({ payload: { event: "unsubscribed", recipient: "a@x" } });
    expect(r.kind).toBe("unsubscribe");
  });
  it("(D5) delivered → delivery", () => {
    const r = classifyBounceEvent({ payload: { event: "delivered", recipient: "a@x" } });
    expect(r.kind).toBe("delivery");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Postmark
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (E) Postmark", () => {
  it("(E1) Delivery → delivery", () => {
    const r = classifyBounceEvent({ payload: { RecordType: "Delivery", Email: "a@x", MessageID: "m1" } });
    expect(r.kind).toBe("delivery");
    expect(r.provider).toBe("postmark");
  });
  it("(E2) Bounce · Type=HardBounce → hard_bounce", () => {
    const r = classifyBounceEvent({ payload: { RecordType: "Bounce", Type: "HardBounce", Email: "a@x" } });
    expect(r.kind).toBe("hard_bounce");
  });
  it("(E3) Bounce · Type=SoftBounce → soft_bounce", () => {
    const r = classifyBounceEvent({ payload: { RecordType: "Bounce", Type: "SoftBounce" } });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(E4) Bounce · Type=Transient → soft_bounce", () => {
    const r = classifyBounceEvent({ payload: { RecordType: "Bounce", Type: "Transient" } });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(E5) SpamComplaint → complaint", () => {
    const r = classifyBounceEvent({ payload: { RecordType: "SpamComplaint", Email: "a@x" } });
    expect(r.kind).toBe("complaint");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Generic SMTP DSN (RFC 3463)
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (F) Generic SMTP", () => {
  it("(F1) Status 5.1.1 (mailbox not found) → hard_bounce", () => {
    const r = classifyBounceEvent({ payload: { Status: "5.1.1", Action: "failed", "Final-Recipient": "rfc822; missing@example.co.uk" } });
    expect(r.kind).toBe("hard_bounce");
    expect(r.smtp_code).toBe("5.1.1");
    expect(r.recipient_email).toBe("missing@example.co.uk");
  });
  it("(F2) Status 4.2.2 (mailbox full · transient) → soft_bounce", () => {
    const r = classifyBounceEvent({ payload: { Status: "4.2.2", Action: "delayed" } });
    expect(r.kind).toBe("soft_bounce");
  });
  it("(F3) Status 2.0.0 (delivered) → delivery", () => {
    const r = classifyBounceEvent({ payload: { Status: "2.0.0", Action: "delivered" } });
    expect(r.kind).toBe("delivery");
  });
  it("(F4) Unknown status class → unknown", () => {
    const r = classifyBounceEvent({ payload: { Status: "9.9.9", Action: "??" } });
    expect(r.kind).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════
// G · Governance / never-fabricates
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (G) governance", () => {
  it("(G1) null payload → unknown · never fabricated", () => {
    const r = classifyBounceEvent({ payload: null });
    expect(r.kind).toBe("unknown");
    expect(r.matched_signal).toBe("payload_not_object");
  });
  it("(G2) empty object with no known signals → unknown", () => {
    const r = classifyBounceEvent({ payload: {} });
    expect(r.kind).toBe("unknown");
  });
  it("(G3) unrecognised provider → unknown · never guessed", () => {
    const r = classifyBounceEvent({ payload: { random_field: "value" } });
    expect(r.kind).toBe("unknown");
    expect(r.provider).toBe("unknown");
  });
  it("(G4) diagnostic snippet capped at 200 chars · payload preserved for audit", () => {
    const bigStr = "x".repeat(500);
    const r = classifyBounceEvent({ payload: { type: "email.frobozzed", data: { note: bigStr } } });
    expect(r.diagnostic_snippet?.length).toBeLessThanOrEqual(201);
  });
  it("(G5) boundary markers exported · structural verification", () => {
    expect(_CLASSIFIER_NEVER_FABRICATES).toBe("classification_only_from_matched_payload_signals");
    expect(_CLASSIFIER_NEVER_GUESSES_PROVIDER).toBe("unknown_provider_returns_unknown_kind_never_guessed");
    expect(_CLASSIFIER_UNSUBSCRIBE_NOT_COUNTED_AGAINST_REPUTATION).toBe("unsubscribe_is_healthy_signal_weight_zero");
  });
  it("(G6) module exports NO synthetic-event generator · never invents events", async () => {
    const mod = await import("..");
    expect((mod as any).generateFakeBounce).toBeUndefined();
    expect((mod as any).synthesiseComplaint).toBeUndefined();
    expect((mod as any).forceHardBounce).toBeUndefined();
    expect((mod as any).createSyntheticEvent).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// H · Reputation weighting (Session-6b)
// ═══════════════════════════════════════════════════════════════════
describe("Bounce classifier · (H) reputation weights", () => {
  it("(H1) hard_bounce = 1.00 · full weight", () => {
    expect(DEFAULT_EVENT_WEIGHTS.hard_bounce).toBe(1.0);
    expect(weightForKind("hard_bounce")).toBe(1.0);
  });
  it("(H2) soft_bounce = 0.25 · retryable · quarter weight", () => {
    expect(DEFAULT_EVENT_WEIGHTS.soft_bounce).toBe(0.25);
    expect(weightForKind("soft_bounce")).toBe(0.25);
  });
  it("(H3) complaint = 1.00 · deliverability-critical", () => {
    expect(DEFAULT_EVENT_WEIGHTS.complaint).toBe(1.0);
  });
  it("(H4) block = 0.75 · provider-side block · high weight", () => {
    expect(DEFAULT_EVENT_WEIGHTS.block).toBe(0.75);
  });
  it("(H5) unsubscribe = 0.00 · healthy signal · NEVER counted against reputation", () => {
    expect(DEFAULT_EVENT_WEIGHTS.unsubscribe).toBe(0);
    expect(weightForKind("unsubscribe")).toBe(0);
  });
  it("(H6) delivery/open/click/unknown → 0 weight · not tracked as reputation events", () => {
    expect(weightForKind("delivery")).toBe(0);
    expect(weightForKind("open")).toBe(0);
    expect(weightForKind("click")).toBe(0);
    expect(weightForKind("unknown")).toBe(0);
  });
});
