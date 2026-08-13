// scripts/nex-brain/audit-supabase-storage-and-local.mjs
//
// Extends the earlier project-tables audit to answer three questions Philip
// asked 2026-08-14:
//   (a) Which Supabase Storage buckets exist in each project · file count · total size?
//   (b) What's stored locally under data/ · how big · git-tracked?
//   (c) Does any local file reference the WRONG Supabase / storage host?
//
// Never writes · pure reads. Safe to run any time.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { join, relative } from "node:path";

function loadDotEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const NEX_URL    = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_KEY    = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const TRADES_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TRADES_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEX_URL || !NEX_KEY || !TRADES_URL || !TRADES_KEY) {
  console.error("Missing one or more Supabase env vars"); process.exit(1);
}

const maskUrl = (u) => u.replace(/(https:\/\/)([a-z0-9]{6})[a-z0-9]{14}/, "$1$2**HIDDEN**");
const nex    = createClient(NEX_URL,    NEX_KEY,    { auth: { persistSession: false } });
const trades = createClient(TRADES_URL, TRADES_KEY, { auth: { persistSession: false } });

const NEX_HOST    = new URL(NEX_URL).host;    // e.g. ijvqdv…supabase.co
const TRADES_HOST = new URL(TRADES_URL).host; // e.g. msdonk…supabase.co

console.log("=".repeat(78));
console.log("SUPABASE STORAGE + LOCAL DATA AUDIT · 2026-08-14");
console.log("=".repeat(78));
console.log(`NEX project    : ${maskUrl(NEX_URL)}`);
console.log(`TRADES project : ${maskUrl(TRADES_URL)}`);
console.log("");

// ── PART A · Storage buckets per project ─────────────────────────────
async function listBuckets(label, client) {
  const { data, error } = await client.storage.listBuckets();
  if (error) { console.log(`  ✗ ${label} listBuckets error: ${error.message}`); return []; }
  return data ?? [];
}

async function bucketStats(client, bucketName) {
  // Recursively list objects at root · Supabase list is paginated (100 per page).
  let total = 0, bytes = 0, pages = 0;
  async function walk(prefix) {
    let offset = 0;
    while (true) {
      const { data, error } = await client.storage.from(bucketName).list(prefix, {
        limit: 100, offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) { throw error; }
      if (!data || data.length === 0) break;
      for (const item of data) {
        // items with an `id` are files · items without are folders
        if (item.id) {
          total += 1;
          bytes += item.metadata?.size ?? 0;
        } else if (item.name) {
          await walk(prefix ? `${prefix}/${item.name}` : item.name);
        }
      }
      pages += 1;
      if (data.length < 100) break;
      offset += 100;
      if (pages > 500) throw new Error("list pagination cap hit · investigate");
    }
  }
  try { await walk(""); return { total, bytes }; }
  catch (e) { return { total, bytes, error: e.message }; }
}

async function auditProjectStorage(label, client) {
  console.log(`── ${label} · Storage buckets ─────────────`);
  const buckets = await listBuckets(label, client);
  if (buckets.length === 0) { console.log("  (no buckets)"); return { label, buckets: [] }; }
  const summary = [];
  for (const b of buckets) {
    const s = await bucketStats(client, b.name);
    const sizeMb = (s.bytes / (1024 * 1024)).toFixed(1);
    const scope = b.public ? "public" : "private";
    console.log(`  · ${b.name.padEnd(30)}  ${String(s.total).padStart(6)} files   ${sizeMb.padStart(8)} MB   [${scope}]`);
    if (s.error) console.log(`      err: ${s.error}`);
    summary.push({ name: b.name, files: s.total, bytes: s.bytes, public: b.public, error: s.error });
  }
  return { label, buckets: summary };
}

const nexStorage    = await auditProjectStorage("NEX (ijvqdv…)", nex);
console.log("");
const tradesStorage = await auditProjectStorage("TRADES (msdonk…)", trades);
console.log("");

// ── PART B · Local data/ survey ───────────────────────────────────────
console.log("── LOCAL data/ folder survey ─────────────");
const DATA = join(process.cwd(), "data");
function humanBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024*1024) return `${(n/1024).toFixed(1)}KB`;
  if (n < 1024*1024*1024) return `${(n/(1024*1024)).toFixed(1)}MB`;
  return `${(n/(1024*1024*1024)).toFixed(2)}GB`;
}
function walkDir(dir) {
  let files = 0, bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur); } catch { continue; }
    for (const e of entries) {
      const p = join(cur, e);
      let s;
      try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) stack.push(p);
      else if (s.isFile()) { files += 1; bytes += s.size; }
    }
  }
  return { files, bytes };
}

