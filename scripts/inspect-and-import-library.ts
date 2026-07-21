// scripts/inspect-and-import-library.ts
//
// Two-phase pipeline for a batch of images the user wants to add to
// The Site library:
//
//   Phase 1 (inspect): download each URL, extract EXIF/IPTC/XMP,
//     classify provenance as AI / HUMAN / AMBIGUOUS, print a report.
//   Phase 2 (import, --upload): for images classified AI (or when the
//     user passes --force-all), strip ALL metadata via sharp, upload
//     to Supabase Storage under social-media/site-library/<slug>.<ext>,
//     insert a row into hammerex_feed_tile_library at tier=2, and
//     probe natural_aspect + fits_frames.
//
// Copyright rule enforcement (from feedback_image_copyright_risk_rules):
//   - AI-generated OK
//   - Licensed stock OK (needs user proof — not auto-detected)
//   - Trade-submitted with T&C OK (needs user proof)
//   - Commissioned OK
//   - Anything else → REJECT.
// We can't PROVE AI vs human from pixels; we lean on metadata. When
// metadata is missing entirely, we mark AMBIGUOUS and ask the user
// to confirm rather than assume.
//
// Usage:
//   npx tsx scripts/inspect-and-import-library.ts <url1> <url2> ...
//   npx tsx scripts/inspect-and-import-library.ts --upload <url1> ...
//   npx tsx scripts/inspect-and-import-library.ts --file urls.txt

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { computeFitsFrames } from "../src/lib/siteEditor/frames";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// -------------------------------------------------------------- env
function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// -------------------------------------------------------------- classification

type Verdict = "AI" | "HUMAN" | "AMBIGUOUS";

type Finding = {
  url:            string;
  ok:             boolean;
  verdict:        Verdict;
  reasons:        string[];
  width:          number | null;
  height:         number | null;
  format:         string | null;
  bytes:          number;
  camera?:        string;
  software?:      string;
  creator?:       string;
  source?:        string;
  xmpSnippet?:    string;
};

const AI_MARKERS = [
  /midjourney/i, /mj v\d/i,
  /dall[-·]?e/i,
  /stable[-·]?diffusion/i, /stability\.ai/i, /sdxl/i, /sd\s*1\.\d/i,
  /leonardo\.ai/i, /firefly/i, /adobe firefly/i,
  /openai/i, /chatgpt/i,
  /flux\.\d/i, /black[-·]?forest[-·]?labs/i,
  /ideogram/i, /playgroundai/i, /nightcafe/i, /invoke[-·]?ai/i,
  /content credentials/i, /c2pa/i, /cai:/i
];

const HUMAN_MARKERS_CAMERA = [
  /canon/i, /nikon/i, /sony/i, /fujifilm/i, /olympus/i, /leica/i,
  /panasonic/i, /pentax/i, /hasselblad/i,
  /iphone/i, /pixel/i, /galaxy/i, /oneplus/i, /xiaomi/i, /huawei/i
];

const PINTEREST_MARKERS = [
  /pinterest\.com/i, /pinimg\.com/i
];

