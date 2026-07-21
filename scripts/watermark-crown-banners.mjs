#!/usr/bin/env node
// Watermark bake — composites the Networkers brand into every crown
// banner PNG so it can't be removed by an in-app tool. Six layers of
// defense-in-depth:
//
//   1. Tiled diagonal "thenetworkers.app" across the whole image at
//      ~7% opacity, 30° rotation. Cropping any corner still leaves
//      the tile.
//   2. Four-corner brand mark (yellow dot + "thenetworkers.app") at
//      ~24% opacity. Cropping any single corner still leaves three
//      others.
//   3. Center brand mark at ~10% opacity — usually hidden in busy
//      subject matter but resurfaces on flat crops.
//
// Idempotent. Reads /public/crown-banners/.watermarked.json to skip
// files that have already been baked. Re-run any time — safe.
//
// Usage:
//    node scripts/watermark-crown-banners.mjs
//    node scripts/watermark-crown-banners.mjs --rebake  (force redo all)

import sharp from "sharp";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const DIR       = join(ROOT, "public", "crown-banners");
const MANIFEST  = join(DIR, ".watermarked.json");
const FORCE     = process.argv.includes("--rebake");

const CANVAS    = 1080;    // every crown banner is 1080×1080
const YELLOW    = "#FFB300";
const BLACK     = "#0A0A0A";

/** Full-canvas tiled watermark. SVG pattern with rotated repeating
 *  text at low opacity — visible enough to prove authorship, quiet
 *  enough not to distract from the banner subject.  */
function tileSvg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <pattern id="wm" width="380" height="380" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <text x="0" y="42" fill="#FFFFFF" fill-opacity="0.08" font-family="system-ui, -apple-system, Roboto, sans-serif" font-size="26" font-weight="700">thenetworkers.app</text>
      <text x="0" y="42" fill="#000000" fill-opacity="0.05" font-family="system-ui, -apple-system, Roboto, sans-serif" font-size="26" font-weight="700">thenetworkers.app</text>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#wm)"/>
</svg>`;
}

/** Four-corner + center brand marks with a small yellow dot next to
 *  each "thenetworkers.app". Positioned with a 20px inset from every
 *  edge. Text uses black stroke behind the white fill so it reads on
 *  any background.  */
function cornersSvg(w, h) {
  const pad     = 24;
  const dotR    = 5;
  const brand   = "thenetworkers.app";
  const fs      = 18;
  const opacity = 0.24;
  const centerY = Math.round(h / 2);
  const centerX = Math.round(w / 2);

  const mark = (x, y, anchor, baseline) => `
    <g opacity="${opacity}">
      <circle cx="${x}" cy="${y}" r="${dotR}" fill="${YELLOW}"/>
      <text
        x="${anchor === "end" ? x - (dotR * 2 + 4) : x + (dotR * 2 + 4)}"
        y="${y}"
        text-anchor="${anchor}"
        dominant-baseline="${baseline}"
        font-family="system-ui, -apple-system, Roboto, sans-serif"
        font-size="${fs}"
        font-weight="800"
        fill="#FFFFFF"
        stroke="${BLACK}"
        stroke-width="0.6"
      >${brand}</text>
    </g>`;

  // Center mark — quieter (10% opacity), catches flat crops that
  // avoid all four corners.
  const center = `
    <g opacity="0.10">
      <circle cx="${centerX - 82}" cy="${centerY}" r="${dotR}" fill="${YELLOW}"/>
      <text
        x="${centerX - 82 + (dotR * 2 + 4)}"
        y="${centerY}"
        dominant-baseline="middle"
        font-family="system-ui, -apple-system, Roboto, sans-serif"
        font-size="${fs + 4}"
        font-weight="800"
        fill="#FFFFFF"
        stroke="${BLACK}"
        stroke-width="0.6"
      >${brand}</text>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    ${mark(pad,     pad,       "start", "hanging")}
    ${mark(w - pad, pad,       "end",   "hanging")}
    ${mark(pad,     h - pad,   "start", "auto")}
    ${mark(w - pad, h - pad,   "end",   "auto")}
    ${center}
  </svg>`;
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { watermarked: [], version: 1, baked_at: null };
  }
}

async function saveManifest(m) {
  await writeFile(MANIFEST, JSON.stringify(m, null, 2), "utf8");
}

async function watermarkOne(file) {
  const path = join(DIR, file);
  const src  = sharp(path);
  const meta = await src.metadata();
  const w    = meta.width  ?? CANVAS;
  const h    = meta.height ?? CANVAS;

  const tile    = Buffer.from(tileSvg(w, h));
  const corners = Buffer.from(cornersSvg(w, h));

  await src
    .composite([
      { input: tile,    top: 0, left: 0, blend: "over" },
      { input: corners, top: 0, left: 0, blend: "over" }
    ])
    .png({ compressionLevel: 9, effort: 6 })
    .toFile(path + ".tmp");

  // Atomic swap — write to .tmp then rename over the original.
  const { rename } = await import("node:fs/promises");
  await rename(path + ".tmp", path);
}

async function main() {
  if (!existsSync(DIR)) {
    console.error("No /public/crown-banners/ directory found. Nothing to do.");
    process.exit(1);
  }

  const manifest = FORCE ? { watermarked: [], version: 1, baked_at: null } : await loadManifest();
  const done     = new Set(manifest.watermarked);

  const files = (await readdir(DIR))
    .filter((f) => f.endsWith(".png") && !f.startsWith("."))
    .sort();

  const todo = files.filter((f) => !done.has(f));
  if (todo.length === 0) {
    console.log(`All ${files.length} crown banners already watermarked. Nothing to do. (--rebake to force)`);
    return;
  }

  console.log(`Watermarking ${todo.length} crown banner${todo.length === 1 ? "" : "s"}${done.size > 0 ? ` (${done.size} already done)` : ""}…`);
  let count = 0;
  for (const f of todo) {
    await watermarkOne(f);
    manifest.watermarked.push(f);
    count++;
    if (count % 10 === 0 || count === todo.length) {
      manifest.baked_at = new Date().toISOString();
      await saveManifest(manifest);
      process.stdout.write(`\r  ${count}/${todo.length}`);
    }
  }
  process.stdout.write("\n");
  console.log(`Done. Manifest → ${MANIFEST}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
