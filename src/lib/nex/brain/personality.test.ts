// Stage 3.30 · Phase 23 · Personality unit tests.

import { describe, it, expect } from "vitest";
import { applyPersonality } from "./personality";

describe("applyPersonality · profiles", () => {
  it("friendly (default) passes through unchanged", () => {
    const input = "I've got 14 real listings for hotels in Yogyakarta.";
    const r = applyPersonality({ reply: input });
    expect(r.reply).toBe(input);
    expect(r.report.profile).toBe("friendly");
  });

  it("concise strips 'Got it — ' opener", () => {
    const input = "Got it — budget hotels near Malioboro.";
    const r = applyPersonality({ reply: input, profile: "concise" });
    expect(r.reply.toLowerCase().startsWith("got it")).toBe(false);
    expect(r.reply).toContain("budget hotels near Malioboro");
  });

  it("concise strips 'Want me to ...?' tail", () => {
    const input = "Griya Sentana, Hotel Trim Tiga. Want me to focus around a specific area?";
    const r = applyPersonality({ reply: input, profile: "concise" });
    expect(r.reply).not.toContain("Want me to");
    expect(r.reply).toContain("Griya Sentana");
  });

  it("professional replaces casual verbs with neutral", () => {
    const input = "I've got 14 real listings. Do you want budget or upmarket?";
    const r = applyPersonality({ reply: input, profile: "professional" });
    expect(r.reply).toContain("I have 14 real listings");
    expect(r.reply).toContain("Would you prefer");
  });

  it("professional preserves numeric claims + names", () => {
    const input = "I have 14 real listings — Griya Sentana, Hotel Trim Tiga, Asia Afrika.";
    const r = applyPersonality({ reply: input, profile: "professional" });
    expect(r.reply).toContain("14");
    expect(r.reply).toContain("Griya Sentana");
    expect(r.reply).toContain("Hotel Trim Tiga");
    expect(r.reply).toContain("Asia Afrika");
  });
});

describe("applyPersonality · report", () => {
  it("records transformations applied", () => {
    const r = applyPersonality({ reply: "Got it — cheap hotels.", profile: "concise" });
    expect(r.report.transformationsApplied.length).toBeGreaterThan(0);
    expect(r.report.transformationsApplied[0]).toContain("concise");
  });

  it("summary describes profile + count", () => {
    const r = applyPersonality({ reply: "test", profile: "professional" });
    expect(r.report.summary).toContain("profile=professional");
  });
});

describe("applyPersonality · truth preservation", () => {
  it("never invents new content", () => {
    const input = "I can't book accommodation for you yet.";
    for (const profile of ["friendly", "concise", "professional"] as const) {
      const r = applyPersonality({ reply: input, profile });
      // Honesty boundary must remain
      expect(r.reply.toLowerCase()).toMatch(/can'?t book|can not book/);
    }
  });

  it("empty reply stays empty", () => {
    const r = applyPersonality({ reply: "", profile: "concise" });
    expect(r.reply).toBe("");
  });
});
