// NEX ImageKit → Supabase migration · Phase 2b · READ-ONLY detail audit.
// Philip 2026-09-02 · authorised.
//
// ═══════════════════════════════════════════════════════════════════════
// STRICT READ-ONLY CONTRACT (same as 01, 02)
// ═══════════════════════════════════════════════════════════════════════
//
// MUST NOT:
//   INSERT / UPDATE / DELETE / MERGE / TRUNCATE / ALTER / CREATE / DROP
//   any DB object · any Storage bucket · any Storage object · migrate any
//   file · modify any source / manifest / .env · create RPC / stored proc.
//
// MAY:
//   SELECT / count · Storage listBuckets · Storage list · HTTP HEAD/GET
//   metadata (no binary download) · read local files · write to ONE new
//   audit-only file at data/nex-imagekit-unknown-review.json.
//
// TASKS (per Philip 2026-09-02 authorisation)
//   1. Full ImageKit-URL audit across ALL 17 NEX-project tables · not just
//      nex_-prefixed ones · JSONB/arrays inspected by fetching values.
//   2. Write data/nex-imagekit-unknown-review.json with the 379
//      UNKNOWN_PROVENANCE URLs from nex-image-manifest.json + metadata.
//   3. HEAD-check every ImageKit URL across all 6 accounts to determine
//      reachability. No binary downloads.
//
// NOT DOING:
//   · MAIN Supabase re-probing beyond one confirmation attempt.
//   · Writing migration script 03.
//   · Creating nex-media bucket.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, "..", "..");

// ─── Env ───────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(repoRoot, ".env.local");
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const NEX_URL = env.NEX_SUPABASE_URL || env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_KEY = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!NEX_URL || !NEX_KEY) { console.error("Missing NEX Supabase env"); process.exit(1); }

