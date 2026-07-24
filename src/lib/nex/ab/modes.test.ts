// Autonomy modes — pure function tests.

import { describe, it, expect } from "vitest";
import { DEFAULT_MODE, isAutoApprovable, resolveAutonomy } from "./modes";
import type { AutonomySettings } from "./types";

describe("resolveAutonomy", () => {
  it("defaults to manual with engine_default source", () => {
    const s = resolveAutonomy({ merchantSlug: "phil" });
    expect(s.mode).toBe(DEFAULT_MODE);
    expect(s.mode).toBe("manual");
    expect(s.source).toBe("engine_default");
    expect(s.trusted_categories).toEqual([]);
  });

  it("override sets source to merchant_override", () => {
    const s = resolveAutonomy({ merchantSlug: "phil", override: { mode: "trusted", trusted_categories: ["review_request"] } });
    expect(s.mode).toBe("trusted");
    expect(s.source).toBe("merchant_override");
    expect(s.trusted_categories).toEqual(["review_request"]);
  });
});

function settings(mode: AutonomySettings["mode"], categories: AutonomySettings["trusted_categories"] = []): AutonomySettings {
  return { merchant_slug: "phil", mode, trusted_categories: categories, source: "merchant_override" };
}

describe("isAutoApprovable", () => {
  it("manual — never", () => {
    expect(isAutoApprovable("review_request", true, settings("manual"))).toBe(false);
  });

  it("assisted — never (prepared, merchant approves)", () => {
    expect(isAutoApprovable("review_request", true, settings("assisted", ["review_request"]))).toBe(false);
  });

  it("trusted — yes only when category listed AND reversible", () => {
    const s = settings("trusted", ["review_request"]);
    expect(isAutoApprovable("review_request", true, s)).toBe(true);
    // not in list
    expect(isAutoApprovable("invoice_reminder", true, s)).toBe(false);
    // not reversible
    expect(isAutoApprovable("review_request", false, s)).toBe(false);
  });

  it("enterprise — yes when category listed (reversibility not required)", () => {
    const s = settings("enterprise", ["review_request"]);
    expect(isAutoApprovable("review_request", true,  s)).toBe(true);
    expect(isAutoApprovable("review_request", false, s)).toBe(true);
    // category NOT in list still gated
    expect(isAutoApprovable("invoice_reminder", true, s)).toBe(false);
  });
});
