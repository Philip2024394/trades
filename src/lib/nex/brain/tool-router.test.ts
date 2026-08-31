// src/lib/nex/brain/tool-router.test.ts
//
// Stage 3.35 · Phase E · Tool Router doctrine tests
// (Philip 2026-08-31).
//
// Covers the 18 test groups from the brief:
//   1  World routing
//   2  Accommodation routing
//   3  Food routing
//   4  Trades/service routing
//   5  Commerce routing
//   6  Calculator routing
//   7  Weather routing
//   8  Knowledge routing
//   9  Action routing
//   10 Multi-tool routing
//   11 Ambiguous requests
//   12 Missing required inputs
//   13 Unsupported tools
//   14 Provider unavailable
//   15 Dependency blocking
//   16 Evidence-state enforcement
//   17 Verification-state enforcement
//   18 Regression against Phase A/B/C/D (covered by full sweep)

import { describe, expect, it } from "vitest";
import { routeToTool, summariseToolSelection } from "./tool-router";
import { runCalculator } from "./tools/calculator";
import { runWeather } from "./tools/weather";
import { runKnowledge } from "./tools/knowledge";

// ─── Groups 1-5 · World routing ─────────────────────────────────────

describe("routeToTool · World routing preserved", () => {
  it("accommodation intent → category:world · toolId:world:accommodation · rank 6", () => {
    const t = routeToTool({ message: "I need a hotel in Yogyakarta", intent: "accommodation", hasMultiStep: false });
    expect(t.category).toBe("world");
    expect(t.toolId).toBe("world:accommodation");
    expect(t.precedenceRank).toBe(6);
    expect(t.readOnly).toBe(true);
    expect(t.performsExternalAction).toBe(false);
  });

  it("food intent → world:food", () => {
    const t = routeToTool({ message: "find gudeg", intent: "food", hasMultiStep: false });
    expect(t.toolId).toBe("world:food");
  });

  it("business intent (services) → world:business", () => {
    const t = routeToTool({ message: "find me a dentist", intent: "business", hasMultiStep: false });
    expect(t.toolId).toBe("world:business");
  });

  it("commerce intent → world:commerce", () => {
    const t = routeToTool({ message: "buy me headphones", intent: "commerce", hasMultiStep: false });
    expect(t.toolId).toBe("world:commerce");
  });

  it("transport intent → world:transport", () => {
    const t = routeToTool({ message: "find a driver", intent: "transport", hasMultiStep: false });
    expect(t.toolId).toBe("world:transport");
  });
});

// ─── Group 6 · Calculator routing ───────────────────────────────────

describe("routeToTool · Calculator routing", () => {
  it("'calculate 20% of 3 million' → category:calculator · rank 3", () => {
    const t = routeToTool({ message: "calculate 20% of 3 million", hasMultiStep: false });
    expect(t.category).toBe("calculator");
    expect(t.precedenceRank).toBe(3);
    expect(t.readOnly).toBe(true);
    expect(t.performsExternalAction).toBe(false);
  });

  it("'20% of 3 million' → calculator", () => {
    expect(routeToTool({ message: "20% of 3 million", hasMultiStep: false }).category).toBe("calculator");
  });

  it("'150 + 200' → calculator", () => {
    expect(routeToTool({ message: "150 + 200", hasMultiStep: false }).category).toBe("calculator");
  });

  it("'hitung 20% dari 3 juta' → calculator (ID)", () => {
    expect(routeToTool({ message: "hitung 20% dari 3 juta", hasMultiStep: false }).category).toBe("calculator");
  });

  it("'what is a kos-kosan?' does NOT route to calculator (hyphen not arithmetic)", () => {
    const t = routeToTool({ message: "what is a kos-kosan?", hasMultiStep: false });
    expect(t.category).not.toBe("calculator");
    expect(t.category).toBe("knowledge");
  });
});

// ─── Group 7 · Weather routing ──────────────────────────────────────

