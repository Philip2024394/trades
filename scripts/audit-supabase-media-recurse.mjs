#!/usr/bin/env node
// scripts/audit-supabase-media-recurse.mjs
// READ-ONLY recursion into nex-media/imported/ to inventory actual assets.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envRaw = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  env[t.slice(0, eq).trim()] = t
    .slice(eq + 1)
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

const url = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const key = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listRecursive(bucket, prefix, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return { path: prefix, depth_exceeded: true };
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) return { path: prefix, error: error.message };
  const files = (data ?? []).filter((o) => o.id !== null);
  const folders = (data ?? []).filter((o) => o.id === null);
  const totalBytes = files.reduce((s, f) => s + (f.metadata?.size ?? 0), 0);
  const mimes = {};
  for (const f of files) {
    const m = f.metadata?.mimetype ?? "unknown";
    mimes[m] = (mimes[m] ?? 0) + 1;
  }
  const result = {
    path: prefix || "(root)",
    file_count: files.length,
    folder_count: folders.length,
    bytes_here: totalBytes,
    mimes,
    sample_files: files.slice(0, 5).map((f) => ({
      name: f.name,
      size: f.metadata?.size,
      mime: f.metadata?.mimetype,
      updated_at: f.updated_at,
    })),
    subfolders: [],
  };
  for (const folder of folders.slice(0, 20)) {
    const subPath = prefix ? `${prefix}/${folder.name}` : folder.name;
    const sub = await listRecursive(bucket, subPath, depth + 1, maxDepth);
    result.subfolders.push(sub);
  }
  return result;
}

async function main() {
  console.error("Recursing nex-media/imported/...");
  const tree = await listRecursive("nex-media", "imported", 0, 4);
  // Also inventory root of nex-media in case there are other folders
  console.error("Listing nex-media root...");
  const root = await listRecursive("nex-media", "", 0, 1);
  // Compute totals
  function walk(node, acc) {
    acc.total_files += node.file_count ?? 0;
    acc.total_bytes += node.bytes_here ?? 0;
    for (const [m, c] of Object.entries(node.mimes ?? {})) {
      acc.mimes[m] = (acc.mimes[m] ?? 0) + c;
    }
    for (const s of node.subfolders ?? []) walk(s, acc);
  }
  const totals = { total_files: 0, total_bytes: 0, mimes: {} };
  walk(tree, totals);
  console.log(
    JSON.stringify(
      { generated_at: new Date().toISOString(), totals, tree, root_listing: root },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
