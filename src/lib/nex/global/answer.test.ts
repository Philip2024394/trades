// Global answer — preamble + clarification + terminology.

import { describe, it, expect, vi } from "vitest";

// Mock the resolver so tests are deterministic.
vi.mock("../world/location", () => ({
  resolveLocation: vi.fn(async () => ({
    country: "UK", region: null, city: null, postcode: null,
    source: "merchant_setting", reason: "test", evidence: { source: "t", tables: [], computed_at: "x" }
  }))
}));

import { answerCountryProfile, answerGlobalRegulation, classifyGlobalQuestion } from "./answer";
import { resolveLocation } from "../world/location";

describe("classifyGlobalQuestion", () => {
  it("routes profile asks", () => {
    expect(classifyGlobalQuestion("what's my country profile?").kind).toBe("profile");
    expect(classifyGlobalQuestion("tell me about construction in canada").kind).toBe("profile");
  });

  it("routes regulation asks with country hint", () => {
    const q = classifyGlobalQuestion("stair regulation in Ireland");
    expect(q.kind).toBe("regulation");
    if (q.kind === "regulation") {
      expect(q.topic).toBe("stairs");
      expect(q.country_hint).toBe("IE");
    }
  });

  it("detects Canada / New Zealand / UAE country hints", () => {
    const ca = classifyGlobalQuestion("building code in Canada");
    const nz = classifyGlobalQuestion("building regulation in New Zealand");
    const ae = classifyGlobalQuestion("building code in Dubai");
    if (ca.kind !== "regulation" && ca.kind !== "profile") throw new Error("expected classified");
    if (nz.kind !== "regulation" && nz.kind !== "profile") throw new Error("expected classified");
    if (ae.kind !== "regulation" && ae.kind !== "profile") throw new Error("expected classified");
    expect(ca.country_hint).toBe("CA");
    expect(nz.country_hint).toBe("NZ");
    expect(ae.country_hint).toBe("AE");
  });

  it("returns 'none' when no topic + no country hint", () => {
    expect(classifyGlobalQuestion("hello there").kind).toBe("none");
  });
});

describe("answerGlobalRegulation — preamble + hits", () => {
  it("UK stairs → 'I've answered using Approved Document K for United Kingdom'", async () => {
    const r = await answerGlobalRegulation({ topic: "stairs", country_hint: "UK" });
    expect(r.speak).toMatch(/I've answered using .*Approved Document K.* for United Kingdom/);
    expect(r.speak).toContain("gov.uk");
    expect(r.country).toBe("UK");
  });

  it("IE stairs → TGD K + gov.ie", async () => {
    const r = await answerGlobalRegulation({ topic: "stairs", country_hint: "IE" });
    expect(r.speak).toMatch(/I've answered using .*TGD K.* for Republic of Ireland/);
    expect(r.speak).toContain("gov.ie");
  });

  it("AU stairs → NCC", async () => {
    const r = await answerGlobalRegulation({ topic: "stairs", country_hint: "AU" });
    expect(r.speak).toContain("NCC");
    expect(r.speak).toContain("Australia");
  });

  it("CA stairs → NBC Section 9.8", async () => {
    const r = await answerGlobalRegulation({ topic: "stairs", country_hint: "CA" });
    expect(r.speak).toContain("NBC 9.8");
    expect(r.speak).toContain("Canada");
  });

  it("NZ stairs → NZBC D1/AS1", async () => {
    const r = await answerGlobalRegulation({ topic: "stairs", country_hint: "NZ" });
    expect(r.speak).toContain("NZBC D1/AS1");
    expect(r.speak).toContain("New Zealand");
  });

  it("region without a country-specific source shows mandatory fallback", async () => {
    // IE electrical not on file → fallback message.
    const r = await answerGlobalRegulation({ topic: "electrical", country_hint: "IE" });
    expect(r.speak).toContain("couldn't confirm one");
    expect(r.speak).toContain("I couldn't find an official source for your location");
    expect(r.speak).toContain("not be treated as a legal or regulatory requirement");
  });
});

describe("answerGlobalRegulation — clarification triggers", () => {
  it("engine_default resolution → asks for country BEFORE giving guidance", async () => {
    (resolveLocation as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void }).mockImplementationOnce(async () => ({
      country: "unknown", region: null, city: null, postcode: null,
      source: "engine_default", reason: "no signal", evidence: { source: "t", tables: [], computed_at: "x" }
    }));
    // No explicit country_hint → clarification MUST fire.
    const r = await answerGlobalRegulation({ topic: "stairs", merchantSlug: "phil" });
    expect(r.clarify).not.toBeUndefined();
    expect(r.speak).toContain("Which country should I use?");
  });

  it("engine_default IS bypassed when caller supplies an explicit country_hint", async () => {
    (resolveLocation as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void }).mockImplementationOnce(async () => ({
      country: "unknown", region: null, city: null, postcode: null,
      source: "engine_default", reason: "no signal", evidence: { source: "t", tables: [], computed_at: "x" }
    }));
    const r = await answerGlobalRegulation({ topic: "stairs", country_hint: "AU" });
    expect(r.clarify).toBeUndefined();
    expect(r.speak).toContain("NCC");
  });
});

describe("answerCountryProfile", () => {
  it("returns full profile block for the resolved country", async () => {
    const out = await answerCountryProfile({});
    expect(out).toContain("Country profile — United Kingdom (England + Wales).");
    expect(out).toContain("VAT 20%");
    expect(out).toContain("Trade bodies:");
  });

  it("unknown country prompts merchant to set one", async () => {
    (resolveLocation as unknown as { mockImplementationOnce: (fn: () => Promise<unknown>) => void }).mockImplementationOnce(async () => ({
      country: "unknown", region: null, city: null, postcode: null,
      source: "engine_default", reason: "", evidence: { source: "t", tables: [], computed_at: "x" }
    }));
    const out = await answerCountryProfile({});
    expect(out).toContain("I don't have your country on file yet");
  });
});
