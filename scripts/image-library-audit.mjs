#!/usr/bin/env node
// scripts/image-library-audit.mjs
//
// Discovery pass for the thenetworkers → NEX image library migration.
// Scans the codebase for every image URL, classifies each by origin
// and inferred purpose, and writes:
//
//   scripts/image-migration-inventory.json  — raw per-URL data
//   docs/IMAGE_LIBRARY_MIGRATION_PLAN.md    — human-readable plan
//
// Zero images moved. Read the plan, decide the target NEX buckets,
// then approve execution as a separate step.
//
// Usage:  node scripts/image-library-audit.mjs

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Directories to scan for URL references
const SCAN_DIRS = ["src", "data", "knowledge", "scripts", "public"].map((d) =>
  path.join(ROOT, d)
);

// Image URL patterns (both ImageKit accounts + Supabase Storage)
const URL_PATTERNS = [
  /https?:\/\/ik\.imagekit\.io\/9mrgsv2rp\/[^\s"'`)\\]+/g, // old / networkers
  /https?:\/\/ik\.imagekit\.io\/5vv5pw26q\/[^\s"'`)\\]+/g, // new / nex-era
  /https?:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/(?:public\/)?[^\s"'`)\\]+\.(?:png|jpg|jpeg|webp|gif|svg|avif)/gi,
];

// File-extension include list for scanning
const SOURCE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".md",
  ".html",
  ".sql",
  ".css",
]);

// Skip these subdirectories entirely
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".turbo",
  "coverage",
]);

// Files to skip inside knowledge/ (backups)
function shouldSkipFile(rel) {
  return /\.bak\./.test(rel) || /\/\.imagekit-migration-map\.json$/.test(rel);
}

/** Recursive file walk. */
async function walk(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, out);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (SOURCE_EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

/** Extract every image URL from a file. */
async function extractUrls(file) {
  let content;
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    return [];
  }
  const found = [];
  for (const pattern of URL_PATTERNS) {
    for (const m of content.matchAll(pattern)) {
      found.push(m[0]);
    }
  }
  return found;
}

/** Classify a URL by origin. */
function classifyOrigin(url) {
  if (url.includes("ik.imagekit.io/9mrgsv2rp/"))
    return { origin: "imagekit-legacy", bucket: null };
  if (url.includes("ik.imagekit.io/5vv5pw26q/"))
    return { origin: "imagekit-nex-era", bucket: null };
  const supaMatch = url.match(
    /supabase\.co\/storage\/v1\/object\/(?:public\/)?([^/]+)\//
  );
  if (supaMatch)
    return { origin: "supabase-storage", bucket: supaMatch[1] };
  return { origin: "other", bucket: null };
}

/** Infer the purpose of an image from filename hints + referring
 *  file context. Best-effort — not authoritative. */
function inferPurpose(url, referringFiles) {
  const filename = decodeURIComponent(
    url.split("/").pop().split("?")[0].toLowerCase()
  );
  const refs = referringFiles.join(" ").toLowerCase();
  const combined = `${filename} ${refs}`;

  const rules = [
    { pattern: /staircase|stairs|tread|riser|balustrade|newel|handrail|joinery|stair-/, purpose: "staircase" },
    { pattern: /logo|catalog|brand/, purpose: "logo" },
    { pattern: /van|vehicle/, purpose: "van_livery" },
    { pattern: /hero|banner|cover/, purpose: "hero_banner" },
    { pattern: /avatar|profile/, purpose: "avatar" },
    { pattern: /product|commerce|marketplace/, purpose: "product" },
    { pattern: /wood|timber|oak|pine|walnut|mahogany|cherry|maple/, purpose: "wood_sample" },
    { pattern: /template|thumbnail/, purpose: "template_thumbnail" },
    { pattern: /sitebook|beacon/, purpose: "sitebook" },
    { pattern: /social/, purpose: "social_media" },
    { pattern: /badge|award/, purpose: "badge" },
    { pattern: /diagram|schematic|blueprint/, purpose: "diagram" },
  ];
  for (const r of rules) {
    if (r.pattern.test(combined)) return r.purpose;
  }
  return "unclassified";
}

