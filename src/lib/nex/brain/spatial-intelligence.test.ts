// src/lib/nex/brain/spatial-intelligence.test.ts
import { describe, it, expect } from "vitest";
import { detectSpatialConstraint, decideSpatialGate, type SpatialConcept } from "./spatial-intelligence";

const expectConcept = (msg: string, concept: SpatialConcept) => {
  it(`"${msg}" → ${concept}`, () => {
    expect(detectSpatialConstraint(msg).concept).toBe(concept);
  });
};

describe("spatial · PROXIMITY (§4)", () => {
  expectConcept("near Malioboro", "PROXIMITY");
  expectConcept("nearby", "PROXIMITY");
  expectConcept("close to the airport", "PROXIMITY");
  expectConcept("far from Malioboro", "PROXIMITY");
  expectConcept("dekat Malioboro", "PROXIMITY");
  expectConcept("jauh dari sini", "DEICTIC");     // "sini" is deictic · dominates
});

describe("spatial · DIRECTION", () => {
  expectConcept("north of Malioboro", "DIRECTION");
  expectConcept("south of the airport", "DIRECTION");
  expectConcept("toward the airport", "DIRECTION");
  expectConcept("away from the crowd", "DIRECTION");
});

describe("spatial · RELATIVE_LOCATION / DEICTIC", () => {
  expectConcept("downtown", "RELATIVE_LOCATION");
  expectConcept("central", "RELATIVE_LOCATION");
  expectConcept("outside town", "RELATIVE_LOCATION");
  expectConcept("here", "DEICTIC");
  expectConcept("there", "DEICTIC");
  expectConcept("somewhere else", "DEICTIC");
  expectConcept("sini", "DEICTIC");
  expectConcept("sana", "DEICTIC");
});

describe("spatial · CHANGE marker (§4)", () => {
  it("'near the airport instead' → is_change=true", () => {
    const c = detectSpatialConstraint("near the airport instead");
    expect(c.is_change).toBe(true);
    expect(c.concept).toBe("PROXIMITY");
  });
  it("'actually somewhere quieter' → is_change=true", () => {
    const c = detectSpatialConstraint("actually somewhere quieter");
    expect(c.is_change).toBe(true);
  });
});

describe("spatial · POLARITY interaction (§7)", () => {
  it("'not near the airport' → NEGATED", () => {
    const c = detectSpatialConstraint("not near the airport");
    expect(c.polarity).toBe("NEGATED");
    expect(c.concept).toBe("PROXIMITY");
  });
});

describe("spatial · anchor extraction", () => {
  it("'near Malioboro' → anchor=malioboro", () => {
    expect(detectSpatialConstraint("near Malioboro").anchor).toBe("malioboro");
  });
  it("'close to the airport' → anchor=airport", () => {
    expect(detectSpatialConstraint("close to the airport").anchor).toBe("airport");
  });
});

describe("spatial · NONE for non-spatial", () => {
  expectConcept("find me a hotel", "NONE");
  expectConcept("what is Yogyakarta?", "NONE");
});

describe("spatial · gate · fresh deictic without antecedent (§5)", () => {
  it("'find something there' fresh → gate fires", () => {
    const g = decideSpatialGate({
      userMessage: "find something there",
      hasSpatialAntecedent: false,
      activeLanguage: "EN",
    });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) expect(g.reply.toLowerCase()).toContain("where");
  });
  it("'find something there' WITH antecedent → passes through", () => {
    const g = decideSpatialGate({
      userMessage: "find something there",
      hasSpatialAntecedent: true,
      activeLanguage: "EN",
    });
    expect(g.shouldGate).toBe(false);
  });
  it("Indonesian deictic without antecedent → Indonesian clarification", () => {
    const g = decideSpatialGate({
      userMessage: "cari tempat di sini",
      hasSpatialAntecedent: false,
      activeLanguage: "ID",
    });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) expect(g.reply.toLowerCase()).toContain("di mana");
  });
});
