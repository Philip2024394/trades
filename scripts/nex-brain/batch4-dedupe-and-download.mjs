// scripts/nex-brain/batch4-dedupe-and-download.mjs
//
// Batch 4 · staircase reference gallery ingest (2026-08-14).
// Reads scripts/nex-brain/batch4-urls.txt, dedupes against the current
// manifest, downloads the NEW ones to data/incoming-image-ingest/batch4/.
// Never touches the manifest — that happens in the ingest step after
// multimodal reads produce structured knowledge.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";

const URL_LIST = join(process.cwd(), "scripts", "nex-brain", "batch4-urls.txt");
const MANIFEST = join(process.cwd(), "data", "nex-image-manifest.json");
const DEST_DIR = join(process.cwd(), "data", "incoming-image-ingest", "batch4-2026-08-14");
const MAPPING  = join(DEST_DIR, "_mapping.json");

const urls = readFileSync(URL_LIST, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
console.log(`Batch 4 · total URLs supplied  : ${urls.length}`);

const mani = JSON.parse(readFileSync(MANIFEST, "utf8"));
const inManifest = new Set(Object.keys(mani.images));
const alreadyKnown = urls.filter((u) => inManifest.has(u));
const newUrls     = urls.filter((u) => !inManifest.has(u));
console.log(`  already in manifest         : ${alreadyKnown.length}`);
console.log(`  new · needs ingest          : ${newUrls.length}`);

if (newUrls.length === 0) { console.log("Nothing new. Exiting."); process.exit(0); }

mkdirSync(DEST_DIR, { recursive: true });
const mapping = { batch: "batch4-2026-08-14", downloaded_at: null, items: [] };

for (let i = 0; i < newUrls.length; i++) {
  const url = newUrls[i];
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  const idx  = String(i + 1).padStart(2, "0");
  const localFile = `img-${idx}-${hash}.png`;
  const localPath = join(DEST_DIR, localFile);

  if (existsSync(localPath)) {
    console.log(`  [${idx}/${newUrls.length}] cached · ${localFile}`);
    mapping.items.push({ idx: i + 1, url, local: localFile, cached: true });
    continue;
  }

  try {
    const t0 = Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.log(`  [${idx}/${newUrls.length}] FAIL ${res.status}`); mapping.items.push({ idx: i + 1, url, error: `http_${res.status}` }); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(localPath, buf);
    console.log(`  [${idx}/${newUrls.length}] ok ${(buf.byteLength/1024).toFixed(0)} KB · ${localFile} · ${Date.now()-t0}ms`);
    mapping.items.push({ idx: i + 1, url, local: localFile, bytes: buf.byteLength });
  } catch (e) {
    console.log(`  [${idx}/${newUrls.length}] ERROR ${e.message}`);
    mapping.items.push({ idx: i + 1, url, error: e.message });
  }
}
mapping.downloaded_at = new Date().toISOString();
writeFileSync(MAPPING, JSON.stringify(mapping, null, 2), "utf8");
console.log("");
console.log(`Mapping saved: ${MAPPING}`);
console.log(`Downloaded to: ${DEST_DIR}`);