async function main() {
  console.log("Scanning source files…");
  const allFiles = [];
  for (const dir of SCAN_DIRS) {
    await walk(dir, allFiles);
  }
  console.log(`  ${allFiles.length} source files found`);

  // Map: url → { urls: Set of raw variants, referring_files: Set }
  const urlMap = new Map();
  for (const file of allFiles) {
    const rel = path.relative(ROOT, file);
    if (shouldSkipFile(rel)) continue;
    const urls = await extractUrls(file);
    for (const url of urls) {
      // Normalise by stripping cache-busting query params for grouping
      const canonical = url.split("?")[0];
      if (!urlMap.has(canonical)) {
        urlMap.set(canonical, {
          canonical_url: canonical,
          raw_variants: new Set(),
          referring_files: new Set(),
        });
      }
      const entry = urlMap.get(canonical);
      entry.raw_variants.add(url);
      entry.referring_files.add(rel);
    }
  }

  console.log(`  ${urlMap.size} unique canonical URLs discovered`);

  // Build the inventory
  const inventory = [];
  const byOrigin = {};
  const byPurpose = {};
  const bySupabaseBucket = {};

  for (const [canonical, data] of urlMap) {
    const { origin, bucket } = classifyOrigin(canonical);
    const referringFiles = [...data.referring_files];
    const purpose = inferPurpose(canonical, referringFiles);

    const row = {
      canonical_url: canonical,
      origin,
      supabase_bucket: bucket,
      purpose,
      raw_variant_count: data.raw_variants.size,
      referring_file_count: referringFiles.length,
      referring_files: referringFiles,
    };
    inventory.push(row);

    byOrigin[origin] = (byOrigin[origin] ?? 0) + 1;
    byPurpose[purpose] = (byPurpose[purpose] ?? 0) + 1;
    if (bucket) bySupabaseBucket[bucket] = (bySupabaseBucket[bucket] ?? 0) + 1;
  }

  // Cross-check against the existing migration map
  let migrationMap = {};
  try {
    migrationMap = JSON.parse(
      await fs.readFile(
        path.join(ROOT, "scripts", ".imagekit-migration-map.json"),
        "utf8"
      )
    );
  } catch {
    // no map
  }
  const alreadyMigrated = new Set(Object.keys(migrationMap).map((u) => u.split("?")[0]));
  const legacyImagekit = inventory.filter((r) => r.origin === "imagekit-legacy");
  const legacyStillNeedsMigration = legacyImagekit.filter(
    (r) => !alreadyMigrated.has(r.canonical_url)
  );

  // Purpose breakdown for legacy-imagekit only (the actual migration set)
  const legacyByPurpose = {};
  for (const row of legacyStillNeedsMigration) {
    legacyByPurpose[row.purpose] = (legacyByPurpose[row.purpose] ?? 0) + 1;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    total_unique_urls: inventory.length,
    by_origin: byOrigin,
    by_purpose_all: byPurpose,
    supabase_buckets_referenced: bySupabaseBucket,
    imagekit_migration_map_entries: Object.keys(migrationMap).length,
    imagekit_legacy_total: legacyImagekit.length,
    imagekit_legacy_still_to_migrate: legacyStillNeedsMigration.length,
    imagekit_legacy_by_purpose: legacyByPurpose,
  };

  const outJson = path.join(ROOT, "scripts", "image-migration-inventory.json");
  await fs.writeFile(
    outJson,
    JSON.stringify({ summary, inventory }, null, 2),
    "utf8"
  );
  console.log(`  wrote ${path.relative(ROOT, outJson)}`);

  // Also write a plan document
  const planPath = path.join(ROOT, "docs", "IMAGE_LIBRARY_MIGRATION_PLAN.md");
  const planMd = buildPlanMarkdown(summary, legacyStillNeedsMigration);
  await fs.writeFile(planPath, planMd, "utf8");
  console.log(`  wrote ${path.relative(ROOT, planPath)}`);

  console.log("\nSUMMARY");
  console.log(JSON.stringify(summary, null, 2));
}

