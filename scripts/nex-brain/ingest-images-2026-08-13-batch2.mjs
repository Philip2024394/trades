// Batch 2 of 2026-08-13 image ingestion · 31 additional URLs from Philip.
// Same shape as ingest-images-2026-08-13.mjs · downloads to a batch2 folder.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const URLS = [
  "https://ik.imagekit.io/5vv5pw26q/Untitleddasddbbasdasdsdfdssdasdadsasdasasdsfsdfasdasddasdsdf.png?updatedAt=1785257079198",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2002_23_05%20AM.png?updatedAt=1785266610669",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2003_52_47%20AM.png?updatedAt=1785272019086",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2003_54_05%20AM.png?updatedAt=1785272070048",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2004_17_43%20AM.png?updatedAt=1785273481556",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2029,%202026,%2002_35_38%20PM.png?updatedAt=1785310562884",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2030,%202026,%2001_17_30%20AM.png?updatedAt=1785349070074",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2030,%202026,%2003_41_30%20PM.png?updatedAt=1785400914005",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2030,%202026,%2004_40_09%20PM.png?updatedAt=1785404442698",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2002_04_14%20AM.png?updatedAt=1785438272355",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2001_48_56%20AM.png?updatedAt=1785437356113",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2001_44_16%20AM.png?updatedAt=1785437075064",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2001_39_35%20AM.png?updatedAt=1785436795316",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2004_15_17%20AM.png?updatedAt=1785446136956",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdsddsd.png?updatedAt=1785439848476",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdsd.png?updatedAt=1785439542954",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2007_44_39%20AM.png?updatedAt=1785458699350",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2007_30_17%20AM.png?updatedAt=1785457883850",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2006_53_13%20AM.png?updatedAt=1785455616453",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2005_38_45%20AM.png?updatedAt=1785451149936",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdf.png?updatedAt=1785461550978",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2031,%202026,%2007_59_16%20AM.png?updatedAt=1785459577807",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdf.png?updatedAt=1785461667804",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsd.png?updatedAt=1785461761048",
  "https://ik.imagekit.io/5vv5pw26q/Untitledxcxc.png?updatedAt=1785462341232",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsddsffsdfsasdsdf.png?updatedAt=1785463318015",
  "https://ik.imagekit.io/5vv5pw26q/Untitledxcxcdvd.png?updatedAt=1785462701408",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsddsffsdfsasdsdfxcxczxczxdfdfdsd.png?updatedAt=1785463931688",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsddsffsdfsasdsdfxcxczxczxdfdf.png?updatedAt=1785463806339",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsddsffsdfsasdsdfxcxczxczx.png?updatedAt=1785463603125",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdadvvcvfsdfsdfsdfsdfsddsffsdfsasdsdfxcxc.png?updatedAt=1785463443244",
];

const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const OUTDIR = join(process.cwd(), "data", "incoming-image-ingest", "2026-08-13-batch2");
mkdirSync(OUTDIR, { recursive: true });

const raw = readFileSync(MANIFEST_PATH, "utf8");
const manifest = JSON.parse(raw);
const existingUrls = new Set(Object.keys(manifest.images ?? {}));
const norm = (u) => u.split("?")[0];
const existingNoQuery = new Set([...existingUrls].map(norm));

const results = URLS.map((url) => ({
  url, inManifest: existingUrls.has(url) || existingNoQuery.has(norm(url)),
}));
const dupCount = results.filter((r) => r.inManifest).length;
const newCount = results.length - dupCount;

console.log(`Batch 2 supplied: ${URLS.length}`);
console.log(`Already stored:   ${dupCount}`);
console.log(`New to ingest:    ${newCount}`);
console.log("");

if (dupCount > 0) {
  console.log("── Duplicates ─────────────────────────────");
  for (const r of results.filter((x) => x.inManifest)) console.log("  ✓", r.url);
  console.log("");
}

if (newCount === 0) {
  console.log("Nothing new to download.");
  process.exit(0);
}

const toDownload = results.filter((r) => !r.inManifest);
const mapPath = join(OUTDIR, "_urls.json");
writeFileSync(mapPath, JSON.stringify(toDownload, null, 2), "utf8");

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
