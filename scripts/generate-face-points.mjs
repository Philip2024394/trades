#!/usr/bin/env node
// scripts/generate-face-points.mjs
//
// Founder Phase 32 · P32-6b · Build-time face-point extraction.
//
// ────────────────────────────────────────────────────────────────────
// The reference image is used HERE and NOWHERE ELSE. At runtime, the
// browser never loads this PNG. The output of this script — a point-
// cloud JSON — is the only thing the renderer sees.
// ────────────────────────────────────────────────────────────────────
//
// Pipeline:
//   1. Download the reference PNG (once) into scripts/_cache/
//   2. Decode with sharp → raw RGBA buffer
//   3. Score every pixel by "cyan-ness" (low R, high G, high B, bright)
//   4. Poisson-ish grid-sample so we get a well-distributed cloud
//   5. Assign each point a depth z via a facial-curvature function
//      (forehead + cheeks intermediate · nose forward · eye sockets
//       and mouth recessed · sides + ears back)
//   6. Assign each point a shimmer phase + brightness
//   7. Write public/nex/face-points.json for the runtime renderer
//   8. Also write public/nex/face-contour.json (head outline traced
//      from the outermost cyan pixels · used to draw the vector
//      contour without any raster reference)
//
// The output JSON is committed to public/nex/ so `next dev` and prod
// both serve it as a static asset. Runtime only fetches JSON.

import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { get as httpsGet } from "node:https";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { PNG } = require("pngjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CACHE_DIR = join(__dirname, "_cache");
const OUT_DIR = join(REPO_ROOT, "public", "nex");
const REFERENCE_URL =
  "https://ik.imagekit.io/ctlxgvqcm/Untitledwqweqwe.png";
// New file name so we don't reuse the old cached reference.
const CACHE_PATH = join(CACHE_DIR, "nex-face-reference-v2.png");

// Target output density · higher-detail reference so we can raise this.
const TARGET_POINTS = 40000;
// Resample the source to this square resolution for fast pixel work.
const WORK_SIZE = 768;

// ═══════════════════════════════════════════════════════════════════
// 1. Download reference (cached)
// ═══════════════════════════════════════════════════════════════════
async function ensureReference() {
  if (existsSync(CACHE_PATH)) return CACHE_PATH;
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log("· downloading reference …");
  await new Promise((resolve, reject) => {
    httpsGet(REFERENCE_URL, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        writeFileSync(CACHE_PATH, Buffer.concat(chunks));
        resolve();
      });
      res.on("error", reject);
    }).on("error", reject);
  });
  return CACHE_PATH;
}

// ═══════════════════════════════════════════════════════════════════
// 2 · Decode + resize to a manageable working buffer
// ═══════════════════════════════════════════════════════════════════
async function loadWorkBuffer(srcPath) {
  console.log("· decoding + resizing to", WORK_SIZE, "px");
  const pngBuf = await sharp(srcPath)
    .resize(WORK_SIZE, WORK_SIZE, { fit: "cover" })
    .png()
    .toBuffer();
  const png = PNG.sync.read(pngBuf);
  return { data: png.data, width: png.width, height: png.height };
}

// ═══════════════════════════════════════════════════════════════════
// 3 · Score every pixel by "cyan-ness"
// ═══════════════════════════════════════════════════════════════════
function computeCyanScore(rgba, i) {
  const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
  // Cyan: low red, high green, high blue, both G and B close.
  // Also weight by overall brightness so we favour the bright dots.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const cyanBias = (g + b) - r * 2;             // pushes back reds
  const gbBalance = 255 - Math.abs(g - b);       // reward when G≈B
  const raw = 0.35 * luma + 0.5 * cyanBias + 0.15 * gbBalance;
  // Normalise 0..1
  return Math.max(0, Math.min(1, raw / 300));
}

// ═══════════════════════════════════════════════════════════════════
// 4 · Sample points on a Poisson-ish grid biased by cyan score
// ═══════════════════════════════════════════════════════════════════
function samplePoints({ data, width, height }, targetCount) {
  console.log("· sampling points…");
  // Grid size that produces ~ targetCount cells
  const gridN = Math.ceil(Math.sqrt(targetCount));
  const cell = width / gridN;
  const points = [];
  for (let gy = 0; gy < gridN; gy++) {
    for (let gx = 0; gx < gridN; gx++) {
      // Pick the highest-scoring pixel in this cell (+ some jitter)
      let bestScore = 0, bestX = 0, bestY = 0;
      const x0 = Math.floor(gx * cell);
      const y0 = Math.floor(gy * cell);
      const x1 = Math.min(width, Math.floor((gx + 1) * cell));
      const y1 = Math.min(height, Math.floor((gy + 1) * cell));
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * width + x) * 4;
          const s = computeCyanScore(data, i);
          if (s > bestScore) { bestScore = s; bestX = x; bestY = y; }
        }
      }
      // Only keep the cell if its best pixel is meaningfully cyan
      // Denser sample · lower threshold to pick up dimmer cyan pixels too
      if (bestScore >= 0.16) {
        points.push({ px: bestX, py: bestY, score: bestScore });
      }
    }
  }
  return points;
}