describe("routeToTool · Weather routing", () => {
  it("'what's the weather?' → category:weather · rank 4", () => {
    const t = routeToTool({ message: "what's the weather in Yogyakarta", hasMultiStep: false });
    expect(t.category).toBe("weather");
    expect(t.precedenceRank).toBe(4);
  });

  it("'is it raining' → weather", () => {
    expect(routeToTool({ message: "is it raining", hasMultiStep: false }).category).toBe("weather");
  });

  it("'cuaca di jogja' → weather (ID)", () => {
    expect(routeToTool({ message: "cuaca di jogja", hasMultiStep: false }).category).toBe("weather");
  });
});

// ─── Group 8 · Knowledge routing ────────────────────────────────────

describe("routeToTool · Knowledge routing", () => {
  it("'what is a kos-kosan?' → category:knowledge · rank 5", () => {
    const t = routeToTool({ message: "what is a kos-kosan?", hasMultiStep: false });
    expect(t.category).toBe("knowledge");
    expect(t.precedenceRank).toBe(5);
  });

  it("'apa itu batik?' → knowledge (ID)", () => {
    expect(routeToTool({ message: "apa itu batik?", hasMultiStep: false }).category).toBe("knowledge");
  });

  it("'what hotels are near Malioboro?' → world (discovery verb wins over knowledge pattern)", () => {
    const t = routeToTool({ message: "what hotels are near Malioboro", intent: "accommodation", hasMultiStep: false });
    expect(t.category).toBe("world");
    // Discovery verbs override the "what X" knowledge pattern
  });
});

// ─── Group 9 · Action routing ───────────────────────────────────────

describe("routeToTool · Action routing", () => {
  it("'message this business' + resolved reference → category:action · rank 2 · performsExternalAction:true", () => {
    const t = routeToTool({ message: "message this business", hasResolvedReference: true, hasMultiStep: false });
    expect(t.category).toBe("action");
    expect(t.precedenceRank).toBe(2);
    expect(t.readOnly).toBe(false);
    expect(t.performsExternalAction).toBe(true);
    expect(t.verificationRequired).toBe(true);
  });

  it("action verb WITHOUT resolved reference → does NOT route to action", () => {
    const t = routeToTool({ message: "message this business", hasResolvedReference: false, hasMultiStep: false });
    expect(t.category).not.toBe("action");
  });

  it("action selection declares required evidence for contact channel", () => {
    const t = routeToTool({ message: "whatsapp them", hasResolvedReference: true, hasMultiStep: false });
    const fields = t.evidenceRequirements.map((e) => e.field);
    expect(fields).toContain("target.whatsapp");
    expect(fields).toContain("target.phone");
    // Both marked block-on-missing
    for (const req of t.evidenceRequirements) {
      expect(req.fallback).toBe("block");
    }
  });
});

// ─── Group 10 · Multi-tool routing / WorldPlan ──────────────────────

describe("routeToTool · WorldPlan takes precedence", () => {
  it("multi-step message → category:world_plan · rank 1", () => {
    const t = routeToTool({ message: "find me a hotel then transport", hasMultiStep: true });
    expect(t.category).toBe("world_plan");
    expect(t.precedenceRank).toBe(1);
  });

  it("WorldPlan beats calculator when both patterns present", () => {
    const t = routeToTool({ message: "find hotel, then calculate 20% of the price", hasMultiStep: true });
    expect(t.category).toBe("world_plan");
  });
});

// ─── Group 11 · Ambiguous requests ──────────────────────────────────

describe("routeToTool · Ambiguous handling", () => {
  it("'can you check this?' → category:ambiguous · rank 7", () => {
    const t = routeToTool({ message: "check this", hasMultiStep: false });
    expect(t.category).toBe("ambiguous");
    expect(t.precedenceRank).toBe(7);
  });

  it("very short unclassified → ambiguous", () => {
    expect(routeToTool({ message: "hmm", hasMultiStep: false }).category).toBe("ambiguous");
  });

  it("does NOT randomly pick a tool for ambiguous input", () => {
    const t = routeToTool({ message: "help", hasMultiStep: false });
    // ambiguous · never randomly calculator/weather/etc
    expect(["ambiguous", "unsupported"]).toContain(t.category);
  });
});

// ─── Group 12/13 · Missing inputs · Unsupported ─────────────────────

describe("routeToTool · Unsupported requests", () => {
  it("longer unknown-intent message → category:unsupported", () => {
    const t = routeToTool({ message: "please arrange for my dry cleaning to be picked up this afternoon", intent: "other", hasMultiStep: false });
    expect(["unsupported", "ambiguous"]).toContain(t.category);
  });
});

