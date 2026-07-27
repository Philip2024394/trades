#!/usr/bin/env node
// scripts/wire-nex-modern-series-family-tree.mjs
//
// Wires family_tree parent/children relationships across the 4 NEX
// Modern Series product families (Rule #14 · ADR-0027 v1.2).
// Direct manifest edit — save endpoint doesn't set these because
// parent/child topology is a batch-level concern, not per-row.

import { promises as fs } from "node:fs";
import path from "node:path";

const MANIFEST_PATH = path.join(process.cwd(), "data", "nex-image-manifest.json");

const FAMILIES = [
  {
    product: "NEX Modern Mahogany & Brushed Stainless Steel Staircase",
    primary: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2005_15_47%20PM.png",
    variants: [],
  },
  {
    product: "NEX Modern Oak & Brushed Stainless Steel Staircase",
    primary: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_42_40%20PM.png",
    variants: [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_38_29%20PM.png",
    ],
  },
  {
    product: "NEX Modern Walnut & Brushed Stainless Steel Staircase",
    primary: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2009_41_43%20PM.png",
    variants: [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_32_58%20PM.png",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdfdsfdfsdasd.png",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_49_14%20PM.png",
    ],
  },
  {
    product: "NEX Modern Black Matte Staircase with Brushed Stainless Steel",
    primary: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_58_04%20PM.png",
    variants: [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_55_32%20PM.png",
    ],
  },
];

const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));

for (const family of FAMILIES) {
  const parent = manifest.images[family.primary];
  if (!parent) {
    console.log(`  SKIP ${family.product}: primary URL not in manifest`);
    continue;
  }
  // Parent row — children array populated with all variants
  parent.family_tree = {
    parent_url: undefined,
    children: family.variants.map((url) => ({
      type: "product_shot",
      url,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: `Variant angle of ${family.product}`,
    })),
  };
  // Variant rows — parent_url points to primary
  for (const variantUrl of family.variants) {
    const variant = manifest.images[variantUrl];
    if (!variant) continue;
    variant.family_tree = {
      parent_url: family.primary,
      children: [],
    };
  }
  console.log(`  ✓ ${family.product}: linked ${family.variants.length} variant(s) to primary`);
}

manifest.generated_at = new Date().toISOString();
await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
console.log("\nFamily tree relationships wired. Rule #14 satisfied.");