// ═══════════════════════════════════════════════════════════════════
// 5 · Assign shallow 3D depth via a facial curvature model
//     · x, y in normalised device coords (-1..1)
//     · z uses:  nose ridge forward · eye sockets + mouth recessed
//                · cheeks intermediate · outer edges back
// ═══════════════════════════════════════════════════════════════════
function depthForPoint(nx, ny) {
  // Base spherical fall-off (front-most at centre)
  const r2 = nx * nx + ny * ny * 0.85;
  let z = 0.35 * Math.max(0, 1 - r2);
  // Nose ridge: a vertical strip forward
  const nose = Math.exp(-((nx / 0.06) ** 2)) *
               Math.exp(-(((ny - 0.05) / 0.30) ** 2));
  z += 0.16 * nose;
  // Nose tip pop
  const noseTip = Math.exp(-((nx / 0.045) ** 2)) *
                  Math.exp(-(((ny - 0.15) / 0.08) ** 2));
  z += 0.09 * noseTip;
  // Eye sockets: two recessed pits
  const eyeL = Math.exp(-(((nx + 0.16) / 0.10) ** 2)) *
               Math.exp(-(((ny + 0.08) / 0.06) ** 2));
  const eyeR = Math.exp(-(((nx - 0.16) / 0.10) ** 2)) *
               Math.exp(-(((ny + 0.08) / 0.06) ** 2));
  z -= 0.06 * (eyeL + eyeR);
  // Mouth recess
  const mouth = Math.exp(-((nx / 0.14) ** 2)) *
                Math.exp(-(((ny - 0.36) / 0.05) ** 2));
  z -= 0.05 * mouth;
  // Cheek bulge
  const cheekL = Math.exp(-(((nx + 0.25) / 0.16) ** 2)) *
                 Math.exp(-(((ny - 0.05) / 0.18) ** 2));
  const cheekR = Math.exp(-(((nx - 0.25) / 0.16) ** 2)) *
                 Math.exp(-(((ny - 0.05) / 0.18) ** 2));
  z += 0.05 * (cheekL + cheekR);
  return z;
}

// ═══════════════════════════════════════════════════════════════════
// 6 · Trace a coarse head contour (extreme cyan pixel per scan row)
//     Used at runtime to draw the outline as a Line geometry.
// ═══════════════════════════════════════════════════════════════════
function traceContour({ data, width, height }) {
  console.log("· tracing contour…");
  const left = new Array(height).fill(-1);
  const right = new Array(height).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = computeCyanScore(data, (y * width + x) * 4);
      if (s > 0.30) { left[y] = x; break; }
    }
    for (let x = width - 1; x >= 0; x--) {
      const s = computeCyanScore(data, (y * width + x) * 4);
      if (s > 0.30) { right[y] = x; break; }
    }
  }
  // Convert into a single ordered loop, downsampled every N pixels
  const contour = [];
  const step = 6;
  for (let y = 0; y < height; y += step) {
    if (left[y] >= 0) contour.push({ px: left[y], py: y });
  }
  for (let y = height - 1; y >= 0; y -= step) {
    if (right[y] >= 0) contour.push({ px: right[y], py: y });
  }
  return contour;
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════
async function main() {
  const src = await ensureReference();
  const work = await loadWorkBuffer(src);
  const sampled = samplePoints(work, TARGET_POINTS);
  console.log(`· ${sampled.length} candidate points`);

  const cx = work.width / 2;
  const cy = work.height / 2;
  const nrm = Math.max(work.width, work.height) / 2;

  // Points → normalised coordinates + depth + shimmer metadata
  const points = sampled.map((p) => {
    const nx = (p.px - cx) / nrm;
    // Flip Y so positive is up
    const ny = -(p.py - cy) / nrm;
    const z = depthForPoint(nx, ny);
    // Deterministic phase per point (avoid Math.random for repeatable output)
    const phase = ((p.px * 17 + p.py * 31) % 628) / 100;   // 0..2π
    return {
      x: +nx.toFixed(4),
      y: +ny.toFixed(4),
      z: +z.toFixed(4),
      b: +(0.55 + 0.45 * p.score).toFixed(3),   // brightness
      p: +phase.toFixed(3),                     // phase
      s: +(0.6 + p.score * 1.4).toFixed(2),     // size factor
    };
  });

  const contourRaw = traceContour(work);
  const contour = contourRaw.map((p) => ({
    x: +((p.px - cx) / nrm).toFixed(4),
    y: +(-(p.py - cy) / nrm).toFixed(4),
  }));

  const stats = {
    generated_at: new Date().toISOString(),
    reference_url: REFERENCE_URL,
    source_size: { width: work.width, height: work.height },
    point_count: points.length,
    contour_count: contour.length,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "face-points.json"), JSON.stringify({ stats, points }));
  writeFileSync(join(OUT_DIR, "face-contour.json"), JSON.stringify({ stats: { generated_at: stats.generated_at }, contour }));

  console.log(`\n✓ wrote public/nex/face-points.json (${points.length} points)`);
  console.log(`✓ wrote public/nex/face-contour.json (${contour.length} contour vertices)`);
  console.log("\nNote: the reference PNG is only used HERE at build time. The runtime never loads it.");
}

main().catch((e) => { console.error("extraction failed:", e); process.exit(1); });