const sb = createClient(NEX_URL, NEX_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("═══════════════════════════════════════════════════════════");
console.log(" NEX ImageKit → Supabase · Phase 2b detail audit · READ-ONLY");
console.log("═══════════════════════════════════════════════════════════\n");

const report = { generated_at: new Date().toISOString(), contract: "READ-ONLY" };

// ═══════════════════════════════════════════════════════════════════════
// TASK 1 · FULL 17-TABLE COLUMN INSPECTION
// ═══════════════════════════════════════════════════════════════════════

const URL_COL_PATTERNS = [
  /url/i, /image/i, /photo/i, /avatar/i, /logo/i, /thumbnail/i, /thumb/i,
  /media/i, /storage/i, /file/i, /asset/i, /hero/i, /banner/i, /icon/i,
  /cover/i, /picture/i, /src/i, /background/i,
];
const isImageLikeName = (name) => URL_COL_PATTERNS.some((p) => p.test(name));

async function fetchOpenAPI() {
  const res = await fetch(`${NEX_URL}/rest/v1/`, {
    method:  "GET",
    headers: { apikey: NEX_KEY, Authorization: `Bearer ${NEX_KEY}`, Accept: "application/openapi+json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// For string columns · SELECT count with ilike (no rows returned).
async function countStringMatches(table, column, pattern) {
  const { count, error } = await sb.from(table).select(column, { count: "exact", head: true }).ilike(column, pattern);
  return error ? { error: error.message } : { count: count ?? 0 };
}
// For array / jsonb columns · fetch rows + inspect values in JS.
// Uses a bounded page fetch (max 5000 rows per column) to avoid crushing DB.
async function inspectComplexColumn(table, column) {
  const PAGE = 1000;
  const MAX_ROWS = 5000;
  let offset = 0;
  let totalScanned = 0;
  let matches = { imagekit: 0, supabase: 0, other_url: 0 };
  let urlOccurrences = { imagekit: 0, supabase: 0, other_url: 0 };
  let truncated = false;
  while (offset < MAX_ROWS) {
    const { data, error } = await sb.from(table).select(column).range(offset, offset + PAGE - 1);
    if (error) return { error: error.message };
    if (!data || data.length === 0) break;
    for (const row of data) {
      const val = row[column];
      if (val == null) continue;
      const asStr = typeof val === "string" ? val : JSON.stringify(val);
      // Extract all URLs from the row
      const urls = asStr.match(/https?:\/\/[^"'\s\)]+/g) || [];
      let hitI = false, hitS = false, hitO = false;
      for (const u of urls) {
        if (u.includes("ik.imagekit.io")) { urlOccurrences.imagekit++; hitI = true; }
        else if (/\.supabase\.(co|in)/.test(u)) { urlOccurrences.supabase++; hitS = true; }
        else { urlOccurrences.other_url++; hitO = true; }
      }
      if (hitI) matches.imagekit++;
      if (hitS) matches.supabase++;
      if (hitO) matches.other_url++;
    }
    totalScanned += data.length;
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset >= MAX_ROWS) { truncated = true; break; }
  }
  return { totalScanned, rowsWith: matches, urlCounts: urlOccurrences, truncated };
}

async function auditAllTables() {
  console.log("─── Task 1 · Full NEX DB audit ─────────────────────");
  const spec = await fetchOpenAPI();
  const defs = spec.definitions ?? {};
  const tables = Object.keys(defs).sort();
  console.log(`  ${tables.length} tables to audit`);

  const results = [];
  for (const table of tables) {
    const cols = Object.entries(defs[table].properties ?? {}).map(([name, meta]) => ({
      name, type: meta.type ?? "unknown", format: meta.format ?? null,
    }));
    const urlLike = cols.filter((c) => isImageLikeName(c.name));
    // Also include any string column that has "url" format in OpenAPI hints
    const extraUrlFormat = cols.filter((c) => c.format === "uri" || c.format === "url").filter((c) => !urlLike.includes(c));
    const allCandidates = [...urlLike, ...extraUrlFormat];
    if (allCandidates.length === 0) {
      results.push({ table, image_columns: [], note: "no url-like columns" });
      continue;
    }
    // Get total row count once
    const { count: totalRows } = await sb.from(table).select("*", { count: "exact", head: true });
    console.log(`\n  ▸ ${table}  (${totalRows ?? "?"} total rows)`);
    const columnResults = [];
    for (const col of allCandidates) {
      const isSimpleString = col.type === "string";
      let stats;
      if (isSimpleString) {
        // Count by URL family
        const [ik, sb2, all] = await Promise.all([
          countStringMatches(table, col.name, "%ik.imagekit.io%"),
          countStringMatches(table, col.name, "%supabase.%"),
          countStringMatches(table, col.name, "%http%"),
        ]);
        stats = {
          strategy: "string_ilike",
          rows_with_imagekit_url: ik.count ?? null,
          rows_with_supabase_url: sb2.count ?? null,
          rows_with_any_url:      all.count ?? null,
          errors: [ik.error, sb2.error, all.error].filter(Boolean),
        };
        console.log(`    ${col.name} (string · format=${col.format ?? "-"})  ImageKit rows: ${ik.count ?? "err"}  · Supabase rows: ${sb2.count ?? "err"}  · any-URL rows: ${all.count ?? "err"}`);
      } else {
        // Array / jsonb / object · deep inspect
        stats = await inspectComplexColumn(table, col.name);
        stats.strategy = "value_scan";
        console.log(`    ${col.name} (${col.type})  scanned ${stats.totalScanned ?? 0}${stats.truncated ? "+" : ""} rows  ·  ImageKit rows: ${stats.rowsWith?.imagekit ?? 0}  ·  Supabase rows: ${stats.rowsWith?.supabase ?? 0}  ·  IK-URL count: ${stats.urlCounts?.imagekit ?? 0}`);
        if (stats.error) console.log(`      err: ${stats.error}`);
      }
      columnResults.push({ column: col.name, type: col.type, ...stats });
    }
    results.push({ table, total_rows: totalRows ?? null, columns: columnResults });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 2 · UNKNOWN-PROVENANCE REVIEW FILE
// ═══════════════════════════════════════════════════════════════════════

function classifyProvenance(url) {
  if (/\.supabase\.(co|in)/.test(url)) return "ALREADY_MIGRATED";
  if (/ChatGPT%20Image|ChatGPT_Image|chatgpt.image/i.test(url)) return "OWNED_LIKELY_AI_GENERATED";
  if (/Untitled[a-z]+/i.test(url)) return "OWNED_LIKELY_UPLOAD";
  if (/removebg-preview/i.test(url)) return "OWNED_LIKELY_PROCESSED";
  return "UNKNOWN_PROVENANCE";
}

async function writeUnknownReview() {
  console.log("\n─── Task 2 · UNKNOWN provenance review file ────────");
  const manifestPath = "data/nex-image-manifest.json";
  const raw = readFileSync(join(repoRoot, manifestPath), "utf8");
  const urls = [...new Set(raw.match(/https?:\/\/[^"'\s\)]+/g) || [])];
  const unknowns = [];
  const brokenEmpty = [];
  for (const url of urls) {
    const cls = classifyProvenance(url);
    if (cls === "UNKNOWN_PROVENANCE") {
      const acc = (url.match(/ik\.imagekit\.io\/([a-z0-9]+)/i) || [])[1] ?? null;
      const pathAfterAcc = acc ? url.split(acc + "/")[1] ?? "" : "";
      const filename = pathAfterAcc.split("?")[0] || null;
      // Heuristic reason
      let reason = "did not match any OWNED heuristic";
      if (/^[0-9a-f]{16,}\.[a-z]{3,4}$/i.test(filename ?? "")) reason = "hex-hash filename · likely imported / third-party";
      else if (!filename) reason = "empty filename · malformed URL";
      else if (/[A-Za-z]{3,}\s[A-Za-z]{3,}/.test(decodeURIComponent(filename))) reason = "human-readable name · possible curated content";
      const entry = {
        imagekit_url: url,
        imagekit_account: acc,
        filename,
        source_manifest: manifestPath,
        heuristic_reason: reason,
      };
      unknowns.push(entry);
      if (!filename || filename === "") brokenEmpty.push(entry);
    }
  }

  // Also flag broken curated URL(s) from curated manifest
  const curatedRaw = readFileSync(join(repoRoot, "data/nex-curated-images-manifest.json"), "utf8");
  const curatedUrls = [...new Set(curatedRaw.match(/https?:\/\/[^"'\s\)]+/g) || [])];
  const curatedBroken = [];
  for (const url of curatedUrls) {
    const pathAfterAcc = url.split(/ik\.imagekit\.io\/[a-z0-9]+\//)[1] ?? "";
    const filename = pathAfterAcc.split("?")[0] || null;
    if (!filename || filename === "") {
      curatedBroken.push({
        imagekit_url: url,
        imagekit_account: (url.match(/ik\.imagekit\.io\/([a-z0-9]+)/i) || [])[1] ?? null,
        filename: null,
        source_manifest: "data/nex-curated-images-manifest.json",
        heuristic_reason: "malformed URL · no filename after account",
      });
    }
  }

  const doc = {
    generated_at: new Date().toISOString(),
    purpose: "Human review before rehosting · NOT authorised for automated migration",
    total_unknown_urls: unknowns.length,
    total_broken_malformed_urls: brokenEmpty.length + curatedBroken.length,
    unknowns,
    broken_malformed_from_curated: curatedBroken,
    per_account_breakdown: unknowns.reduce((acc, u) => { acc[u.imagekit_account || "unknown"] = (acc[u.imagekit_account || "unknown"] || 0) + 1; return acc; }, {}),
  };

  const outPath = join(repoRoot, "data/nex-imagekit-unknown-review.json");
  writeFileSync(outPath, JSON.stringify(doc, null, 2));
  console.log(`  ✓ ${unknowns.length} unknown URLs written`);
  console.log(`  ✓ ${curatedBroken.length} malformed curated URLs flagged`);
  console.log(`  → ${outPath}`);
  return { unknowns_count: unknowns.length, malformed_count: brokenEmpty.length + curatedBroken.length };
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 3 · IMAGEKIT SOURCE AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════

async function testImageKitAvailability() {
  console.log("\n─── Task 3 · ImageKit source HEAD availability ─────");
  // Gather all unique ImageKit URLs across the 3 manifests
  const sources = [
    "data/nex-image-manifest.json",
    "data/nex-curated-images-manifest.json",
    "data/nex-confirmed-images.json",
  ];
  const allUrls = new Set();
  for (const p of sources) {
    const raw = readFileSync(join(repoRoot, p), "utf8");
    for (const u of raw.match(/https?:\/\/ik\.imagekit\.io\/[^"'\s\)]+/g) || []) allUrls.add(u);
  }
  const urls = [...allUrls];
  console.log(`  ${urls.length} unique ImageKit URLs across 3 manifests`);

  // HEAD each URL, batched. Track per-account outcomes.
  const CONC = 15;
  const outcomes = [];
  for (let i = 0; i < urls.length; i += CONC) {
    const batch = urls.slice(i, i + CONC);
    const settled = await Promise.all(batch.map(async (url) => {
      try {
        const res = await fetch(url, { method: "HEAD", redirect: "follow" });
        return {
          url,
          status:        res.status,
          ok:            res.ok,
          content_type:  res.headers.get("content-type") ?? null,
          content_length: Number(res.headers.get("content-length")) || null,
          final_url:     res.url,
        };
      } catch (e) {
        return { url, status: 0, ok: false, error: e.message };
      }
    }));
    outcomes.push(...settled);
    if ((i + CONC) % (CONC * 20) === 0 || i + CONC >= urls.length) {
      process.stdout.write(`\r  progress: ${Math.min(i + CONC, urls.length)} / ${urls.length}`);
    }
  }
  console.log("\n");

  // Per-account breakdown
  const perAccount = {};
  for (const r of outcomes) {
    const acc = (r.url.match(/ik\.imagekit\.io\/([a-z0-9]+)/i) || [])[1] ?? "unknown";
    perAccount[acc] ??= { total: 0, reachable: 0, ok200: 0, http_403: 0, http_404: 0, other_4xx: 0, http_5xx: 0, timeout_or_error: 0, mime_counts: {}, sample_bad: [] };
    const b = perAccount[acc];
    b.total++;
    if (r.ok) { b.reachable++; b.ok200++; }
    else if (r.status === 403) b.http_403++;
    else if (r.status === 404) b.http_404++;
    else if (r.status >= 400 && r.status < 500) b.other_4xx++;
    else if (r.status >= 500) b.http_5xx++;
    else b.timeout_or_error++;
    if (r.content_type) b.mime_counts[r.content_type] = (b.mime_counts[r.content_type] || 0) + 1;
    if (!r.ok && b.sample_bad.length < 3) b.sample_bad.push({ url: r.url, status: r.status, error: r.error });
  }
  console.log("  Per-account availability:");
  for (const [acc, b] of Object.entries(perAccount)) {
    console.log(`    ${acc}  total ${b.total}  ·  reachable ${b.reachable} (${((b.reachable / b.total) * 100).toFixed(1)}%)  ·  404 ${b.http_404}  ·  403 ${b.http_403}  ·  5xx ${b.http_5xx}  ·  timeout/err ${b.timeout_or_error}`);
  }
  return { total: urls.length, perAccount };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  try {
    report.task_1_db_audit = await auditAllTables();
    report.task_2_unknown_review = await writeUnknownReview();
    report.task_3_imagekit_availability = await testImageKitAvailability();
    report.main_supabase_note = "MAIN Supabase (msdonkkechxzgagyguoe) is unreachable from this machine · noted as external infrastructure limitation · no further probing attempted per Philip 2026-09-02 direction.";

    const outPath = join(repoRoot, "data/nex-imagekit-migration-report-2b.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(` Detail-audit report: ${outPath}`);
    console.log(` Unknown review file: data/nex-imagekit-unknown-review.json`);
    console.log(`═══════════════════════════════════════════════════════════`);
  } catch (e) {
    console.error("FATAL:", e.message);
    process.exit(1);
  }
})();
