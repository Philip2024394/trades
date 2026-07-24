// Growth engine — pattern → opportunity mapping.

import { describe, it, expect } from "vitest";
import { suggestGrowth } from "./growth";

describe("suggestGrowth", () => {
  it("empty input → no opportunities", () => {
    expect(suggestGrowth({})).toEqual([]);
  });

  it("package: ≥10 of same trade → package suggestion", () => {
    const opps = suggestGrowth({ completed_projects: [{ trade_label: "Kitchen renovation", count: 18 }] });
    const p = opps.find((o) => o.kind === "package")!;
    expect(p.headline).toContain("18");
    expect(p.headline.toLowerCase()).toContain("kitchen");
  });

  it("package: <10 → no package", () => {
    const opps = suggestGrowth({ completed_projects: [{ trade_label: "Kitchen renovation", count: 5 }] });
    expect(opps.filter((o) => o.kind === "package")).toHaveLength(0);
  });

  it("follow_up: stale quotes ≥14 days → follow_up suggestions with upside_pence", () => {
    const opps = suggestGrowth({
      stale_quotes: [{ quote_id: "q1", customer_label: "Smith", age_days: 21, amount_pence: 8_400_00 }]
    });
    const f = opps.find((o) => o.kind === "follow_up")!;
    expect(f.upside_pence).toBe(8_400_00);
    expect(f.headline).toContain("21");
  });

  it("referral: 5★ customer → referral opportunity per customer", () => {
    const opps = suggestGrowth({
      five_star_customers: [{ customer_id: "c1", customer_label: "Jones", last_review_at: "2026-07-01" }]
    });
    expect(opps.filter((o) => o.kind === "referral")).toHaveLength(1);
  });

  it("campaign: nearby searches ≥3 → campaign suggestion", () => {
    const opps = suggestGrowth({
      nearby_searches: [{ trade_label: "Bathroom", count: 5, window_days: 7 }]
    });
    const c = opps.find((o) => o.kind === "campaign")!;
    expect(c.headline).toContain("5 nearby");
  });
});
