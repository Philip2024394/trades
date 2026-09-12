// src/lib/nex/brain/live-discovery-intent.test.ts
//
// NEX · Phase D · LIVE_DISCOVERY_REQUEST intent tests
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §17-§20

import { describe, it, expect } from "vitest";
import { detectLiveDiscoveryScope } from "./live-discovery-intent";

describe("detectLiveDiscoveryScope · §17 English natural-language targets", () => {
  it("recognises 'what's live'", () => {
    const r = detectLiveDiscoveryScope("what's live");
    expect(r.is_live_discovery).toBe(true);
    expect(r.language).not.toBe("UNKNOWN");
  });
  it("recognises 'what's happening tonight?'", () => {
    const r = detectLiveDiscoveryScope("what's happening tonight?");
    expect(r.is_live_discovery).toBe(true);
    expect(r.time_scope).toBe("TONIGHT");
  });
  it("recognises 'what's happening in the city tonight?'", () => {
    const r = detectLiveDiscoveryScope("what's happening in the city tonight?");
    expect(r.is_live_discovery).toBe(true);
    expect(r.time_scope).toBe("TONIGHT");
  });
  it("recognises 'show me what's live'", () => {
    const r = detectLiveDiscoveryScope("show me what's live");
    expect(r.is_live_discovery).toBe(true);
  });
  it("recognises 'anything happening tonight?'", () => {
    const r = detectLiveDiscoveryScope("anything happening tonight?");
    expect(r.is_live_discovery).toBe(true);
    expect(r.time_scope).toBe("TONIGHT");
  });
  it("recognises 'what's going on tonight?'", () => {
    const r = detectLiveDiscoveryScope("what's going on tonight?");
    expect(r.is_live_discovery).toBe(true);
    expect(r.time_scope).toBe("TONIGHT");
  });
  it("recognises 'anything interesting happening?'", () => {
    // Deliberately less strict — 'anything happening' without a time
    // scope should NOT match (avoids over-triggering on chitchat).
    const r = detectLiveDiscoveryScope("anything interesting happening?");
    expect(r.is_live_discovery).toBe(false);
  });
});

describe("detectLiveDiscoveryScope · §17 Indonesian natural-language targets", () => {
  it("recognises 'apa yang sedang berlangsung malam ini?'", () => {
    const r = detectLiveDiscoveryScope("apa yang sedang berlangsung malam ini?");
    expect(r.is_live_discovery).toBe(true);
    expect(["ID","MIXED"]).toContain(r.language);
    expect(r.time_scope).toBe("TONIGHT");
  });
  it("recognises 'ada acara malam ini?'", () => {
    const r = detectLiveDiscoveryScope("ada acara malam ini?");
    expect(r.is_live_discovery).toBe(true);
    expect(r.time_scope).toBe("TONIGHT");
  });
  it("recognises 'apa yang lagi terjadi sekarang?'", () => {
    const r = detectLiveDiscoveryScope("apa yang lagi terjadi sekarang?");
    expect(r.is_live_discovery).toBe(true);
    expect(r.time_scope).toBe("NOW");
  });
});

describe("detectLiveDiscoveryScope · §18 scope extraction", () => {
  it("time_scope=NOW for 'right now'", () => {
    expect(detectLiveDiscoveryScope("what's live right now?").time_scope).toBe("NOW");
  });
  it("time_scope=TONIGHT for 'tonight'", () => {
    expect(detectLiveDiscoveryScope("what's live tonight?").time_scope).toBe("TONIGHT");
  });
  it("time_scope=UPCOMING for 'starting soon'", () => {
    expect(detectLiveDiscoveryScope("anything on starting soon?").time_scope).toBe("UPCOMING");
  });
  it("category=music for 'any music live tonight?'", () => {
    const r = detectLiveDiscoveryScope("any music live tonight?");
    expect(r.is_live_discovery).toBe(true);
    expect(r.category_scope).toBe("music");
    expect(r.time_scope).toBe("TONIGHT");
  });
  it("category=food for 'any restaurants live tonight?'", () => {
    const r = detectLiveDiscoveryScope("any restaurants live tonight?");
    expect(r.category_scope).toBe("food");
  });
  it("category=gym for 'any gym happening tonight?'", () => {
    const r = detectLiveDiscoveryScope("any gym happening tonight?");
    expect(r.category_scope).toBe("gym");
  });
  it("explicit city extracted when named ('in Yogyakarta')", () => {
    const r = detectLiveDiscoveryScope("what's happening in Yogyakarta tonight?");
    expect(r.explicit_city).toBe("yogyakarta");
  });
  it("Jogja alias resolves to yogyakarta", () => {
    const r = detectLiveDiscoveryScope("apa yang sedang berlangsung di Jogja malam ini?");
    expect(r.explicit_city).toBe("yogyakarta");
  });
  it("no city named → explicit_city null · never guessed", () => {
    expect(detectLiveDiscoveryScope("what's live tonight?").explicit_city).toBeNull();
  });
});

describe("detectLiveDiscoveryScope · §21 zero-signal safety", () => {
  it("empty string is NONE", () => {
    const r = detectLiveDiscoveryScope("");
    expect(r.is_live_discovery).toBe(false);
    expect(r.reason).toBe("no_live_signal");
  });
  it("plain greeting is NOT live discovery", () => {
    expect(detectLiveDiscoveryScope("hello nex").is_live_discovery).toBe(false);
  });
  it("staircase question is NOT live discovery", () => {
    expect(detectLiveDiscoveryScope("what oak should I use for a staircase?").is_live_discovery).toBe(false);
  });
  it("weather question is NOT live discovery", () => {
    expect(detectLiveDiscoveryScope("what's the weather tonight?").is_live_discovery).toBe(false);
  });
  it("past-tense 'what happened yesterday' is NOT live discovery", () => {
    expect(detectLiveDiscoveryScope("what happened yesterday?").is_live_discovery).toBe(false);
  });
  it("booking a table is NOT live discovery", () => {
    expect(detectLiveDiscoveryScope("book me a table tonight").is_live_discovery).toBe(false);
  });
});

describe("detectLiveDiscoveryScope · reason field observability", () => {
  it("reason includes language + time + category for a fully-specified ask", () => {
    const r = detectLiveDiscoveryScope("any music live tonight?");
    expect(r.reason).toContain("live");
    expect(r.reason).toContain("tonight");
    expect(r.reason).toContain("music");
  });
  it("reason marks the 'happening' fallback path distinctly", () => {
    const r = detectLiveDiscoveryScope("what's going on tonight?");
    expect(r.reason).toContain("happening");
    expect(r.reason).toContain("tonight");
  });
});