function buildPlanMarkdown(summary, legacyToMigrate) {
  const lines = [];
  lines.push("# Image Library Migration Plan — thenetworkers → NEX");
  lines.push("");
  lines.push(`Generated: ${summary.generated_at}`);
  lines.push("");
  lines.push("Discovery pass per ADR-0023 discussion. Zero images moved.");
  lines.push("This document proposes target NEX-named Supabase buckets,");
  lines.push("classifies the migration set, and sequences the work.");
  lines.push("Approve or amend before any execution.");
  lines.push("");
  lines.push("## Current state");
  lines.push("");
  lines.push(`- **Unique image URLs across the app:** ${summary.total_unique_urls}`);
  lines.push("- **By origin:**");
  for (const [origin, count] of Object.entries(summary.by_origin)) {
    lines.push(`  - \`${origin}\`: ${count}`);
  }
  lines.push(`- **Existing migration map entries** (\`scripts/.imagekit-migration-map.json\`): ${summary.imagekit_migration_map_entries}`);
  lines.push(`- **Legacy ImageKit URLs still awaiting migration:** ${summary.imagekit_legacy_still_to_migrate} of ${summary.imagekit_legacy_total}`);
  lines.push("");
  lines.push("## Supabase buckets currently referenced by URL");
  lines.push("");
  for (const [bucket, count] of Object.entries(summary.supabase_buckets_referenced)) {
    lines.push(`- \`${bucket}\`: ${count} referenced URLs`);
  }
  lines.push("");
  lines.push("## Legacy migration set — purpose breakdown");
  lines.push("");
  lines.push("These are the URLs on `ik.imagekit.io/9mrgsv2rp/` that");
  lines.push("still need to move to NEX-owned storage. Purpose is inferred");
  lines.push("from filename + referring-file context (best-effort — audit");
  lines.push("the inventory JSON for edge cases).");
  lines.push("");
  lines.push("| Purpose | Count | Suggested NEX bucket |");
  lines.push("|---|---:|---|");
  const bucketMap = {
    staircase: "nex-staircase-library",
    logo: "nex-logos",
    van_livery: "nex-van-liveries",
    hero_banner: "nex-hero-banners",
    avatar: "nex-avatars",
    product: "nex-product-images",
    wood_sample: "nex-material-samples",
    template_thumbnail: "nex-template-thumbnails",
    sitebook: "nex-sitebook",
    social_media: "nex-social-media",
    badge: "nex-badges",
    diagram: "nex-diagrams",
    unclassified: "nex-unclassified-inbox",
  };
  const purposes = Object.entries(summary.imagekit_legacy_by_purpose).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [purpose, count] of purposes) {
    lines.push(`| ${purpose} | ${count} | \`${bucketMap[purpose] ?? "nex-misc"}\` |`);
  }
  lines.push("");
  lines.push("## Proposed target-bucket schema");
  lines.push("");
  lines.push("Every NEX-owned bucket follows the naming convention `nex-<domain>-<subdomain>`");
  lines.push("so provenance is unambiguous. All buckets `public: true` for CDN reads");
  lines.push("(RLS via storage.objects policies for writes). Retire the legacy");
  lines.push("`networkers-*` bucket names once references are updated.");
  lines.push("");
  lines.push("## Recommended sequence");
  lines.push("");
  lines.push("1. **Approve target buckets** (this doc)");
  lines.push("2. **Write bucket-creation migration** (`supabase/migrations/YYYYMMDD_nex_image_buckets.sql`)");
  lines.push("3. **Batch 1 — staircase subset** (~staircase count above): highest-value for the current directory push");
  lines.push("4. **Batch 2 — logos + avatars**: small, high-visibility, cleanly separable");
  lines.push("5. **Batch 3 — hero banners + wood samples**: modest volume");
  lines.push("6. **Batch 4 — product images**: bulk work");
  lines.push("7. **Batch 5 — long tail** (templates, sitebook, badges, diagrams, unclassified)");
  lines.push("8. **Update reference map** on every batch: extend `scripts/.imagekit-migration-map.json` in append-only mode");
  lines.push("9. **Codemod pass** to swap URLs across the ~40 referring files (one-shot per batch, verified diff-by-diff)");
  lines.push("10. **Retire the legacy ImageKit account** only after zero references remain (grep verification)");
  lines.push("");
  lines.push("## Referring-files hotspots (top 20 files by legacy URL count)");
  lines.push("");
  const fileCounts = {};
  for (const row of legacyToMigrate) {
    for (const f of row.referring_files) {
      fileCounts[f] = (fileCounts[f] ?? 0) + 1;
    }
  }
  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [file, count] of topFiles) {
    lines.push(`- \`${file}\` — ${count} URLs`);
  }
  lines.push("");
  lines.push("## Raw inventory");
  lines.push("");
  lines.push("Full per-URL data (canonical URL · origin · purpose · referring files) is in:");
  lines.push("");
  lines.push("`scripts/image-migration-inventory.json`");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("_Next step:_ review + amend, then approve execution posture (batched vs. all-at-once).");
  lines.push("Per ADR-0023, no images move until you say go.");
  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
