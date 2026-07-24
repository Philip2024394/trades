// Verified-Knowledge helpers — pure functions, no DB.

import { describe, it, expect } from "vitest";
import { coerceSource, isTrustedUrl, draftTier } from "./research";
import { KIND_TO_TIER, type KnowledgeEntryDraft } from "./types";

describe("isTrustedUrl (fabricated URL guard)", () => {
  it("accepts gov.uk", () => {
    expect(isTrustedUrl("https://www.gov.uk/government/publications/approved-doc-k")).toBe(true);
  });
  it("accepts hse.gov.uk (subdomain of gov.uk)", () => {
    expect(isTrustedUrl("https://www.hse.gov.uk/pubns/priced/l24.pdf")).toBe(true);
  });
  it("accepts BSI + trade bodies", () => {
    expect(isTrustedUrl("https://www.bsigroup.com/bs-1234")).toBe(true);
    expect(isTrustedUrl("https://www.niceic.com/find")).toBe(true);
    expect(isTrustedUrl("https://www.gassaferegister.co.uk/find-an-engineer/")).toBe(true);
  });
  it("rejects random blogs", () => {
    expect(isTrustedUrl("https://randomblog.example/carpentry-tips")).toBe(false);
    expect(isTrustedUrl("https://medium.com/@x/kitchen-fitting")).toBe(false);
  });
  it("rejects malformed URLs", () => {
    expect(isTrustedUrl("not a url")).toBe(false);
    expect(isTrustedUrl("")).toBe(false);
  });
  it("rejects sneaky spoofs", () => {
    expect(isTrustedUrl("https://gov.uk.evil.example/x")).toBe(false);
    expect(isTrustedUrl("https://fake-gov.uk-cdn.example/x")).toBe(false);
  });
});

describe("coerceSource — tier + URL sanitisation", () => {
  it("derives tier from kind when omitted", () => {
    expect(coerceSource({ title: "AD-K", kind: "regulation" }).tier).toBe("official");
    expect(coerceSource({ title: "NICEIC", kind: "trade-body" }).tier).toBe("industry");
    expect(coerceSource({ title: "Reddit thread", kind: "expert-quote" }).tier).toBe("community");
  });
  it("keeps URL when trusted", () => {
    const s = coerceSource({ title: "AD-K", kind: "regulation", url: "https://www.gov.uk/x" });
    expect(s.url).toBe("https://www.gov.uk/x");
    expect(s.verification_note).toBeUndefined();
  });
  it("nulls URL when NOT on allowlist and adds a verification note", () => {
    const s = coerceSource({ title: "Some blog", kind: "other", url: "https://randomblog.example/x" });
    expect(s.url).toBeUndefined();
    expect(s.verification_note).toBeDefined();
    expect(s.verification_note).toContain("not on trusted-domain allowlist");
  });
  it("defaults country to UK", () => {
    expect(coerceSource({ title: "AD-K", kind: "regulation" }).country).toBe("UK");
  });
  it("respects explicit tier override", () => {
    expect(coerceSource({ title: "X", kind: "other", tier: "official" }).tier).toBe("official");
  });
  it("falls back to unverified for unknown kinds", () => {
    expect(coerceSource({ title: "X", kind: "unknown-kind" }).tier).toBe("unverified");
  });
});

describe("draftTier — weakest-link tiering", () => {
  const base: KnowledgeEntryDraft = {
    trade: "carpentry", topic: "second-fix", title: "Skirting joins",
    summary: "Mitre joints for external corners; scarf joints for long straight runs.",
    difficulty: "basic", keywords: [], sources: [], evidence: [], confidence: 80
  };

  it("official + official → official", () => {
    const d = { ...base, sources: [
      { title: "AD-K", kind: "regulation" as const, tier: "official" as const },
      { title: "HSE", kind: "regulation" as const, tier: "official" as const }
    ]};
    expect(draftTier(d)).toBe("official");
  });

  it("official + community → community (weakest link)", () => {
    const d = { ...base, sources: [
      { title: "AD-K", kind: "regulation" as const, tier: "official" as const },
      { title: "Reddit", kind: "expert-quote" as const, tier: "community" as const }
    ]};
    expect(draftTier(d)).toBe("community");
  });

  it("industry only → industry", () => {
    const d = { ...base, sources: [
      { title: "NICEIC", kind: "trade-body" as const, tier: "industry" as const }
    ]};
    expect(draftTier(d)).toBe("industry");
  });

  it("empty sources → official (vacuous; the sources.min(1) Zod check enforces at draft time)", () => {
    const d = { ...base, sources: [] };
    expect(draftTier(d)).toBe("official");
  });

  it("infers tier from kind if source.tier missing", () => {
    const d = { ...base, sources: [
      { title: "AD-K", kind: "regulation" as const } // no tier field
    ]};
    expect(draftTier(d)).toBe("official");
  });
});

describe("KIND_TO_TIER map completeness", () => {
  it("covers every kind we accept in SourceSchema", () => {
    const knownKinds = ["regulation", "manufacturer", "textbook", "video", "photo", "trade-body", "expert-quote", "other"];
    for (const k of knownKinds) {
      expect(KIND_TO_TIER[k]).toBeDefined();
    }
  });
});
