// Batch 9 · dedupe + download newel-cap + starting-step images.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const URL_LIST = join(process.cwd(), "scripts", "nex-brain", "batch9-urls.txt");
const MANIFEST = join(process.cwd(), "data", "nex-image-manifest.json");
const DEST_DIR = join(process.cwd(), "data", "incoming-image-ingest", "batch9-2026-08-14");
const MAPPING  = join(DEST_DIR, "_mapping.json");

const raw = readFileSync(URL_LIST, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const urls = [...new Set(raw)];
console.log(`Batch 9 · supplied: ${raw.length} · deduped: ${urls.length}`);
const mani = JSON.parse(readFileSync(MANIFEST, "utf8"));
const inMani = new Set(Object.keys(mani.images));
const newUrls = urls.filter((u) => !inMani.has(u));
console.log(`  already in manifest: ${urls.length - newUrls.length} · new: ${newUrls.length}`);
if (!newUrls.length) { console.log("nothing new."); process.exit(0); }

mkdirSync(DEST_DIR, { recursive: true });
const mapping = { batch: "batch9-2026-08-14", downloaded_at: null, items: [] };
for (let i = 0; i < newUrls.length; i++) {
  const url = newUrls[i];
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  const idx = String(i + 1).padStart(2, "0");
  const localFile = `img-${idx}-${hash}.png`;
  const localPath = join(DEST_DIR, localFile);
  if (existsSync(localPath)) { mapping.items.push({ idx: i + 1, url, local: localFile, cached: true }); continue; }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.log(`  [${idx}] FAIL ${res.status}`); mapping.items.push({ idx: i + 1, url, error: `http_${res.status}` }); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(localPath, buf);
    if (i % 10 === 0 || i === newUrls.length - 1) console.log(`  [${idx}/${newUrls.length}] ok`);
    mapping.items.push({ idx: i + 1, url, local: localFile, bytes: buf.byteLength });
  } catch (e) { console.log(`  [${idx}] ERROR ${e.message}`); mapping.items.push({ idx: i + 1, url, error: e.message }); }
}
mapping.downloaded_at = new Date().toISOString();
writeFileSync(MAPPING, JSON.stringify(mapping, null, 2), "utf8");
console.log(`\nMapping: ${MAPPING}`);
