// scripts/refacing/queue-diagnose.mjs
//
// Ad-hoc diagnostic: reads .env.local, connects to the NEX Supabase project
// via the service-role key, and prints the queue's real-time state — status
// distribution, top failure reasons, classification totals, error categories.
//
// Zero writes · pure SELECTs. Safe to run any time.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

function loadDotEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (!(k in process.env)) {
        // Strip surrounding quotes if present
        process.env[k] = v.replace(/^["'](.*)["']$/, "$1");
      }
    }
  } catch { /* file not present or unreadable — proceed with existing env */ }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const URL_ = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY in env / .env.local");
  process.exit(1);
}

const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function pad(s, n) { return String(s).padEnd(n); }

async function statusDist() {
  const { data, error } = await sb
    .from("nex_collection_url_queue")
    .select("status");
  if (error) { console.error("[status]", error.message); return; }
  const counts = {};
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const total = data?.length ?? 0;
  console.log("");
  console.log(`STATUS DISTRIBUTION  ·  total rows in queue: ${total}`);
  console.log("──────────────────────────────────────────────");
  const order = ["queued","processing","completed","duplicate","needs_review","failed","retry_scheduled","discovery_bookmark"];
  for (const s of order) {
    if (counts[s] != null) console.log(`  ${pad(s, 22)} ${counts[s]}`);
  }
  for (const s of Object.keys(counts)) {
    if (!order.includes(s)) console.log(`  ${pad(s, 22)} ${counts[s]}   (unexpected status)`);
  }
}

async function classificationDist() {
  const { data, error } = await sb
    .from("nex_collection_url_queue")
    .select("classification, kind");
  if (error) { console.error("[classification]", error.message); return; }
  const counts = {};
  let candidates = 0;
  let unclassified = 0;
  for (const row of data ?? []) {
    if (row.kind === "discovery") continue;
    candidates++;
    if (row.classification) counts[row.classification] = (counts[row.classification] ?? 0) + 1;
    else unclassified++;
  }
  console.log("");
  console.log(`CLASSIFICATION TOTALS  ·  candidate rows: ${candidates}`);
  console.log("──────────────────────────────────────────────");
  const order = ["REFACING","MANUFACTURE","BOTH","INSTALLER","SUPPLIER","NEEDS_REVIEW","NOT_RELEVANT"];
  for (const c of order) {
    if (counts[c] != null) console.log(`  ${pad(c, 22)} ${counts[c]}`);
  }
  if (unclassified > 0) console.log(`  ${pad("(unclassified)", 22)} ${unclassified}   (pre-extraction)`);
}

async function topFailureReasons() {
  const { data, error } = await sb
    .from("nex_collection_url_queue")
    .select("last_error")
    .eq("status", "failed");
  if (error) { console.error("[failures]", error.message); return; }
  const counts = {};
  for (const row of data ?? []) {
    const key = row.last_error ?? "(no error text)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log("");
  console.log(`TOP FAILURE REASONS  ·  failed rows: ${data?.length ?? 0}`);
  console.log("──────────────────────────────────────────────");
  for (const [reason, n] of sorted) {
    // Truncate long messages for readability
    const short = reason.length > 90 ? reason.slice(0, 87) + "..." : reason;
    console.log(`  ${pad(String(n), 5)} ${short}`);
  }
}

async function fetchErrorCategories() {
  const { data, error } = await sb
    .from("nex_collection_fetch_errors")
    .select("error_category, dead");
  if (error) { console.error("[fetch_errors]", error.message); return; }
  const counts = {};
  let dead = 0;
  for (const row of data ?? []) {
    const key = row.error_category ?? "(null)";
    counts[key] = (counts[key] ?? 0) + 1;
    if (row.dead) dead++;
  }
  console.log("");
  console.log(`FETCH-ERROR CATEGORIES  ·  total error rows: ${data?.length ?? 0}   (dead=3-strikes: ${dead})`);
  console.log("──────────────────────────────────────────────");
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [cat, n] of sorted) console.log(`  ${pad(cat, 22)} ${n}`);
}

async function stuckProcessing() {
  const { data, error } = await sb
    .from("nex_collection_url_queue")
    .select("id, candidate_url, processing_started_at, attempt_count")
    .eq("status", "processing")
    .order("processing_started_at", { ascending: true })
    .limit(10);
  if (error) { console.error("[stuck]", error.message); return; }
  if (!data?.length) return;
  console.log("");
  console.log(`STUCK IN 'PROCESSING' (oldest 10)`);
  console.log("──────────────────────────────────────────────");
  for (const r of data) {
    console.log(`  ${r.processing_started_at ?? "(null)"}   attempt ${r.attempt_count}   ${r.candidate_url}`);
  }
}

async function sampleFailures() {
  const { data, error } = await sb
    .from("nex_collection_url_queue")
    .select("candidate_url, last_error")
    .eq("status", "failed")
    .order("submitted_at", { ascending: false })
    .limit(10);
  if (error) { console.error("[sample]", error.message); return; }
  if (!data?.length) return;
  console.log("");
  console.log(`SAMPLE FAILED URLs (10 most recent)`);
  console.log("──────────────────────────────────────────────");
  for (const r of data) {
    console.log(`  ${r.candidate_url}`);
    console.log(`    → ${r.last_error ?? "(no error)"}`);
  }
}

console.log("NEX collection queue · live diagnostic");
console.log("=======================================================");
await statusDist();
await classificationDist();
await topFailureReasons();
await fetchErrorCategories();
await stuckProcessing();
await sampleFailures();
console.log("");
console.log("=======================================================");
