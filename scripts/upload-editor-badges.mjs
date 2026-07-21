// scripts/upload-editor-badges.mjs
//
// Upload the SOCIAL-MEDIA-ONLY badge set to Supabase Storage under
// social-media/editor-badges/<slug>.webp. These are AI-generated
// scene illustrations that live in the Site Editor's Overlays drawer
// ONLY — they are not surfaced anywhere else in the app.
//
// Metadata is stripped and images re-encoded to WebP for size + a
// guaranteed-clean container.
//
// Usage: node scripts/upload-editor-badges.mjs

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Missing SUPABASE env");

// slug → source file mapping. Update when the user drops more sheets.
const BADGES = [
  { slug: "check-this-out",     file: "sheet-1.png", label: "Check this out"      },
  { slug: "new-product-update", file: "sheet-2.png", label: "New product update"  },
  { slug: "join-us-updates",    file: "sheet-3.png", label: "Join us for updates" },
  { slug: "no-way",             file: "sheet-4.png", label: "No way!"             },
  { slug: "discounted",         file: "sheet-5.png", label: "Discounted"          },
  { slug: "1000-followers",     file: "sheet-6.png", label: "1000 followers"      }
];

async function main() {
  const src = path.join(ROOT, "tmp/badges-v2");
  const results = [];
  for (const b of BADGES) {
    const bytes = fs.readFileSync(path.join(src, b.file));
    // sharp() with no .withMetadata() = strips EXIF/IPTC/XMP.
    // .webp() re-encodes for size + guaranteed alpha support.
    const webp = await sharp(bytes).webp({ quality: 90 }).toBuffer();
    const meta = await sharp(webp).metadata();
    const remote = `editor-badges/${b.slug}.webp`;
    const uploadRes = await fetch(`${URL}/storage/v1/object/social-media/${remote}?upsert=true`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEY}`,
        "apikey":        KEY,
        "Content-Type":  "image/webp",
        "x-upsert":      "true"
      },
      body: webp
    });
    if (!uploadRes.ok) {
      console.error(`✗ ${b.slug}: ${uploadRes.status} ${await uploadRes.text()}`);
      continue;
    }
    const aspect = (meta.width ?? 1) / (meta.height ?? 1);
    console.log(`✓ ${b.slug}  ${meta.width}×${meta.height} aspect=${aspect.toFixed(2)}  ${(webp.length / 1024).toFixed(1)}KB`);
    results.push({ slug: b.slug, label: b.label, aspect, w: meta.width, h: meta.height });
  }
  console.log("\nPaste into overlays.ts EDITOR_BADGES:");
  console.log(results.map((r) => `  { slug: "${r.slug}", label: "${r.label}", url: cdn("${r.slug}"), aspectRatio: ${r.aspect.toFixed(3)} }`).join(",\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
