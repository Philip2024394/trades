// scripts/nexapp/measure-master-frame.mjs
//
// Stage 3.43 · master-frame pixel scan (Philip 2026-09-01).
//
// Scans hud-frame-master.png alpha channel and reports the true
// four-sided transparent interior rectangle (top/bottom/left/right
// insets AND width/height %), so we can update geometry.ts +
// content padding to fit inside the new bezel with a small safe
// margin per Philip's request.

import sharp from "sharp";
import path from "node:path";

const FRAME_PATH = path.join(process.cwd(), "public", "nex", "hud-frame-master.png");

async function main() {
  const img = sharp(FRAME_PATH).ensureAlpha();
  const { width, height, channels } = await img.metadata();
  if (!width || !height) throw new Error("failed to read image metadata");
  const raw = await img.raw().toBuffer();
  const ch = channels ?? 4;
  const ALPHA_MAX = 8;   // treat as "transparent" below this
  const ALPHA_MIN = 200; // treat as "opaque bezel" above this

  console.log(`Frame:  ${FRAME_PATH}`);
  console.log(`Raster: ${width} × ${height} · aspect ${(width / height).toFixed(4)}`);
  console.log("");

  // ─── 1. Vertical bounds (hero strip end, footer strip start) ─────
  // Same technique as measure-frame-viewport.mjs: sample the middle
  // horizontal band and find the LONGEST contiguous run of "interior"
  // rows (>85% transparent in the sampled column).
  const midX0 = Math.floor(width * 0.25);
  const midX1 = Math.floor(width * 0.75);
  const midSpan = midX1 - midX0 + 1;

  const rowIsInterior = new Array(height).fill(false);
  for (let y = 0; y < height; y++) {
    let trans = 0;
    for (let x = midX0; x <= midX1; x++) {
      const alpha = raw[(y * width + x) * ch + 3];
      if (alpha < ALPHA_MAX) trans++;
    }
    rowIsInterior[y] = trans > midSpan * 0.85;
  }

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
  if (topY < 0) { console.error("no interior rows"); process.exit(1); }

  // ─── 2. Horizontal bounds (left bezel end, right bezel start) ───
  // Sample the middle VERTICAL band of the interior height (which we
  // just found) and find the LONGEST contiguous run of "interior"
  // columns.
  const midY0 = topY + Math.floor((bottomY - topY) * 0.35);
  const midY1 = topY + Math.floor((bottomY - topY) * 0.65);
  const midVSpan = midY1 - midY0 + 1;

  const colIsInterior = new Array(width).fill(false);
  for (let x = 0; x < width; x++) {
    let trans = 0;
    for (let y = midY0; y <= midY1; y++) {
      const alpha = raw[(y * width + x) * ch + 3];
      if (alpha < ALPHA_MAX) trans++;
    }
    colIsInterior[x] = trans > midVSpan * 0.85;
  }

  let leftX = -1, rightX = -1, bestColRun = 0;
  let colCurStart = -1;
  for (let x = 0; x <= width; x++) {
    const isInt = x < width && colIsInterior[x];
    if (isInt) {
      if (colCurStart < 0) colCurStart = x;
    } else {
      if (colCurStart >= 0) {
        const len = x - colCurStart;
        if (len > bestColRun) { bestColRun = len; leftX = colCurStart; rightX = x - 1; }
        colCurStart = -1;
      }
    }
  }
  if (leftX < 0) { console.error("no interior columns"); process.exit(1); }

  // ─── 3. Report ──────────────────────────────────────────────────
  const topPct     = (topY / height) * 100;
  const bottomPct  = ((height - 1 - bottomY) / height) * 100;
  const leftPct    = (leftX / width) * 100;
  const rightPct   = ((width - 1 - rightX) / width) * 100;
  const widthPct   = 100 - leftPct - rightPct;
  const heightPct  = 100 - topPct - bottomPct;

  console.log("=== TRUE TRANSPARENT INTERIOR RECT (four-sided) ===");
  console.log(`  top    : y=${topY}      → ${topPct.toFixed(2)}% inset from top`);
  console.log(`  bottom : y=${bottomY}    → ${bottomPct.toFixed(2)}% inset from bottom`);
  console.log(`  left   : x=${leftX}      → ${leftPct.toFixed(2)}% inset from left`);
  console.log(`  right  : x=${rightX}     → ${rightPct.toFixed(2)}% inset from right`);
  console.log(`  width  : ${rightX - leftX + 1}px → ${widthPct.toFixed(2)}% of frame`);
  console.log(`  height : ${bottomY - topY + 1}px → ${heightPct.toFixed(2)}% of frame`);
  console.log("");

  console.log("=== CANONICAL CONSTANTS FOR geometry.ts ===");
  console.log(`{`);
  console.log(`  topPct    : ${topPct.toFixed(2)},`);
  console.log(`  bottomPct : ${bottomPct.toFixed(2)},`);
  console.log(`  leftPct   : ${leftPct.toFixed(2)},`);
  console.log(`  rightPct  : ${rightPct.toFixed(2)},`);
  console.log(`  widthPct  : ${widthPct.toFixed(2)},`);
  console.log(`  heightPct : ${heightPct.toFixed(2)},`);
  console.log(`}`);
  console.log("");

  // Suggested content zone with a small safe padding INSIDE the
  // transparent interior (Philip's ask: "little back from transparent
  // edge"). 8-12px equivalent · at 407-wide frame that's ~2-3% inset.
  const safePad = 2.5; // % inset from each edge inside the transparent region
  console.log(`=== SUGGESTED CONTENT ZONE (${safePad}% safe padding inside transparent interior) ===`);
  console.log(`  top    : ${(topPct + safePad).toFixed(2)}%`);
  console.log(`  left   : ${(leftPct + safePad).toFixed(2)}%`);
  console.log(`  width  : ${(widthPct - safePad * 2).toFixed(2)}%`);
  console.log(`  height : ${(heightPct - safePad * 2).toFixed(2)}%`);
}
main().catch((e) => { console.error(e); process.exit(1); });
