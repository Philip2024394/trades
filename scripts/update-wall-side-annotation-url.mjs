#!/usr/bin/env node
// scripts/update-wall-side-annotation-url.mjs
//
// The ✗ character overlay produced by ImageKit rendered as index letters
// (font glyph missing). Replace the annotated_url reference in the
// wall-side anti-pattern manifest row with a "NOT PRACTICAL" red-badge
// overlay that uses plain ASCII text.

import fs from "node:fs/promises";
import path from "node:path";

const URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2007_29_13%20PM.png";
const NEW_ANNOTATED =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2007_29_13%20PM.png?tr=l-text,i-NOT%20PRACTICAL,fs-140,co-FFFFFF,ff-Arial-Black,pa-24,bg-CC0000,l-end";

const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const row = manifest.images[URL];
if (!row) {
  console.error("Wall-side anti-pattern row not found in manifest.");
  process.exit(1);
}

row.notes =
  "ANTI-PATTERN reference · wall-side balusters + door-frame proximity · used in customer-education article · annotated version with NOT PRACTICAL red badge at " +
  NEW_ANNOTATED;

if (row.description) {
  row.description = row.description.replace(
    /Annotated Version \(red ✗ overlay via ImageKit\):\r?\n[^\r\n]+/,
    "Annotated Version (NOT PRACTICAL red badge via ImageKit):\n" + NEW_ANNOTATED
  );
}

manifest.generated_at = new Date().toISOString();
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log("Wall-side annotated_url updated.");
console.log("New URL:", NEW_ANNOTATED);
