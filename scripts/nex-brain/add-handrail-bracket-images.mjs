// scripts/nex-brain/add-handrail-bracket-images.mjs
//
// Ad-hoc: add the 19 handrail-bracket ImageKit URLs Philip supplied on
// 2026-08-13 to data/nex-image-manifest.json.
//
// Rule A of the intelligence constitution: NEVER fabricate. The extractor
// cannot see these images so per-image "this is a chrome scroll bracket"
// descriptions are OFF LIMITS. Every entry uses the same honest generic
// description and shared tags. Admin retags per specific bracket type via
// /admin/image-tagger.
//
// Safe to re-run: keys are checked before insert, existing entries are left
// intact.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");

const URLS = [
  "https://ik.imagekit.io/5vv5pw26q/dgfg.jpg",
  "https://ik.imagekit.io/5vv5pw26q/yityi.jpg",
  "https://ik.imagekit.io/5vv5pw26q/vbncvn.jpg",
  "https://ik.imagekit.io/5vv5pw26q/bvcncvbn.jpg",
  "https://ik.imagekit.io/5vv5pw26q/fghdfgh.jpg",
  "https://ik.imagekit.io/5vv5pw26q/cgdjgjg.jpg",
  "https://ik.imagekit.io/5vv5pw26q/bvncb.jpg",
  "https://ik.imagekit.io/5vv5pw26q/x8sdaff.jpg",
  "https://ik.imagekit.io/5vv5pw26q/fgdh.jpg",
  "https://ik.imagekit.io/5vv5pw26q/er.jpg",
  "https://ik.imagekit.io/5vv5pw26q/asddcc.jpg",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdsafdsfcvxcv.png?updatedAt=1786449371955",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdsafdsfcv.png?updatedAt=1786449237800",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdsafdsf.png?updatedAt=1786449202393",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdsa.png?updatedAt=1786449138337",
  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadsdds.png?updatedAt=1786449077299",
  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadsd.png?updatedAt=1786449020750",
  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdad.png?updatedAt=1786448977830",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdd.png?updatedAt=1786448908446",
];

const NOW_ISO = new Date().toISOString();

// Shared honest metadata. Descriptions do NOT invent specific bracket types
// (see Rule A). Tags are the union of confirmed subjects — the images
// accompany the handrail brackets article and depict "different types of
// handrail brackets" per Philip's message.
function entryFor(url) {
  return {
    source: "philip_supplied",
    original_prompt: null,
    description:
      "Product image supplied by Philip on 2026-08-13 as one of 19 companion images for the 'Staircase Handrail Brackets' knowledge article. Specific bracket type (standard wall / mopstick / flat / decorative / minimalist / adjustable / post-mounted / glass · and finish · chrome / brushed nickel / stainless / brass / black / powder-coated) awaiting admin tagging via /admin/image-tagger. Companion article: data/nex-reference-brains/staircase-preparation/layer-2-drafts/staircase-handrail-brackets.md",
    master_ai_prompt: null,
    created_at: NOW_ISO,
    created_by: "philip",
    notes:
      "Manually catalogued per ADR-0024 · Image Manifest Rule. Supplied in Philip's 2026-08-13 handrail brackets article. Per-image type/finish tagging pending admin review — never invented.",
    tags: [
      "staircase",
      "handrail",
      "handrail-bracket",
      "bracket",
      "component",
      "hardware",
      "accessory",
      "illustrative",
      "awaiting-admin-retag",
    ],
    a_plus: false,
    subject_domain: "staircase",
  };
}

const raw = readFileSync(MANIFEST_PATH, "utf8");
const manifest = JSON.parse(raw);
if (!manifest.images || typeof manifest.images !== "object") {
  console.error("manifest.images is missing or wrong shape · refusing to write");
  process.exit(1);
}

let added = 0;
let skipped = 0;
for (const url of URLS) {
  if (manifest.images[url]) {
    skipped++;
    continue;
  }
  manifest.images[url] = entryFor(url);
  added++;
}

// Update the top-level metadata so the reader knows when this batch landed.
manifest.updated_at = NOW_ISO;
manifest.last_change = `${added} handrail-bracket image(s) added · ${skipped} already present · 2026-08-13 Philip's handrail brackets article ingestion`;

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(`Manifest: added ${added} new · skipped ${skipped} existing · total URLs in manifest now: ${Object.keys(manifest.images).length}`);
