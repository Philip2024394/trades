// Relationship health aggregator — pure function tests.

import { describe, it, expect } from "vitest";
import { bandFor, computeRelationshipHealth } from "./health";
import type { ContactSummary } from "@/lib/crm/loadContactTimeline";

function contact(overrides: Partial<ContactSummary["contact"]> = {}): ContactSummary["contact"] {
  return {
    id: "c1", displayName: "Test", email: null, whatsappE164: null, postcode: null,
    lifecycleStage: "active", source: null, tags: [], ownerDisplayName: null,
    notes: null, lastActivityAt: null, lastTouchAt: null, nextFollowUpAt: null,
    quietSince: null, partyId: null, createdAt: "2026-01-01T00:00:00Z",
    ...overrides
  };
}

function summary(overrides: Partial<ContactSummary> = {}): ContactSummary {
  return {
    contact:    contact(overrides.contact),
    timeline:   overrides.timeline   ?? [],
    openTasks:  overrides.openTasks  ?? [],
    totals:     overrides.totals     ?? { renders: 0, quotesSent: 0, quotesAccepted: 0, jobsSignedOff: 0, reviewsPosted: 0 }
  };
}

describe("computeRelationshipHealth", () => {
  it("returns 0 / critical when no signal has data", () => {
    const h = computeRelationshipHealth({ summary: summary(), payments_owed: [] });
    expect(h.score).toBe(0);
    expect(h.band).toBe("critical");
    expect(h.headline).toContain("no data");
  });

  it("nothing outstanding + recent touch = high score", () => {
    const now = new Date("2026-07-23T12:00:00Z");
    const s = summary({
      contact:  contact({ lastTouchAt: "2026-07-20T00:00:00Z" }),
      totals:   { renders: 0, quotesSent: 1, quotesAccepted: 1, jobsSignedOff: 2, reviewsPosted: 1 },
      timeline: [
        { kind: "quote_sent",   occurredAt: "2026-05-01T09:00:00Z", headline: "Quote sent",   sourceApp: "q", sourceId: "q1" },
        { kind: "quote_viewed", occurredAt: "2026-05-01T13:00:00Z", headline: "Quote viewed", sourceApp: "q", sourceId: "q1" }
      ]
    });
    const h = computeRelationshipHealth({ summary: s, payments_owed: [], reviewStars: 5, now });
    expect(h.score).toBeGreaterThanOrEqual(85);
    expect(h.band).toMatch(/excellent|healthy/);
    expect(h.signals.payments.score).toBe(95);
    expect(h.signals.communication.score).toBe(95);
    expect(h.signals.responsiveness.score).toBe(95);
  });

  it("overdue outstanding drags payments to 30", () => {
    const s = summary();
    const h = computeRelationshipHealth({
      summary: s,
      payments_owed: [
        { cost_id: "1", project_title: null, description: null, agreed_pence: 100_000, paid_pence: 0, outstanding_pence: 100_000, due_at: "2020-01-01", is_overdue: true, evidence: { source: "", tables: [], computed_at: "" } }
      ]
    });
    expect(h.signals.payments.score).toBe(30);
    expect(h.signals.payments.note).toContain("overdue");
  });

  it("quiet for 100 days scores communication low", () => {
    const now = new Date("2026-07-23T12:00:00Z");
    const s = summary({ contact: contact({ lastTouchAt: "2026-04-14T00:00:00Z" }) });
    const h = computeRelationshipHealth({ summary: s, payments_owed: [], now });
    expect(h.signals.communication.score).toBe(45);
  });

  it("repeat business boosts score", () => {
    const s = summary({
      totals: { renders: 0, quotesSent: 3, quotesAccepted: 3, jobsSignedOff: 4, reviewsPosted: 2 }
    });
    const h = computeRelationshipHealth({ summary: s, payments_owed: [] });
    expect(h.signals.repeat.score).toBeGreaterThanOrEqual(85);   // 70 + 3*8 = 94
  });
});

describe("bandFor", () => {
  it("maps thresholds correctly", () => {
    expect(bandFor(95)).toBe("excellent");
    expect(bandFor(75)).toBe("healthy");
    expect(bandFor(60)).toBe("steady");
    expect(bandFor(40)).toBe("attention");
    expect(bandFor(10)).toBe("critical");
  });
});
