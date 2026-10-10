import { describe, it, expect, beforeEach } from "vitest";
import {
  seedCoreLayouts,
  registerLayout,
  listByFamily,
  listAllLayouts,
  countLayouts,
  exportLayoutManifest,
  routeRequest,
  selectLayoutsForFamily,
  _resetLayoutRegistryForTests,
  nexNativeProvenance,
} from "./layout-registry";
import { NEX_LAYOUT_VERSION, computeLayoutId, hasThreeViewportEvidence } from "./layout-types";

describe("layout-registry · core catalog", () => {
  beforeEach(() => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
  });

  it("seeds exactly 7 CORE layouts", () => {
    expect(countLayouts()).toBe(7);
  });

  it("covers 6 layout families", () => {
    const families = new Set(listAllLayouts().map((l) => l.layout_family));
    // At least 6 of 8 families in the CORE seed
    expect(families.size).toBeGreaterThanOrEqual(6);
    expect(families.has("dashboard")).toBe(true);
    expect(families.has("editor_creative")).toBe(true);
    expect(families.has("data_directory")).toBe(true);
    expect(families.has("mobile_first")).toBe(true);
    expect(families.has("pwa")).toBe(true);
    expect(families.has("product_landing")).toBe(true);
  });

  it("every CORE layout declares desktop + tablet + mobile responsive models", () => {
    for (const l of listAllLayouts()) {
      expect(l.responsive.desktop).toBeDefined();
      expect(l.responsive.tablet_portrait).toBeDefined();
      expect(l.responsive.mobile).toBeDefined();
    }
  });

  it("every CORE layout has zero_llm=true and ledger=B", () => {
    for (const l of listAllLayouts()) {
      expect(l.zero_llm).toBe(true);
      expect(l.ledger).toBe("B");
    }
  });

  it("layout_id is deterministic across seed calls", () => {
    const first = new Map(listAllLayouts().map((l) => [l.name, l.layout_id]));
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const second = new Map(listAllLayouts().map((l) => [l.name, l.layout_id]));
    for (const [name, id] of first.entries()) expect(second.get(name)).toBe(id);
  });

  it("dashboard family has at least 2 distinct structural options (Give-me-three prep)", () => {
    const dashboards = listByFamily("dashboard");
    expect(dashboards.length).toBeGreaterThanOrEqual(2);
    // They must be structurally different: navigation model or region set differs
    const navSet = new Set(dashboards.map((l) => l.responsive.desktop.navigation));
    expect(navSet.size).toBeGreaterThanOrEqual(2);
  });

  it("selectLayoutsForFamily returns up to N layouts", () => {
    const rows = selectLayoutsForFamily("dashboard", 3);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
  });

  it("manifest declares canonical version + coherent counts", () => {
    const m = exportLayoutManifest();
    expect(m.version).toBe(NEX_LAYOUT_VERSION);
    expect(m.total).toBe(7);
    expect(m.zero_llm).toBe(true);
    expect(m.ledger).toBe("B");
  });
});

