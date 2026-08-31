// scripts/nexapp/measure-frame-viewport.mjs
//
// NEX HUD · CANONICAL frame viewport MEASURED · Philip 2026-08-27 v2.
//
// v2 (Philip clarification): the content viewport is FULL WIDTH (edge to
// edge of the frame image) and only bounded VERTICALLY by the hero strip
// (top) and the footer/composer strip (bottom). The rail housing + rail
// buttons sit on TOP of the content · content passes BEHIND them.
//
// So we measure:
//   TOP  = the y where the hero strip ends (first row where the FRAME MIDDLE
//          becomes transparent · scanning down from the top)
//   BOTTOM = the y where the footer strip begins (last row where the frame
//          middle is transparent · scanning up from the bottom)
//   LEFT   = 0 (full frame width · content extends behind left bezel silhouette)
//   RIGHT  = 0 (full frame width · content extends behind right rail housing)
//
// "Frame middle" = a small column strip around x = width/2 · this avoids
// the left bezel silhouette and the right rail housing which are opaque
// even in the middle-vertical band.

import sharp from "sharp";
import path from "node:path";

// v10 (Philip 2026-08-28): new locked chassis asset. Frame is IMMUTABLE ·
// content renders inside the transparent alpha region · buttons/silhouette
// overlay on top per NEX MASTER FRAME doctrine.
const FRAME_PATH = path.join(process.cwd(), "public", "nex", "hud-frame-v12.png");

async function main() {
  const img = sharp(FRAME_PATH).ensureAlpha();
  const { width, height, channels } = await img.metadata();
  if (!width || !height) throw new Error("failed to read image metadata");
  const raw = await img.raw().toBuffer();
  const ch = channels ?? 4;

  console.log(`Frame: ${FRAME_PATH}`);
  console.log(`Raster: ${width} × ${height} · aspect ${(width / height).toFixed(4)}`);
  console.log("");

  // Sample the FULL "middle band" from x=20% to x=60% of frame width.
  // This is inside the interior region (skips left bezel silhouette and
  // right rail housing which are opaque). A row is "interior" only if the
  // majority of the middle band is transparent. This detects both the top
  // hero strip AND the bottom footer/composer strip which extend across
  // most of the middle band even though they may leave narrow transparent
  // channels in the middle column.
  const midStart = Math.floor(width * 0.20);
  const midEnd   = Math.floor(width * 0.60);
  const midSpan  = midEnd - midStart + 1;

  const rowIsInterior = new Array(height).fill(false);
  for (let y = 0; y < height; y++) {
    let trans = 0;
    for (let x = midStart; x <= midEnd; x++) {
      const alpha = raw[(y * width + x) * ch + 3];
      if (alpha < 8) trans++;
    }
    rowIsInterior[y] = trans > midSpan * 0.85;   // 85% majority · robust to speaker/notch cutouts
  }

  // Find the LONGEST contiguous run of interior rows · that's the main
  // opening between hero strip and footer strip. Ignores small transparent
  // pockets above/below (speaker cutout, top notch, etc.).
  let topY = -1, bottomY = -1, bestLen = 0;
  let curStart = -1;
  for (let y = 0; y <= height; y++) {
    const isInt = y < height && rowIsInterior[y];
    if (isInt) {
      if (curStart < 0) curStart = y;
    } else {
      if (curStart >= 0) {
        const len = y - curStart;
        if (len > bestLen) { bestLen = len; topY = curStart; bottomY = y - 1; }
        curStart = -1;
      }
    }
  }

  if (topY < 0 || bottomY < 0) {
    console.error("Could not find any interior rows in mid-strip · aborting");
    process.exit(1);
  }

  console.log("=== HERO-TO-FOOTER VERTICAL BOUNDS (measured @ mid column strip) ===");
  console.log(`hero strip ends at y = ${topY}  (top of content viewport)`);
  console.log(`footer strip starts at y = ${bottomY + 1}  (bottom of content viewport)`);
  console.log(`vertical height = ${bottomY - topY + 1} px`);
  console.log("");

  const topPct    = (topY / height) * 100;
  const bottomPct = ((height - 1 - bottomY) / height) * 100;

  console.log("=== VIEWPORT · edge-to-edge width · vertically bounded ===");
  console.log(`  top    · ${topPct.toFixed(2)}%   (= ${topY} px)`);
  console.log(`  bottom · ${bottomPct.toFixed(2)}%   (= ${height - 1 - bottomY} px inset from bottom)`);
  console.log(`  left   · 0%    (full frame width · content behind left bezel silhouette)`);
  console.log(`  right  · 0%    (full frame width · content behind rail housing · buttons overlay on top)`);
  console.log(`  width  · 100%`);
  console.log(`  height · ${(100 - topPct - bottomPct).toFixed(2)}%`);
  console.log("");

  console.log("=== CANONICAL CONSTANTS (paste into geometry.ts NEX_INNER_VIEWPORT) ===");
  console.log(`topPct    : ${topPct.toFixed(2)}`);
  console.log(`bottomPct : ${bottomPct.toFixed(2)}`);
  console.log(`leftPct   : 0`);
  console.log(`rightPct  : 0`);
  console.log(`widthPct  : 100`);
  console.log(`heightPct : ${(100 - topPct - bottomPct).toFixed(2)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