if (!existsSync(DATA)) {
  console.log("  (no data/ folder)");
} else {
  const subdirs = readdirSync(DATA).filter((e) => {
    try { return statSync(join(DATA, e)).isDirectory(); } catch { return false; }
  }).sort();
  const rows = [];
  for (const d of subdirs) {
    const stats = walkDir(join(DATA, d));
    rows.push({ dir: d, ...stats });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  for (const r of rows) {
    console.log(`  · ${r.dir.padEnd(42)}  ${String(r.files).padStart(6)} files   ${humanBytes(r.bytes).padStart(10)}`);
  }
  // Loose files at the top of data/
  const loose = readdirSync(DATA).filter((e) => {
    try { return statSync(join(DATA, e)).isFile(); } catch { return false; }
  }).sort();
  if (loose.length) {
    console.log(`  · ${"(loose files at data/ root)".padEnd(42)}  ${String(loose.length).padStart(6)} files`);
    for (const f of loose.slice(0, 20)) {
      const s = statSync(join(DATA, f));
      console.log(`      · ${f.padEnd(50)} ${humanBytes(s.size)}`);
    }
    if (loose.length > 20) console.log(`      · … and ${loose.length - 20} more`);
  }
}
console.log("");

// ── PART C · Cross-reference host contamination check ────────────────
console.log("── Cross-reference · does any local file reference the wrong Supabase host? ─");
// We only look inside data/ and src/ · not node_modules.
const SCAN_ROOTS = ["data", "src"];
function walkSmall(dir, exts) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur); } catch { continue; }
    for (const e of entries) {
      const p = join(cur, e);
      if (p.includes("node_modules")) continue;
      let s;
      try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) stack.push(p);
      else if (s.isFile() && exts.some((x) => p.endsWith(x))) out.push(p);
    }
  }
  return out;
}

let nexHostHits = 0, tradesHostHits = 0;
const tradesHostHitFiles = [];
for (const root of SCAN_ROOTS) {
  const abs = join(process.cwd(), root);
  if (!existsSync(abs)) continue;
  const files = walkSmall(abs, [".json", ".md", ".ts", ".tsx", ".mjs", ".sql", ".yaml", ".yml"]);
  for (const f of files) {
    let content = "";
    try { content = readFileSync(f, "utf8"); } catch { continue; }
    if (content.includes(NEX_HOST))    nexHostHits += 1;
    if (content.includes(TRADES_HOST)) { tradesHostHits += 1; tradesHostHitFiles.push(relative(process.cwd(), f)); }
  }
}
console.log(`  Files that reference the NEX host    (${NEX_HOST})    : ${nexHostHits}`);
console.log(`  Files that reference the TRADES host (${TRADES_HOST}) : ${tradesHostHits}`);
if (tradesHostHitFiles.length) {
  console.log("  Trades-host references (may be legitimate — inspect each):");
  for (const f of tradesHostHitFiles.slice(0, 30)) console.log(`      · ${f}`);
  if (tradesHostHitFiles.length > 30) console.log(`      · … and ${tradesHostHitFiles.length - 30} more`);
}
console.log("");

// ── PART D · Image-manifest hosting check ────────────────────────────
console.log("── Image manifest hosting check ─────────────");
const MANIFEST_PATH = join(DATA, "nex-image-manifest.json");
if (existsSync(MANIFEST_PATH)) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const urls = Object.keys(manifest.images ?? {});
  const hostCounts = {};
  for (const u of urls) {
    try {
      const h = new URL(u).host;
      hostCounts[h] = (hostCounts[h] ?? 0) + 1;
    } catch { hostCounts["(unparsed)"] = (hostCounts["(unparsed)"] ?? 0) + 1; }
  }
  const sorted = Object.entries(hostCounts).sort((a, b) => b[1] - a[1]);
  console.log(`  Total manifest URLs : ${urls.length}`);
  console.log(`  Distinct hosts      : ${sorted.length}`);
  for (const [h, n] of sorted.slice(0, 15)) {
    const flag = h === NEX_HOST ? " ← NEX Supabase" :
                 h === TRADES_HOST ? " ← TRADES Supabase (CONTAMINATION)" :
                 "";
    console.log(`    · ${String(n).padStart(5)}  ${h}${flag}`);
  }
  if (sorted.length > 15) console.log(`    · … and ${sorted.length - 15} more distinct hosts`);
} else {
  console.log("  (no manifest at data/nex-image-manifest.json)");
}
console.log("");

console.log("=".repeat(78));
console.log("Done.");