async function inspect(url: string): Promise<Finding> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return {
      url, ok: false, verdict: "AMBIGUOUS",
      reasons: [`fetch failed: HTTP ${res.status}`],
      width: null, height: null, format: null, bytes: 0
    };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const reasons: string[] = [];

  // Assemble every text-bearing metadata payload we can decode.
  const exifText = meta.exif ? safeString(meta.exif) : "";
  const iptcText = meta.iptc ? safeString(meta.iptc) : "";
  const xmpText  = meta.xmp  ? safeString(meta.xmp)  : "";
  const allText  = `${exifText}\n${iptcText}\n${xmpText}`;

  // Pull common named fields out of XMP for readability.
  const camera   = findTagValue(xmpText, ["tiff:Make", "Make", "CameraModel"]);
  const software = findTagValue(xmpText, ["xmp:CreatorTool", "CreatorTool", "Software"]);
  const creator  = findTagValue(xmpText, ["dc:creator", "photoshop:Credit", "photoshop:AuthorsPosition", "Author"]);
  const source   = findTagValue(xmpText, ["photoshop:Source", "dc:source", "xmp:Source", "OriginatingProgram"]);
  const xmpSnippet = xmpText.slice(0, 400).replace(/\s+/g, " ");

  // AI markers
  const aiHits = AI_MARKERS.filter((re) => re.test(allText) || re.test(software ?? "") || re.test(creator ?? "") || re.test(source ?? ""));
  aiHits.forEach((re) => reasons.push(`AI marker: ${re.source}`));

  // Human camera markers
  const camHits = HUMAN_MARKERS_CAMERA.filter((re) => re.test(camera ?? "") || re.test(allText));
  camHits.forEach((re) => reasons.push(`Camera marker: ${re.source}`));

  // Pinterest markers
  const pinHits = PINTEREST_MARKERS.filter((re) => re.test(allText) || re.test(source ?? ""));
  pinHits.forEach((re) => reasons.push(`Pinterest source: ${re.source}`));

  // Verdict
  let verdict: Verdict;
  if (aiHits.length > 0 && camHits.length === 0) {
    verdict = "AI";
  } else if (camHits.length > 0) {
    verdict = "HUMAN";
  } else if (pinHits.length > 0) {
    verdict = "HUMAN";                 // Pinterest = re-share of human/stock work
  } else if (allText.trim().length === 0) {
    verdict = "AMBIGUOUS";             // metadata already stripped — can't tell
    reasons.push("no metadata present — cannot verify provenance");
  } else if (aiHits.length > 0) {
    verdict = "AI";                    // AI marker but also weak human hint
  } else {
    verdict = "AMBIGUOUS";
    reasons.push("no AI or clear human markers");
  }

  return {
    url,
    ok:     true,
    verdict,
    reasons,
    width:  meta.width  ?? null,
    height: meta.height ?? null,
    format: meta.format ?? null,
    bytes:  buf.length,
    camera:   camera   || undefined,
    software: software || undefined,
    creator:  creator  || undefined,
    source:   source   || undefined,
    xmpSnippet
  };
}

function findTagValue(xml: string, names: string[]): string | null {
  for (const n of names) {
    const re = new RegExp(`<${n}[^>]*>([^<]{1,200})</${n}>|${n}="([^"]{1,200})"`, "i");
    const m = re.exec(xml);
    if (m) return (m[1] ?? m[2]).trim();
  }
  return null;
}

function safeString(buf: Buffer): string {
  try {
    return buf.toString("utf8").replace(/\x00+/g, " ");
  } catch {
    return buf.toString("latin1");
  }
}

// -------------------------------------------------------------- upload path

async function importOne(finding: Finding): Promise<string | null> {
  if (!SB_URL || !SB_KEY) throw new Error("missing supabase env");
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  const res = await fetch(finding.url, { cache: "no-store" });
  const raw = Buffer.from(await res.arrayBuffer());

  // Strip ALL metadata (no .withMetadata() call → sharp writes clean).
  // Re-encode to WebP for smaller size + guaranteed clean container.
  const cleaned = await sharp(raw).rotate().webp({ quality: 88 }).toBuffer();
  const width  = finding.width  ?? 0;
  const height = finding.height ?? 1;
  const aspect = width && height ? width / height : 1;

  const slug = `lib-${createHash("sha256").update(finding.url).digest("hex").slice(0, 12)}`;
  const storagePath = `site-library/${slug}.webp`;

  const up = await sb.storage.from("social-media").upload(storagePath, cleaned, {
    contentType: "image/webp",
    upsert:      true
  });
  if (up.error) throw new Error(`storage: ${up.error.message}`);
  const { data: pub } = sb.storage.from("social-media").getPublicUrl(storagePath);
  const publicUrl = pub.publicUrl;

  const fits = computeFitsFrames(aspect);
  const ins = await sb.from("hammerex_feed_tile_library").upsert({
    slug,
    url:             publicUrl,
    alt:             "",
    tier:            2,             // site-buyable
    active:          true,
    has_brand_marks: false,
    is_banner:       false,
    trade_slugs:     [],
    text_tone:       "white",
    natural_aspect:  aspect,
    fits_frames:     fits
  }, { onConflict: "slug" });
  if (ins.error) throw new Error(`db: ${ins.error.message}`);
  return slug;
}

