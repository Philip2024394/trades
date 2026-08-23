// NEX image matcher — regression tests for the directory-card picker.
//
// The rules under test (Philip 2026-08-17 · locked):
//   1. Material eligibility is a HARD gate — timber company never gets
//      metal/glass, metal company never gets timber, timber+glass company
//      accepts either or both.
//   2. Least-used-first assignment on unavoidable reuse; ties broken by
//      hash so distribution is even but deterministic per (seed, salt).
//   3. Rotation salt reshuffles picks over time without breaking
//      within-batch stability.
//   4. v9 parts / white-background / component filter stays intact.
//
// These tests use in-memory ManifestImage arrays via a spied `loadManifest`
// so they're independent of the on-disk manifest.

import { describe, expect, it } from "vitest";

import {
  deriveMaterialsFromText,
  deriveCompanyMaterialsFromText,
  isImageCompatibleWithCompany,
  pickDiverseAPlusImage,
  type ManifestImage,
  type StaircaseMaterialFamily,
} from "./imageMatcher";

// ── Fixtures ──────────────────────────────────────────────────────

const img = (
  url: string,
  overrides: Partial<ManifestImage> = {},
): ManifestImage => ({
  url,
  a_plus: true,
  subject_domain: "staircase",
  description: "",
  tags: [],
  ...overrides,
});

const TIMBER_1 = img("https://cdn/timber-1.png", {
  description: "Warm oak staircase in a domestic hallway",
  tags: ["staircase", "hero-scene", "oak", "material:light_oak"],
});
const TIMBER_2 = img("https://cdn/timber-2.png", {
  description: "Traditional pine staircase with turned balusters",
  tags: ["staircase", "hero-scene", "pine", "material:pine"],
});
const TIMBER_3 = img("https://cdn/timber-3.png", {
  description: "Contemporary walnut floating staircase",
  tags: ["staircase", "hero-scene", "walnut", "material:dark_walnut"],
});
const METAL_1 = img("https://cdn/metal-1.png", {
  description: "Powder-coated steel mono-string industrial staircase",
  tags: ["staircase", "hero-scene", "steel", "material:steel"],
});
const METAL_2 = img("https://cdn/metal-2.png", {
  description: "Wrought iron traditional balustrade with brushed stainless handrail",
  tags: ["staircase", "hero-scene", "iron", "material:wrought_iron"],
});
const GLASS_1 = img("https://cdn/glass-1.png", {
  description: "Frameless glass balustrade on a modern floating staircase",
  tags: ["staircase", "hero-scene", "glass", "material:frameless_glass"],
});
const TIMBER_GLASS_1 = img("https://cdn/timber-glass-1.png", {
  description: "Oak treads with frameless glass balustrade",
  tags: ["staircase", "hero-scene", "oak", "glass"],
});
const METAL_GLASS_1 = img("https://cdn/metal-glass-1.png", {
  description: "Steel mono-string with glass balustrade",
  tags: ["staircase", "hero-scene", "steel", "glass"],
});
const PART_LEAK = img("https://cdn/part.png", {
  description: "STAIRCASE COMPONENT REFERENCE · handrail blank",
  tags: ["stair_component", "handrail_blank"],
});
const WHITE_BG_LEAK = img("https://cdn/white-bg.png", {
  description: "Isolated staircase on plain background",
  tags: ["staircase", "isolated", "transparent_background"],
});

const FIXTURE_MANIFEST: ManifestImage[] = [
  TIMBER_1,
  TIMBER_2,
  TIMBER_3,
  METAL_1,
  METAL_2,
  GLASS_1,
  TIMBER_GLASS_1,
  METAL_GLASS_1,
  PART_LEAK,
  WHITE_BG_LEAK,
];

// Company-side derivation with trade-realistic broadening. Use this in the
// picker tests since production wires the loader to this variant.
const companyProfileOf = (text: string): Set<StaircaseMaterialFamily> =>
  deriveCompanyMaterialsFromText(text);

// ── 1. Material eligibility is a hard gate ────────────────────────

