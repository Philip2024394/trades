// src/lib/nex-agent/seo-agent.test.ts

import { describe, it, expect } from "vitest";
import { detectProjectType, suggestSeo, pickIntroductionFlash } from "./seo-agent";

describe("detectProjectType", () => {
  it("detects landing page from prompt", () => {
    const r = detectProjectType({ prompt: "Build a landing page for my SaaS" });
    expect(r.projectType).toBe("landing-page");
  });

  it("detects ecommerce from prompt", () => {
    const r = detectProjectType({ prompt: "Create a shop with cart and checkout" });
    expect(r.projectType).toBe("ecommerce");
  });

  it("detects blog from prompt", () => {
    const r = detectProjectType({ prompt: "Build a blog with articles and posts" });
    expect(r.projectType).toBe("blog");
  });

  it("falls back to webapp when Next.js present without keywords", () => {
    const r = detectProjectType({
      prompt: "make a widget",
      packageJson: { dependencies: { next: "16.0.0", react: "19.0.0" } },
    });
    expect(r.projectType).toBe("webapp");
    expect(r.hasNextJs).toBe(true);
  });

  it("returns unknown when nothing matches", () => {
    const r = detectProjectType({ prompt: "make a widget" });
    expect(r.projectType).toBe("unknown");
    expect(r.hasNextJs).toBe(false);
  });

  it("records provenance in detectedFrom", () => {
    const r = detectProjectType({
      prompt: "Build a marketplace for widgets",
      packageJson: { dependencies: { next: "16" } },
    });
    expect(r.detectedFrom).toContain("package.json:next");
    expect(r.detectedFrom.some((s) => s.includes("marketplace"))).toBe(true);
  });
});

describe("suggestSeo", () => {
  it("returns applicable suggestions sorted by severity", () => {
    const ctx = detectProjectType({ prompt: "landing page" });
    const s = suggestSeo(ctx, 10);
    expect(s.length).toBeGreaterThan(0);
    // First should be severity high
    expect(s[0].severity).toBe("high");
  });

  it("respects the limit", () => {
    const ctx = detectProjectType({ prompt: "blog" });
    const s = suggestSeo(ctx, 3);
    expect(s.length).toBeLessThanOrEqual(3);
  });

  it("assigns unique ids", () => {
    const ctx = detectProjectType({ prompt: "ecommerce" });
    const s = suggestSeo(ctx, 20);
    const ids = new Set(s.map((x) => x.id));
    expect(ids.size).toBe(s.length);
  });

  it("every suggestion has rationale + category", () => {
    const s = suggestSeo(detectProjectType({ prompt: "saas dashboard" }));
    for (const x of s) {
      expect(x.rationale.length).toBeGreaterThan(20);
      expect(x.category).toBeTruthy();
    }
  });
});

describe("pickIntroductionFlash", () => {
  it("returns null for empty list", () => {
    expect(pickIntroductionFlash([], "seed")).toBeNull();
  });

  it("deterministic per seed", () => {
    const ctx = detectProjectType({ prompt: "blog" });
    const s = suggestSeo(ctx);
    const p1 = pickIntroductionFlash(s, "task-abc");
    const p2 = pickIntroductionFlash(s, "task-abc");
    expect(p1?.id).toBe(p2?.id);
  });

  it("different seeds pick differently (usually)", () => {
    const ctx = detectProjectType({ prompt: "blog" });
    const s = suggestSeo(ctx, 20);
    const picks = new Set<string>();
    for (const seed of ["a","b","c","d","e","f","g","h"]) {
      const p = pickIntroductionFlash(s, seed);
      if (p) picks.add(p.id);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});
