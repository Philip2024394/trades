// Stage 3.18 · Phase 11 · Tool Selection unit tests.

import { describe, it, expect } from "vitest";
import { selectTool, summariseToolDecision } from "./tool-selection";

describe("selectTool · intent → tool mapping", () => {
  it("accommodation → world_retrieval (available) · preferCategory=accommodation", () => {
    const d = selectTool({ intent: "accommodation", message: "I need a hotel", userMarket: "ID" });
    expect(d.primary).toBe("world_retrieval");
    expect(d.availability).toBe("available");
    expect(d.parameters?.preferCategory).toBe("accommodation");
    expect(d.parameters?.market).toBe("ID");
  });

  it("food → world_retrieval (available) · no preferCategory", () => {
    const d = selectTool({ intent: "food", message: "find nasi goreng", userMarket: "ID" });
    expect(d.primary).toBe("world_retrieval");
    expect(d.availability).toBe("available");
    expect(d.parameters?.preferCategory).toBeUndefined();
  });

  it("indonesia + tourism + places + business → world_retrieval", () => {
    for (const intent of ["indonesia", "tourism", "places", "business"]) {
      const d = selectTool({ intent, message: "?" });
      expect(d.primary, `intent=${intent}`).toBe("world_retrieval");
    }
  });

  it("weather → live_source (declared_not_wired)", () => {
    const d = selectTool({ intent: "weather", message: "is it raining?", userMarket: "ID" });
    expect(d.primary).toBe("live_source");
    expect(d.availability).toBe("declared_not_wired");
    expect(d.parameters?.source).toBe("bmkg");
  });

  it("marketplace + booking → commerce_retrieval (declared_not_wired)", () => {
    for (const intent of ["marketplace", "booking"]) {
      const d = selectTool({ intent, message: "buy" });
      expect(d.primary, `intent=${intent}`).toBe("commerce_retrieval");
      expect(d.availability, `intent=${intent}`).toBe("declared_not_wired");
    }
  });

  it("translation + writing + image → none (available · composer answers)", () => {
    for (const intent of ["translation", "writing", "image"]) {
      const d = selectTool({ intent, message: "?" });
      expect(d.primary, `intent=${intent}`).toBe("none");
      expect(d.availability, `intent=${intent}`).toBe("available");
    }
  });

  it("conversation → none (chit-chat · no tool)", () => {
    const d = selectTool({ intent: "conversation", message: "hi" });
    expect(d.primary).toBe("none");
  });

  it("book intent + resolved reference → user_action (declared_not_wired)", () => {
    const d = selectTool({
      intent: "accommodation",
      message: "book it",
      slots: { action: "book", type: "hotel" },
      hasResolvedReference: true,
    });
    expect(d.primary).toBe("user_action");
    expect(d.availability).toBe("declared_not_wired");
    expect(d.reason).toContain("Action layer not yet wired");
    // Secondary suggests we could still retrieve context.
    expect(d.secondary).toContain("world_retrieval");
  });

  it("book intent WITHOUT resolved reference → still accommodation retrieval (no user_action)", () => {
    const d = selectTool({
      intent: "accommodation",
      message: "book me a hotel",
      slots: { action: "book" },
      hasResolvedReference: false,
    });
    expect(d.primary).toBe("world_retrieval");
  });

  it("safety.* pseudo-intent → none (safety runs before tool selection)", () => {
    const d = selectTool({ intent: "safety.earthquake", message: "earthquake!" });
    expect(d.primary).toBe("none");
    expect(d.reason).toContain("safety response handled by safety.ts");
  });

  it("unknown intent → none with honest reason", () => {
    const d = selectTool({ intent: "nonsense_intent", message: "?" });
    expect(d.primary).toBe("none");
    expect(d.reason).toContain("no tool mapping defined");
  });
});

describe("summariseToolDecision", () => {
  it("primary only", () => {
    const s = summariseToolDecision({ primary: "world_retrieval", secondary: [], reason: "", availability: "available" });
    expect(s).toBe("world_retrieval · available");
  });

  it("primary + secondary", () => {
    const s = summariseToolDecision({
      primary: "user_action", secondary: ["world_retrieval"],
      reason: "", availability: "declared_not_wired",
    });
    expect(s).toBe("user_action (+world_retrieval) · declared_not_wired");
  });
});
