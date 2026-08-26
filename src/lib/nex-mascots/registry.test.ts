// Registry adapter + recommendation logic tests · 2026-08-27.
//
// We mock BOTH the authoritative NEX_ACTIONS registry AND the augmentation
// manifest so the adapter logic + scoring is verified in isolation.

import { describe, it, expect, vi } from "vitest";

// Mock NEX_ACTIONS · minimal shape matching NexAction type
vi.mock("../nex-actions/registry", () => ({
  NEX_ACTIONS: [
    { id: "nex-love",    tier: "reaction",     section: "react",    mascot: { imageUrl: "https://cdn/love.png",    label: "Love",     expression: "romantic" }, handlerKey: "toggle-reaction", audit: "normal" },
    { id: "nex-laugh",   tier: "reaction",     section: "react",    mascot: { imageUrl: "https://cdn/laugh.png",   label: "Laughing", expression: "laugh"    }, handlerKey: "toggle-reaction", audit: "normal" },
    { id: "nex-boss",    tier: "reaction",     section: "react",    mascot: { imageUrl: "https://cdn/boss.png",    label: "Boss",     expression: "boss"     }, handlerKey: "toggle-reaction", audit: "normal" },
    { id: "weather",     tier: "intelligence", section: "ask-nex",  mascot: { imageUrl: "https://cdn/weather.png", label: "Weather",  expression: "rainy"    }, handlerKey: "weather-post",    audit: "normal" },
    { id: "beach",       tier: "action",       section: "discover", mascot: { imageUrl: "https://cdn/beach.png",   label: "Beach",    expression: "sunny"    }, handlerKey: "find-venue",      audit: "normal" },
    { id: "placeholder", tier: "reaction",     section: "react",    mascot: { imageUrl: "https://ik.imagekit.io/7grri5v7d/mascot-placeholder.png", label: "Placeholder", expression: "generic" }, handlerKey: "toggle-reaction", audit: "normal" },
  ],
}));

// Mock the augmentation manifest
vi.mock("../../../data/nex-mascot-manifest.json", () => ({
  default: {
    version: 1,
    generated: "test",
    mascots: [
      { id: "nex-love",  recommendedThemes: ["pink-metal"], extraTags: ["pink", "cute", "girl-theme"], recommendedTagsMatch: ["pink"], featured: true },
      { id: "nex-boss",  recommendedThemes: ["gold"],       extraTags: ["luxury", "warm"], featured: true },
      { id: "nex-laugh", recommendedThemes: ["titanium"],   extraTags: ["playful"] },
    ],
  },
}));

import { listAll, listAllWithArtwork, findById, listBySection, search, recommendedForTheme, recommendationSplit } from "./registry";

describe("adapter · NEX_ACTIONS → Mascot", () => {
  it("adapts every NEX_ACTIONS row into a Mascot (no filtering)", () => {
    const all = listAll();
    expect(all.length).toBe(6);
    expect(all.map((m) => m.id)).toEqual(["nex-love", "nex-laugh", "nex-boss", "weather", "beach", "placeholder"]);
  });

  it("maps id, name, asset, tier, section, expression from the source row", () => {
    const love = findById("nex-love")!;
    expect(love.name).toBe("Love");
    expect(love.asset).toBe("https://cdn/love.png");
    expect(love.tier).toBe("reaction");
    expect(love.section).toBe("react");
    expect(love.expression).toBe("romantic");
  });

  it("marks placeholder-URL rows as hasArtwork=false, real URLs as true", () => {
    expect(findById("nex-love")!.hasArtwork).toBe(true);
    expect(findById("placeholder")!.hasArtwork).toBe(false);
  });

  it("derives auto-tags from tier + section + expression", () => {
    const love = findById("nex-love")!;
    expect(love.tags).toContain("reaction");
    expect(love.tags).toContain("react");
    expect(love.tags).toContain("romantic");
    expect(love.tags).toContain("love"); // auto-added when expression=romantic
  });

  it("merges augmentation extraTags without duplicating auto-tags", () => {
    const love = findById("nex-love")!;
    expect(love.tags).toContain("pink");     // from augmentation
    expect(love.tags).toContain("cute");     // from augmentation
    expect(love.tags).toContain("romantic"); // auto
    // No duplicates
    expect(new Set(love.tags).size).toBe(love.tags.length);
  });

  it("carries augmentation featured + recommendedThemes flags", () => {
    const love = findById("nex-love")!;
    expect(love.featured).toBe(true);
    expect(love.recommendedThemes).toEqual(["pink-metal"]);
  });

  it("un-augmented rows default to featured=false and no recommendedThemes", () => {
    const weather = findById("weather")!;
    expect(weather.featured).toBe(false);
    expect(weather.recommendedThemes).toBeUndefined();
  });

  it("listAllWithArtwork drops placeholder rows", () => {
    const arts = listAllWithArtwork();
    expect(arts.map((m) => m.id)).not.toContain("placeholder");
    expect(arts.length).toBe(5);
  });
});

