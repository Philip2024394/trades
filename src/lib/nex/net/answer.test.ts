// Answer router — classifier + formatters.

import { describe, it, expect, vi } from "vitest";

vi.mock("./matchmaker", () => ({
  findMatches: vi.fn(async ({ brief }: { brief: string }) => {
    if (brief.includes("gibberish")) return null;
    return {
      intent: { trade: "bricklayer", area: "M25" },
      matches: [
        { slug: "acme-bricks", display_name: "ACME Bricks",  trading_name: null, primary_trade: "bricklayer", secondary_trades: [], city: "Manchester", postcode_prefix: "M25", distance_km: 4.2, evidence: { source: "t", tables: [], computed_at: "x" } }
      ],
      note: "test note.",
      evidence: { source: "t", tables: [], computed_at: "x" }
    };
  })
}));

import { answerNetwork, classifyNetworkQuestion } from "./answer";
import type { NetworkSnapshot } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function snap(overrides: Partial<NetworkSnapshot> = {}): NetworkSnapshot {
  return {
    computed_at:   "2026-07-23T00:00:00Z",
    merchant_slug: "phil",
    trust: {
      slug: "phil", display_name: "Phil Plumbing", overall_score: 78, band: "healthy",
      signals: {
        reviews:     { score: 82, weight: 2,   note: "10 reviews, avg 4.5★." },
        completions: { score: 75, weight: 1.5, note: "5 projects completed." },
        reliability: { score: 70, weight: 1,   note: "8 of 10 replies." },
        tenure:      { score: null, weight: 0.5, note: "listing date unknown." }
      },
      evidence: ev
    },
    collaborators: [
      { partner_slug: "acme-bricks", partner_name: "ACME Bricks", partner_trade: "bricklayer", projects_together: 3, most_recent_at: "2026-07-01T00:00:00Z", evidence: ev }
    ],
    referrals: [
      { contact_id: "c1", display_name: "Mrs Smith", reason: "5★ review", action: "Ask for a referral", evidence: ev }
    ],
    unavailable: ["Apprentice registry."],
    errors:      [],
    ...overrides
  };
}

describe("classifyNetworkQuestion", () => {
  it("routes find", () => {
    expect(classifyNetworkQuestion("find me a bricklayer").kind).toBe("find");
    expect(classifyNetworkQuestion("recommend a roofer").kind).toBe("find");
    expect(classifyNetworkQuestion("i need a plumber").kind).toBe("find");
  });
  it("routes trust", () => {
    expect(classifyNetworkQuestion("my trust profile").kind).toBe("trust");
    expect(classifyNetworkQuestion("how trusted am i").kind).toBe("trust");
  });
  it("routes collaborators", () => {
    expect(classifyNetworkQuestion("who have I worked with").kind).toBe("collaborators");
  });
  it("routes referrals", () => {
    expect(classifyNetworkQuestion("referrals").kind).toBe("referrals");
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifyNetworkQuestion("hello there").kind).toBe("none");
  });
});

describe("answerNetwork", () => {
  it("find returns matched businesses + note", async () => {
    const out = await answerNetwork({ question: { kind: "find", brief: "find me a bricklayer near M25" } });
    expect(out).toContain("ACME Bricks");
    expect(out).toContain("~4.2 km away");
  });

  it("find with gibberish → clarifying reply", async () => {
    const out = await answerNetwork({ question: { kind: "find", brief: "find me a gibberish" } });
    expect(out).toContain("didn't recognise a trade");
  });

  it("trust prints headline + per-signal breakdown", async () => {
    const out = await answerNetwork({ question: { kind: "trust" }, snapshot: snap() });
    expect(out).toContain("78%");
    expect(out).toContain("reviews:");
    expect(out).toContain("tenure: no data");
  });

  it("collaborators lists partners with count", async () => {
    const out = await answerNetwork({ question: { kind: "collaborators" }, snapshot: snap() });
    expect(out).toContain("ACME Bricks");
    expect(out).toContain("3 projects together");
  });

  it("referrals surfaces reason + action", async () => {
    const out = await answerNetwork({ question: { kind: "referrals" }, snapshot: snap() });
    expect(out).toContain("Mrs Smith");
    expect(out).toContain("Ask for a referral");
  });

  it("unavailable enumerates missing sources", async () => {
    const out = await answerNetwork({ question: { kind: "unavailable" }, snapshot: snap() });
    expect(out).toContain("Apprentice registry");
  });
});
