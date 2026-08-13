// scripts/nex-brain/ingest-images-2026-08-13.mjs
//
// Two jobs:
//   1. Check each supplied URL against data/nex-image-manifest.json · report
//      which are already stored (skip · Philip's rule: never duplicate).
//   2. For genuinely new URLs, download the image to
//      data/incoming-image-ingest/2026-08-13/ so it can be Read()
//      multimodally and richly described per ADR-0028 Intelligence
//      Constitution.
//
// Does NOT write to the manifest itself — that comes AFTER human/model
// review of each image so descriptions are evidence-based, not fabricated.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const URLS = [
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2008_15_53%20PM.png?updatedAt=1785071775734",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2007_40_34%20PM.png?updatedAt=1785069651885",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2008_31_06%20PM.png?updatedAt=1785072686726",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2009_41_43%20PM.png?updatedAt=1785076926175",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_32_58%20PM.png?updatedAt=1785079995668",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_38_29%20PM.png?updatedAt=1785080328887",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_49_14%20PM.png?updatedAt=1785080971205",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_44_59%20PM.png?updatedAt=1785080717608",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_42_40%20PM.png?updatedAt=1785080582493",
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdfdsfdfsdasd.png?updatedAt=1785080404109",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_58_04%20PM.png?updatedAt=1785081500103",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_55_32%20PM.png?updatedAt=1785081348730",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2002_33_39%20PM.png?updatedAt=1785137647970",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2002_45_16%20PM.png?updatedAt=1785138340007",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2002_58_26%20PM.png?updatedAt=1785139130823",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2003_07_43%20PM.png?updatedAt=1785139684752",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2005_15_47%20PM.png?updatedAt=1785147365380",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2003_14_04%20PM.png?updatedAt=1785140068277",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2012_10_50%20AM.png?updatedAt=1785172275633",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdasdfsdf.png?updatedAt=1785169399124",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsda.png?updatedAt=1785169141615",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2011_36_39%20AM.png?updatedAt=1785213417829",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2011_32_18%20AM.png?updatedAt=1785213154992",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2011_28_11%20AM.png?updatedAt=1785212912960",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2012_27_00%20AM.png?updatedAt=1785173241948",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2011_57_13%20AM.png?updatedAt=1785214658136",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2011_50_34%20AM.png?updatedAt=1785214253849",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2011_47_28%20AM.png?updatedAt=1785214064292",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2011_42_28%20AM.png?updatedAt=1785213764831",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2012_00_42%20PM.png?updatedAt=1785214860370",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2012_55_56%20PM.png?updatedAt=1785218200980",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2008_56_59%20PM.png?updatedAt=1785247049277",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2009_05_02%20PM.png?updatedAt=1785247520122",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2009_03_38%20PM.png?updatedAt=1785247438403",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2009_01_16%20PM.png?updatedAt=1785247299150",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2008_58_11%20PM.png?updatedAt=1785247134057",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2009_19_34%20PM.png?updatedAt=1785248392246",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2009_19_03%20PM.png?updatedAt=1785248361306",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2009_14_32%20PM.png?updatedAt=1785248099648",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2028,%202026,%2009_07_47%20PM.png?updatedAt=1785247687110",
  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsdsdsdasdsdsdassdsdasassdsd.png?updatedAt=1785250656976",
];

const MANIFEST_PATH = join(process.cwd(), "data", "nex-image-manifest.json");
const OUTDIR = join(process.cwd(), "data", "incoming-image-ingest", "2026-08-13");
mkdirSync(OUTDIR, { recursive: true });

const raw = readFileSync(MANIFEST_PATH, "utf8");
const manifest = JSON.parse(raw);
const existingUrls = new Set(Object.keys(manifest.images ?? {}));

// The manifest keys may or may not include the `?updatedAt=` query — normalise
// on the CANONICAL form (with query) but also probe the trailing-slug form so
// we don't miss duplicates the earlier ingestion stored without the query.
function normalise(u) {
  // Strip ?updatedAt=... for match check, but keep original for reference.
  return u.split("?")[0];
}
const existingNoQuery = new Set([...existingUrls].map(normalise));

const results = [];
for (const url of URLS) {
  const norm = normalise(url);
  const inManifest = existingUrls.has(url) || existingNoQuery.has(norm);
  results.push({ url, norm, inManifest });
}

const dupCount = results.filter((r) => r.inManifest).length;
const newCount = results.length - dupCount;

console.log(`Supplied URLs:  ${URLS.length}`);
console.log(`Already stored: ${dupCount}  (will not duplicate)`);
console.log(`New to ingest:  ${newCount}`);
console.log("");

if (dupCount > 0) {
  console.log("── Duplicates (already in manifest) ─────────────────────");
  for (const r of results.filter((x) => x.inManifest)) console.log("  ✓", r.url);
  console.log("");
}

if (newCount === 0) {
  console.log("Nothing new to download. All supplied URLs already exist in the manifest.");
  process.exit(0);
}

console.log("── Downloading new images ──────────────────────────────");
const toDownload = results.filter((r) => !r.inManifest);
const manifestFile = join(OUTDIR, "_urls.json");
writeFileSync(manifestFile, JSON.stringify(toDownload, null, 2), "utf8");

let ok = 0, fail = 0;
for (let i = 0; i < toDownload.length; i++) {
  const { url } = toDownload[i];
  const ext = (url.match(/\.(png|jpe?g|webp|gif)(\?|$)/i)?.[1] ?? "png").toLowerCase();
  const fname = `img-${String(i + 1).padStart(3, "0")}.${ext}`;
  const outPath = join(OUTDIR, fname);
  if (existsSync(outPath)) {
    ok++;
    console.log(`  ✓ (cached) ${fname}`);
    continue;
  }
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
console.log(`URL↔filename map: ${manifestFile}`);