describe("search", () => {
  it("empty query returns all mascots (including placeholder)", () => {
    expect(search("").length).toBe(6);
  });
  it("matches by name (case-insensitive)", () => {
    expect(search("boss").map((m) => m.id)).toEqual(["nex-boss"]);
    expect(search("BOSS").map((m) => m.id)).toEqual(["nex-boss"]);
  });
  it("matches by auto-tag (expression)", () => {
    expect(search("romantic").map((m) => m.id)).toEqual(["nex-love"]);
  });
  it("matches by augmentation extraTag", () => {
    expect(search("pink").map((m) => m.id)).toEqual(["nex-love"]);
  });
  it("matches by section", () => {
    const results = search("discover");
    expect(results.map((m) => m.id)).toEqual(["beach"]);
  });
});

describe("recommendedForTheme", () => {
  it("pink-metal · pink tags · nex-love wins (featured + recommendedTheme + tag hits)", () => {
    const ordered = recommendedForTheme("pink-metal", ["pink", "cute"]);
    expect(ordered[0].id).toBe("nex-love");
  });

  it("gold theme · nex-boss wins over pink-love because both featured but boss.recommendedThemes matches", () => {
    const ordered = recommendedForTheme("gold", ["luxury", "warm"]);
    // nex-love: featured (100) · nex-boss: featured (100) + recommendedTheme (50) + luxury+warm hits
    expect(ordered[0].id).toBe("nex-boss");
  });

  it("placeholder mascots sink to the bottom of any ordering", () => {
    const ordered = recommendedForTheme("titanium", ["tech"]);
    expect(ordered[ordered.length - 1].id).toBe("placeholder");
  });

  it("total ordering · every mascot appears exactly once", () => {
    const ordered = recommendedForTheme("pink-metal", ["pink"]);
    expect(ordered.length).toBe(6);
    expect(new Set(ordered.map((m) => m.id)).size).toBe(6);
  });
});

describe("recommendationSplit", () => {
  it("pink-metal · nex-love is Recommended · rest in Browse All", () => {
    const { recommended, browseAll } = recommendationSplit("pink-metal", ["pink", "cute"]);
    expect(recommended.map((m) => m.id)).toContain("nex-love");
    expect(browseAll.map((m) => m.id)).toContain("weather");
    expect(browseAll.map((m) => m.id)).toContain("beach");
  });

  it("placeholder mascot never appears in Recommended · always in Browse All", () => {
    const { recommended, browseAll } = recommendationSplit("titanium", ["tech"]);
    expect(recommended.map((m) => m.id)).not.toContain("placeholder");
    expect(browseAll.map((m) => m.id)).toContain("placeholder");
  });

  it("split is a partition · covers every mascot exactly once", () => {
    const { recommended, browseAll } = recommendationSplit("gold", ["luxury"]);
    const ids = [...recommended.map((m) => m.id), ...browseAll.map((m) => m.id)];
    expect(new Set(ids).size).toBe(6);
    expect(ids.length).toBe(6);
  });

  it("respects maxRecommended cap", () => {
    const { recommended } = recommendationSplit("pink-metal", ["pink"], 1);
    expect(recommended.length).toBe(1);
  });
});

describe("listBySection", () => {
  it("filters correctly", () => {
    expect(listBySection("discover").map((m) => m.id)).toEqual(["beach"]);
    expect(listBySection("ask-nex").map((m) => m.id)).toEqual(["weather"]);
    expect(listBySection("react").length).toBe(4); // nex-love, laugh, boss, placeholder
  });
});