describe("material eligibility gate", () => {
  it("timber-only company never receives metal or glass imagery", async () => {
    // Traditional joiner · timber-only. Company-side broadening is
    // asymmetric on purpose: timber companies do NOT auto-broaden to
    // metal/glass, so this profile stays strict {timber}.
    const companyMaterials = companyProfileOf("Traditional oak timber staircase joinery");
    expect(companyMaterials.has("timber")).toBe(true);
    expect(companyMaterials.has("metal")).toBe(false);
    expect(companyMaterials.has("glass")).toBe(false);

    // Sample 30 different seed ids · none should land on a metal/glass image.
    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "timber joinery", subject_domain: "staircase" },
        `seed-timber-${i}`,
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) results.add(url);
    }
    for (const url of results) {
      expect(url).not.toBe(METAL_1.url);
      expect(url).not.toBe(METAL_2.url);
      expect(url).not.toBe(GLASS_1.url);
      expect(url).not.toBe(METAL_GLASS_1.url);
    }
  });

  it("metal fabricator profile auto-includes timber (trade-realistic broadening)", async () => {
    // Steel fabricators almost universally install timber treads on their
    // steel staircases. Profile broadens to {metal, timber} by default so
    // the 131 metal+timber images (or equivalent fixture) become eligible.
    const companyMaterials = companyProfileOf(
      "Steel fabricator custom stainless steel staircases",
    );
    expect(companyMaterials.has("metal")).toBe(true);
    expect(companyMaterials.has("timber")).toBe(true);
    // But glass is not auto-added.
    expect(companyMaterials.has("glass")).toBe(false);

    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "steel fabrication", subject_domain: "staircase" },
        `seed-metal-${i}`,
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) results.add(url);
    }
    // Glass images (pure glass or metal+glass) must never appear because
    // glass isn't in the company profile.
    for (const url of results) {
      expect(url).not.toBe(GLASS_1.url);
      expect(url).not.toBe(METAL_GLASS_1.url);
      expect(url).not.toBe(TIMBER_GLASS_1.url);
    }
  });

  it("explicit metal-only signal blocks the timber auto-broadening", async () => {
    // A company that specifically declares "all-steel" / "metal-only" /
    // "structural steel only" is a genuine pure-metal shop (rare · usually
    // commercial fire escapes) — no timber auto-add, no timber imagery.
    const companyMaterials = companyProfileOf(
      "Structural steel only commercial fire escape staircase fabrication",
    );
    expect(companyMaterials.has("metal")).toBe(true);
    expect(companyMaterials.has("timber")).toBe(false);

    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "structural steel", subject_domain: "staircase" },
        `seed-metalonly-${i}`,
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) results.add(url);
    }
    for (const url of results) {
      expect(url).not.toBe(TIMBER_1.url);
      expect(url).not.toBe(TIMBER_2.url);
      expect(url).not.toBe(TIMBER_3.url);
      expect(url).not.toBe(TIMBER_GLASS_1.url);
    }
  });

  it("glass company profile auto-includes timber (trade-realistic broadening)", async () => {
    // A "glass staircase" or "glass balustrade" specialist in UK trade
    // almost never builds structural-glass staircases · they install glass
    // balustrades on wood or steel substrates. Profile broadens to
    // {glass, timber} so the 65 existing glass-touching images serve them.
    const companyMaterials = companyProfileOf(
      "Frameless glass balustrade installer",
    );
    expect(companyMaterials.has("glass")).toBe(true);
    expect(companyMaterials.has("timber")).toBe(true);
    expect(companyMaterials.has("metal")).toBe(false);

    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "glass balustrade", subject_domain: "staircase" },
        `seed-glass-${i}`,
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) results.add(url);
    }
    // Metal-inclusive images (metal-only, metal+glass) still rejected —
    // profile is {glass, timber}, metal is not compatible.
    for (const url of results) {
      expect(url).not.toBe(METAL_1.url);
      expect(url).not.toBe(METAL_2.url);
      expect(url).not.toBe(METAL_GLASS_1.url);
    }
  });

  it("timber+glass company accepts timber, glass, or timber+glass images", async () => {
    const companyMaterials = companyProfileOf(
      "Oak staircases with frameless glass balustrades",
    );
    expect(companyMaterials.has("timber")).toBe(true);
    expect(companyMaterials.has("glass")).toBe(true);
    expect(companyMaterials.has("metal")).toBe(false);

    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "oak glass staircase", subject_domain: "staircase" },
        `seed-tg-${i}`,
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) results.add(url);
    }
    // The eligible pool for this profile is the 3 timber + glass +
    // timber-glass · never metal, never metal-glass, never white-bg, never part.
    const allowed = new Set([
      TIMBER_1.url,
      TIMBER_2.url,
      TIMBER_3.url,
      GLASS_1.url,
      TIMBER_GLASS_1.url,
    ]);
    for (const url of results) {
      expect(allowed.has(url)).toBe(true);
    }
  });
});