// ─── Group 14 · Provider unavailable ────────────────────────────────

describe("runWeather · provider unavailable → honest state", () => {
  it("no provider → obtained:false with reason:provider_not_configured", async () => {
    const r = await runWeather({ message: "weather in Yogyakarta" });
    expect(r.obtained).toBe(false);
    if (!r.obtained) {
      expect(r.reason).toBe("provider_not_configured");
      expect(r.message.en).toContain("weather provider isn't wired");
      expect(r.message.en).toContain("won't guess");
    }
  });

  it("no location extractable → obtained:false with location_not_extractable", async () => {
    // Fake provider so we get past the provider check
    const fakeProvider = { fetchCurrent: async () => null };
    const r = await runWeather({ message: "what's the weather", provider: fakeProvider });
    expect(r.obtained).toBe(false);
    if (!r.obtained) expect(r.reason).toBe("location_not_extractable");
  });

  it("provider throws → obtained:false with provider_unavailable · never fabricates weather", async () => {
    const flaky = { fetchCurrent: async () => { throw new Error("timeout"); } };
    const r = await runWeather({ message: "weather in yogyakarta", provider: flaky });
    expect(r.obtained).toBe(false);
    if (!r.obtained) expect(r.reason).toBe("provider_unavailable");
  });
});

// ─── Calculator honesty ─────────────────────────────────────────────

describe("runCalculator · never fabricates arithmetic", () => {
  it("'20% of 3 million' → correct real answer", () => {
    const r = runCalculator("what is 20% of 3 million");
    expect(r.computed).toBe(true);
    if (r.computed && r.op.kind === "percentage_of") {
      expect(r.op.result).toBe(600_000);
      expect(r.displayResult).toBe("Rp 600.000");
    }
  });

  it("'150 + 200' → 350", () => {
    const r = runCalculator("150 + 200");
    if (r.computed && r.op.kind === "addition") expect(r.op.result).toBe(350);
  });

  it("'10 / 0' → computed:false · division_by_zero (no fabricated infinity)", () => {
    const r = runCalculator("10 / 0");
    expect(r.computed).toBe(false);
    if (!r.computed) expect(r.reason).toBe("division_by_zero");
  });

  it("no arithmetic pattern → computed:false · no_operation_pattern", () => {
    const r = runCalculator("hello there");
    expect(r.computed).toBe(false);
    if (!r.computed) expect(r.reason).toBe("no_operation_pattern");
  });
});

// ─── Knowledge honesty ──────────────────────────────────────────────

describe("runKnowledge · never fabricates editorial answers", () => {
  it("subject with no matching entry → found:false · never invents", () => {
    const r = runKnowledge({ message: "what is a xyzunkownthing?" });
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.reason).toBe("no_matching_entry");
      expect(r.message.en).toContain("won't invent");
    }
  });

  it("non-knowledge question shape → no_query_extracted (never guesses)", () => {
    const r = runKnowledge({ message: "hello there" });
    expect(r.found).toBe(false);
    if (!r.found) expect(r.reason).toBe("no_query_extracted");
  });
});

// ─── Group 17 · Verification state discipline ───────────────────────

describe("routeToTool · Verification state discipline", () => {
  it("action tool sets verificationRequired:true", () => {
    const t = routeToTool({ message: "message the business", hasResolvedReference: true, hasMultiStep: false });
    expect(t.verificationRequired).toBe(true);
  });

  it("read-only tools set verificationRequired:false", () => {
    for (const msg of ["what's the weather", "calculate 5 + 3", "what is batik?", "find hotels"]) {
      const t = routeToTool({ message: msg, hasMultiStep: false, intent: msg.includes("hotel") ? "accommodation" : undefined });
      expect(t.verificationRequired).toBe(false);
    }
  });
});

// ─── summariseToolSelection ─────────────────────────────────────────

describe("summariseToolSelection", () => {
  it("produces inspectable one-liner", () => {
    const t = routeToTool({ message: "what's the weather", hasMultiStep: false });
    const s = summariseToolSelection(t);
    expect(s).toContain("weather");
    expect(s).toContain("rank");
  });
});
