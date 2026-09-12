#!/usr/bin/env node
// ADR-0314a.2.s · §7.1 · Read-only Supabase inventory of knowledge_records.category
//
// AUTHORISED: Philip · 2026-09-11 · verbatim in ADR-0314a.2.s §11
// SCOPE:      SELECT-only · knowledge_records table · public schema
// FORBIDDEN:  INSERT · UPDATE · DELETE · ALTER · TRUNCATE · CREATE · DROP
//             normalisation · merging · renaming · promotion · deprecation
//             classification · derived values · any state change of any kind
//
// This script only calls .from("knowledge_records").select(<listed fields>)
// with .limit() + .range() pagination. No other Supabase-js methods used.
// Nothing about this script writes, modifies, or state-changes any row on
// any substrate. Output goes to stdout only.

import { createClient } from "@supabase/supabase-js";

// Read env supplied via `node --env-file=.env.local`
const url =
  process.env.NEX_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
  process.env.SUPABASE_URL;
const key =
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "[§7.1] Missing NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY. Aborting.",
  );
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" },
});

const PAGE_SIZE = 1000;
const timestamp = new Date().toISOString();

// Discovery pass: what fields does the live schema actually carry that
// touch classification? We probe defensively — request the fields we
// expect and let Supabase reject unknown ones. Any 400 = we learn the
// schema. This is a strict SELECT with LIMIT 1.
async function probeSchema() {
  const attemptedFields = [
    "id",
    "category",
    "subcategory",
    "status",
    "primary_audience",
    "canonical_owner",
    "authored_by",
    "authorised_by",
  ];
  const { data, error } = await client
    .from("knowledge_records")
    .select(attemptedFields.join(","))
    .limit(1);
  return { data, error, attemptedFields };
}

async function pageThroughAll(fields) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from("knowledge_records")
      .select(fields.join(","))
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { error, rows };
    if (!data || data.length === 0) break;
    for (const row of data) rows.push(row);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { error: null, rows };
}

function aggregate(rows) {
  // Per raw category value: row count · status distribution · subcategory sample · audience distribution
  const byCategory = new Map();
  for (const row of rows) {
    const raw = row.category;
    if (!byCategory.has(raw)) {
      byCategory.set(raw, {
        raw_value: raw,
        row_count: 0,
        status_dist: new Map(),
        subcategory_samples: new Set(),
        audience_dist: new Map(),
        authorised_by_null_count: 0,
        authorised_by_nonnull_count: 0,
      });
    }
    const bucket = byCategory.get(raw);
    bucket.row_count += 1;
    const status = row.status ?? "(null)";
    bucket.status_dist.set(status, (bucket.status_dist.get(status) ?? 0) + 1);
    if (row.subcategory != null && row.subcategory !== "") {
      bucket.subcategory_samples.add(row.subcategory);
    }
    const audience = row.primary_audience ?? "(null)";
    bucket.audience_dist.set(
      audience,
      (bucket.audience_dist.get(audience) ?? 0) + 1,
    );
    if (row.authorised_by == null) bucket.authorised_by_null_count += 1;
    else bucket.authorised_by_nonnull_count += 1;
  }
  return Array.from(byCategory.values()).sort(
    (a, b) => b.row_count - a.row_count,
  );
}

function mapToObj(m, cap = 20) {
  const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  const out = {};
  for (const [k, v] of arr.slice(0, cap)) out[k] = v;
  if (arr.length > cap) out.__truncated__ = arr.length - cap;
  return out;
}

