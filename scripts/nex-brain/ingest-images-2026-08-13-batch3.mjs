// Batch 3 · 2026-08-13 image ingestion.
// Dedupe against manifest · download only truly new images.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Deduplicated + preserved order from Philip's message (one URL repeated
// in the source — kept only the first occurrence).
const URLS = Array.from(new Set([
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsddsffsdfsasdsdfxcxczxczxdfdfdsddfdsdfdsf.png?updatedAt=1785464181615",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsddsffsdfsasdsdfxcxczxczxdfdfdsddfdsdf.png?updatedAt=1785464031310",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2011_59_28%20PM.png?updatedAt=1785517191138",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_32_48%20AM.png?updatedAt=1785519186230",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_35_51%20AM.png?updatedAt=1785519371440",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_42_43%20AM.png?updatedAt=1785519783075",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_46_19%20AM.png?updatedAt=1785519998497",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_52_21%20AM.png?updatedAt=1785520360617",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_18_11%20AM.png?updatedAt=1785521911400",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2002_06_07%20AM.png?updatedAt=1785524785129",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_27_08%20AM.png?updatedAt=1785522446173",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2002_37_50%20AM.png?updatedAt=1785526690463",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2002_33_29%20AM.png?updatedAt=1785526425588",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2002_32_23%20AM.png?updatedAt=1785526366388",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2002_39_35%20AM.png?updatedAt=1785526794488",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2002_43_13%20AM.png?updatedAt=1785527011052",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2002_45_24%20AM.png?updatedAt=1785527143689",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_09_35%20AM.png?updatedAt=1785528597154",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_26_24%20AM.png?updatedAt=1785529625948",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_21_15%20AM.png?updatedAt=1785529301388",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_18_02%20AM.png?updatedAt=1785529107569",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_11_20%20AM.png?updatedAt=1785528704782",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2004_09_14%20AM.png?updatedAt=1785532173072",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2004_03_15%20AM.png?updatedAt=1785531821336",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_53_08%20AM.png?updatedAt=1785531208759",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_51_37%20AM.png?updatedAt=1785531127822",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2004_43_30%20AM.png?updatedAt=1785534230672",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2004_36_25%20AM.png?updatedAt=1785533811254",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2004_28_20%20AM.png?updatedAt=1785533320521",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2004_16_11%20AM.png?updatedAt=1785532593823",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2005_11_27%20AM.png?updatedAt=1785535908073",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_12_10%20AM.png?updatedAt=1785604356677",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_14_37%20AM.png?updatedAt=1785604495966",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_24_24%20AM.png?updatedAt=1785605081083",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_18_21%20AM.png?updatedAt=1785604720352",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_40_13%20AM.png?updatedAt=1785606038433",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_29_42%20AM.png?updatedAt=1785605398736",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_26_51%20AM.png?updatedAt=1785605231265",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2001_24_21%20AM.png?updatedAt=1785608682447",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2001_17_34%20AM.png?updatedAt=1785608276930",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_52_05%20AM.png?updatedAt=1785606740231",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2012_50_16%20AM.png?updatedAt=1785606633418",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2002_27_32%20AM.png?updatedAt=1785612467449",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2002_25_40%20AM.png?updatedAt=1785612361283",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2002_16_57%20AM.png?updatedAt=1785611852906",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2001_35_12%20AM.png?updatedAt=1785609336679",
]));

const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const OUTDIR = join(process.cwd(), "data", "incoming-image-ingest", "2026-08-13-batch3");
mkdirSync(OUTDIR, { recursive: true });

const raw = readFileSync(MANIFEST_PATH, "utf8");
const manifest = JSON.parse(raw);
const existingUrls = new Set(Object.keys(manifest.images ?? {}));
const norm = (u) => u.split("?")[0];
const existingNoQuery = new Set([...existingUrls].map(norm));

const results = URLS.map((url) => ({ url, inManifest: existingUrls.has(url) || existingNoQuery.has(norm(url)) }));
const dup = results.filter((r) => r.inManifest).length;
const nw  = results.length - dup;

console.log(`Batch 3 supplied: ${URLS.length}  (source list had a duplicate · deduped in memory)`);
console.log(`Already stored:   ${dup}`);
console.log(`New to ingest:    ${nw}`);
console.log("");

if (dup > 0) {
  console.log("── Duplicates ─────────────────────────────");
  for (const r of results.filter((x) => x.inManifest)) console.log("  ✓", r.url);
  console.log("");
}
if (nw === 0) { console.log("Nothing new to download."); process.exit(0); }

const toDownload = results.filter((r) => !r.inManifest);
writeFileSync(join(OUTDIR, "_urls.json"), JSON.stringify(toDownload, null, 2), "utf8");

console.log("── Downloading ────────────────────────────");
let ok = 0, fail = 0;
for (let i = 0; i < toDownload.length; i++) {
  const { url } = toDownload[i];
  const ext = (url.match(/\.(png|jpe?g|webp|gif)(\?|$)/i)?.[1] ?? "png").toLowerCase();
  const fname = `img-${String(i + 1).padStart(3, "0")}.${ext}`;
  const outPath = join(OUTDIR, fname);
  if (existsSync(outPath)) { ok++; console.log(`  ✓ (cached) ${fname}`); continue; }
  try {
    const res = await fetch(url, { headers: { "user-agent": "NEX-image-ingest/1.0" } });
    if (!res.ok) { console.log(`  ✗ HTTP ${res.status}  ${url}`); fail++; continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(outPath, buf);
    console.log(`  ✓ ${fname}  (${Math.round(buf.byteLength / 1024)}kb)`);
    ok++;
  } catch (err) {
    console.log(`  ✗ ${err.message}  ${url}`);
    fail++;
  }
}
console.log("");
console.log(`Downloaded ${ok}/${toDownload.length} · saved to ${OUTDIR}`);
