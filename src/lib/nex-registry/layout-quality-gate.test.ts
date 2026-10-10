import { describe, it, expect, beforeEach } from "vitest";
import { seedCoreLayouts, listAllLayouts, listByFamily, _resetLayoutRegistryForTests } from "./layout-registry";
import { assessLayout, attachVisualProbes, LAYOUT_QUALITY_GATE_VERSION, type LayoutQualityResult } from "./layout-quality-gate";
import type { LayoutSpec, ScreenshotProbe } from "./layout-types";

const ISO = new Date().toISOString();
function probe(viewport: ScreenshotProbe["viewport"], overrides: Partial<ScreenshotProbe> = {}): ScreenshotProbe {
  return {
    screenshot_hash: `hash-${viewport}`,
    viewport,
    rendered_ok: true,
    overflow_detected: false,
    missing_icons: false,
    broken_images: false,
    interaction_targets_meet_minimum_size: true,
    primary_action_visible: true,
    probed_at_iso: ISO,
    ...overrides,
  };
}

describe("layout-quality-gate · founder invariants", () => {
  it("canonical version", () => {
    expect(LAYOUT_QUALITY_GATE_VERSION).toBe("layout-quality-gate.v1.2026-09-19");
  });

  it("emits exactly 10 signals L1-L10", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const spec = listAllLayouts()[0];
    const r = assessLayout(spec);
    expect(r.signals.length).toBe(10);
    expect(r.signals.map((s) => s.signal)).toEqual(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"]);
  });

  it("declares zero_llm=true and ledger=B", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const r = assessLayout(listAllLayouts()[0]);
    expect(r.zero_llm).toBe(true);
    expect(r.ledger).toBe("B");
  });
});

describe("§29 Test 6 · REJECT_OUTDATED for deliberately outdated layout descriptor", () => {
  it("descriptor triggers REJECT_OUTDATED (never sneaks past)", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const good = listAllLayouts()[0];
    const bad: LayoutSpec = { ...good, description: "generic-saas dashboard with giant hero by default and rainbow gradient" };
    const r = assessLayout(bad);
    expect(r.verdict).toBe("REJECT_OUTDATED");
    expect(r.rejection_reasons.some((x) => x.includes("L2"))).toBe(true);
  });

  it("modernity_status outdated triggers REJECT_OUTDATED", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const good = listAllLayouts()[0];
    const bad: LayoutSpec = { ...good, modernity_status: "outdated" };
    const r = assessLayout(bad);
    expect(r.verdict).toBe("REJECT_OUTDATED");
    expect(r.rejection_reasons.some((x) => x.includes("L8"))).toBe(true);
  });
});

describe("§29 Test 7 · REJECT_RESPONSIVE_FAILURE for desktop-only or shrunk-desktop", () => {
  it("mobile density not compact → responsive failure", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const good = listAllLayouts()[0];
    const bad: LayoutSpec = {
      ...good,
      responsive: {
        ...good.responsive,
        mobile: { ...good.responsive.mobile, density: "comfortable" },
      },
    };
    const r = assessLayout(bad);
    expect(r.verdict).toBe("REJECT_RESPONSIVE_FAILURE");
  });

  it("desktop and mobile navigation identical + no region differences → responsive failure", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const good = listAllLayouts()[0];
    const bad: LayoutSpec = {
      ...good,
      responsive: {
        ...good.responsive,
        // Force mobile to mirror desktop exactly (except density which we already handle above)
        mobile: {
          ...good.responsive.desktop,
          density: "compact",
        },
      },
    };
    const r = assessLayout(bad);
    // L5 or L4 will reject
    expect(["REJECT_RESPONSIVE_FAILURE"]).toContain(r.verdict);
  });
});

describe("§29 Test 8 · No screenshots → PASS_CONDITIONAL (never PASS_MODERN)", () => {
  it("well-formed layout without visual probes returns PASS_CONDITIONAL", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    for (const spec of listAllLayouts()) {
      const r = assessLayout(spec);
      expect(r.verdict).toBe("PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED");
      expect(r.required_visual_probe).toBe(true);
    }
  });

  it("layout with only 2 viewports of probes still cannot PASS_MODERN", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const good = listAllLayouts()[0];
    const withProbes = attachVisualProbes(good, [probe("desktop"), probe("tablet-portrait")]);
    const r = assessLayout(withProbes);
    // L10 will reject because three-viewport not covered
    expect(["REJECT_INSUFFICIENT_EVIDENCE", "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED"]).toContain(r.verdict);
  });

  it("layout with clean desktop + tablet + mobile probes CAN PASS_MODERN", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const good = listAllLayouts()[0];
    const withProbes = attachVisualProbes(good, [probe("desktop"), probe("tablet-portrait"), probe("mobile-portrait")]);
    const r = assessLayout(withProbes);
    expect(r.verdict).toBe("PASS_MODERN");
    expect(r.required_visual_probe).toBe(false);
  });

  it("layout with a broken mobile probe (overflow detected) does NOT PASS_MODERN", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const good = listAllLayouts()[0];
    const withProbes = attachVisualProbes(good, [
      probe("desktop"),
      probe("tablet-portrait"),
      probe("mobile-portrait", { overflow_detected: true }),
    ]);
    const r = assessLayout(withProbes);
    expect(r.verdict).not.toBe("PASS_MODERN");
  });
});

describe("layout-quality-gate · every CORE layout passes conditional gate (no rejects)", () => {
  it("no CORE layout returns REJECT", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const results: LayoutQualityResult[] = listAllLayouts().map((s) => assessLayout(s));
    const bad = results.filter((r) => r.verdict.startsWith("REJECT"));
    if (bad.length > 0) {
      // eslint-disable-next-line no-console
      console.log("CORE layouts that REJECTed:", JSON.stringify(bad.map((b) => ({ name: b.layout_name, verdict: b.verdict, reasons: b.rejection_reasons })), null, 2));
    }
    expect(bad.length).toBe(0);
  });

  it("all CORE layouts return PASS_CONDITIONAL until visual probes provided", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    for (const spec of listAllLayouts()) {
      const r = assessLayout(spec);
      expect(r.verdict).toBe("PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED");
    }
  });
});

describe("§29 Test 3 · Give me three modern dashboard layouts", () => {
  it("dashboard family exposes structurally distinct options", () => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
    const dashboards = listByFamily("dashboard");
    expect(dashboards.length).toBeGreaterThanOrEqual(2);
    // Structural difference proof: different desktop navigation model
    const navs = new Set(dashboards.map((d) => d.responsive.desktop.navigation));
    expect(navs.size).toBeGreaterThanOrEqual(2);
  });
});
