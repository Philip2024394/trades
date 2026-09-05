// src/lib/nex/brain/temporal-intelligence.test.ts
import { describe, it, expect } from "vitest";
import { detectTemporalState, decideTemporalGate, type TenseState } from "./temporal-intelligence";

const expectTense = (msg: string, tense: TenseState) => {
  it(`"${msg}" → ${tense}`, () => {
    expect(detectTemporalState(msg).tense).toBe(tense);
  });
};

describe("temporal · basic states (§5)", () => {
  expectTense("I need a hotel", "UNKNOWN");             // no marker · UNKNOWN
  expectTense("I need a hotel now", "CURRENT");
  expectTense("I was looking for a hotel yesterday", "PAST");
  expectTense("I'm going to need a hotel tomorrow", "FUTURE");
  expectTense("I already found one", "COMPLETED");
  expectTense("I'm still looking", "ONGOING");
  expectTense("I've just found one", "RECENT");
  expectTense("I haven't found one yet", "NOT_YET");
  expectTense("I used to want hotels but now I want restaurants", "CHANGE_OF_STATE");
  expectTense("I used to want hotels", "PAST");
});

describe("temporal · Indonesian markers (§18)", () => {
  expectTense("saya sudah menemukan hotel", "COMPLETED");
  expectTense("saya belum menemukan hotel", "NOT_YET");
  expectTense("saya masih mencari hotel", "ONGOING");
  expectTense("saya kemarin mencari hotel", "PAST");
  expectTense("saya besok butuh hotel", "FUTURE");
  expectTense("saya baru saja menemukan hotel", "RECENT");
});

describe("temporal · gate fires on reflective tenses with entity (§6)", () => {
  it("PAST + hotel → gate fires with reflective ack", () => {
    const g = decideTemporalGate({ userMessage: "I was looking for a hotel yesterday", activeLanguage: "EN" });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) {
      expect(g.reply.toLowerCase()).toMatch(/still need|help|earlier/);
      // Must NOT re-emit a hotel list
      expect(g.reply.toLowerCase()).not.toContain("521 real listings");
    }
  });
  it("COMPLETED + hotel → gate fires", () => {
    const g = decideTemporalGate({ userMessage: "I already found a hotel", activeLanguage: "EN" });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) expect(g.reply.toLowerCase()).toContain("anything else");
  });
  it("NOT_YET + hotel → gate fires", () => {
    const g = decideTemporalGate({ userMessage: "I haven't found a hotel yet", activeLanguage: "EN" });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) expect(g.reply.toLowerCase()).toContain("help now");
  });
  it("ONGOING + hotel → gate does NOT fire (active task)", () => {
    const g = decideTemporalGate({ userMessage: "I'm still looking for a hotel", activeLanguage: "EN" });
    expect(g.shouldGate).toBe(false);
  });
  it("CURRENT + hotel → gate does NOT fire", () => {
    const g = decideTemporalGate({ userMessage: "I need a hotel now", activeLanguage: "EN" });
    expect(g.shouldGate).toBe(false);
  });
});

describe("temporal · Indonesian gate replies (§17 §18)", () => {
  it("belum + hotel → gate fires with Indonesian reply", () => {
    const g = decideTemporalGate({ userMessage: "saya belum menemukan hotel", activeLanguage: "ID" });
    expect(g.shouldGate).toBe(true);
    if (g.shouldGate) expect(g.reply.toLowerCase()).toMatch(/belum|ingin/);
  });
});

describe("temporal · temporal question does NOT gate (§21)", () => {
  it("'Did you already find the hotel?' → not gated (temporal question)", () => {
    const g = decideTemporalGate({ userMessage: "did you already find the hotel", activeLanguage: "EN" });
    // is_temporal_question is set · gate does not fire
    expect(g.shouldGate).toBe(false);
  });
});