describe("isImageCompatibleWithCompany direct rules", () => {
  it("empty company profile accepts anything (defensive default)", () => {
    expect(
      isImageCompatibleWithCompany(
        new Set(),
        new Set(["metal", "timber"]),
      ),
    ).toBe(true);
  });

  it("empty image profile accepts any company (generic-scene fallback)", () => {
    expect(
      isImageCompatibleWithCompany(
        new Set(["timber"]),
        new Set(),
      ),
    ).toBe(true);
  });

  it("rejects when image contains a material the company doesn't work with", () => {
    expect(
      isImageCompatibleWithCompany(
        new Set(["timber"]),
        new Set(["metal"]),
      ),
    ).toBe(false);
  });

  it("accepts when image material set is a subset of company's", () => {
    expect(
      isImageCompatibleWithCompany(
        new Set(["timber", "glass"]),
        new Set(["timber"]),
      ),
    ).toBe(true);
    expect(
      isImageCompatibleWithCompany(
        new Set(["timber", "glass"]),
        new Set(["timber", "glass"]),
      ),
    ).toBe(true);
  });
});

// ── 2. Least-used-first distributes reuse evenly ──────────────────

describe("least-used-first distribution", () => {
  it("spreads assignment across the eligible pool before any reuse", async () => {
    // Company profile: any timber. Eligible timber images = 3.
    // Ask the picker 3 times with distinct seedIds and unique-tracking on.
    const companyMaterials = new Set<StaircaseMaterialFamily>(["timber"]);
    const usedCounts = new Map<string, number>();
    const picked: string[] = [];
    for (let i = 0; i < 3; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "timber", subject_domain: "staircase" },
        `seed-${i}`,
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          usedCounts,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) {
        picked.push(url);
        usedCounts.set(url, (usedCounts.get(url) ?? 0) + 1);
      }
    }
    // All three timber images should have been used exactly once — no
    // duplicate before the pool exhausts.
    expect(new Set(picked).size).toBe(3);
  });

  it("distributes forced reuse evenly across the pool (no one image concentrated)", async () => {
    // 6 seeds against a 3-image timber pool → each image assigned 2×.
    const companyMaterials = new Set<StaircaseMaterialFamily>(["timber"]);
    const usedCounts = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "timber", subject_domain: "staircase" },
        `seed-${i}`,
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          usedCounts,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) {
        usedCounts.set(url, (usedCounts.get(url) ?? 0) + 1);
      }
    }
    const counts = [...usedCounts.values()].sort();
    // With 6 seeds / 3 images / even distribution, every image ends at
    // exactly 2. No image should be 3× while another sits at 1.
    expect(counts).toEqual([2, 2, 2]);
  });
});

// ── 3. Rotation salt reshuffles over time ─────────────────────────

describe("rotation salt", () => {
  it("different salts can produce different picks for the same seed", async () => {
    const companyMaterials = new Set<StaircaseMaterialFamily>(["timber"]);
    const seenPerSalt = new Set<string>();
    for (const salt of ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"]) {
      const url = await pickDiverseAPlusImage(
        { text: "timber", subject_domain: "staircase" },
        "stable-seed",
        {
          companyMaterials,
          excludeStaircaseParts: true,
          poolSize: 12,
          rotationSalt: salt,
          manifest: FIXTURE_MANIFEST,
        },
      );
      if (url) seenPerSalt.add(url);
    }
    // Across 4 different day-salts the picker should not be forced onto
    // the same image every time — with 3 eligible timber images we expect
    // >1 distinct pick.
    expect(seenPerSalt.size).toBeGreaterThan(1);
  });
});

// ── 4. v9 filter is locked · parts / white-bg still rejected ──────

describe("v9 reject list is intact", () => {
  it("part/component leak is never returned when excludeStaircaseParts is on", async () => {
    for (let i = 0; i < 30; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "generic staircase", subject_domain: "staircase" },
        `seed-${i}`,
        {
          excludeStaircaseParts: true,
          poolSize: 12,
          manifest: FIXTURE_MANIFEST,
        },
      );
      expect(url).not.toBe(PART_LEAK.url);
    }
  });

  it("white-background / isolated / transparent leak is never returned", async () => {
    for (let i = 0; i < 30; i++) {
      const url = await pickDiverseAPlusImage(
        { text: "generic staircase", subject_domain: "staircase" },
        `seed-${i}`,
        {
          excludeStaircaseParts: true,
          poolSize: 12,
          manifest: FIXTURE_MANIFEST,
        },
      );
      expect(url).not.toBe(WHITE_BG_LEAK.url);
    }
  });
});
