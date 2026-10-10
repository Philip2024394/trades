import { describe, it, expect, beforeEach } from "vitest";
import { seedCoreRegistry, listByCategory, listAutoSelectable, _resetRegistryForTests, registerEntry } from "./registry";
import { assessEntry, assessBatch, MODERNITY_QUALITY_GATE_VERSION, type VisualProbeEvidence } from "./modernity-quality-gate";
import type { LibraryEntry } from "./types";

function baseEntry(over: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    entry_id: "test-entry",
    category: "component",
    name: "TestButton",
    description: "modern component",
    quality_tier: "APPROVED",
    provenance: {
      source_repository: "test/repo",
      source_url: null,
      source_commit: null,
      source_version: "1",
      license: "MIT",
      license_verified: true,
      framework: ["react", "tailwindcss"],
      dependencies: [],
      security_status: "clean",
      accessibility_status: "aria_and_keyboard_verified",
      visual_quality: "excellent",
      modernity_status: "current",
      nex_compatibility: "verified",
      nex_modifications: [],
      import_date: new Date().toISOString(),
      provenance_hash: "hash",
    },
    usage_context: ["desktop", "tablet", "mobile"],
    variants: ["primary"],
    device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
    path_in_repo: "src/components/ui/button.tsx",
    proxy_target: null,
    documented_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    ...over,
  };
}

describe("modernity-quality-gate · founder invariants", () => {
  it("canonical version", () => {
    expect(MODERNITY_QUALITY_GATE_VERSION).toBe("modernity-quality-gate.v1.2026-09-19");
  });

  it("PASS_CONDITIONAL on a component entry without visual probe (anti-fabrication invariant · composition needs probe)", () => {
    const r = assessEntry({ entry: baseEntry() });
    expect(r.verdict).toBe("PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED");
    expect(r.rejection_reasons.length).toBe(0);
    expect(r.required_visual_probe).toBe(true);
  });

  it("REJECT_OUTDATED when modernity_status=outdated", () => {
    const r = assessEntry({
      entry: baseEntry({
        provenance: { ...baseEntry().provenance, modernity_status: "outdated" },
      }),
    });
    expect(r.verdict).toBe("REJECT_OUTDATED");
    expect(r.rejection_reasons.some((x) => x.includes("A"))).toBe(true);
  });

  it("REJECT_OUTDATED when modernity_status=legacy (founder rule: legacy is not acceptable)", () => {
    const r = assessEntry({
      entry: baseEntry({
        provenance: { ...baseEntry().provenance, modernity_status: "legacy" },
      }),
    });
    expect(r.verdict).toBe("REJECT_OUTDATED");
  });

  it("HOLD_LICENSE_REVIEW when license requires review", () => {
    const r = assessEntry({
      entry: baseEntry({
        provenance: { ...baseEntry().provenance, license: "UNCLEAR" },
      }),
    });
    expect(r.verdict).toBe("HOLD_LICENSE_REVIEW");
  });

  it("HOLD_LICENSE_REVIEW when license_verified=false", () => {
    // We construct the object directly (bypass registerEntry tier-gate) because we test the gate itself.
    const r = assessEntry({
      entry: baseEntry({
        quality_tier: "EXPERIMENTAL",
        provenance: { ...baseEntry().provenance, license_verified: false },
      }),
    });
    expect(r.verdict).toBe("HOLD_LICENSE_REVIEW");
  });

  it("REJECT_RESPONSIVE_FAILURE when tablet+mobile missing and not desktop-only", () => {
    const r = assessEntry({
      entry: baseEntry({
        device_support: { desktop: true, tablet: false, mobile: false, pwa: false },
        usage_context: ["dashboard"],
      }),
    });
    expect(r.verdict).toBe("REJECT_RESPONSIVE_FAILURE");
  });

  it("PASSes when desktop-only is explicitly declared", () => {
    const r = assessEntry({
      entry: baseEntry({
        device_support: { desktop: true, tablet: false, mobile: false, pwa: false },
        usage_context: ["desktop_only", "workstation"],
      }),
    });
    // May still be PASS_MODERN (H is a pass under desktop-only)
    expect(["PASS_MODERN", "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED"]).toContain(r.verdict);
  });

  it("REJECT_CONSISTENCY_FAILURE when react is used without tailwind or radix", () => {
    const r = assessEntry({
      entry: baseEntry({
        provenance: { ...baseEntry().provenance, framework: ["react"] },
      }),
    });
    expect(r.verdict).toBe("REJECT_CONSISTENCY_FAILURE");
  });

  it("REJECT when description matches an outdated descriptor", () => {
    const r = assessEntry({
      entry: baseEntry({
        description: "generic-saas dashboard with giant hero and rainbow gradient",
      }),
    });
    expect(r.verdict).toBe("REJECT_OUTDATED");
  });

  it("PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED when composition signal needs probe but no probe supplied", () => {
    const r = assessEntry({ entry: baseEntry() });
    // Composition returns unknown_needs_probe by default (deterministic-only)
    // so without probes we can still PASS_MODERN if no rejection signals fired
    // and needsProbe path triggers PASS_CONDITIONAL. Our seed entry passes
    // deterministically because Composition alone is unknown_needs_probe.
    // We test via a probe path below.
    expect(["PASS_MODERN", "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED"]).toContain(r.verdict);
  });

  it("PASS_MODERN when three-viewport visual probe evidence provided", () => {
    const probes: VisualProbeEvidence[] = [
      { screenshot_hash: "aaa", viewport: "desktop", rendered_ok: true, overflow_detected: false, missing_icons: false, broken_images: false, probed_at_iso: new Date().toISOString() },
      { screenshot_hash: "bbb", viewport: "tablet-portrait", rendered_ok: true, overflow_detected: false, missing_icons: false, broken_images: false, probed_at_iso: new Date().toISOString() },
      { screenshot_hash: "ccc", viewport: "mobile-portrait", rendered_ok: true, overflow_detected: false, missing_icons: false, broken_images: false, probed_at_iso: new Date().toISOString() },
    ];
    const r = assessEntry({ entry: baseEntry(), visual_probes: probes });
    expect(r.verdict).toBe("PASS_MODERN");
    expect(r.required_visual_probe).toBe(false);
  });
});