function setToArr(s, cap = 12) {
  const arr = Array.from(s.values());
  if (arr.length <= cap) return arr;
  return arr.slice(0, cap).concat([`(+${arr.length - cap} more)`]);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("ADR-0314a.2.s · §7.1 · Live Supabase inventory");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Substrate: Supabase (public schema)`);
  console.log(`Table:     knowledge_records`);
  console.log(`Client:    @supabase/supabase-js · service role key`);
  console.log(`URL:       ${url.replace(/^(https:\/\/[^.]+).*/, "$1***")}`);
  console.log("");

  // Step 1 · probe schema
  const probe = await probeSchema();
  if (probe.error) {
    console.log("[§7.1] Schema probe failed:");
    console.log(JSON.stringify(probe.error, null, 2));
    // Fallback: minimal fields only
    console.log("[§7.1] Retrying with minimal fields [id, category] only.");
    const minimal = await client
      .from("knowledge_records")
      .select("id, category")
      .limit(1);
    if (minimal.error) {
      console.log("[§7.1] Minimal probe also failed. Aborting.");
      console.log(JSON.stringify(minimal.error, null, 2));
      process.exit(2);
    }
    console.log("[§7.1] Live schema carries at least [id, category].");
    console.log("");
    const fetch = await pageThroughAll(["id", "category"]);
    if (fetch.error) {
      console.log("[§7.1] Fetch failed:");
      console.log(JSON.stringify(fetch.error, null, 2));
      process.exit(3);
    }
    reportMinimal(fetch.rows);
    return;
  }

  const probedFields = probe.attemptedFields;
  console.log(`Schema probe: OK · fields available in live schema:`);
  console.log(`  ${probedFields.join(", ")}`);
  console.log("");
  console.log("SQL (verbatim intent):");
  console.log(
    `  SELECT ${probedFields.join(", ")} FROM public.knowledge_records`,
  );
  console.log("  (paginated via supabase-js .range() · PAGE_SIZE=1000)");
  console.log("");

  const fetch = await pageThroughAll(probedFields);
  if (fetch.error) {
    console.log("[§7.1] Fetch failed:");
    console.log(JSON.stringify(fetch.error, null, 2));
    process.exit(3);
  }

  const total = fetch.rows.length;
  const buckets = aggregate(fetch.rows);

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`HEADER`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total rows scanned:      ${total}`);
  console.log(`Total distinct category: ${buckets.length}`);
  console.log(
    `NULL category rows:      ${buckets.filter((b) => b.raw_value == null).reduce((s, b) => s + b.row_count, 0)}`,
  );
  console.log(
    `Empty-string category:   ${buckets.filter((b) => b.raw_value === "").reduce((s, b) => s + b.row_count, 0)}`,
  );
  console.log("");

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`PER-VALUE INVENTORY (sorted by row_count desc)`);
  console.log("═══════════════════════════════════════════════════════════");
  for (const b of buckets) {
    console.log("---");
    console.log(`raw_value:                  ${JSON.stringify(b.raw_value)}`);
    console.log(`row_count:                  ${b.row_count}`);
    console.log(`physical_substrate:         Supabase public.knowledge_records`);
    console.log(`source_table.field:         knowledge_records.category`);
    console.log(
      `status_distribution:        ${JSON.stringify(mapToObj(b.status_dist))}`,
    );
    console.log(
      `primary_audience_dist:      ${JSON.stringify(mapToObj(b.audience_dist))}`,
    );
    console.log(
      `subcategory_samples:        ${JSON.stringify(setToArr(b.subcategory_samples))}`,
    );
    console.log(
      `authorised_by_null_count:   ${b.authorised_by_null_count}`,
    );
    console.log(
      `authorised_by_nonnull_count: ${b.authorised_by_nonnull_count}`,
    );
  }
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("END OF INVENTORY · NO STATE MODIFIED · READ-ONLY COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
}

function reportMinimal(rows) {
  const total = rows.length;
  const byCategory = new Map();
  for (const r of rows) {
    const raw = r.category;
    byCategory.set(raw, (byCategory.get(raw) ?? 0) + 1);
  }
  const sorted = Array.from(byCategory.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  console.log(`Total rows: ${total}`);
  console.log(`Distinct categories: ${byCategory.size}`);
  for (const [raw, count] of sorted) {
    console.log(`  ${JSON.stringify(raw)}: ${count}`);
  }
}

main().catch((err) => {
  console.error("[§7.1] Uncaught error:");
  console.error(err);
  process.exit(4);
});
