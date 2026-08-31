// scripts/nexapp/measure-frame-full.mjs
//
// NEX HUD · FULL INNER SCAN · Philip 2026-08-28.
//
// Doctrine: when Philip says "lock images/containers into position" they must
// be locked to the frame's INNER measured geometry — never estimated. This
// script scans the alpha channel of the active frame asset and outputs every
// dimension a developer needs to know how much room they have to work with.
//
// Emits both human-readable console output AND a machine-readable JSON dump
// at data/nex-run-logs/frame-inner-geometry.json for programmatic consumers.
//
// Regions detected:
//   1. Outer PNG bounds + silhouette bounds
//   2. Transparent inner viewport (hero → footer main opening) · MEASURED
//   3. Per-row transparent width across the whole height · shows where bezel
//      silhouette narrows / widens the usable interior
//   4. Header band (top opaque area · above the interior)
//   5. Footer band (bottom opaque area · below the interior)
//   6. Left bezel silhouette bounds (the opaque frame on left edge)
//   7. Right rail housing bounds (the opaque frame on right edge)
//   8. Narrowest / widest inner content strip
//   9. Top wordmark plate (opaque box top-left, if distinct)
//  10. Top header icon plates (opaque boxes top-right)

import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Toggle target frame via env: FRAME_VARIANT=norail node scripts/nexapp/measure-frame-full.mjs
const FRAME_NAME = process.env.FRAME_VARIANT === "norail"
  ? "hud-frame-v12-norail.png"
  : "hud-frame-v12.png";
const FRAME = path.join(process.cwd(), "public", "nex", FRAME_NAME);
const OUT_JSON = path.join(process.cwd(), "data", "nex-run-logs", "frame-inner-geometry.json");
const OPAQUE_ALPHA_THRESHOLD = 60;

