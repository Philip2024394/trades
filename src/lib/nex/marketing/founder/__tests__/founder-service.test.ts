// src/lib/nex/marketing/founder/__tests__/founder-service.test.ts
//
// NEX Email Marketing HQ · Founder Control Centre acceptance
// Founder-authorised programme.

import { describe, it, expect, beforeEach } from "vitest";
import {
  assertFounder,
  listFounderSenders,
  addFounderSender,
  createFounderDraft,
  listFounderCampaigns,
  loadFounderCampaign,
  previewFounderCampaign,
  reviewFounderCampaign,
  sendFounderCampaign,
  sendFounderTestEmail,
  checkGlobalUnsubscribe,
  getFounderAnalytics,
  getHQSystemStatus,
  FounderAccessError,
  FounderLaneViolationError,
  FounderValidationError,
  type FounderAuthContext,
} from "..";
import { makeMockPool } from "./mock-pool";

let mock: ReturnType<typeof makeMockPool>;
beforeEach(() => { mock = makeMockPool(); });

const founderAuth = (): FounderAuthContext => ({ authenticated: true, actor: "founder", source: "localhost" });
const noAuth = (): FounderAuthContext => ({ authenticated: false, actor: "", source: "unauthenticated" });

// Fake adapter for test-email path
const okAdapter = { send: async () => ({ ok: true as const, provider_message_id: "test-msg-1", provider: "resend", sent_at: new Date().toISOString() }) };

