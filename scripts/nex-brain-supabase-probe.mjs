#!/usr/bin/env node
// One-off probe: check which Supabase project the SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY combo points at, and whether the brain
// tables from db/migrations/001 + 002 already exist.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load .env.local manually (Node scripts don't get Next.js's env loader)
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const url =
  env.NEX_SUPABASE_URL ||
  env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
  env.SUPABASE_URL;
const key =
  env.NEX_SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY;

const projectRef = (url ?? "").match(/https?:\/\/([^.]+)\./)?.[1] ?? "unknown";
console.log(`Target project: ${projectRef}`);
console.log(`URL           : ${url}`);
console.log(`Service key   : ${key ? key.slice(0, 12) + "…" : "(missing)"}`);
console.log("");

if (!url || !key) {
  console.error("Missing URL or service key. Cannot proceed.");
  process.exit(1);
}

const supa = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  "knowledge_records",
  "record_versions",
  "graph_edges",
  "worker_jobs",
  "worker_results",
  "sources",
  "confidence_scores",
  "contradictions",
  "deprecations",
  "knowledge_feedback",
  "audit_log",
  "llm_retry_queue",
];

console.log("Checking brain tables:");
for (const t of TABLES) {
  const { error, count } = await supa
    .from(t)
    .select("id", { count: "exact", head: true });
  if (error) {
    if (/relation .* does not exist|schema cache|not find/i.test(error.message)) {
      console.log(`  ${t.padEnd(24)} ✗ missing`);
    } else {
      console.log(`  ${t.padEnd(24)} ✗ ${error.message.slice(0, 80)}`);
    }
  } else {
    console.log(`  ${t.padEnd(24)} ✓ ${count} rows`);
  }
}
