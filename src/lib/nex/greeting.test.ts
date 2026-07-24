// Nex greeting — time-of-day + last-seen tests.

import { describe, it, expect } from "vitest";
import { buildGreeting } from "./greeting";

function at(hour: number): Date {
  // Construct a Date at the given UTC-hour that's still valid.
  const d = new Date("2026-07-22T00:00:00Z");
  d.setUTCHours(hour);
  return d;
}

describe("Nex greeting", () => {
  it("Good morning at 07:00 UTC (08:00 UK-ish)", () => {
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: null, pendingReviews: 0, now: at(7) });
    expect(g.greeting.startsWith("Good morning, Phil.")).toBe(true);
  });

  it("Afternoon at 13:00 UTC", () => {
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: null, pendingReviews: 0, now: at(13) });
    expect(g.greeting.startsWith("Afternoon, Phil.")).toBe(true);
  });

  it("Evening at 19:00 UTC", () => {
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: null, pendingReviews: 0, now: at(19) });
    expect(g.greeting.startsWith("Evening, Phil.")).toBe(true);
  });

  it("First visit language when no last-seen", () => {
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: null, pendingReviews: 0, now: at(9) });
    expect(g.greeting).toContain("First visit");
  });

  it("Welcome back within a week", () => {
    const yesterday = new Date(at(9).getTime() - 1000 * 60 * 60 * 24 * 3);
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: yesterday.toISOString(), pendingReviews: 0, now: at(9) });
    expect(g.greeting).toContain("Welcome back");
  });

  it("Long time no see after a month", () => {
    const long = new Date(at(9).getTime() - 1000 * 60 * 60 * 24 * 60);
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: long.toISOString(), pendingReviews: 0, now: at(9) });
    expect(g.greeting).toContain("Long time no see");
  });

  it("Briefing mentions pending reviews", () => {
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: null, pendingReviews: 5, now: at(9) });
    expect(g.briefing).toContain("5 knowledge items");
  });

  it("No briefing when nothing pending", () => {
    const g = buildGreeting({ firstName: "Phil", lastSeenAt: null, pendingReviews: 0, now: at(9) });
    expect(g.briefing).toBeNull();
  });

  it("Handles missing first name", () => {
    const g = buildGreeting({ firstName: "", lastSeenAt: null, pendingReviews: 0, now: at(9) });
    expect(g.greeting.startsWith("Good morning.")).toBe(true);
  });
});
