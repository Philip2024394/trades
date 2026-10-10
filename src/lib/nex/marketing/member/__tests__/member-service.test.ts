// src/lib/nex/marketing/member/__tests__/member-service.test.ts
//
// NEX Stage 4 · Member Campaign UI · acceptance suite
// Founder-authorised programme.
//
// Under-test coverage of the domain service. UI pages are thin wrappers
// over this service. World-proof boundary remains CLOSED.

import { describe, it, expect, beforeEach } from "vitest";
import {
  assertAuthenticatedMember,
  countAudience,
  compileTemplate,
  listMemberCampaigns,
  loadMemberCampaign,
  createDraftCampaign,
  reviewMemberCampaign,
  scheduleOrSendMemberCampaign,
  cancelMemberCampaign,
  MemberAccessError,
  MemberIsolationError,
  MemberValidationError,
  type MemberAuthContext,
  type CampaignComposerInput,
} from "..";
import { makeMockPool, resetMockPool } from "./mock-pool";

let mock: ReturnType<typeof makeMockPool>;
beforeEach(() => { mock = makeMockPool(); });

const authOf = (member_id: string): MemberAuthContext => ({
  member_id,
  authenticated: true,
  session_source: "cookie",
});

// ═══════════════════════════════════════════════════════════════════
// (A) Auth guard
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (A) auth guard", () => {
  it("(A1) unauthenticated → MemberAccessError", () => {
    expect(() => assertAuthenticatedMember({ member_id: "x", authenticated: false, session_source: "unauthenticated" }))
      .toThrow(MemberAccessError);
  });
  it("(A2) missing member_id → MemberAccessError", () => {
    expect(() => assertAuthenticatedMember({ member_id: "", authenticated: true, session_source: "cookie" }))
      .toThrow(MemberAccessError);
  });
  it("(A3) authenticated + member_id → passes", () => {
    expect(() => assertAuthenticatedMember(authOf("m1"))).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// (B) Audience counter · no addresses returned
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (B) audience counter · contact-boundary preservation", () => {
  it("(B1) countAudience returns integers only · no email addresses in response", async () => {
    mock.seedContacts([
      { email: "a@a.com", country: "US", category_slug: "scaffolding", opt_out: false, hard_bounced: false },
      { email: "b@b.com", country: "US", category_slug: "scaffolding", opt_out: false, hard_bounced: false },
      { email: "c@c.com", country: "US", category_slug: "scaffolding", opt_out: true,  hard_bounced: false },
      { email: "d@d.com", country: "UK", category_slug: "scaffolding", opt_out: false, hard_bounced: false },
    ]);
    const count = await countAudience(mock.client, { country: "US", category: "scaffolding" });
    expect(count.total_discovered).toBe(3);
    expect(count.eligible).toBe(2);
    expect(count.suppressed).toBe(1);
    // Structural: response has NO field containing an email address
    const json = JSON.stringify(count);
    expect(json).not.toContain("a@a.com");
    expect(json).not.toContain("b@b.com");
    expect(json).not.toContain("c@c.com");
  });

  it("(B2) suppressed breakdown surfaces opt_out and hard_bounced separately", async () => {
    mock.seedContacts([
      { email: "a@a.com", country: "US", category_slug: "x", opt_out: true, hard_bounced: false },
      { email: "b@b.com", country: "US", category_slug: "x", opt_out: false, hard_bounced: true },
      { email: "c@c.com", country: "US", category_slug: "x", opt_out: false, hard_bounced: false },
    ]);
    const count = await countAudience(mock.client, { country: "US", category: "x" });
    expect(count.not_eligible_reason.opt_out).toBe(1);
    expect(count.not_eligible_reason.hard_bounced).toBe(1);
    expect(count.eligible).toBe(1);
  });

  it("(B3) empty audience returns zero counts · not an error", async () => {
    const count = await countAudience(mock.client, { country: "MARS", category: "unknown" });
    expect(count.total_discovered).toBe(0);
    expect(count.eligible).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (C) Template composer
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (C) template composer", () => {
  it("(C1) compiles content blocks into HTML + text fallback", () => {
    const out = compileTemplate({
      display_name: "Test",
      subject_line: "Hello",
      from_email: "sender@example.com",
      package_id: "p", sender_id: "s",
      audience: {},
      content_blocks: [
        { kind: "heading", text: "Big Header" },
        { kind: "paragraph", text: "Some content here." },
        { kind: "button", label: "Click me", url: "https://example.com" },
      ],
    });
    expect(out.html).toContain("Big Header");
    expect(out.html).toContain("Some content here.");
    expect(out.html).toContain("Click me");
    expect(out.text).toContain("Big Header");
    expect(out.text).toContain("Click me · https://example.com");
  });

  it("(C2) HTML-escapes user content · no XSS via subject", () => {
    const out = compileTemplate({
      display_name: "Test",
      subject_line: `<script>alert(1)</script>`,
      from_email: "s@x", package_id: "p", sender_id: "s",
      audience: {},
      content_blocks: [{ kind: "paragraph", text: `<img src=x onerror=alert(1)>` }],
    });
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).toContain("&lt;img");
  });

  it("(C3) accepts raw MJML source when provided", () => {
    const out = compileTemplate({
      display_name: "Test", subject_line: "S", from_email: "s@x",
      package_id: "p", sender_id: "s", audience: {},
      mjml_source: "<mjml><mj-body>hi</mj-body></mjml>",
    });
    expect(out.mjml_source).toBe("<mjml><mj-body>hi</mj-body></mjml>");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (D) Create draft campaign · ownership enforcement
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (D) create draft campaign · ownership", () => {
  it("(D1) creates a draft when member owns package + sender", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-A", "member-A");
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "US Scaffolding Intro",
      subject_line: "Meet NEX",
      from_email: "member@business.com",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "US", category: "scaffolding" },
    });
    expect(c.status).toBe("draft");
    expect(c.member_id).toBe("member-A");
    expect(c.package_id).toBe("pkg-A");
  });

  it("(D2) Member B cannot create against Member A's package", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-B", "member-B");
    await expect(createDraftCampaign(mock.client, authOf("member-B"), {
      display_name: "campaign-name", subject_line: "hello world", from_email: "x@x",
      package_id: "pkg-A", sender_id: "snd-B",
      audience: {},
    })).rejects.toThrow(MemberIsolationError);
  });

  it("(D3) Member cannot use another member's sender", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-B", "member-B");
    await expect(createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "x", subject_line: "hello world", from_email: "x@x",
      package_id: "pkg-A", sender_id: "snd-B",   // wrong member's sender
      audience: {},
    })).rejects.toThrow(MemberIsolationError);
  });

  it("(D4) rejects display_name shorter than 3 chars", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-A", "member-A");
    await expect(createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "ab", subject_line: "hello", from_email: "x@x",
      package_id: "pkg-A", sender_id: "snd-A", audience: {},
    })).rejects.toThrow(MemberValidationError);
  });

  it("(D5) unauthenticated request refused", async () => {
    await expect(createDraftCampaign(mock.client, {
      member_id: "", authenticated: false, session_source: "unauthenticated"
    }, {
      display_name: "campaign-name", subject_line: "hello world", from_email: "x@x",
      package_id: "p", sender_id: "s", audience: {},
    })).rejects.toThrow(MemberAccessError);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (E) List/load member campaigns · isolation
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (E) member campaign isolation", () => {
  it("(E1) listMemberCampaigns returns ONLY caller's campaigns", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedPackage("pkg-B", "member-B", 100);
    mock.seedSender("snd-A", "member-A");
    mock.seedSender("snd-B", "member-B");
    await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "A's campaign", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A", audience: {},
    });
    await createDraftCampaign(mock.client, authOf("member-B"), {
      display_name: "B's campaign", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-B", sender_id: "snd-B", audience: {},
    });
    const listA = await listMemberCampaigns(mock.client, authOf("member-A"));
    const listB = await listMemberCampaigns(mock.client, authOf("member-B"));
    expect(listA.length).toBe(1);
    expect(listB.length).toBe(1);
    expect(listA[0].member_id).toBe("member-A");
    expect(listB[0].member_id).toBe("member-B");
  });

  it("(E2) loadMemberCampaign refuses cross-member access", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-A", "member-A");
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "hidden", subject_line: "hidden", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A", audience: {},
    });
    await expect(loadMemberCampaign(mock.client, authOf("member-B"), c.campaign_id))
      .rejects.toThrow(MemberIsolationError);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (F) Review · package + sender + audience aggregation
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (F) review · aggregation + gates", () => {
  async function setupHealthyCampaign() {
    mock.seedPackage("pkg-A", "member-A", 500);
    mock.seedSender("snd-A", "member-A", { hourly_capacity: 100, daily_capacity: 500 });
    mock.seedContacts([
      { email: "u1@x", country: "US", category_slug: "scaffolding", opt_out: false, hard_bounced: false },
      { email: "u2@x", country: "US", category_slug: "scaffolding", opt_out: false, hard_bounced: false },
      { email: "u3@x", country: "US", category_slug: "scaffolding", opt_out: false, hard_bounced: false },
    ]);
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "US Scaffolding", subject_line: "Meet NEX", from_email: "sender@x",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "US", category: "scaffolding" },
    });
    return c;
  }

  it("(F1) healthy campaign · send_ready=true · no refusal reasons", async () => {
    const c = await setupHealthyCampaign();
    const r = await reviewMemberCampaign(mock.client, authOf("member-A"), c.campaign_id);
    expect(r.send_ready).toBe(true);
    expect(r.refusal_reasons).toEqual([]);
    expect(r.audience_count.eligible).toBe(3);
    expect(r.sender.email).toBeTruthy();
    expect(r.package.remaining).toBe(500);
  });

  it("(F2) package exhausted → send_ready=false with package_exhausted reason", async () => {
    mock.seedPackage("pkg-A", "member-A", 2);   // only 2 sends purchased
    mock.seedSender("snd-A", "member-A");
    mock.seedContacts([
      { email: "u1@x", country: "US", category_slug: "s", opt_out: false, hard_bounced: false },
      { email: "u2@x", country: "US", category_slug: "s", opt_out: false, hard_bounced: false },
      { email: "u3@x", country: "US", category_slug: "s", opt_out: false, hard_bounced: false },
    ]);
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-big", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "US", category: "s" },
    });
    const r = await reviewMemberCampaign(mock.client, authOf("member-A"), c.campaign_id);
    expect(r.send_ready).toBe(false);
    expect(r.refusal_reasons.some(x => x.kind === "package_exhausted")).toBe(true);
  });

  it("(F3) audience empty → send_ready=false with audience_empty reason", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-A", "member-A");
    // No contacts seeded matching MARS/unknown
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-empty", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "MARS", category: "unknown" },
    });
    const r = await reviewMemberCampaign(mock.client, authOf("member-A"), c.campaign_id);
    expect(r.send_ready).toBe(false);
    expect(r.refusal_reasons.some(x => x.kind === "audience_empty")).toBe(true);
  });

  it("(F4) sender unhealthy → send_ready=false with sender_unhealthy reason", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-A", "member-A", { health_state: "provider_blocked" });
    mock.seedContacts([
      { email: "u@x", country: "US", category_slug: "s", opt_out: false, hard_bounced: false },
    ]);
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-name", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A", audience: { country: "US", category: "s" },
    });
    const r = await reviewMemberCampaign(mock.client, authOf("member-A"), c.campaign_id);
    expect(r.send_ready).toBe(false);
    expect(r.refusal_reasons.some(x => x.kind === "sender_unhealthy")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (G) Schedule/send · reserves package capacity + status transitions
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (G) schedule/send · package accounting integration", () => {
  it("(G1) schedule reserves exact audience_count into package", async () => {
    mock.seedPackage("pkg-A", "member-A", 500);
    mock.seedSender("snd-A", "member-A");
    mock.seedContacts(
      Array.from({ length: 10 }, (_, i) => ({ email: `u${i}@x`, country: "US", category_slug: "s", opt_out: false, hard_bounced: false })),
    );
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "US", category: "s" },
    });
    const r = await scheduleOrSendMemberCampaign(mock.client, authOf("member-A"), c.campaign_id);
    expect(r.reserved).toBe(10);
    const pkg = mock.getPackage("pkg-A");
    expect(pkg?.reserved_capacity).toBe(10);
  });

  it("(G2) send_ready=false blocks schedule/send", async () => {
    mock.seedPackage("pkg-A", "member-A", 1);   // only 1 slot
    mock.seedSender("snd-A", "member-A");
    mock.seedContacts(Array.from({ length: 5 }, (_, i) => ({ email: `u${i}@x`, country: "US", category_slug: "s", opt_out: false, hard_bounced: false })));
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-over", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "US", category: "s" },
    });
    await expect(scheduleOrSendMemberCampaign(mock.client, authOf("member-A"), c.campaign_id))
      .rejects.toThrow(MemberValidationError);
  });

  it("(G3) cancel releases reserved capacity", async () => {
    mock.seedPackage("pkg-A", "member-A", 500);
    mock.seedSender("snd-A", "member-A");
    mock.seedContacts(Array.from({ length: 5 }, (_, i) => ({ email: `u${i}@x`, country: "US", category_slug: "s", opt_out: false, hard_bounced: false })));
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-name", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "US", category: "s" },
    });
    await scheduleOrSendMemberCampaign(mock.client, authOf("member-A"), c.campaign_id);
    expect(mock.getPackage("pkg-A")?.reserved_capacity).toBe(5);
    const cancel = await cancelMemberCampaign(mock.client, authOf("member-A"), c.campaign_id, "member_changed_mind");
    expect(cancel.released).toBe(5);
    expect(mock.getPackage("pkg-A")?.reserved_capacity).toBe(0);
  });

  it("(G4) cancel refused if campaign already sent/failed/cancelled", async () => {
    mock.seedPackage("pkg-A", "member-A", 500);
    mock.seedSender("snd-A", "member-A");
    mock.seedContacts([{ email: "u@x", country: "US", category_slug: "s", opt_out: false, hard_bounced: false }]);
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-name", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A",
      audience: { country: "US", category: "s" },
    });
    mock.forceCampaignStatus(c.campaign_id, "sent");
    await expect(cancelMemberCampaign(mock.client, authOf("member-A"), c.campaign_id))
      .rejects.toThrow(MemberValidationError);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (H) Contact-boundary structural checks
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (H) contact-boundary preservation (ADR-0003a Clause 1)", () => {
  it("(H1) member module exports NO contact-export functions", async () => {
    const mod = await import("..");
    // Structural: no export named for lead-selling actions
    expect((mod as any).exportContacts).toBeUndefined();
    expect((mod as any).downloadLeads).toBeUndefined();
    expect((mod as any).listContactAddresses).toBeUndefined();
    expect((mod as any).exportAddresses).toBeUndefined();
    expect((mod as any).downloadCsv).toBeUndefined();
    expect((mod as any).getAudienceEmails).toBeUndefined();
  });

  it("(H2) analytics response contains counts only · no address fields", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("snd-A", "member-A");
    mock.seedContacts([{ email: "u@x", country: "US", category_slug: "s", opt_out: false, hard_bounced: false }]);
    const c = await createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-name", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "snd-A", audience: { country: "US", category: "s" },
    });
    const { getMemberCampaignAnalytics } = await import("..");
    const a = await getMemberCampaignAnalytics(mock.client, authOf("member-A"), c.campaign_id);
    const json = JSON.stringify(a);
    expect(json).not.toContain("u@x");
    expect(json).not.toContain("@");   // no addresses anywhere · analytics is counts only
    // Observed-open naming preserved
    expect(a).toHaveProperty("observed_opens");
    expect((a as any).read).toBeUndefined();
    expect(a.rates).toHaveProperty("observed_open_rate");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (I) Three-lane isolation · package cannot be consumed by AUTO/FOUNDER
// ═══════════════════════════════════════════════════════════════════
describe("Stage 4 · (I) three-lane isolation", () => {
  it("(I1) FOUNDER-lane sender cannot be selected in member composer", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("founder-sender", null, { lane: "founder" });
    await expect(createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-name", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "founder-sender", audience: {},
    })).rejects.toThrow(MemberIsolationError);
  });

  it("(I2) AUTO-lane sender cannot be selected in member composer", async () => {
    mock.seedPackage("pkg-A", "member-A", 100);
    mock.seedSender("auto-sender", null, { lane: "auto" });
    await expect(createDraftCampaign(mock.client, authOf("member-A"), {
      display_name: "campaign-name", subject_line: "hello world", from_email: "s@x",
      package_id: "pkg-A", sender_id: "auto-sender", audience: {},
    })).rejects.toThrow(MemberIsolationError);
  });
});