// ═══════════════════════════════════════════════════════════════════
// (A) Auth
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (A) auth", () => {
  it("(A1) unauthenticated blocked", () => {
    expect(() => assertFounder(noAuth())).toThrow(FounderAccessError);
  });
  it("(A2) authenticated passes", () => {
    expect(() => assertFounder(founderAuth())).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// (B) Sender listing · Founder-lane only
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (B) sender listing · Founder-lane isolation", () => {
  it("(B1) list returns FOUNDER senders only · AUTO + MEMBER excluded", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x" });
    mock.seedSender("a1", { lane: "auto", email: "a1@x" });
    mock.seedSender("m1", { lane: "member", member_id: "member-A", email: "m1@x" });
    const list = await listFounderSenders(mock.client, founderAuth());
    expect(list.length).toBe(1);
    expect(list[0].sender_id).toBe("f1");
  });

  it("(B2) exposes capacity + health but NO credentials", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x" });
    const list = await listFounderSenders(mock.client, founderAuth());
    const s = list[0];
    expect(s).toHaveProperty("capacity");
    expect((s as any).provider_account_ref).toBeUndefined();   // never leaked
    expect((s as any).authentication_secret).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// (C) Add sender · verification required · capacity source mandatory
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (C) add sender", () => {
  it("(C1) invalid email refused", async () => {
    await expect(addFounderSender(mock.client, founderAuth(), {
      email: "not-an-email", provider: "resend", capacity_source: "provider-doc",
    })).rejects.toThrow(FounderValidationError);
  });

  it("(C2) missing capacity_source refused · never hard-code assumed limits", async () => {
    await expect(addFounderSender(mock.client, founderAuth(), {
      email: "ok@ok.com", provider: "resend", capacity_source: "",
    })).rejects.toThrow(FounderValidationError);
  });

  it("(C3) added sender begins in pending authentication state · not immediately sendable", async () => {
    const s = await addFounderSender(mock.client, founderAuth(), {
      email: "new@example.com", provider: "resend",
      capacity_source: "provider-dashboard-2026-09-21",
      daily_capacity: 500, hourly_capacity: 100,
    });
    expect(s.authentication_state).toBe("pending");
    expect(s.is_sendable).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (D) Campaign create · Founder-lane isolation
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (D) create draft · Founder-lane isolation", () => {
  it("(D1) creates campaign in Founder lane · metadata.lane=founder + origin=founder", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x" });
    const c = await createFounderDraft(mock.client, founderAuth(), {
      display_name: "Founder campaign",
      subject_line: "Meet NEX",
      from_email: "f1@x",
      sender_id: "f1",
      audience: { country: "US", category: "scaffolding" },
      content_blocks: [{ kind: "paragraph", text: "Hello NEX" }],
    });
    expect(c.status).toBe("draft");
    const loaded = mock.store.campaigns.get(c.campaign_id);
    expect(loaded.metadata.lane).toBe("founder");
    expect(loaded.metadata.origin).toBe("founder");
  });

  it("(D2) MEMBER sender rejected · FounderLaneViolationError", async () => {
    mock.seedSender("m1", { lane: "member", member_id: "member-A", email: "m1@x" });
    await expect(createFounderDraft(mock.client, founderAuth(), {
      display_name: "invalid", subject_line: "hello world",
      from_email: "m1@x", sender_id: "m1",
      audience: {},
    })).rejects.toThrow(FounderLaneViolationError);
  });

  it("(D3) AUTO sender rejected · FounderLaneViolationError", async () => {
    mock.seedSender("a1", { lane: "auto", email: "a1@x" });
    await expect(createFounderDraft(mock.client, founderAuth(), {
      display_name: "invalid", subject_line: "hello world",
      from_email: "a1@x", sender_id: "a1",
      audience: {},
    })).rejects.toThrow(FounderLaneViolationError);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (E) Preview + Review
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (E) preview + review", () => {
  async function setup() {
    mock.seedSender("f1", { lane: "founder", email: "f1@x", hourly_capacity: 100, daily_capacity: 500 });
    mock.seedContacts([
      { email: "u1@x", country: "US", category_slug: "scaffolding" },
      { email: "u2@x", country: "US", category_slug: "scaffolding" },
      { email: "u3@x", country: "US", category_slug: "scaffolding" },
    ]);
    return createFounderDraft(mock.client, founderAuth(), {
      display_name: "Big campaign", subject_line: "Hello", from_email: "f1@x", sender_id: "f1",
      audience: { country: "US", category: "scaffolding" },
      content_blocks: [{ kind: "paragraph", text: "Content here" }],
    });
  }

  it("(E1) preview returns actual compiled HTML", async () => {
    const c = await setup();
    const p = await previewFounderCampaign(mock.client, founderAuth(), c.campaign_id);
    expect(p.subject).toBe("Hello");
    expect(p.compiled_html).toContain("Content here");
  });

  it("(E2) review aggregates audience + sender + refusal reasons", async () => {
    const c = await setup();
    const r = await reviewFounderCampaign(mock.client, founderAuth(), c.campaign_id);
    expect(r.send_ready).toBe(true);
    expect(r.audience_count.eligible).toBe(3);
    expect(r.sender.email).toBe("f1@x");
    expect(r.refusal_reasons).toEqual([]);
  });

  it("(E3) unhealthy sender surfaces sender_unhealthy refusal", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x", health_state: "paused" });
    mock.seedContacts([{ email: "u@x", country: "US", category_slug: "s" }]);
    const c = await createFounderDraft(mock.client, founderAuth(), {
      display_name: "x campaign", subject_line: "hi world", from_email: "f1@x", sender_id: "f1",
      audience: { country: "US", category: "s" },
    });
    const r = await reviewFounderCampaign(mock.client, founderAuth(), c.campaign_id);
    expect(r.send_ready).toBe(false);
    expect(r.refusal_reasons.some(x => x.kind === "sender_unhealthy")).toBe(true);
  });

  it("(E4) empty audience surfaces audience_empty refusal", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x" });
    const c = await createFounderDraft(mock.client, founderAuth(), {
      display_name: "empty campaign", subject_line: "hello", from_email: "f1@x", sender_id: "f1",
      audience: { country: "MARS", category: "unknown" },
    });
    const r = await reviewFounderCampaign(mock.client, founderAuth(), c.campaign_id);
    expect(r.send_ready).toBe(false);
    expect(r.refusal_reasons.some(x => x.kind === "audience_empty")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (F) Send · Founder → shared executor · NO member package touch
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (F) send · shared executor · member package canary", () => {
  it("(F1) send_to_selected enters shared queue · MEMBER package untouched", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x" });
    mock.seedContacts([
      { email: "u1@x", country: "US", category_slug: "s" },
      { email: "u2@x", country: "US", category_slug: "s" },
    ]);
    const c = await createFounderDraft(mock.client, founderAuth(), {
      display_name: "send test", subject_line: "hello", from_email: "f1@x", sender_id: "f1",
      audience: { country: "US", category: "s" },
    });
    const r = await sendFounderCampaign(mock.client, founderAuth(), c.campaign_id, "send_to_selected");
    expect(r.queued).toBe(2);
    // CANARY: no member package or operating budget touched
    expect(mock.store.member_package_touched).toBe(false);
    // Queue populated
    expect(mock.store.send_queue.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (G) TEST EMAIL · isolated · not audience · not accounted
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (G) test email", () => {
  async function setup() {
    mock.seedSender("f1", { lane: "founder", email: "f1@x" });
    return createFounderDraft(mock.client, founderAuth(), {
      display_name: "test", subject_line: "hello", from_email: "f1@x", sender_id: "f1",
      audience: {},
      content_blocks: [{ kind: "paragraph", text: "Test body" }],
    });
  }

  it("(G1) valid test recipient · adapter.send called with subject prefix", async () => {
    const c = await setup();
    let received: any = null;
    const capturing = { send: async (msg: any) => { received = msg; return { ok: true as const, provider_message_id: "m1", provider: "resend", sent_at: "" }; } };
    const out = await sendFounderTestEmail(mock.client, founderAuth(), { campaign_id: c.campaign_id, test_recipient: "test@example.com" }, capturing);
    expect(out.kind).toBe("test_sent");
    expect(received.to[0].address).toBe("test@example.com");
    expect(received.subject).toContain("[TEST]");
    expect(received.headers["X-NEX-Test-Send"]).toBe("true");
  });

  it("(G2) invalid recipient refused", async () => {
    const c = await setup();
    const out = await sendFounderTestEmail(mock.client, founderAuth(), { campaign_id: c.campaign_id, test_recipient: "not-an-email" }, okAdapter);
    expect(out.kind).toBe("test_refused");
    if (out.kind === "test_refused") expect(out.reason).toBe("invalid_test_recipient");
  });

  it("(G3) test send does NOT populate main send queue · does NOT touch member package", async () => {
    const c = await setup();
    await sendFounderTestEmail(mock.client, founderAuth(), { campaign_id: c.campaign_id, test_recipient: "t@t.com" }, okAdapter);
    expect(mock.store.send_queue.length).toBe(0);
    expect(mock.store.member_package_touched).toBe(false);
  });

  it("(G4) unhealthy sender refuses test send", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x", health_state: "paused" });
    const c = await createFounderDraft(mock.client, founderAuth(), {
      display_name: "unhealthy test", subject_line: "hi world", from_email: "f1@x", sender_id: "f1", audience: {},
    });
    const out = await sendFounderTestEmail(mock.client, founderAuth(), { campaign_id: c.campaign_id, test_recipient: "t@t.com" }, okAdapter);
    expect(out.kind).toBe("test_refused");
    if (out.kind === "test_refused") expect(out.reason).toBe("sender_unhealthy");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (H) Global unsubscribe check (§19)
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (H) global unsubscribe (§19)", () => {
  it("(H1) opt_out contact is_suppressed=true reason=opt_out", async () => {
    mock.seedContacts([{ email: "unsub@x", opt_out: true }]);
    const r = await checkGlobalUnsubscribe(mock.client, "unsub@x");
    expect(r.is_suppressed).toBe(true);
    expect(r.reason).toBe("opt_out");
  });

  it("(H2) hard_bounced contact is_suppressed=true reason=hard_bounced", async () => {
    mock.seedContacts([{ email: "bounce@x", hard_bounced: true }]);
    const r = await checkGlobalUnsubscribe(mock.client, "bounce@x");
    expect(r.is_suppressed).toBe(true);
    expect(r.reason).toBe("hard_bounced");
  });

  it("(H3) global opt_out list · is_suppressed=true reason=unsubscribed", async () => {
    mock.seedContacts([{ email: "gone@x" }]);
    mock.addOptOut("gone@x");
    const r = await checkGlobalUnsubscribe(mock.client, "gone@x");
    expect(r.is_suppressed).toBe(true);
    expect(r.reason).toBe("unsubscribed");
  });

  it("(H4) clean contact · not suppressed", async () => {
    mock.seedContacts([{ email: "ok@x" }]);
    const r = await checkGlobalUnsubscribe(mock.client, "ok@x");
    expect(r.is_suppressed).toBe(false);
    expect(r.reason).toBe("not_suppressed");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (I) HQ status
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (I) system status", () => {
  it("(I1) reports 0 senders · not ready when empty", async () => {
    const s = await getHQSystemStatus(mock.client, founderAuth());
    expect(s.active_senders).toBe(0);
    expect(s.ready).toBe(false);
    expect(s.backend_available).toBe(true);
  });

  it("(I2) reports active sender count when senders exist", async () => {
    mock.seedSender("f1", { lane: "founder", email: "f1@x" });
    mock.seedSender("f2", { lane: "founder", email: "f2@x" });
    const s = await getHQSystemStatus(mock.client, founderAuth());
    expect(s.active_senders).toBe(2);
    expect(s.ready).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (J) Contact-address boundary (structural)
// ═══════════════════════════════════════════════════════════════════
describe("Founder HQ · (J) contact-address boundary", () => {
  it("(J1) module exports NO export/download-lead functions", async () => {
    const mod = await import("..");
    expect((mod as any).exportContacts).toBeUndefined();
    expect((mod as any).downloadLeads).toBeUndefined();
    expect((mod as any).getAudienceEmails).toBeUndefined();
    expect((mod as any).exportAddresses).toBeUndefined();
  });
});
