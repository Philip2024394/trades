// Answer classifier + formatters.

import { describe, it, expect } from "vitest";
import { classifyCustomerQuestion, formatCustomerList, formatCustomerOverview } from "./answer";
import type { CustomerSnapshot } from "./types";

describe("classifyCustomerQuestion", () => {
  it("routes 'who owes me money?'", () => {
    expect(classifyCustomerQuestion("who owes me money?").kind).toBe("who_owes");
  });
  it("routes 'who should I contact today?'", () => {
    expect(classifyCustomerQuestion("who should I contact today?").kind).toBe("who_to_contact");
  });
  it("routes 'who leaves the best reviews?'", () => {
    expect(classifyCustomerQuestion("who leaves the best reviews").kind).toBe("best_reviewers");
  });
  it("routes 'which customers have repeat work'", () => {
    expect(classifyCustomerQuestion("which customers have repeat work").kind).toBe("repeat_customers");
  });
  it("routes 'show kitchen customers'", () => {
    const q = classifyCustomerQuestion("show kitchen customers");
    expect(q.kind).toBe("by_tag");
    if (q.kind === "by_tag") expect(q.tag).toBe("kitchen");
  });
  it("routes 'tell me about Mrs Smith'", () => {
    const q = classifyCustomerQuestion("tell me about Mrs Smith");
    expect(q.kind).toBe("customer_overview");
    if (q.kind === "customer_overview") expect(q.name?.toLowerCase()).toContain("mrs smith");
  });
  it("routes 'open John's project'", () => {
    const q = classifyCustomerQuestion("open John's project");
    expect(q.kind).toBe("customer_overview");
    if (q.kind === "customer_overview") expect(q.name?.toLowerCase()).toBe("john");
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifyCustomerQuestion("hello there").kind).toBe("none");
  });
});

describe("formatCustomerList", () => {
  it("empty list returns a friendly no-results message", () => {
    expect(formatCustomerList("who_owes", [])).toContain("Nothing to show");
  });
  it("labels the section header per kind", () => {
    const out = formatCustomerList("who_owes", [
      { contactId: "c1", displayName: "Mrs Smith",  lifecycleStage: "active", lastActivityAt: null, note: "£1,200 outstanding." },
      { contactId: "c2", displayName: "Dave Jones", lifecycleStage: "won",    lastActivityAt: null, note: "£450 overdue." }
    ]);
    expect(out).toContain("outstanding balance:");
    expect(out).toContain("Mrs Smith");
    expect(out).toContain("£1,200");
  });
});

describe("formatCustomerOverview", () => {
  const snap: CustomerSnapshot = {
    contactId: "c1",
    contact:   { id: "c1", displayName: "Mrs Smith", email: null, whatsappE164: null, postcode: "M25", lifecycleStage: "active", source: null, tags: ["kitchen", "loyal"], ownerDisplayName: null, notes: null, lastActivityAt: null, lastTouchAt: null, nextFollowUpAt: null, quietSince: null, partyId: "p1", createdAt: "2026-01-01T00:00:00Z" },
    timeline:  [],
    openTasks: [],
    totals:    { renders: 0, quotesSent: 3, quotesAccepted: 2, jobsSignedOff: 2, reviewsPosted: 1 },
    health:    { score: 88, band: "healthy", headline: "Relationship Health: 88%. Healthy.", signals: { payments: { score: 95, note: "" }, communication: { score: 80, note: "" }, reviews: { score: 90, note: "" }, repeat: { score: 78, note: "" }, responsiveness: { score: null, note: "" } } },
    preferences:   [{ key: "channel_wa", label: "Prefers WhatsApp", strength: "strong", reason: "8/8 last activities", evidence: { source: "", tables: [], computed_at: "" } }],
    opportunities: [{ key: "cadence_1", headline: "Kitchen completed 18 months ago — recommend maintenance.", reason: "signed 2025-02", evidence: { source: "", tables: [], computed_at: "" } }],
    warranties:    [{ title: "Boiler service", trade_name: null, next_due_at: "2026-09-01", days_until: 40, evidence: { source: "", tables: [], computed_at: "" } }],
    payments_owed: [{ cost_id: "1", project_title: "Kitchen refit", description: "Final invoice", agreed_pence: 300_000, paid_pence: 200_000, outstanding_pence: 100_000, due_at: null, is_overdue: false, evidence: { source: "", tables: [], computed_at: "" } }],
    computed_at:   "2026-07-23T00:00:00Z",
    errors: []
  };

  it("includes health headline + counts + preferences + opportunities + warranties + outstanding", () => {
    const out = formatCustomerOverview(snap);
    expect(out).toContain("Mrs Smith");
    expect(out).toContain("Relationship Health: 88%");
    expect(out).toContain("3 quotes sent");
    expect(out).toContain("Outstanding: £1,000");
    expect(out).toContain("Prefers WhatsApp");
    expect(out).toContain("Kitchen completed 18 months ago");
    expect(out).toContain("Boiler service — 40 days");
    expect(out).toContain("kitchen, loyal");
  });
});