describe("layout-registry · anti-fabrication guards", () => {
  beforeEach(() => _resetLayoutRegistryForTests());

  it("refuses to register CORE layout with modernity_status=outdated", () => {
    const provenance = nexNativeProvenance();
    expect(() => registerLayout({
      layout_family: "dashboard",
      name: "outdated-attempt",
      description: "attempt to register something old as CORE",
      product_context: ["saas"],
      primary_goal: "test",
      regions: ["primary_navigation", "primary_content"],
      component_slots: {} as never,
      responsive: {
        desktop: { columns: 12, navigation: "left_sidebar_expanded", density: "medium", regions: {} as never },
        tablet_landscape: { columns: 8, navigation: "left_sidebar_compact", density: "medium", regions: {} as never },
        tablet_portrait: { columns: 8, navigation: "left_sidebar_compact", density: "medium", regions: {} as never },
        mobile: { columns: 1, navigation: "bottom_navigation", density: "compact", regions: {} as never },
      },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      design_system_requirements: ["shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "focus_visible"],
      motion_requirements: [],
      modernity_status: "outdated",
      quality_tier: "CORE",
      visual_probes: [],
    })).toThrow(/modernity_status=outdated/);
  });

  it("refuses to register CORE layout with modernity_status=legacy", () => {
    expect(() => registerLayout({
      layout_family: "dashboard",
      name: "legacy-attempt",
      description: "attempt",
      product_context: ["saas"],
      primary_goal: "test",
      regions: ["primary_navigation", "primary_content"],
      component_slots: {} as never,
      responsive: {
        desktop: { columns: 12, navigation: "left_sidebar_expanded", density: "medium", regions: {} as never },
        tablet_landscape: { columns: 8, navigation: "left_sidebar_compact", density: "medium", regions: {} as never },
        tablet_portrait: { columns: 8, navigation: "left_sidebar_compact", density: "medium", regions: {} as never },
        mobile: { columns: 1, navigation: "bottom_navigation", density: "compact", regions: {} as never },
      },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      design_system_requirements: ["shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "focus_visible"],
      motion_requirements: [],
      modernity_status: "legacy",
      quality_tier: "CORE",
      visual_probes: [],
    })).toThrow(/modernity_status=legacy/);
  });
});

describe("layout-registry · semantic router", () => {
  beforeEach(() => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
  });

  it("routes 'build me a modern dashboard' to dashboard family", () => {
    const r = routeRequest({ text: "build me a modern dashboard" });
    expect(r.resolution).toBe("resolved");
    if (r.resolution === "resolved") {
      expect(r.primary).toBe("dashboard");
    }
  });

  it("routes 'give me a modern mobile-first PWA' with pwa as a modifier", () => {
    const r = routeRequest({ text: "give me a modern mobile-first PWA for construction" });
    expect(r.resolution).toBe("resolved");
    if (r.resolution === "resolved") {
      expect([r.primary, ...r.alternatives]).toContain("pwa");
    }
  });

  it("routes 'build me an image editor' to editor_creative", () => {
    const r = routeRequest({ text: "build me an image editor with a canvas" });
    expect(r.resolution).toBe("resolved");
    if (r.resolution === "resolved") expect(r.primary).toBe("editor_creative");
  });

  it("routes 'directory' to data_directory", () => {
    const r = routeRequest({ text: "we need a searchable directory of trades" });
    expect(r.resolution).toBe("resolved");
    if (r.resolution === "resolved") expect(r.primary).toBe("data_directory");
  });

  it("returns unresolved on genuinely ambiguous request (§14 anti-fabrication)", () => {
    const r = routeRequest({ text: "build me a modern app" });
    expect(r.resolution).toBe("unresolved");
  });

  it("returns unresolved on gibberish", () => {
    const r = routeRequest({ text: "asdf qwerty zxcv" });
    expect(r.resolution).toBe("unresolved");
  });
});

describe("layout-types · helpers", () => {
  it("computeLayoutId is deterministic", () => {
    const a = computeLayoutId({ family: "dashboard", name: "focused-dashboard" });
    const b = computeLayoutId({ family: "dashboard", name: "focused-dashboard" });
    expect(a).toBe(b);
    expect(a.length).toBe(20);
  });

  it("hasThreeViewportEvidence requires desktop + tablet + mobile all clean", () => {
    const iso = new Date().toISOString();
    const desktop = { screenshot_hash: "d", viewport: "desktop" as const, rendered_ok: true, overflow_detected: false, missing_icons: false, broken_images: false, interaction_targets_meet_minimum_size: true, primary_action_visible: true, probed_at_iso: iso };
    const tablet = { ...desktop, viewport: "tablet-portrait" as const, screenshot_hash: "t" };
    const mobile = { ...desktop, viewport: "mobile-portrait" as const, screenshot_hash: "m" };
    expect(hasThreeViewportEvidence([desktop, tablet, mobile])).toBe(true);
    expect(hasThreeViewportEvidence([desktop, tablet])).toBe(false); // no mobile
    expect(hasThreeViewportEvidence([{ ...mobile, overflow_detected: true }, desktop, tablet])).toBe(false); // mobile overflow
  });
});
