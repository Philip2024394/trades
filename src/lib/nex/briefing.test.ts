// Daily briefing composer. Signal collection is DB-backed so we
// exercise the pure formatter with hand-rolled signals.

import { describe, it, expect } from "vitest";
import { briefingToSpeech, type DailyBriefing } from "./briefing";
import { voiceCheck } from "./persona";

function makeBriefing(overrides: Partial<DailyBriefing> = {}): DailyBriefing {
  return {
    greeting:        "Good morning, Phil.",
    bullets:         [],
    signals:         [],
    observations:    [],
    health:          null,
    priorities:      [],
    recommendations: [],
    closing:         "What would you like to work on first?",
    ...overrides
  };
}

describe("briefingToSpeech", () => {
  it("includes only greeting + closing when nothing to report", () => {
    const out = briefingToSpeech(makeBriefing());
    expect(out).toContain("Good morning, Phil.");
    expect(out).toContain("What would you like to work on first?");
    expect(out).not.toContain("Here's today's briefing");
  });

  it("inserts 'Here's today's briefing' section when bullets present", () => {
    const out = briefingToSpeech(makeBriefing({
      bullets: ["- 2 posts waiting for approval.", "- 1 knowledge review pending."]
    }));
    expect(out).toContain("Here's today's briefing.");
    expect(out).toContain("2 posts waiting for approval.");
    expect(out).toContain("1 knowledge review pending.");
  });

  it("passes the voice check (no banned phrases)", () => {
    const out = briefingToSpeech(makeBriefing({
      bullets: [
        "- 3 knowledge items waiting for approval.",
        "- 1 post scheduled for later today.",
        "- 2 carpentry entries haven't been reviewed in six months."
      ]
    }));
    expect(voiceCheck(out)).toEqual([]);
  });

  it("closing changes when nothing was noticed", () => {
    const out = briefingToSpeech(makeBriefing({
      closing: "Nothing needs your attention right now. What would you like to work on first?"
    }));
    expect(out).toContain("Nothing needs your attention");
  });
});
