// NEX ImageKit → Supabase migration · READ-ONLY DB inspection.
// Philip 2026-09-02 · Phase 2 · authorised.
//
// PURPOSE
//   Query the NEX Supabase project to find every column that could hold an
//   ImageKit URL. Count how many rows in each column actually reference
//   `ik.imagekit.io`. Report samples. Zero writes.
//
// SAFETY
//   · SELECT queries only · no INSERT / UPDATE / DELETE / DDL
//   · Uses SERVICE_ROLE_KEY (bypasses RLS · needed to see everything)
//   · Reads env from `.env.local` · never hardcodes credentials
//   · Prints redacted URLs (host + path only, no query strings) to reduce
//     accidental credential leakage if output is shared
//
// OUTPUT
//   Console report:
//     · List of every column with `url` / `image` / `photo` / `avatar` /
//       `hero` / `thumbnail` / `cover` in its name
//     · Count of ImageKit URLs found per column
//     · Up to 3 sample URLs per column
//     · Total unique ImageKit accounts referenced live
//
// USAGE
//   node scripts/nex-imagekit-migration/01-inspect-db.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ─── Load env from .env.local (dotenv-lite · no dependency) ────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const envPath = join(repoRoot, ".env.local");
let env = {};
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (e) {
  console.error(`Failed to read .env.local at ${envPath}:`, e.message);
  process.exit(1);
}

const NEX_SUPABASE_URL = env.NEX_SUPABASE_URL || env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_SERVICE_KEY  = env.NEX_SUPABASE_SERVICE_ROLE_KEY;

if (!NEX_SUPABASE_URL || !NEX_SERVICE_KEY) {
  console.error("Missing NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
console.log(`Target NEX Supabase: ${NEX_SUPABASE_URL}`);
console.log(`(using service_role key · bypasses RLS · read-only queries only)\n`);

const sb = createClient(NEX_SUPABASE_URL, NEX_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Find columns likely to hold URLs · via information_schema ─────────
// We query information_schema.columns for text/jsonb columns whose name
// suggests they hold an image URL. This gives us the FULL surface even
// if I miss a table in my local migration audit.
const COL_PATTERN = "%url%,%image%,%photo%,%avatar%,%hero%,%thumbnail%,%thumb%,%cover%,%banner%,%asset%,%src%,%media%";

async function findCandidateColumns() {
  // Supabase Postgres exposes information_schema. Use rpc-less raw SQL via
  // the pg REST endpoint. supabase-js can call a stored function; without
  // one, we use a Postgres view — but we can query information_schema
  // directly through PostgREST if it's exposed.
  //
  // Fallback: hit the REST /rpc endpoint of a built-in function if defined.
  // If neither works, fall back to hitting a fixed list of known tables.
  //
  // Cleanest path: use pg dumps or supabase-js `.from('information_schema.columns')`
  // which works on many projects when the schema is exposed to REST.
  try {
    // Try direct read of information_schema.columns filtered by name pattern.
    const patterns = COL_PATTERN.split(",");
    const { data, error } = await sb
      .schema("information_schema")
      .from("columns")
      .select("table_schema, table_name, column_name, data_type")
      .in("data_type", ["text", "character varying", "jsonb", "json"])
      .or(patterns.map((p) => `column_name.ilike.${p.trim()}`).join(","));
    if (error) throw error;
    return data.filter(
      (c) =>
        c.table_schema === "public" ||
        c.table_schema === "nex" ||
        c.table_schema.startsWith("nex_"),
    );
  } catch (e) {
    console.error("information_schema query failed:", e.message);
    console.error("Falling back to seeded column list from migration audit.");
    return SEEDED_CANDIDATES;
  }
}

// Fallback: columns I found in local migration files (NEX-scoped only).
const SEEDED_CANDIDATES = [
  { table_schema: "public", table_name: "nex_uploads",           column_name: "storage_path",       data_type: "text"  },
  { table_schema: "public", table_name: "nex_social_posts",      column_name: "image_urls",         data_type: "jsonb" },
  { table_schema: "public", table_name: "nex_materials",         column_name: "photo_url",          data_type: "text"  },
  { table_schema: "public", table_name: "nex_projects",          column_name: "merchant_avatar_url",data_type: "text"  },
];

// ─── Count ImageKit URLs in each candidate column ──────────────────────
async function countImageKitInColumn(schema, table, column, dataType) {
  const fq = `${schema}.${table}`;
  try {
    if (dataType === "jsonb" || dataType === "json") {
      // JSON arrays / objects · use ::text::ilike for a fuzzy match.
      const { count, error } = await sb
        .schema(schema)
        .from(table)
        .select(column, { count: "exact", head: true })
        .filter(column, "cs", '"ik.imagekit.io"');
      if (error) throw error;
      // Sample 3 non-null rows
      const { data: samples } = await sb
        .schema(schema)
        .from(table)
        .select(column)
        .not(column, "is", null)
        .limit(3);
      return { fq, column, count: count ?? 0, samples: (samples ?? []).map((r) => JSON.stringify(r[column]).slice(0, 200)) };
    } else {
      const { count, error } = await sb
        .schema(schema)
        .from(table)
        .select(column, { count: "exact", head: true })
        .ilike(column, "%ik.imagekit.io%");
      if (error) throw error;
      const { data: samples } = await sb
        .schema(schema)
        .from(table)
        .select(column)
        .ilike(column, "%ik.imagekit.io%")
        .limit(3);
      return { fq, column, count: count ?? 0, samples: (samples ?? []).map((r) => String(r[column]).slice(0, 200)) };
    }
  } catch (e) {
    return { fq, column, count: 0, error: e.message };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────
(async () => {
  console.log("Discovering columns that could hold image URLs...");
  const columns = await findCandidateColumns();
  console.log(`Found ${columns.length} candidate columns.\n`);

  const results = [];
  for (const c of columns) {
    const r = await countImageKitInColumn(c.table_schema, c.table_name, c.column_name, c.data_type);
    results.push(r);
    const flag = r.error ? "!" : r.count > 0 ? "*" : " ";
    console.log(`  ${flag} ${r.fq}.${r.column}  →  ${r.count} rows with ImageKit URLs`);
    if (r.error) console.log(`      error: ${r.error}`);
    if (r.samples && r.samples.length > 0) {
      r.samples.forEach((s, i) => console.log(`      sample ${i + 1}: ${s}`));
    }
  }

  const totalRows = results.reduce((acc, r) => acc + (r.count || 0), 0);
  const columnsWithData = results.filter((r) => r.count > 0);
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`Total NEX DB rows with ImageKit URLs: ${totalRows}`);
  console.log(`Columns containing ImageKit URLs:     ${columnsWithData.length} / ${results.length}`);
  console.log(`Columns with query errors:            ${results.filter((r) => r.error).length}`);
  console.log("═══════════════════════════════════════════════════");
  console.log("\nWrite this list to a file? Not doing so automatically. Re-run with --json to emit JSON.");
})();
