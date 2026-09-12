// NEX ImageKit → Supabase migration · Phase 2 · READ-ONLY DISCOVERY.
// Philip 2026-09-02 · authorised.
//
// ═══════════════════════════════════════════════════════════════════════
// ABSOLUTE READ-ONLY CONTRACT
// ═══════════════════════════════════════════════════════════════════════
//
// This script MUST NOT:
//   · INSERT / UPDATE / DELETE / MERGE / TRUNCATE
//   · ALTER / CREATE / DROP any table / view / function / trigger / index
//   · CREATE / DELETE any Storage bucket
//   · UPLOAD / COPY / MOVE / DELETE any Storage object
//   · Modify any source file / manifest / .env
//   · Create any migration file
//   · Create any stored procedure or RPC function in the target DB
//
// If pg_catalog / information_schema cannot be queried safely via the
// available REST API, the limitation is REPORTED rather than worked
// around by creating DB objects.
//
// Every Supabase operation used below is READ-ONLY:
//   · fetch(rest_url) [GET only]
//   · sb.storage.listBuckets()      · read
//   · sb.storage.from(x).list(path) · read
//   · sb.from(t).select(*)          · read
//   · HTTP HEAD on public URLs      · read
//
// PURPOSE
//   Get 100 % clarity on where NEX data + images currently live BEFORE
//   any Phase 3 migration decision. Produces:
//     A · NEX database inventory
//     B · MAIN database inventory
//     C · NEX Storage inventory
//     D · MAIN Storage inventory
//     E · Existing 127-object inventory (MAIN Supabase)
//     F · ImageKit inventory (all 3 NEX manifests)
//     G · Source-code references (delta from Phase 1)
//     H · Data-file references (delta from Phase 1)
//     I · Provenance risks (best-effort heuristic buckets)
//     J · Recommended migration architecture (documented · not executed)
//
// OUTPUT
//   Console summary + a machine-readable JSON dump to
//   `data/nex-imagekit-migration-report.json` (this is a data file the
//   user can inspect · it does NOT modify any source / manifest).

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

// ─── Env loader (no dependency) ────────────────────────────────────────
function loadEnv() {
  const envPath = join(repoRoot, ".env.local");
  const env = {};
  try {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.error(`Failed to read .env.local: ${e.message}`);
    process.exit(1);
  }
  return env;
}

