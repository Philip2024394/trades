// safety.test.ts · tourist-guardian safety mode.
//
// Enforces the highest-priority intent: emergencies always come
// first. Never continue chit-chat when a user says "I'm sick" or
// "chest pain" — that's the guardian promise.

import { describe, it, expect } from "vitest";
import { classifySafetySignal, composeSafetyResponse } from "./safety";

describe("classifySafetySignal · medical emergency (top priority)", () => {
  it.each([
    "I can't breathe",
    "I think I'm having a chest pain",
    "call an ambulance!",
    "panggil ambulans sekarang",
    "she's unconscious",
    "he's bleeding a lot",
  ])("'%s' → medical_emergency", (msg) => {
    const r = classifySafetySignal(msg);
    expect(r.signal).toBe("medical_emergency");
    expect(r.requiresSafetyResponse).toBe(true);
  });
});

describe("classifySafetySignal · illness / injury / lost / theft / disaster", () => {
  it("'I'm sick' → medical_illness", () => {
    expect(classifySafetySignal("I'm sick").signal).toBe("medical_illness");
  });
  it("'saya sakit' → medical_illness", () => {
    expect(classifySafetySignal("saya sakit").signal).toBe("medical_illness");
  });
  it("'Bali belly' → medical_illness", () => {
    expect(classifySafetySignal("I've got Bali belly").signal).toBe("medical_illness");
  });
  it("'I cut myself' → medical_injury", () => {
    expect(classifySafetySignal("I cut myself").signal).toBe("medical_injury");
  });
  it("snake bite → medical_injury", () => {
    expect(classifySafetySignal("I've been bitten by a snake").signal).toBe("medical_injury");
  });
  it("'I'm lost' → lost", () => {
    expect(classifySafetySignal("I'm lost").signal).toBe("lost");
  });
  it("'my wallet was stolen' → theft_or_assault", () => {
    expect(classifySafetySignal("my wallet was stolen").signal).toBe("theft_or_assault");
  });
  it("'earthquake' → natural_disaster", () => {
    expect(classifySafetySignal("there was an earthquake, is it safe?").signal).toBe("natural_disaster");
  });
});

describe("classifySafetySignal · safe-but-worried is NOT a safety response", () => {
  it("'is it safe to walk at night?' → safe_but_worried, no safety response", () => {
    const r = classifySafetySignal("is it safe to walk at night?");
    expect(r.signal).toBe("safe_but_worried");
    expect(r.requiresSafetyResponse).toBe(false);
  });
});

describe("classifySafetySignal · normal conversation does NOT fire safety mode", () => {
  it.each([
    "Hi NEX",
    "Tell me about Bali",
    "What food should I try in Yogyakarta?",
    "Plan me a 3 day trip to Indonesia",
    "Find me a restaurant",
    "Halo NEX apa kabar?",
    "What is the weather like in Bali?",
  ])("'%s' → none", (msg) => {
    const r = classifySafetySignal(msg);
    expect(r.signal).toBe("none");
    expect(r.requiresSafetyResponse).toBe(false);
  });
});

describe("composeSafetyResponse · emergency response", () => {
  it("medical_emergency response mentions 112, ambulance, and a hospital", () => {
    const r = composeSafetyResponse({ signal: "medical_emergency", requiresSafetyResponse: true, reason: "test" });
    expect(r.reply).toMatch(/\b112\b/);
    expect(r.reply).toMatch(/ambulance|118|119/i);
    expect(r.reply).toMatch(/BIMC|SOS|Siloam|Panti Rapih/);
  });

  it("lost response mentions a real actionable path (Grab, Google Maps, tourist police)", () => {
    const r = composeSafetyResponse({ signal: "lost", requiresSafetyResponse: true, reason: "test" });
    expect(r.reply).toMatch(/(Grab|Gojek|Google Maps|Tourist Police|112)/);
  });

  it("theft response mentions Bali tourist police number 224111", () => {
    const r = composeSafetyResponse({ signal: "theft_or_assault", requiresSafetyResponse: true, reason: "test" });
    expect(r.reply).toMatch(/224111/);
  });

  it("safe_but_worried returns empty reply (route continues to conversation)", () => {
    const r = composeSafetyResponse({ signal: "safe_but_worried", requiresSafetyResponse: false, reason: "test" });
    expect(r.reply).toBe("");
  });
});
