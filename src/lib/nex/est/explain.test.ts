// explainLine — keyword matching + null when nothing fits.

import { describe, it, expect } from "vitest";
import { explainLine, speakLine } from "./explain";
import { buildEstimate } from "./engine";

describe("explainLine", () => {
  it("finds the labour line for 'why so many hours?'", async () => {
    const b = await buildEstimate({ brief: "estimate 42m² plastering" });
    if (!b.ok) throw new Error();
    const l = explainLine(b.estimate, "why so many hours?");
    expect(l?.category).toBe("labour");
  });

  it("finds the profit line for 'why the profit markup?'", async () => {
    const b = await buildEstimate({ brief: "estimate 42m² plastering" });
    if (!b.ok) throw new Error();
    const l = explainLine(b.estimate, "why the profit markup?");
    expect(l?.category).toBe("profit");
  });

  it("finds the plaster bags line for 'why so many bags?'", async () => {
    const b = await buildEstimate({ brief: "estimate 42m² plastering" });
    if (!b.ok) throw new Error();
    const l = explainLine(b.estimate, "why so many bags?");
    expect(l?.label).toContain("Finish plaster");
  });

  it("returns null when nothing matches", async () => {
    const b = await buildEstimate({ brief: "estimate 42m² plastering" });
    if (!b.ok) throw new Error();
    const l = explainLine(b.estimate, "how's the weather?");
    expect(l).toBeNull();
  });

  it("speakLine formats a plain-text reply with the explanation", async () => {
    const b = await buildEstimate({ brief: "estimate 42m² plastering" });
    if (!b.ok) throw new Error();
    const l = explainLine(b.estimate, "why bags?");
    if (!l) throw new Error();
    const t = speakLine(l);
    expect(t).toContain("Finish plaster");
    expect(t).toContain("9 m²/bag");
    expect(t).toContain("£");
  });
});
