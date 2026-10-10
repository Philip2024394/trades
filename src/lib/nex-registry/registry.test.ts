import { describe, it, expect, beforeEach } from "vitest";
import {
  seedCoreRegistry,
  registerEntry,
  getEntry,
  listByCategory,
  listByTier,
  listAutoSelectable,
  search,
  count,
  summary,
  exportManifest,
  _resetRegistryForTests,
} from "./registry";
import {
  computeEntryId,
  computeProvenanceHash,
  isCommercialSafe,
  isAutoSelectable,
  requiresLicenseReview,
  REGISTRY_CATEGORIES,
  NEX_REGISTRY_VERSION,
} from "./types";

describe("nex-registry · types + helpers", () => {
  it("computeEntryId is deterministic and 20 char prefix", () => {
    const a = computeEntryId({ category: "component", name: "Button", source_repository: "shadcn-ui/ui" });
    const b = computeEntryId({ category: "component", name: "Button", source_repository: "shadcn-ui/ui" });
    expect(a).toBe(b);
    expect(a.length).toBe(20);
  });

  it("computeProvenanceHash is deterministic irrespective of array order", () => {
    const base = {
      source_repository: "x",
      source_url: null,
      source_commit: null,
      source_version: "1",
      license: "MIT" as const,
      license_verified: true,
      framework: ["react", "tailwindcss"],
      dependencies: ["b", "a"],
      security_status: "clean" as const,
      accessibility_status: "not_assessed" as const,
      visual_quality: "good" as const,
      modernity_status: "current" as const,
      nex_compatibility: "verified" as const,
      nex_modifications: [],
      import_date: "2026-09-19T00:00:00.000Z",
    };
    const h1 = computeProvenanceHash(base);
    const h2 = computeProvenanceHash({ ...base, framework: ["tailwindcss", "react"], dependencies: ["a", "b"] });
    expect(h1).toBe(h2);
  });

  it("commercial-safe / auto-selectable / license-review helpers behave", () => {
    expect(isCommercialSafe("MIT")).toBe(true);
    expect(isCommercialSafe("COMMERCIAL")).toBe(false);
    expect(isAutoSelectable("CORE")).toBe(true);
    expect(isAutoSelectable("EXPERIMENTAL")).toBe(false);
    expect(requiresLicenseReview("UNCLEAR")).toBe(true);
    expect(requiresLicenseReview("MIT")).toBe(false);
  });

  it("version constant is canonical", () => {
    expect(NEX_REGISTRY_VERSION).toBe("nex-registry.v1.2026-09-19");
  });
});

describe("nex-registry · seedCoreRegistry + queries", () => {
  beforeEach(() => {
    _resetRegistryForTests();
    seedCoreRegistry();
  });

  it("populates ≥30 CORE entries drawn from the discovery map", () => {
    expect(count()).toBeGreaterThanOrEqual(30);
  });

  it("categorises entries across component/icon/font/animation/section/asset/design_system", () => {
    const s = summary();
    expect(s.component).toBeGreaterThanOrEqual(25);   // 27 shadcn
    expect(s.icon).toBeGreaterThanOrEqual(1);
    expect(s.font).toBeGreaterThanOrEqual(1);
    expect(s.animation).toBeGreaterThanOrEqual(2);
    expect(s.design_system).toBeGreaterThanOrEqual(1);
    expect(s.section).toBeGreaterThanOrEqual(1);
    expect(s.asset).toBeGreaterThanOrEqual(1);
    expect(s.template).toBe(0);  // empty by design in Phase 1
    expect(s.layout).toBe(0);    // empty by design in Phase 1
  });

  it("every entry is marked zero_llm=true and ledger=B", () => {
    for (const cat of REGISTRY_CATEGORIES) {
      for (const e of listByCategory(cat)) {
        expect(e.zero_llm).toBe(true);
        expect(e.ledger).toBe("B");
      }
    }
  });

  it("shadcn Button is registered as CORE with verified MIT", () => {
    const btn = listByCategory("component").find((e) => e.name === "Button");
    expect(btn).toBeTruthy();
    expect(btn!.quality_tier).toBe("CORE");
    expect(btn!.provenance.license).toBe("MIT");
    expect(btn!.provenance.license_verified).toBe(true);
    expect(btn!.provenance.modernity_status).toBe("current");
    expect(btn!.provenance.nex_compatibility).toBe("verified");
  });

  it("Studio sections proxy points to the existing sectionRegistry (§43 anti-duplication)", () => {
    const [proxy] = listByCategory("section");
    expect(proxy.proxy_target).toContain("studio/sectionRegistry");
  });

  it("Image manifest proxy points at the existing 187K-row store", () => {
    const [proxy] = listByCategory("asset");
    expect(proxy.proxy_target).toContain("nex-image-manifest");
  });

  it("listAutoSelectable returns only CORE/APPROVED entries", () => {
    const rows = listAutoSelectable();
    for (const r of rows) {
      expect(["CORE", "APPROVED"]).toContain(r.quality_tier);
    }
  });

  it("search filters by category + device", () => {
    const rows = search({ category: "component", device: "mobile" });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.category).toBe("component");
      expect(r.device_support.mobile).toBe(true);
    }
  });

  it("search license_commercial_safe=true excludes COMMERCIAL/REVIEW_REQUIRED", () => {
    const rows = search({ license_commercial_safe: true });
    for (const r of rows) {
      expect(requiresLicenseReview(r.provenance.license)).toBe(false);
    }
  });

  it("exportManifest returns canonical version + coherent counts", () => {
    const m = exportManifest();
    expect(m.version).toBe("nex-registry.v1.2026-09-19");
    expect(m.total_entries).toBe(count());
    expect(m.by_tier.CORE).toBeGreaterThanOrEqual(30);
    expect(m.zero_llm).toBe(true);
    expect(m.ledger).toBe("B");
  });
});

