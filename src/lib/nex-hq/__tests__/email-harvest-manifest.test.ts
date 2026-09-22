// src/lib/nex-hq/__tests__/email-harvest-manifest.test.ts
//
// Anti-fabrication acceptance for the EMAIL HARVEST manifest.
// Every entry is either a real page, a reused existing route, or a stub
// that names its own blocker. No entry can silently claim to be real.

import { describe, it, expect } from "vitest";
import {
  EMAIL_HARVEST_PAGES, findEmailHarvestPage,
  _MANIFEST_NEVER_LISTS_FAKE_PAGE, _MANIFEST_STUB_NAMES_ITS_BLOCKER,
} from "../email-harvest-manifest";

describe("Email Harvest manifest · anti-fabrication", () => {
  it("(A1) manifest has exactly the 17 canonical pages", () => {
    expect(EMAIL_HARVEST_PAGES).toHaveLength(17);
  });

  it("(A2) slugs are unique", () => {
    const slugs = EMAIL_HARVEST_PAGES.map(p => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("(A3) every real_via_reuse entry carries an href to an existing route", () => {
    const reuse = EMAIL_HARVEST_PAGES.filter(p => p.status === "real_via_reuse");
    for (const p of reuse) {
      expect(p.href, `page ${p.slug} status=real_via_reuse must have href`).toBeTruthy();
      expect(p.href!.startsWith("/")).toBe(true);
    }
  });

  it("(A4) every stub entry names its blocker · no stub can be silent", () => {
    const stubs = EMAIL_HARVEST_PAGES.filter(p => p.status === "stub");
    // If any stub exists it MUST name its blocker meaningfully.
    // (Empty stubs list is legitimate · all pages wired to real / real_via_reuse / partial.)
    for (const p of stubs) {
      expect(p.blocker, `stub ${p.slug} must name a blocker`).toBeTruthy();
      expect(p.blocker!.length).toBeGreaterThan(20);
    }
  });

  it("(A5) every partial entry names its blocker (partial means genuinely incomplete)", () => {
    const partials = EMAIL_HARVEST_PAGES.filter(p => p.status === "partial");
    for (const p of partials) {
      expect(p.blocker, `partial ${p.slug} must name a blocker`).toBeTruthy();
    }
  });

  it("(A6) every real entry names at least one persisted source it reads from", () => {
    const reals = EMAIL_HARVEST_PAGES.filter(p => p.status === "real");
    for (const p of reals) {
      expect(p.reads_from, `real ${p.slug} must name reads_from`).toBeTruthy();
      expect(p.reads_from!.length).toBeGreaterThan(0);
    }
  });

  it("(A7) findEmailHarvestPage returns the matching entry · null for unknown slug", () => {
    expect(findEmailHarvestPage("overview")?.slug).toBe("overview");
    expect(findEmailHarvestPage("proof-health")?.slug).toBe("proof-health");
    expect(findEmailHarvestPage("nonexistent-slug")).toBeNull();
  });

  it("(A8) boundary markers exported", () => {
    expect(_MANIFEST_NEVER_LISTS_FAKE_PAGE).toContain("honestly_stubbed");
    expect(_MANIFEST_STUB_NAMES_ITS_BLOCKER).toContain("blocker");
  });

  it("(A9) overview and proof-health both exist and are real", () => {
    const o = findEmailHarvestPage("overview");
    const p = findEmailHarvestPage("proof-health");
    expect(o?.status).toBe("real");
    expect(p?.status).toBe("real");
  });

  it("(A10) no entry claims 'real' without at least one data source (structural anti-fabrication)", () => {
    for (const p of EMAIL_HARVEST_PAGES) {
      if (p.status === "real") {
        expect(p.reads_from, `${p.slug} claims real but has no reads_from`).toBeTruthy();
      }
    }
  });
});