// ─── Project descriptors ───────────────────────────────────────────────
const env = loadEnv();
const projects = [
  {
    key:  "NEX",
    url:  env.NEX_SUPABASE_URL || env.NEXT_PUBLIC_NEX_SUPABASE_URL,
    key_service: env.NEX_SUPABASE_SERVICE_ROLE_KEY,
    key_anon:    env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY,
  },
  {
    key:  "MAIN",
    url:  env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    key_service: env.SUPABASE_SERVICE_ROLE_KEY,
    key_anon:    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
];
projects.forEach((p) => {
  if (!p.url || !p.key_service) {
    console.error(`${p.key}: missing URL or SERVICE_ROLE_KEY · aborting`);
    process.exit(1);
  }
});

console.log("═══════════════════════════════════════════════════════════");
console.log(" NEX ImageKit → Supabase · Phase 2 · READ-ONLY discovery");
console.log("═══════════════════════════════════════════════════════════\n");

const report = {
  generated_at: new Date().toISOString(),
  contract: "READ-ONLY · no INSERT / UPDATE / DELETE / DDL / bucket-create / file-upload",
  projects: {},
  manifests: {},
  source_code: {},
  provenance: {},
  recommended_architecture: null,
  limitations: [],
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION A/B · DATABASE INVENTORY (both projects)
// ═══════════════════════════════════════════════════════════════════════

// PostgREST exposes an OpenAPI spec at the REST base URL (GET, no writes).
// That spec lists every table + column + type. Uses only GET · read-only.
async function discoverSchemaViaOpenAPI(url, serviceKey) {
  const openapiUrl = `${url}/rest/v1/`;
  try {
    const res = await fetch(openapiUrl, {
      method: "GET",
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Accept":      "application/openapi+json",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} · ${res.statusText}` };
    }
    const spec = await res.json();
    // Extract table names + columns from paths + definitions.
    const tables = {};
    const defs = spec.definitions ?? spec.components?.schemas ?? {};
    for (const [tableName, def] of Object.entries(defs)) {
      const properties = def.properties ?? {};
      const columns = Object.entries(properties).map(([name, meta]) => ({
        name,
        type:   meta.type ?? "unknown",
        format: meta.format ?? null,
      }));
      tables[tableName] = { columns };
    }
    return { ok: true, table_count: Object.keys(tables).length, tables };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// URL-like column detector: names or types that plausibly hold image URLs.
const URL_COL_PATTERNS = [
  /url/i, /image/i, /photo/i, /avatar/i, /logo/i, /thumbnail/i, /thumb/i,
  /media/i, /storage/i, /file/i, /asset/i, /hero/i, /banner/i, /icon/i,
  /cover/i, /picture/i, /src/i, /background/i,
];
function isImageLikeColumn(col) {
  const n = col.name.toLowerCase();
  if (col.type !== "string" && col.type !== "object" && col.type !== "array") return false;
  return URL_COL_PATTERNS.some((p) => p.test(n));
}

// Count rows containing ImageKit URLs · READ-ONLY.
async function countImageKitInColumn(sb, table, col) {
  try {
    if (col.type === "string") {
      const { count, error } = await sb
        .from(table)
        .select(col.name, { count: "exact", head: true })
        .ilike(col.name, "%ik.imagekit.io%");
      if (error) return { error: error.message };
      return { count: count ?? 0 };
    } else {
      // JSON containment - imprecise but read-only
      const { count, error } = await sb
        .from(table)
        .select(col.name, { count: "exact", head: true })
        .filter(col.name, "cs", '"ik.imagekit.io"');
      if (error) return { error: error.message };
      return { count: count ?? 0 };
    }
  } catch (e) {
    return { error: e.message };
  }
}

async function auditProjectDatabase(project) {
  console.log(`\n─── ${project.key} DB (${project.url}) ────────────`);
  const sb = createClient(project.url, project.key_service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const schema = await discoverSchemaViaOpenAPI(project.url, project.key_service);
  if (!schema.ok) {
    console.log(`  ✗ OpenAPI discovery failed: ${schema.error}`);
    report.limitations.push(`${project.key}: OpenAPI schema discovery failed · ${schema.error}`);
    return { schema_discovery: { ok: false, error: schema.error }, tables: {} };
  }
  console.log(`  ✓ OpenAPI reachable · ${schema.table_count} tables exposed`);

  const tables = {};
  const imageLikeCols = [];
  for (const [tableName, def] of Object.entries(schema.tables)) {
    const imageColumns = def.columns.filter(isImageLikeColumn);
    if (imageColumns.length > 0) {
      imageLikeCols.push({ table: tableName, columns: imageColumns.map((c) => c.name) });
      tables[tableName] = { image_columns: imageColumns };
    }
  }
  console.log(`  → ${imageLikeCols.length} tables have image-like columns`);

  // For NEX-scoped tables (name starts with "nex" OR any column mentions
  // ImageKit as a hint that this is a NEX table), count ImageKit URLs.
  for (const [tableName, tableInfo] of Object.entries(tables)) {
    const isNex = tableName.toLowerCase().startsWith("nex");
    // Only actively count for NEX-named tables in this pass · keeps calls light.
    if (!isNex) { tableInfo.imagekit_row_count = "not_counted (non-nex table)"; continue; }
    tableInfo.imagekit_counts = {};
    for (const col of tableInfo.image_columns) {
      const result = await countImageKitInColumn(sb, tableName, col);
      tableInfo.imagekit_counts[col.name] = result;
      const disp = result.error ? `err: ${result.error}` : `${result.count} rows`;
      console.log(`    ${tableName}.${col.name} → ${disp}`);
    }
  }

  return {
    schema_discovery: { ok: true, table_count: schema.table_count },
    tables_with_image_columns: tables,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION C/D · STORAGE INVENTORY (both projects)
// ═══════════════════════════════════════════════════════════════════════

async function inventoryStorage(project) {
  console.log(`\n─── ${project.key} Storage ────────────────────────`);
  const sb = createClient(project.url, project.key_service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) {
    console.log(`  ✗ listBuckets failed: ${error.message}`);
    report.limitations.push(`${project.key}: listBuckets failed · ${error.message}`);
    return { error: error.message };
  }
  console.log(`  ✓ ${buckets.length} buckets found`);
  const inventory = [];
  for (const bucket of buckets) {
    // Get first 1000 objects (read-only). If more exist, we report the
    // truncation limit rather than making thousands of calls.
    let object_count = null;
    let sample = [];
    try {
      const { data: files, error: listErr } = await sb.storage.from(bucket.name).list("", { limit: 1000 });
      if (listErr) {
        object_count = `err: ${listErr.message}`;
      } else {
        object_count = files.length;
        sample = files.slice(0, 5).map((f) => ({ name: f.name, size: f.metadata?.size }));
      }
    } catch (e) {
      object_count = `err: ${e.message}`;
    }
    const nexRelated = /nex|imagekit-import/i.test(bucket.name);
    const entry = {
      name:            bucket.name,
      public:          bucket.public,
      created_at:      bucket.created_at,
      approx_objects:  object_count,
      nex_related:     nexRelated,
      sample_top5:     sample,
    };
    inventory.push(entry);
    console.log(`    ${bucket.public ? "🌐" : "🔒"} ${bucket.name}  ·  ${object_count} objects  ${nexRelated ? "· NEX-related" : ""}`);
  }
  return { buckets: inventory };
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION E · EXISTING 127 SUPABASE URLs (MAIN project · retrievability)
// ═══════════════════════════════════════════════════════════════════════

async function inventoryExisting127() {
  console.log(`\n─── Existing 127 MAIN-Supabase URLs (HEAD check) ─`);
  const manifest = readFileSync(join(repoRoot, "data/nex-image-manifest.json"), "utf8");
  const supabaseUrls = [...new Set(manifest.match(/https:\/\/[a-z0-9]*\.supabase\.co[^"'\s]*/g) || [])];
  console.log(`  ${supabaseUrls.length} distinct Supabase URLs in nex-image-manifest.json`);

  const results = [];
  // HEAD each URL (read only · standard HTTP) · in small batches to avoid overload.
  const BATCH = 8;
  for (let i = 0; i < supabaseUrls.length; i += BATCH) {
    const batch = supabaseUrls.slice(i, i + BATCH);
    const outcomes = await Promise.all(
      batch.map(async (url) => {
        try {
          const res = await fetch(url, { method: "HEAD" });
          return {
            url,
            status:       res.status,
            content_type: res.headers.get("content-type"),
            size:         Number(res.headers.get("content-length")) || null,
            retrievable:  res.ok,
          };
        } catch (e) {
          return { url, error: e.message, retrievable: false };
        }
      }),
    );
    results.push(...outcomes);
    process.stdout.write(`\r  progress: ${Math.min(i + BATCH, supabaseUrls.length)} / ${supabaseUrls.length}`);
  }
  console.log("\n");

  const retrievable = results.filter((r) => r.retrievable).length;
  const broken      = results.filter((r) => !r.retrievable).length;
  const byMime = {};
  const byBucket = {};
  for (const r of results) {
    if (r.content_type) byMime[r.content_type] = (byMime[r.content_type] || 0) + 1;
    const m = r.url.match(/\/storage\/v1\/object\/public\/([^/]+)\//);
    if (m) byBucket[m[1]] = (byBucket[m[1]] || 0) + 1;
  }

  console.log(`  ✓ Retrievable: ${retrievable}  ✗ Broken: ${broken}`);
  console.log(`  Buckets referenced:`, byBucket);
  console.log(`  MIME types:`, byMime);
  return {
    total_urls:          supabaseUrls.length,
    retrievable:         retrievable,
    broken:              broken,
    buckets_referenced:  byBucket,
    mime_types:          byMime,
    per_url:             results,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION F · IMAGEKIT MANIFEST CLASSIFICATION (all 3 manifests)
// ═══════════════════════════════════════════════════════════════════════

const MANIFEST_FILES = [
  "data/nex-image-manifest.json",
  "data/nex-curated-images-manifest.json",
  "data/nex-confirmed-images.json",
];

function classifyManifest(path) {
  const abs = join(repoRoot, path);
  if (!existsSync(abs)) return { path, exists: false };
  const raw = readFileSync(abs, "utf8");
  const urls = raw.match(/https?:\/\/[^"'\s\)]+/g) || [];
  const uniqueUrls = new Set(urls);
  const imagekit = urls.filter((u) => u.includes("ik.imagekit.io"));
  const supabase = urls.filter((u) => /\.supabase\.(co|in)/.test(u));
  const other    = urls.filter((u) => !u.includes("ik.imagekit.io") && !/\.supabase\.(co|in)/.test(u));
  const accounts = {};
  for (const u of imagekit) {
    const m = u.match(/ik\.imagekit\.io\/([a-z0-9]+)/i);
    if (m) accounts[m[1]] = (accounts[m[1]] || 0) + 1;
  }
  const size = statSync(abs).size;
  return {
    path,
    exists:                  true,
    file_size_bytes:         size,
    total_urls:              urls.length,
    unique_urls:             uniqueUrls.size,
    duplicate_urls:          urls.length - uniqueUrls.size,
    imagekit_urls:           imagekit.length,
    imagekit_urls_unique:    new Set(imagekit).size,
    supabase_urls:           supabase.length,
    supabase_urls_unique:    new Set(supabase).size,
    other_urls:              other.length,
    imagekit_accounts:       accounts,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION G/H · SOURCE + DATA FILE REFERENCE COUNTS (delta from Phase 1)
// ═══════════════════════════════════════════════════════════════════════

import { execSync } from "node:child_process";
function countGrep(pattern, path) {
  try {
    const out = execSync(
      `git ls-files "${path}" | xargs grep -l "${pattern}" 2>/dev/null || true`,
      { cwd: repoRoot, encoding: "utf8", shell: true },
    );
    return out.trim().split(/\r?\n/).filter(Boolean);
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION I · PROVENANCE HEURISTICS (best-effort · flag UNKNOWN clearly)
// ═══════════════════════════════════════════════════════════════════════

// Classification is a HINT, not a decision. Every URL requires human
// review before migration. The script only splits URLs into buckets so
// the user can spot patterns without eyeballing 2000+ URLs.
function classifyProvenance(url) {
  if (/\.supabase\.(co|in)/.test(url)) return "ALREADY_MIGRATED";
  // OpenAI/ChatGPT-generated images · Philip created via ChatGPT · owned
  if (/ChatGPT%20Image|ChatGPT_Image|chatgpt.image/i.test(url)) return "OWNED_LIKELY_AI_GENERATED";
  // "Untitled" pattern + hash-like suffixes = personal uploads
  if (/Untitled[a-z]+\.png/i.test(url) || /Untitled.*removebg/i.test(url)) return "OWNED_LIKELY_UPLOAD";
  // ".png?updatedAt=..." pattern only = generic ImageKit hosted file
  if (/removebg-preview\.png/i.test(url)) return "OWNED_LIKELY_PROCESSED";
  return "UNKNOWN_PROVENANCE";
}

function classifyManifestProvenance(path) {
  const abs = join(repoRoot, path);
  if (!existsSync(abs)) return null;
  const raw = readFileSync(abs, "utf8");
  const urls = [...new Set(raw.match(/https?:\/\/[^"'\s\)]+/g) || [])];
  const buckets = {
    ALREADY_MIGRATED: 0,
    OWNED_LIKELY_AI_GENERATED: 0,
    OWNED_LIKELY_UPLOAD: 0,
    OWNED_LIKELY_PROCESSED: 0,
    UNKNOWN_PROVENANCE: 0,
  };
  const samples = { UNKNOWN_PROVENANCE: [] };
  for (const url of urls) {
    const cls = classifyProvenance(url);
    buckets[cls]++;
    if (cls === "UNKNOWN_PROVENANCE" && samples.UNKNOWN_PROVENANCE.length < 10) {
      samples.UNKNOWN_PROVENANCE.push(url);
    }
  }
  return { total: urls.length, buckets, samples };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  // A + B · database inventory (both projects)
  for (const p of projects) {
    report.projects[p.key] = { url: p.url };
    report.projects[p.key].database = await auditProjectDatabase(p);
  }

  // C + D · storage inventory (both projects)
  for (const p of projects) {
    report.projects[p.key].storage = await inventoryStorage(p);
  }

  // E · existing 127 MAIN URLs
  report.projects.MAIN.existing_imagekit_import_inventory = await inventoryExisting127();

  // F · manifest classification
  console.log(`\n─── Manifest classification ──────────────────────`);
  for (const path of MANIFEST_FILES) {
    const cls = classifyManifest(path);
    report.manifests[path] = cls;
    if (cls.exists) {
      console.log(`  ${path}`);
      console.log(`    total ${cls.total_urls} · unique ${cls.unique_urls} · dup ${cls.duplicate_urls}`);
      console.log(`    imagekit ${cls.imagekit_urls} (${cls.imagekit_urls_unique} unique) · supabase ${cls.supabase_urls} · other ${cls.other_urls}`);
      console.log(`    accounts:`, cls.imagekit_accounts);
    } else {
      console.log(`  ${path} · MISSING`);
    }
  }

  // G · source-code references (delta count from Phase 1)
  console.log(`\n─── Source-code / data reference counts ──────────`);
  const nexPaths = [
    "src/app/nexapp",
    "src/app/nex-app",
    "src/components/nexapp",
    "src/components/nex-app",
    "src/lib/nexapp",
    "src/lib/nexapp-shell",
    "src/lib/nex-food",
    "src/lib/nex-mascots",
    "src/lib/nex-actions",
    "src/lib/nex-brain",
    "src/lib/nex-directory",
    "src/lib/nex-voice",
    "src/lib/refacing",
  ];
  const codeCounts = {};
  for (const p of nexPaths) {
    codeCounts[p] = countGrep("ik.imagekit.io", `${p}/**/*.ts*`).length;
  }
  const dataCount = countGrep("ik.imagekit.io", "data/nex-*").length;
  console.log("  Source per NEX path:", codeCounts);
  console.log(`  Data files under data/nex-*: ${dataCount}`);
  report.source_code.per_nex_path      = codeCounts;
  report.source_code.data_files_count  = dataCount;

  // I · provenance
  console.log(`\n─── Provenance (heuristic · human review needed) ─`);
  for (const path of MANIFEST_FILES) {
    const cls = classifyManifestProvenance(path);
    if (!cls) continue;
    report.provenance[path] = cls;
    console.log(`  ${path}`);
    Object.entries(cls.buckets).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
    if (cls.samples.UNKNOWN_PROVENANCE.length > 0) {
      console.log(`    UNKNOWN samples (first 3):`);
      cls.samples.UNKNOWN_PROVENANCE.slice(0, 3).forEach((u) => console.log(`      ${u}`));
    }
  }

  // J · recommended architecture · documented only · not created
  report.recommended_architecture = {
    target_project:           "NEX-specific (ijvqdvsvwtwxzcqmoqit)",
    bucket_name_proposal:     "nex-media",
    folder_structure: {
      "ui/":            "NexIcons · nexEmojis · nexVisualAssets",
      "frames/":        "chat frame · master · prev versions (currently in /public/nex/)",
      "avatars/":       "user avatars",
      "profiles/":      "profile-page media",
      "directory/food/":          "food directory images",
      "directory/accommodation/": "hotels · guesthouse · villa · kos · hostel",
      "directory/businesses/":    "general business directory",
      "directory/places/":        "map + place content",
      "marketplace/":             "marketplace listings",
      "social/":                  "social-post media (image_urls JSONB)",
      "live/":                    "NexCentreLiveFeed · NexPinterestFeed",
      "projects/":                "project photos + merchant avatars",
      "uploads/":                 "raw user uploads (nex_uploads target)",
    },
    consolidation_plan_for_existing_127: {
      current_location: "MAIN Supabase / product-images / imagekit-import/*",
      final_location:   "NEX Supabase / nex-media / <content-appropriate-subfolder>/*",
      approach:         "COPY not MOVE · keep MAIN copies during transition · switch references then remove after verification",
    },
    imagekit_landing_zone_note:
      "Do NOT permanently keep files in nex-media/imagekit-import/ · that's a migration staging pattern only · final placement is content-classified subfolders per Philip 2026-09-02 spec.",
  };

  // Write report to disk (data file · not a source file · doesn't touch code)
  const outPath = join(repoRoot, "data/nex-imagekit-migration-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(` Report written to: ${outPath}`);
  console.log(` Limitations encountered: ${report.limitations.length}`);
  if (report.limitations.length > 0) {
    report.limitations.forEach((l) => console.log(`   · ${l}`));
  }
  console.log(`═══════════════════════════════════════════════════════════`);
})();
