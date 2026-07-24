// Opportunities enricher — cadence + reheat + referral.

import { describe, it, expect } from "vitest";
import { detectOpportunities } from "./opportunities";
import type { ContactSummary } from "@/lib/crm/loadContactTimeline";

function tl(kind: ContactSummary["timeline"][number]["kind"], iso: string, headline: string, sourceId?: string): ContactSummary["timeline"][number] {
  return { kind, occurredAt: iso, headline, sourceApp: "test", sourceId };
}

function summary(overrides: Partial<ContactSummary> = {}): ContactSummary {
  return {
    contact: { id: "c1", displayName: "T", email: null, whatsappE164: null, postcode: null, lifecycleStage: "active", source: null, tags: [], ownerDisplayName: null, notes: null, lastActivityAt: null, lastTouchAt: null, nextFollowUpAt: null, quietSince: null, partyId: null, createdAt: "2026-01-01T00:00:00Z" },
    timeline: overrides.timeline ?? [],
    openTasks: [],
    totals: { renders: 0, quotesSent: 0, quotesAccepted: 0, jobsSignedOff: 0, reviewsPosted: 0 },
    ...overrides
  };
}

const NOW = new Date("2026-07-23T00:00:00Z");

describe("detectOpportunities — cadence", () => {
  it("kitchen signed off 18 months ago → maintenance suggestion", () => {
    // 18 months = 540 days → 2025-02-04
    const s = summary({ timeline: [tl("job_signed_off", "2025-02-04T12:00:00Z", "Kitchen refit — signed off", "j1")] });
    const opps = detectOpportunities(s, NOW);
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].headline).toContain("Kitchen");
    expect(opps[0].headline).toContain("silicone");
    expect(opps[0].reason).toContain("2025-02-04");
  });

  it("roof signed off 12 months ago → gutter inspection", () => {
    const s = summary({ timeline: [tl("job_signed_off", "2025-07-23T12:00:00Z", "Roof felt replacement", "j1")] });
    const opps = detectOpportunities(s, NOW);
    expect(opps[0].headline).toContain("gutter");
  });

  it("boiler service anniversary triggers annual service opportunity", () => {
    const s = summary({ timeline: [tl("job_signed_off", "2025-08-22T12:00:00Z", "Boiler install", "j1")] });
    const opps = detectOpportunities(s, NOW);
    expect(opps[0].headline).toContain("boiler");
  });

  it("no opportunity when job is too fresh or too stale", () => {
    const fresh = summary({ timeline: [tl("job_signed_off", "2026-07-01T12:00:00Z", "Kitchen refit", "j1")] });
    expect(detectOpportunities(fresh, NOW)).toEqual([]);
    const ancient = summary({ timeline: [tl("job_signed_off", "2010-01-01T12:00:00Z", "Kitchen refit", "j1")] });
    expect(detectOpportunities(ancient, NOW)).toEqual([]);
  });
});

describe("detectOpportunities — quote reheat", () => {
  it("quote sent > 7 days ago with no accept/reject → chase opportunity", () => {
    const s = summary({ timeline: [tl("quote_sent", "2026-07-10T12:00:00Z", "Quote sent", "q1")] });
    const opps = detectOpportunities(s, NOW);
    expect(opps.some((o) => o.key.startsWith("quote_reheat_"))).toBe(true);
  });

  it("quote accepted → no reheat opportunity", () => {
    const s = summary({ timeline: [
      tl("quote_sent",     "2026-07-10T12:00:00Z", "Quote sent",     "q1"),
      tl("quote_accepted", "2026-07-12T12:00:00Z", "Quote accepted", "q1")
    ]});
    const opps = detectOpportunities(s, NOW);
    expect(opps.some((o) => o.key.startsWith("quote_reheat_"))).toBe(false);
  });
});

describe("detectOpportunities — referral thank-you", () => {
  it("reviewer that hasn't heard from you in 60+ days = referral moment", () => {
    const s = summary({
      contact: { id: "c1", displayName: "T", email: null, whatsappE164: null, postcode: null, lifecycleStage: "active", source: null, tags: [], ownerDisplayName: null, notes: null, lastActivityAt: null, lastTouchAt: "2026-04-01T00:00:00Z", nextFollowUpAt: null, quietSince: null, partyId: null, createdAt: "2026-01-01T00:00:00Z" },
      timeline: [tl("review_posted", "2026-03-15T00:00:00Z", "5★ review — great job", "r1")]
    });
    const opps = detectOpportunities(s, NOW);
    expect(opps.some((o) => o.key === "referral_thankyou")).toBe(true);
  });
});