// -------------------------------------------------------------- main

async function main() {
  const args = process.argv.slice(2);
  const doUpload  = args.includes("--upload");
  const forceAll  = args.includes("--force-all");
  const fileArg   = args.indexOf("--file");
  let urls: string[] = [];
  if (fileArg >= 0 && args[fileArg + 1]) {
    urls = fs.readFileSync(args[fileArg + 1], "utf8").split(/\s+/).filter((u) => /^https?:/.test(u));
  } else {
    urls = args.filter((a) => /^https?:/.test(a));
  }
  if (urls.length === 0) {
    console.error("usage: npx tsx scripts/inspect-and-import-library.ts [--upload] [--force-all] <url1> <url2> ...");
    process.exit(1);
  }

  console.log(`inspecting ${urls.length} images…\n`);
  const findings: Finding[] = [];
  for (const url of urls) {
    process.stdout.write(`  ${url.slice(-40)} `);
    try {
      const f = await inspect(url);
      findings.push(f);
      const badge = f.verdict === "AI" ? "AI  ✓" : f.verdict === "HUMAN" ? "HUMAN ✗" : "AMBIG ?";
      console.log(`${badge}  ${f.width}×${f.height}  ${(f.bytes / 1024).toFixed(1)}KB`);
    } catch (e) {
      console.log(`ERROR ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("\n---- report ----");
  const ai       = findings.filter((f) => f.verdict === "AI");
  const human    = findings.filter((f) => f.verdict === "HUMAN");
  const ambig    = findings.filter((f) => f.verdict === "AMBIGUOUS");
  console.log(`AI:        ${ai.length}`);
  console.log(`HUMAN:     ${human.length}  (rejected — copyright risk)`);
  console.log(`AMBIGUOUS: ${ambig.length} (metadata stripped — needs manual verification)`);
  console.log("");

  for (const f of findings) {
    const badge = f.verdict === "AI" ? "AI     " : f.verdict === "HUMAN" ? "HUMAN  " : "AMBIG  ";
    console.log(`${badge}  ${f.url}`);
    if (f.software) console.log(`         software: ${f.software}`);
    if (f.camera)   console.log(`         camera:   ${f.camera}`);
    if (f.creator)  console.log(`         creator:  ${f.creator}`);
    if (f.source)   console.log(`         source:   ${f.source}`);
    if (f.reasons.length && f.reasons.length < 6) {
      for (const r of f.reasons) console.log(`         · ${r}`);
    }
  }

  if (!doUpload) {
    console.log("\n(dry run — pass --upload to import AI/verified images)");
    console.log("(pass --force-all to also import AMBIGUOUS — use at your own risk)");
    return;
  }

  const toImport = forceAll ? [...ai, ...ambig] : ai;
  if (toImport.length === 0) {
    console.log("\nnothing to import.");
    return;
  }
  console.log(`\nimporting ${toImport.length} images (stripped metadata, tier=2)…`);
  let ok = 0, fail = 0;
  for (const f of toImport) {
    try {
      const slug = await importOne(f);
      if (slug) { console.log(`  ✓ ${slug}  ${f.url}`); ok++; }
    } catch (e) {
      console.log(`  ✗ ${f.url}  ${e instanceof Error ? e.message : e}`);
      fail++;
    }
  }
  console.log(`\ndone — ${ok} imported · ${fail} failed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
