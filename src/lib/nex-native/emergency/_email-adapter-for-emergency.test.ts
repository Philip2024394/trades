// src/lib/nex-native/emergency/_email-adapter-for-emergency.test.ts

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  composeEmergencyEmailBody,
  isRealSendAuthorised,
  sendEmergencyEmail,
} from "./_email-adapter-for-emergency";

const prevRealSend = process.env.NEX_EMERGENCY_EMAIL_REAL_SEND;

beforeEach(() => {
  delete process.env.NEX_EMERGENCY_EMAIL_REAL_SEND;
});

afterEach(() => {
  if (prevRealSend === undefined) {
    delete process.env.NEX_EMERGENCY_EMAIL_REAL_SEND;
  } else {
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = prevRealSend;
  }
});

describe("sendEmergencyEmail · input guards", () => {
  it("rejects invalid recipient", async () => {
    const r = await sendEmergencyEmail({
      to: "not-an-email",
      subject: "s",
      textBody: "b",
      idempotencyKey: "k",
      simulated: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_recipient_email");
  });

  it("rejects empty subject", async () => {
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "   ",
      textBody: "b",
      idempotencyKey: "k",
      simulated: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_subject");
  });

  it("rejects empty body", async () => {
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "s",
      textBody: "",
      idempotencyKey: "k",
      simulated: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_body");
  });

  it("rejects empty idempotency key", async () => {
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "s",
      textBody: "b",
      idempotencyKey: "",
      simulated: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_idempotency_key");
  });
});

describe("sendEmergencyEmail · simulated path (v1 pilot)", () => {
  it("returns ok with a synthetic providerMessageId when simulated=true", async () => {
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "subj",
      textBody: "body",
      idempotencyKey: "abc123",
      simulated: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.providerMessageId).toBe("simulated:abc123");
      expect(r.simulated).toBe(true);
    }
  });

  it("does NOT attempt real send even when real-send env is TRUE if simulated=true", async () => {
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "true";
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "subj",
      textBody: "body",
      idempotencyKey: "abc123",
      simulated: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.providerMessageId).toBe("simulated:abc123");
  });
});

describe("sendEmergencyEmail · live-send gate", () => {
  it("blocks live send when env is not set", async () => {
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "s",
      textBody: "b",
      idempotencyKey: "k",
      simulated: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("live_send_not_authorised");
  });

  it("blocks live send when env is 'false'", async () => {
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "false";
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "s",
      textBody: "b",
      idempotencyKey: "k",
      simulated: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("live_send_not_authorised");
  });

  it("isRealSendAuthorised reflects the env flag", () => {
    expect(isRealSendAuthorised()).toBe(false);
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "true";
    expect(isRealSendAuthorised()).toBe(true);
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "yes";
    expect(isRealSendAuthorised()).toBe(false);
  });
});

describe("composeEmergencyEmailBody · transitions", () => {
  it("pending_confirmation subject + body signal the 10-second window", () => {
    const r = composeEmergencyEmailBody({
      transition: "pending_confirmation",
      requesterLabel: "Alex",
      incidentIdShort: "abc-123",
      simulated: true,
    });
    expect(r.subject).toMatch(/safety alert|may need help/i);
    expect(r.textBody).toMatch(/10-second safety window/i);
    expect(r.textBody).toContain("abc-123");
  });

  it("active message indicates CONFIRMED after the window", () => {
    const r = composeEmergencyEmailBody({
      transition: "active",
      requesterLabel: "Alex",
      incidentIdShort: "x",
      simulated: false,
    });
    expect(r.subject).toMatch(/CONFIRMED/);
    expect(r.textBody).toMatch(/confirmed they need help/i);
    expect(r.textBody).not.toMatch(/SIMULATED/);
  });

  it("revoked_within_window body uses the sealed language ('cancelled by the requester within the 10-second safety window')", () => {
    const r = composeEmergencyEmailBody({
      transition: "revoked_within_window",
      requesterLabel: "Alex",
      incidentIdShort: "x",
      simulated: true,
    });
    expect(r.textBody).toMatch(
      /cancelled by the requester within the 10-second safety window/i,
    );
    expect(r.textBody).toMatch(/No action is required/i);
    expect(r.textBody).toMatch(/SIMULATED/);
  });

  it("cancelled body says 'no further action is required'", () => {
    const r = composeEmergencyEmailBody({
      transition: "cancelled",
      requesterLabel: "Alex",
      incidentIdShort: "x",
      simulated: false,
    });
    expect(r.textBody).toMatch(/No further action/i);
  });

  it("resolved body thanks the responder", () => {
    const r = composeEmergencyEmailBody({
      transition: "resolved",
      requesterLabel: "Alex",
      incidentIdShort: "x",
      simulated: false,
    });
    expect(r.textBody).toMatch(/resolved/i);
    expect(r.textBody).toMatch(/thank you/i);
  });

  it("falls back to 'A NEX user' when label is empty", () => {
    const r = composeEmergencyEmailBody({
      transition: "pending_confirmation",
      requesterLabel: "   ",
      incidentIdShort: "x",
      simulated: true,
    });
    expect(r.textBody).toMatch(/A NEX user/);
  });

  it("escapes HTML in the requester label (htmlBody)", () => {
    const r = composeEmergencyEmailBody({
      transition: "pending_confirmation",
      requesterLabel: "<script>alert(1)</script>",
      incidentIdShort: "x",
      simulated: true,
    });
    expect(r.htmlBody).not.toMatch(/<script>/i);
    expect(r.htmlBody).toContain("&lt;script&gt;");
  });
});

// =====================================================================
// EH hardening audit 2026-10-10 · additions
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md
// =====================================================================

describe("hardening · email adapter requires BOTH flags for a real send", () => {
  it("simulated=true · always returns ok with simulated note (never calls SMTP)", async () => {
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "true";
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "s",
      textBody: "b",
      idempotencyKey: "k",
      simulated: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.simulated).toBe(true);
      expect(r.note).toBe("simulated_fan_out_v1_pilot");
      expect(r.providerMessageId).toBe("simulated:k");
    }
  });

  it("simulated=false AND NEX_EMERGENCY_EMAIL_REAL_SEND unset → live_send_not_authorised", async () => {
    delete process.env.NEX_EMERGENCY_EMAIL_REAL_SEND;
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "s",
      textBody: "b",
      idempotencyKey: "k",
      simulated: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("live_send_not_authorised");
  });

  it("simulated=false AND NEX_EMERGENCY_EMAIL_REAL_SEND='false' → live_send_not_authorised", async () => {
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "false";
    const r = await sendEmergencyEmail({
      to: "a@b.co",
      subject: "s",
      textBody: "b",
      idempotencyKey: "k",
      simulated: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("live_send_not_authorised");
  });

  it("isRealSendAuthorised honestly reflects the env var", () => {
    delete process.env.NEX_EMERGENCY_EMAIL_REAL_SEND;
    expect(isRealSendAuthorised()).toBe(false);
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "true";
    expect(isRealSendAuthorised()).toBe(true);
    process.env.NEX_EMERGENCY_EMAIL_REAL_SEND = "1";
    expect(isRealSendAuthorised()).toBe(false); // must be the literal "true"
  });
});
