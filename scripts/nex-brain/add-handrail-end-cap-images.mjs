// scripts/nex-brain/add-handrail-end-cap-images.mjs
//
// Ad-hoc: add the 19 handrail-end-cap ImageKit URLs Philip supplied on
// 2026-08-13 to data/nex-image-manifest.json.
//
// Rule A of the intelligence constitution: NEVER fabricate. The extractor
// cannot see these images, so per-image "this is a brass volute cap"
// descriptions are OFF LIMITS. Every entry uses the same honest generic
// description and shared tags. Admin retags per specific cap type via
// /admin/image-tagger.
//
// Safe to re-run: keys are checked before insert, existing entries are left
// intact.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");

const URLS = [
  "https://ik.imagekit.io/5vv5pw26q/terterte.jpg",
  "https://ik.imagekit.io/5vv5pw26q/34234.jpg",
  "https://ik.imagekit.io/5vv5pw26q/vxcv.jpg",
  "https://ik.imagekit.io/5vv5pw26q/cvbcb.jpg",
  "https://ik.imagekit.io/5vv5pw26q/terrtert.jpg",
  "https://ik.imagekit.io/5vv5pw26q/ewrew.jpg",
  "https://ik.imagekit.io/5vv5pw26q/rtert.jpg",
  "https://ik.imagekit.io/5vv5pw26q/nbvn.jpg",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsfsdfsdfsdffffsdd-removebg-preview.png?updatedAt=1786538644255",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsfsdfsdfsdffffsd-removebg-preview.png?updatedAt=1786538578062",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsfsdfsdfsdffff-removebg-preview.png?updatedAt=1786538489541",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsfsdfsdfsdff-removebg-preview.png?updatedAt=1786538413957",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsfsdfsdfsdf-removebg-preview.png?updatedAt=1786538357251",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsfsdfsdf-removebg-preview.png?updatedAt=1786538294010",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsfsdf-removebg-preview.png?updatedAt=1786538228655",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdfdsf-removebg-preview.png?updatedAt=1786538168372",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsfsdfsdf-removebg-preview.png?updatedAt=1786538096836",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsf-removebg-preview.png?updatedAt=1786538042791",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdsddsddsdsdasdadsddfsdfcvcvcvcvfdssdfsdfsf-removebg-preview.png?updatedAt=1786537962501",
];

const NOW_ISO = new Date().toISOString();

function entryFor() {
  return {
    source: "philip_supplied",
    original_prompt: null,
    description:
      "Product image supplied by Philip on 2026-08-13 as one of 19 companion images for the 'Staircase Handrail End Caps' knowledge article. Specific end-cap type (plain timber / return-to-wall / volute / metal / stainless steel / brass / plastic-polymer) and finish (polished / satin / brushed / mirror / stained / oiled / lacquered / painted) awaiting admin tagging via /admin/image-tagger. Companion article: data/nex-reference-brains/staircase-preparation/layer-2-drafts/staircase-handrail-end-caps.md",
    master_ai_prompt: null,
    created_at: NOW_ISO,
    created_by: "philip",
    notes:
      "Manually catalogued per ADR-0024 · Image Manifest Rule. Supplied in Philip's 2026-08-13 handrail end caps article. Per-image type/finish tagging pending admin review — never invented.",
    tags: [
      "staircase",
      "handrail",
      "handrail-end-cap",
      "handrail-fitting",
      "end-cap",
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
  manifest.images[url] = entryFor();
  added++;
}

manifest.updated_at = NOW_ISO;
manifest.last_change = `${added} handrail-end-cap image(s) added · ${skipped} already present · 2026-08-13 Philip's handrail end caps article ingestion`;

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(`Manifest: added ${added} new · skipped ${skipped} existing · total URLs in manifest now: ${Object.keys(manifest.images).length}`);
