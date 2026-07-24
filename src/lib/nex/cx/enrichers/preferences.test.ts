// Preferences enricher — inference rules.

import { describe, it, expect } from "vitest";
import { inferPreferences } from "./preferences";
import type { ContactSummary } from "@/lib/crm/loadContactTimeline";

function tl(kind: ContactSummary["timeline"][number]["kind"], iso: string, sourceId?: string): ContactSummary["timeline"][number] {
  return { kind, occurredAt: iso, headline: kind, sourceApp: "test", sourceId };
}

function summary(overrides: Partial<ContactSummary> = {}): ContactSummary {
  return {
    contact: { id: "c1", displayName: "T", email: null, whatsappE164: null, postcode: null, lifecycleStage: "active", source: null, tags: [], ownerDisplayName: null, notes: null, lastActivityAt: null, lastTouchAt: null, nextFollowUpAt: null, quietSince: null, partyId: null, createdAt: "2026-01-01T00:00:00Z" },
    timeline:  overrides.timeline  ?? [],
    openTasks: [],
    totals:    { renders: 0, quotesSent: 0, quotesAccepted: 0, jobsSignedOff: 0, reviewsPosted: 0 },
    ...overrides
  };
}

describe("inferPreferences", () => {
  it("returns [] when signal is thin", () => {
    const s = summary({ timeline: [tl("whatsapp_sent", "2026-07-01T12:00:00Z")] });
    expect(inferPreferences(s)).toEqual([]);
  });

  it("detects WhatsApp preference when 60%+ of last 12 are WA", () => {
    const timeline = Array.from({ length: 8 }, (_, i) => tl("whatsapp_sent", `2026-07-${String(i + 10).padStart(2, "0")}T14:00:00Z`))
      .concat(Array.from({ length: 4 }, (_, i) => tl("email_sent", `2026-07-${String(i + 10).padStart(2, "0")}T15:00:00Z`)));
    const prefs = inferPreferences(summary({ timeline }));
    const wa = prefs.find((p) => p.key === "channel_wa");
    expect(wa).toBeDefined();
    expect(wa?.reason).toContain("WhatsApp");
  });

  it("detects evening pattern when 70%+ of activity is after 5pm UTC", () => {
    const timeline = Array.from({ length: 6 }, (_, i) => tl("whatsapp_sent", `2026-07-${String(i + 10).padStart(2, "0")}T19:00:00Z`));
    const prefs = inferPreferences(summary({ timeline }));
    expect(prefs.find((p) => p.key === "time_evening")).toBeDefined();
  });

  it("respects explicit merchant note preferences", () => {
    const s = summary({
      contact: { id: "c1", displayName: "T", email: null, whatsappE164: null, postcode: null, lifecycleStage: "active", source: null, tags: [], ownerDisplayName: null, notes: "Prefers phone calls in the morning\nOwns 3 rental flats", lastActivityAt: null, lastTouchAt: null, nextFollowUpAt: null, quietSince: null, partyId: null, createdAt: "2026-01-01T00:00:00Z" },
      timeline: Array.from({ length: 4 }, (_, i) => tl("call", `2026-07-${String(i + 10).padStart(2, "0")}T10:00:00Z`))
    });
    const prefs = inferPreferences(s);
    const noteP = prefs.find((p) => p.key === "note_pref");
    expect(noteP?.label).toContain("Prefers phone");
    expect(noteP?.strength).toBe("strong");
  });

  it("detects fast response from quote-sent → quote-viewed lag", () => {
    const timeline = [
      tl("quote_sent",   "2026-07-01T09:00:00Z", "q1"),
      tl("quote_viewed", "2026-07-01T14:00:00Z", "q1"),
      tl("quote_sent",   "2026-07-05T09:00:00Z", "q2"),
      tl("quote_viewed", "2026-07-05T15:00:00Z", "q2"),
      tl("quote_sent",   "2026-07-10T09:00:00Z", "q3"),
      tl("quote_viewed", "2026-07-10T18:00:00Z", "q3")
    ];
    const prefs = inferPreferences(summary({ timeline }));
    expect(prefs.find((p) => p.key === "response_fast")).toBeDefined();
  });
});