describe("nex-registry · anti-fabrication guards", () => {
  beforeEach(() => _resetRegistryForTests());

  it("refuses to register a CORE entry with license_verified=false", () => {
    expect(() => registerEntry({
      category: "component",
      name: "Fake",
      description: "attempt",
      quality_tier: "CORE",
      provenance: {
        source_repository: "somebody/repo",
        source_url: null,
        source_commit: null,
        source_version: "1",
        license: "MIT",
        license_verified: false,
        framework: ["react"],
        dependencies: [],
        security_status: "not_scanned",
        accessibility_status: "not_assessed",
        visual_quality: "good",
        modernity_status: "current",
        nex_compatibility: "unknown",
        nex_modifications: [],
        import_date: new Date().toISOString(),
        provenance_hash: "test",
      },
      usage_context: ["desktop"],
      variants: [],
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      path_in_repo: null,
      proxy_target: null,
    })).toThrow(/license_verified/);
  });

  it("refuses to register an APPROVED entry with license_verified=false", () => {
    expect(() => registerEntry({
      category: "component",
      name: "Fake2",
      description: "attempt",
      quality_tier: "APPROVED",
      provenance: {
        source_repository: "somebody/repo",
        source_url: null,
        source_commit: null,
        source_version: "1",
        license: "MIT",
        license_verified: false,
        framework: ["react"],
        dependencies: [],
        security_status: "not_scanned",
        accessibility_status: "not_assessed",
        visual_quality: "good",
        modernity_status: "current",
        nex_compatibility: "unknown",
        nex_modifications: [],
        import_date: new Date().toISOString(),
        provenance_hash: "test",
      },
      usage_context: ["desktop"],
      variants: [],
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      path_in_repo: null,
      proxy_target: null,
    })).toThrow(/license_verified/);
  });

  it("permits an EXPERIMENTAL entry with license_verified=false (tier gate does not block)", () => {
    const e = registerEntry({
      category: "component",
      name: "Experimental",
      description: "attempt",
      quality_tier: "EXPERIMENTAL",
      provenance: {
        source_repository: "somebody/repo",
        source_url: null,
        source_commit: null,
        source_version: "1",
        license: "REVIEW_REQUIRED",
        license_verified: false,
        framework: ["react"],
        dependencies: [],
        security_status: "not_scanned",
        accessibility_status: "not_assessed",
        visual_quality: "not_assessed",
        modernity_status: "not_assessed",
        nex_compatibility: "unknown",
        nex_modifications: [],
        import_date: new Date().toISOString(),
        provenance_hash: "test",
      },
      usage_context: [],
      variants: [],
      device_support: { desktop: true, tablet: false, mobile: false, pwa: false },
      path_in_repo: null,
      proxy_target: null,
    });
    expect(e.quality_tier).toBe("EXPERIMENTAL");
  });
});
