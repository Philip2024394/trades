// scripts/nexapp/preview-rail-housings.mjs
//
// Philip 2026-08-29 · Path A rail-illumination visual confirmation.
//
// Renders the five PROPOSED rail-housing accent regions as coloured
// overlay rectangles + labels on top of the master frame asset:
//
//   input : public/nex/hud-frame-v12.png            (untouched · read only)
//   output: public/nex/hud-frame-v12-rail-housing-preview.png
//
// One-off dev script. Sibling of measure-frame-accents.mjs. Does not
// touch any production code, does not modify the master PNG, does not
// commit anything to NEX_BRAND_ACCENT_REGIONS. The output PNG lets
// Philip visually verify that each numbered rectangle sits exactly
// over the intended illuminated housing before the measurements are
// committed for real.
//
// Delete the output PNG after confirmation · or keep as a QA artifact.

import sharp from "sharp";
import path from "node:path";
import { Buffer } from "node:buffer";

const INPUT_PATH  = path.join(process.cwd(), "public", "nex", "hud-frame-v12.png");
const OUTPUT_PATH = path.join(process.cwd(), "public", "nex", "hud-frame-v12-rail-housing-preview.png");

// Proposed rail-housing rectangles · pixel coordinates in the source frame
// (941 × 1672). Derived from the flood-fill in measure-frame-accents.mjs
// (see the audit report to Philip 2026-08-29).
const HOUSINGS = [
  { id: 1, x1: 797, y1: 434,  x2: 918, y2: 564  },
  { id: 2, x1: 797, y1: 596,  x2: 918, y2: 731  },
  { id: 3, x1: 797, y1: 764,  x2: 918, y2: 898  },
  { id: 4, x1: 797, y1: 930,  x2: 918, y2: 1062 },
  { id: 5, x1: 797, y1: 1099, x2: 918, y2: 1233 },
];

async function main() {
  const meta = await sharp(INPUT_PATH).metadata();
  const width  = meta.width;
  const height = meta.height;
  if (!width || !height) throw new Error("Could not read PNG metadata");

  console.log(`Source: ${width} × ${height} · ${INPUT_PATH}`);

  // Compose overlay as a single SVG so all five rectangles + labels
  // render in one composite pass over the source PNG.
  const strokeCyan = "#00e5ff";
  const fillCyan   = "rgba(0, 229, 255, 0.15)";
  const labelBg    = "rgba(0, 0, 0, 0.75)";
  const labelFg    = "#ffffff";

  const rects = HOUSINGS.map((h) => {
    const w = h.x2 - h.x1 + 1;
    const hgt = h.y2 - h.y1 + 1;
    // Label placed slightly LEFT of the housing so it doesn't obscure the
    // orange illumination inside the rect. 44px circle · number centred.
    const labelCx = h.x1 - 34;
    const labelCy = h.y1 + hgt / 2;
    return `
      <rect
        x="${h.x1}" y="${h.y1}" width="${w}" height="${hgt}"
        fill="${fillCyan}" stroke="${strokeCyan}" stroke-width="4"
      />
      <circle
        cx="${labelCx}" cy="${labelCy}" r="26"
        fill="${labelBg}" stroke="${strokeCyan}" stroke-width="3"
      />
      <text
        x="${labelCx}" y="${labelCy + 12}"
        text-anchor="middle" font-family="sans-serif"
        font-size="32" font-weight="700" fill="${labelFg}"
      >${h.id}</text>`;
  }).join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${rects}
</svg>`;

  await sharp(INPUT_PATH)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(OUTPUT_PATH);

  console.log(`Wrote: ${OUTPUT_PATH}`);
  console.log("");
  console.log("Open the output PNG and visually verify:");
  console.log("  · each numbered rectangle sits over the intended illuminated housing");
  console.log("  · labels 1-5 read top-to-bottom");
  console.log("  · no rectangle covers non-housing artwork (chrome, kebab, footer)");
}

main().catch((e) => { console.error(e); process.exit(1); });
