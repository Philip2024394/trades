// intake-imagekit-batch.mjs
// One-shot intake: download the batch of ChatGPT-generated staircase images
// from ImageKit into a working directory, deduped by content hash.
//
// USAGE:
//   node scripts/refacing/intake-imagekit-batch.mjs
//
// The URL list is inline (paste-once). Reads a hash manifest at
// data/staircase-renovations/intake/hashes.json to skip duplicates across
// runs. Writes each image with a stable numeric name so subsequent tools
// (dedup + tagger) have deterministic filenames.
//
// Does NOT modify the main manifest. That happens in the tagger step.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const URLS = [
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_50_14%20PM.png?updatedAt=1786427428699",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_38_59%20PM.png?updatedAt=1786426763341",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_34_04%20PM.png?updatedAt=1786426461204",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_30_48%20PM.png?updatedAt=1786426263138",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_30_14%20PM.png?updatedAt=1786426235928",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_22_34%20PM.png?updatedAt=1786425771297",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_15_14%20PM.png?updatedAt=1786425328125",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_08_25%20PM.png?updatedAt=1786424928585",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_00_35%20PM.png?updatedAt=1786424455995",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2011_44_00%20AM.png?updatedAt=1786423472923",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2011_35_53%20AM.png?updatedAt=1786422968614",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2011_18_08%20AM.png?updatedAt=1786421910666",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2011_17_09%20AM.png?updatedAt=1786421854697",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2007_16_40%20AM.png?updatedAt=1786407430929",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2007_05_05%20AM.png?updatedAt=1786406720104",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2007_03_51%20AM.png?updatedAt=1786406646227",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2006_57_13%20AM.png?updatedAt=1786406257338",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2006_20_53%20AM.png?updatedAt=1786404068623",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2006_19_43%20AM.png?updatedAt=1786404000096",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2006_17_46%20AM.png?updatedAt=1786403931060",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2010_00_22%20AM.png?updatedAt=1786244449091",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_50_43%20AM.png?updatedAt=1786243868975",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_45_30%20AM.png?updatedAt=1786243555997",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_41_21%20AM.png?updatedAt=1786243309182",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_38_00%20AM.png?updatedAt=1786243101214",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_30_17%20AM.png?updatedAt=1786242639034",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_23_30%20AM.png?updatedAt=1786242243005",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_12_21%20AM.png?updatedAt=1786241559297",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_09_57%20AM.png?updatedAt=1786241421061",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2009_02_54%20AM.png?updatedAt=1786241003839",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2008_54_27%20AM.png?updatedAt=1786240483044",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2008_53_28%20AM.png?updatedAt=1786240440037",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2008_36_10%20AM.png?updatedAt=1786239424978",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2007_37_11%20AM.png?updatedAt=1786238409636",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2008_12_10%20AM.png?updatedAt=1786238393695",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2007_14_05%20AM.png?updatedAt=1786234465293",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2007_10_03%20AM.png?updatedAt=1786234224521",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2007_07_20%20AM.png?updatedAt=1786234055720",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2007_06_27%20AM.png?updatedAt=1786234016632",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2007_00_49%20AM.png?updatedAt=1786233665211",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_56_56%20AM.png?updatedAt=1786233436008",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_48_13%20AM.png?updatedAt=1786232929346",
  "https://ik.imagekit.io/5vv5pw26q/b07c7065-9ee8-4fd9-8302-1f296c656276.png?updatedAt=1786232078942",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_32_52%20AM.png?updatedAt=1786231991321",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_20_39%20AM.png?updatedAt=1786231257695",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_17_33%20AM.png?updatedAt=1786231072086",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_09_19%20AM.png?updatedAt=1786230576428",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_07_19%20AM.png?updatedAt=1786230459742",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2006_04_36%20AM.png?updatedAt=1786230295143",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_42_53%20AM.png?updatedAt=1786229027632",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_37_05%20AM.png?updatedAt=1786228648593",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_33_26%20AM.png?updatedAt=1786228427981",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_30_01%20AM.png?updatedAt=1786228219941",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_28_52%20AM.png?updatedAt=1786228151732",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_26_14%20AM.png?updatedAt=1786227991992",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_23_53%20AM.png?updatedAt=1786227856322",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2005_06_16%20AM.png?updatedAt=1786226809726",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%209,%202026,%2004_51_16%20AM.png?updatedAt=1786225901942",
];

const OUT_DIR = "public/staircase-renovations/intake-2026-08-13";
const HASH_MANIFEST_PATH = "data/staircase-renovations/intake/hashes.json";

const REPO_ROOT = process.cwd();
const outDirAbs  = join(REPO_ROOT, OUT_DIR);
const hashPathAbs = join(REPO_ROOT, HASH_MANIFEST_PATH);

async function loadHashes() {
  try {
    if (!existsSync(hashPathAbs)) return { by_hash: {}, entries: [] };
    const raw = await readFile(hashPathAbs, "utf8");
    return JSON.parse(raw);
  } catch { return { by_hash: {}, entries: [] }; }
}
async function saveHashes(m) {
  await mkdir(join(REPO_ROOT, "data/staircase-renovations/intake"), { recursive: true });
  await writeFile(hashPathAbs, JSON.stringify(m, null, 2), "utf8");
}

async function main() {
  await mkdir(outDirAbs, { recursive: true });
  const manifest = await loadHashes();
  const before = manifest.entries.length;

  console.log(`intake · ${URLS.length} URLs · out=${OUT_DIR}`);
  const results = [];

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    try {
      const res = await fetch(url);
      if (!res.ok) { results.push({ url, ok: false, reason: `HTTP ${res.status}` }); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
      if (manifest.by_hash[hash]) {
        results.push({ url, ok: true, dedup: true, hash, existing: manifest.by_hash[hash] });
        continue;
      }
      const seq = String(before + results.filter((r) => r.ok && !r.dedup).length + 1).padStart(3, "0");
      const filename = `intake-${seq}-${hash}.png`;
      const filepath = join(outDirAbs, filename);
      await writeFile(filepath, buf);
      manifest.by_hash[hash] = filename;
      manifest.entries.push({ filename, hash, source_url: url, downloaded_at: new Date().toISOString(), bytes: buf.length });
      results.push({ url, ok: true, filename, hash, bytes: buf.length });
    } catch (e) { results.push({ url, ok: false, reason: e.message }); }
  }

  await saveHashes(manifest);

  const ok    = results.filter((r) => r.ok && !r.dedup).length;
  const dupe  = results.filter((r) => r.dedup).length;
  const fail  = results.filter((r) => !r.ok).length;

  console.log(`\ndone. downloaded=${ok} · deduped=${dupe} · failed=${fail}`);
  if (fail) console.log("failures:", results.filter((r) => !r.ok));
  if (dupe) console.log("dedup skips:", results.filter((r) => r.dedup).map((r) => `${r.hash} → ${r.existing}`));
  console.log(`\nfiles saved to: ${OUT_DIR}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