async function main() {
  const meta = await sharp(FRAME).metadata();
  const width = meta.width, height = meta.height;
  const raw = await sharp(FRAME).ensureAlpha().raw().toBuffer();
  const alphaAt = (x, y) => raw[(y * width + x) * 4 + 3];
  const isOpaque = (x, y) => alphaAt(x, y) >= OPAQUE_ALPHA_THRESHOLD;
  const isTransparent = (x, y) => alphaAt(x, y) < OPAQUE_ALPHA_THRESHOLD;

  const pct = (n, total) => ((n / total) * 100).toFixed(2);

  // ── 1. Silhouette bounds ──────────────────────────────────────────────
  let sMinX = width, sMaxX = -1, sMinY = height, sMaxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isOpaque(x, y)) {
        if (x < sMinX) sMinX = x;
        if (x > sMaxX) sMaxX = x;
        if (y < sMinY) sMinY = y;
        if (y > sMaxY) sMaxY = y;
      }
    }
  }
  const silhouette = { minX: sMinX, maxX: sMaxX, minY: sMinY, maxY: sMaxY };

  // ── 2. Per-row transparent range (interior width per y) ───────────────
  // For each y, find [firstTransparentX .. lastTransparentX]. Rows with no
  // transparent pixel are fully opaque bands (header/footer).
  const rowRanges = new Array(height);
  let rowFullyOpaqueCount = 0;
  for (let y = 0; y < height; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < width; x++) {
      if (isTransparent(x, y)) { l = x; break; }
    }
    if (l >= 0) {
      for (let x = width - 1; x >= 0; x--) {
        if (isTransparent(x, y)) { r = x; break; }
      }
    }
    if (l < 0) { rowRanges[y] = null; rowFullyOpaqueCount++; }
    else rowRanges[y] = { l, r, wPx: r - l + 1 };
  }

  // ── 3. Longest contiguous run of interior rows (the main viewport) ────
  // "Interior" here = row that has >= 60% of its middle 20-60% band transparent.
  const midStart = Math.floor(width * 0.20);
  const midEnd = Math.floor(width * 0.60);
  const midSpan = midEnd - midStart + 1;
  const rowIsInterior = new Array(height).fill(false);
  for (let y = 0; y < height; y++) {
    let t = 0;
    for (let x = midStart; x <= midEnd; x++) if (isTransparent(x, y)) t++;
    rowIsInterior[y] = t > midSpan * 0.85;
  }
  let vpTopY = -1, vpBottomY = -1, bestLen = 0, curStart = -1;
  for (let y = 0; y <= height; y++) {
    const isInt = y < height && rowIsInterior[y];
    if (isInt) { if (curStart < 0) curStart = y; }
    else {
      if (curStart >= 0) {
        const len = y - curStart;
        if (len > bestLen) { bestLen = len; vpTopY = curStart; vpBottomY = y - 1; }
        curStart = -1;
      }
    }
  }
  const viewport = {
    topY: vpTopY,
    bottomY: vpBottomY,
    heightPx: vpBottomY - vpTopY + 1,
    topPct: pct(vpTopY, height),
    bottomPct: pct(height - 1 - vpBottomY, height),
    heightPct: pct(vpBottomY - vpTopY + 1, height),
  };

  // ── 4. Header band (opaque strip above viewport, y = 0 .. viewport.topY-1) ──
  const header = { topY: 0, bottomY: vpTopY - 1, heightPx: vpTopY, heightPct: pct(vpTopY, height) };
  // ── 5. Footer band (opaque strip below viewport, y = viewport.bottomY+1 .. height-1) ──
  const footer = { topY: vpBottomY + 1, bottomY: height - 1, heightPx: height - vpBottomY - 1, heightPct: pct(height - vpBottomY - 1, height) };

  // ── 6. Left bezel silhouette · scan INSIDE viewport rows only. Bezel is the
  //    opaque strip from x=0 to the first-transparent x for each row. Find MAX
  //    such x across the viewport rows = widest point of the left bezel intrusion.
  let leftBezelMaxX = 0;
  for (let y = vpTopY; y <= vpBottomY; y++) {
    const r = rowRanges[y];
    if (r && r.l > leftBezelMaxX) leftBezelMaxX = r.l;
  }
  const leftBezel = {
    maxX: leftBezelMaxX,
    maxPct: pct(leftBezelMaxX, width),
    maxIntrusionPx: leftBezelMaxX,
  };

  // ── 7. Right rail housing · scan INSIDE viewport rows. Rail is the opaque
  //    strip from lastTransparentX+1 to width-1 for each row. Find MIN of that
  //    lastTransparentX across viewport rows = narrowest point where rail eats
  //    the most interior. Report the rail leftEdge = min(r) so we know the
  //    RIGHT-MOST safe x for content.
  let railMinR = width - 1;
  for (let y = vpTopY; y <= vpBottomY; y++) {
    const r = rowRanges[y];
    if (r && r.r < railMinR) railMinR = r.r;
  }
  const rightRail = {
    innerEdgeMinX: railMinR,
    widthPx: width - 1 - railMinR,
    widthPct: pct(width - 1 - railMinR, width),
    // Right-inset % = 100 - (railMinR / width) * 100
    rightInsetPct: pct(width - 1 - railMinR, width),
  };

  // ── 8. Narrowest / widest inner strip within viewport ─────────────────
  let narrowestW = Infinity, widestW = 0;
  let narrowestY = -1, widestY = -1;
  for (let y = vpTopY; y <= vpBottomY; y++) {
    const r = rowRanges[y];
    if (!r) continue;
    if (r.wPx < narrowestW) { narrowestW = r.wPx; narrowestY = y; }
    if (r.wPx > widestW) { widestW = r.wPx; widestY = y; }
  }
  const innerStrip = {
    widestPx: widestW,
    widestPct: pct(widestW, width),
    widestY,
    narrowestPx: narrowestW,
    narrowestPct: pct(narrowestW, width),
    narrowestY,
  };

  // ── 9. Wordmark plate detection (top-left opaque region, within header band)
  //    Find opaque contiguous region touching (0,0) in the header band.
  //    Report bounding box.
  const wordmark = detectRegionBBox(raw, width, height, 0, 0, vpTopY - 1, isOpaque);
  const wordmarkPlate = wordmark ? {
    x: wordmark.minX, y: wordmark.minY,
    w: wordmark.maxX - wordmark.minX + 1,
    h: wordmark.maxY - wordmark.minY + 1,
    leftPct: pct(wordmark.minX, width),
    topPct: pct(wordmark.minY, height),
    widthPct: pct(wordmark.maxX - wordmark.minX + 1, width),
    heightPct: pct(wordmark.maxY - wordmark.minY + 1, height),
  } : null;

  // ── 10. Header icon plates (top-right opaque region) ──────────────────
  //    Find opaque region touching (width-1, 0) in the header band.
  const headerRight = detectRegionBBox(raw, width, height, width - 1, 0, vpTopY - 1, isOpaque);
  const headerIconPlates = headerRight ? {
    x: headerRight.minX, y: headerRight.minY,
    w: headerRight.maxX - headerRight.minX + 1,
    h: headerRight.maxY - headerRight.minY + 1,
    leftPct: pct(headerRight.minX, width),
    topPct: pct(headerRight.minY, height),
    widthPct: pct(headerRight.maxX - headerRight.minX + 1, width),
    heightPct: pct(headerRight.maxY - headerRight.minY + 1, height),
    rightInsetPct: pct(width - 1 - headerRight.maxX, width),
  } : null;

  // ── OUTPUT ────────────────────────────────────────────────────────────
  console.log(`╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  NEX FRAME · FULL INNER SCAN                                         ║`);
  console.log(`║  ${FRAME.padEnd(66)}║`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝`);
  console.log(``);
  console.log(`RASTER              ${width} × ${height}   aspect ${(width / height).toFixed(4)}`);
  console.log(`SILHOUETTE          x [${silhouette.minX}..${silhouette.maxX}]  y [${silhouette.minY}..${silhouette.maxY}]`);
  console.log(``);
  console.log(`── VIEWPORT (transparent inner opening) ────────────────────────────────`);
  console.log(`  y range        ${viewport.topY} .. ${viewport.bottomY}   (${viewport.heightPx} px tall)`);
  console.log(`  top inset      ${viewport.topPct}%   (header band above)`);
  console.log(`  bottom inset   ${viewport.bottomPct}%   (footer band below)`);
  console.log(`  height         ${viewport.heightPct}%`);
  console.log(``);
  console.log(`── HEADER BAND (opaque frame above viewport) ───────────────────────────`);
  console.log(`  y range        ${header.topY} .. ${header.bottomY}   (${header.heightPx} px · ${header.heightPct}%)`);
  console.log(``);
  console.log(`── FOOTER BAND (opaque frame below viewport) ───────────────────────────`);
  console.log(`  y range        ${footer.topY} .. ${footer.bottomY}   (${footer.heightPx} px · ${footer.heightPct}%)`);
  console.log(``);
  console.log(`── LEFT BEZEL SILHOUETTE (opaque intrusion into viewport) ──────────────`);
  console.log(`  max intrusion  ${leftBezel.maxIntrusionPx} px into interior  (${leftBezel.maxPct}%)`);
  console.log(`  → content starting from x < ${leftBezel.maxIntrusionPx} px WILL BE HIDDEN behind bezel`);
  console.log(``);
  console.log(`── RIGHT RAIL HOUSING (opaque intrusion into viewport) ─────────────────`);
  console.log(`  inner edge x   ${rightRail.innerEdgeMinX} px   (rail eats ${rightRail.widthPx} px = ${rightRail.widthPct}%)`);
  console.log(`  → content extending past x > ${rightRail.innerEdgeMinX} px WILL BE HIDDEN behind rail`);
  console.log(``);
  console.log(`── INNER CONTENT STRIP (what fits between bezel and rail) ──────────────`);
  console.log(`  widest         ${innerStrip.widestPx} px = ${innerStrip.widestPct}% (at y=${innerStrip.widestY})`);
  console.log(`  narrowest      ${innerStrip.narrowestPx} px = ${innerStrip.narrowestPct}% (at y=${innerStrip.narrowestY})`);
  console.log(``);
  if (wordmarkPlate) {
    console.log(`── WORDMARK PLATE (top-left header artwork) ────────────────────────────`);
    console.log(`  bounds         x=${wordmarkPlate.x}..${wordmarkPlate.x + wordmarkPlate.w - 1} y=${wordmarkPlate.y}..${wordmarkPlate.y + wordmarkPlate.h - 1}`);
    console.log(`  css            top: ${wordmarkPlate.topPct}%  left: ${wordmarkPlate.leftPct}%  width: ${wordmarkPlate.widthPct}%  height: ${wordmarkPlate.heightPct}%`);
    console.log(``);
  }
  if (headerIconPlates) {
    console.log(`── HEADER ICON PLATES (top-right header artwork) ───────────────────────`);
    console.log(`  bounds         x=${headerIconPlates.x}..${headerIconPlates.x + headerIconPlates.w - 1} y=${headerIconPlates.y}..${headerIconPlates.y + headerIconPlates.h - 1}`);
    console.log(`  css            top: ${headerIconPlates.topPct}%  right: ${headerIconPlates.rightInsetPct}%  width: ${headerIconPlates.widthPct}%  height: ${headerIconPlates.heightPct}%`);
    console.log(``);
  }
  console.log(`── CANONICAL CONSTANTS (for geometry.ts) ───────────────────────────────`);
  console.log(`  NEX_INNER_VIEWPORT.topPct    = ${viewport.topPct}`);
  console.log(`  NEX_INNER_VIEWPORT.bottomPct = ${viewport.bottomPct}`);
  console.log(`  NEX_INNER_VIEWPORT.heightPct = ${viewport.heightPct}`);
  console.log(``);
  console.log(`  DEFAULT_ZONES.workspace.left  = ${leftBezel.maxPct}%   (clear of left bezel)`);
  console.log(`  DEFAULT_ZONES.workspace.width = ${(100 - Number(leftBezel.maxPct) - Number(rightRail.rightInsetPct)).toFixed(2)}%`);
  console.log(`  DEFAULT_ZONES.side.right      = 0%   (rail already opaque frame · buttons ON TOP)`);
  console.log(`  DEFAULT_ZONES.side.width      = ${rightRail.widthPct}%`);
  console.log(``);

  // Machine-readable JSON.
  const json = {
    scannedAt: new Date().toISOString(),
    frame: FRAME,
    raster: { width, height, aspect: width / height },
    silhouette,
    viewport,
    header,
    footer,
    leftBezel,
    rightRail,
    innerStrip,
    wordmarkPlate,
    headerIconPlates,
  };
  mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(json, null, 2));
  console.log(`JSON written → ${OUT_JSON}`);
}

/** Iterative flood-fill BBox of the opaque region containing (seedX, seedY), constrained to y <= maxY. */
function detectRegionBBox(raw, width, height, seedX, seedY, maxY, isOpaqueFn) {
  if (!isOpaqueFn(seedX, seedY)) return null;
  const visited = new Uint8Array(width * (maxY + 1));
  const stack = [[seedX, seedY]];
  let minX = seedX, maxX = seedX, minY = seedY, maxBBoxY = seedY;
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y > maxY) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    if (!isOpaqueFn(x, y)) continue;
    visited[idx] = 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxBBoxY) maxBBoxY = y;
    stack.push([x + 1, y]); stack.push([x - 1, y]);
    stack.push([x, y + 1]); stack.push([x, y - 1]);
  }
  return { minX, maxX, minY, maxY: maxBBoxY };
}

main().catch((e) => { console.error(e); process.exit(1); });
