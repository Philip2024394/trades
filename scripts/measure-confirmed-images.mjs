// Measure the real pixel dimensions of every URL in the confirmed Visual Brain
// library and write the results to data/nex-confirmed-image-dimensions.json.
//
// Philip 2026-08-02 · powers the Staircase Library viewport-fit filter · only
// images at least 1200px on the longer edge with a sensible aspect ratio
// (0.4 – 2.5) are shown so nothing upscales and nothing composes badly.
//
// Idempotent · re-runnable when new designs land · unmatched URLs default to
// exclusion so the library stays quality-first.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";

const LIBRARY_PATH = "data/nex-confirmed-images.json";
const CACHE_PATH   = "data/nex-confirmed-image-dimensions.json";

async function measure(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return { ok: false, error: "no_dimensions" };
    return { ok: true, width: meta.width, height: meta.height, format: meta.format };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function run() {
  const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));
  const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : { measured_at: null, dimensions: {} };
  const existing = cache.dimensions ?? {};

  // Collect every URL to probe · design.url + design.additional_views
  const urls = new Set();
  for (const d of lib.confirmed) {
    if (d.url) urls.add(d.url);
    for (const v of d.additional_views ?? []) if (v) urls.add(v);
  }

  console.log(`Probing ${urls.size} distinct URL(s)…`);
  let hit = 0, miss = 0, kept = 0;

  const nextDimensions = {};
  for (const url of urls) {
    if (existing[url]?.ok) {
      nextDimensions[url] = existing[url];
      hit++;
      continue;
    }
    process.stdout.write(`  measuring ${url.slice(-60)} … `);
    const result = await measure(url);
    nextDimensions[url] = result;
    if (result.ok) {
      console.log(`${result.width}×${result.height} ${result.format}`);
      kept++;
    } else {
      console.log(`FAILED (${result.error})`);
      miss++;
    }
  }

  const out = {
    measured_at: new Date().toISOString(),
    total:       urls.size,
    measured:    hit + kept,
    failed:      miss,
    dimensions:  nextDimensions,
  };
  writeFileSync(CACHE_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nCache written to ${CACHE_PATH}`);
  console.log(`  cache-hit: ${hit} · newly-measured: ${kept} · failed: ${miss}`);
}

run().catch((err) => { console.error("measure failed:", err); process.exit(1); });