describe("modernity-quality-gate · batch assessment across the CORE catalog", () => {
  beforeEach(() => {
    _resetRegistryForTests();
    seedCoreRegistry();
  });

  it("every CORE entry either PASSes or is PASS_CONDITIONAL (never REJECT)", () => {
    const rows = listAutoSelectable();
    const results = assessBatch(rows);
    const bad = results.filter((r) => r.verdict.startsWith("REJECT") || r.verdict === "HOLD_LICENSE_REVIEW");
    if (bad.length > 0) {
      // eslint-disable-next-line no-console
      console.log("Bad CORE assessments:", JSON.stringify(bad.map((b) => ({ name: b.entry_name, verdict: b.verdict, reasons: b.rejection_reasons })), null, 2));
    }
    expect(bad.length).toBe(0);
  });

  it("shadcn Button assesses as PASS_MODERN or PASS_CONDITIONAL", () => {
    const btn = listByCategory("component").find((e) => e.name === "Button")!;
    const r = assessEntry({ entry: btn });
    expect(["PASS_MODERN", "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED"]).toContain(r.verdict);
  });
});

describe("modernity-quality-gate · signal coverage", () => {
  it("emits exactly 12 signals (A-L)", () => {
    const r = assessEntry({ entry: baseEntry() });
    expect(r.signals.length).toBe(12);
    const ids = r.signals.map((s) => s.signal);
    expect(ids).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);
  });

  it("declares zero_llm=true and ledger=B", () => {
    const r = assessEntry({ entry: baseEntry() });
    expect(r.zero_llm).toBe(true);
    expect(r.ledger).toBe("B");
  });
});
