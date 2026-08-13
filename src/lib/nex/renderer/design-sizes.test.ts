// Universal Design Sizes registry · tests.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { listDesignSizes, listByCategory, getDesignSize, countDesignSizes, listCategories } from "./design-sizes";

describe("Universal Design Sizes registry", () => {
  it("contains 60+ design sizes covering all 5 categories", () => {
    expect(countDesignSizes()).toBeGreaterThanOrEqual(60);
  });

  it("every category has at least one size", () => {
    for (const c of listCategories()) {
      expect(listByCategory(c).length).toBeGreaterThan(0);
    }
  });

  it("categories cover: social, web, print, documents, apps", () => {
    expect(listCategories()).toEqual(["social", "web", "print", "documents", "apps"]);
  });

  it("Facebook Feed is 1200x628", () => {
    const fb = getDesignSize("facebook_feed");
    expect(fb).toBeDefined();
    expect(fb?.width_px).toBe(1200);
    expect(fb?.height_px).toBe(628);
  });

  it("Instagram Story is 1080x1920 (9:16)", () => {
    const ig = getDesignSize("instagram_story");
    expect(ig?.width_px).toBe(1080);
    expect(ig?.height_px).toBe(1920);
    expect(ig?.aspect_ratio).toBe("9:16");
  });

  it("Print sizes carry DPI metadata (300 dpi baseline)", () => {
    const a4 = getDesignSize("print_poster_a4");
    expect(a4?.dpi).toBe(300);
  });

  it("Every design size has positive dimensions and a name", () => {
    for (const s of listDesignSizes()) {
      expect(s.width_px).toBeGreaterThan(0);
      expect(s.height_px).toBeGreaterThan(0);
      expect(s.name).toBeTruthy();
      expect(s.aspect_ratio).toBeTruthy();
    }
  });

  it("Every design size has a unique id", () => {
    const ids = listDesignSizes().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
