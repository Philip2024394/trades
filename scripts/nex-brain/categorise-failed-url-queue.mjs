// scripts/nex-brain/categorise-failed-url-queue.mjs
//
// Break the URL-queue "Failed" bucket into structured failure reasons
// per Philip 2026-08-14: don't reprocess blindly · categorise first ·
// give exact breakdown before submitting another large URL dump.
//
// SHARED LOGIC · runtime equivalent lives at src/lib/nex/collection/failureCategorisation.ts
// The two files must stay in sync (this script stays .mjs so it runs without
// a build step). Any pattern update here must be mirrored there.
//
// Categories:
//   dns              - domain doesn't resolve (fabricated / dead / typo)
//   connection       - TCP refused / reset · host reachable but nothing there
//   timeout          - fetch aborted before response
//   ssl              - certificate expired / invalid / hostname mismatch
//   http_403         - reachable but bot-blocked / access denied
//   http_404         - reachable but page dead / URL wrong
//   http_5xx         - reachable but server errored (temporary retriable?)
//   http_other       - other 4xx (401 · 429 · 410 · etc.)
//   not_html         - PDF / image / redirect-to-app / whatever · not extractable
//   extraction       - fetch succeeded but no signals · needs review
//   other            - unclassified · needs manual look
//
// Writes:
//   data/audit/failed-url-queue-breakdown-<ISO>.json
//
// Never reprocesses. Never modifies queue rows. Read-only.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";
import { promises as dnsp } from "node:dns";

function loadDotEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const NEX_URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!NEX_URL || !NEX_KEY) { console.error("Missing NEX Supabase env"); process.exit(1); }
const nex = createClient(NEX_URL, NEX_KEY, { auth: { persistSession: false } });

// ─── categorisation ──────────────────────────────────────────────────
function categorise(row, linkedErr) {
  // Prefer structured error_category from nex_collection_fetch_errors if present.
  if (linkedErr?.error_category) {
    switch (linkedErr.error_category) {
      case "dns_error":         return { category: "dns",        source: "linked_structured" };
      case "connection_refused":return { category: "connection", source: "linked_structured" };
      case "timeout":           return { category: "timeout",    source: "linked_structured" };
      case "ssl_error":         return { category: "ssl",        source: "linked_structured" };
      case "http_error":        break; // needs more detail from last_error to split 403/404/5xx
      case "not_html":          return { category: "not_html",   source: "linked_structured" };
      case "extraction_failed": return { category: "extraction", source: "linked_structured" };
      case "other":             break; // "other" is the whole thing we're trying to break down · fall through to text parsing
    }
  }

  const err = String(row.last_error ?? linkedErr?.last_error ?? "").toLowerCase();
  if (!err) return { category: "other", source: "empty_error" };

  // DNS
  if (/enotfound|eai_again|getaddrinfo|no dns lookup|dns[- _]?fail|dns[- _]?error|host not found/i.test(err))
    return { category: "dns", source: "text_pattern" };
  // Connection
  if (/econnrefused|econnreset|eaddrnotavail|connection refused|connection reset|network is unreachable/i.test(err))
    return { category: "connection", source: "text_pattern" };
  // Timeout · undici raises "Connect Timeout Error" · Node abort raises "was aborted"
  if (/etimedout|aborterror|timeout|signal aborted|the operation was aborted|deadline exceeded|connect timeout error|und_err_connect_timeout|und_err_headers_timeout|und_err_body_timeout/i.test(err))
    return { category: "timeout", source: "text_pattern" };
  // SSL / TLS
  if (/cert_has_expired|self[- _]?signed|unable to verify|err_ssl|err_tls|hostname[- _]?mismatch|epki|handshake failed/i.test(err))
    return { category: "ssl", source: "text_pattern" };
  // HTTP status split
  const status = err.match(/\b(?:http[- ]?)?(\d{3})\b/);
  if (status) {
    const code = Number(status[1]);
    if (code === 403) return { category: "http_403", source: "text_pattern" };
    if (code === 404) return { category: "http_404", source: "text_pattern" };
    if (code >= 500 && code < 600) return { category: "http_5xx", source: "text_pattern" };
    if (code >= 400 && code < 500) return { category: "http_other", source: "text_pattern" };
  }
  if (/forbidden|blocked|access denied|cloudflare[- _]?challenge/i.test(err))
    return { category: "http_403", source: "text_pattern" };
  if (/not found|page not found|does not exist/i.test(err))
    return { category: "http_404", source: "text_pattern" };
  if (/not[- _]?html|text\/html|expected html|got application\//i.test(err))
    return { category: "not_html", source: "text_pattern" };
  if (/no signals|extraction failed|no evidence|nothing extracted/i.test(err))
    return { category: "extraction", source: "text_pattern" };

  // Bare "fetch failed" with no cause chain is almost always DNS in practice
  // (this codebase's Node fetch loses the cause when the address is unresolvable
  // and no cause was captured before 2026-08-13). Flag it separately from the
  // other "other" bucket so it can be verified explicitly rather than lumped.
  if (/^(?:other:\s*)?fetch failed\s*$/i.test(err.trim()))
    return { category: "dns_probable", source: "bare_fetch_failed" };

  return { category: "other", source: "unmatched" };
}

// ─── data ────────────────────────────────────────────────────────────
console.log("=".repeat(72));
console.log("URL-QUEUE FAILED-BUCKET CATEGORISATION · READ-ONLY");
console.log("=".repeat(72));

const { data: queue, error: qErr } = await nex
  .from("nex_collection_url_queue")
  .select("id, candidate_url, target_domain, status, attempt_count, last_error, updated_at")
  .eq("status", "failed")
  .order("updated_at", { ascending: false })
  .limit(1000);
if (qErr) { console.error("queue query error:", qErr); process.exit(1); }
console.log(`Failed queue rows found : ${queue.length}`);

// Try to enrich with nex_collection_fetch_errors linked by queue_item_id
let errs = null;
const { data: linkedErrs, error: eErr } = await nex
  .from("nex_collection_fetch_errors")
  .select("queue_item_id, error_category, last_error, attempt_count, last_failed_at, dead")
  .in("queue_item_id", queue.map((q) => q.id));
if (eErr) console.log(`(note: could not fetch nex_collection_fetch_errors — ${eErr.message})`);
else errs = linkedErrs;
const errByQueueId = new Map();
for (const e of errs ?? []) errByQueueId.set(e.queue_item_id, e);

// ─── categorise ──────────────────────────────────────────────────────
const buckets = {};
const sampleByCategory = {};
for (const row of queue) {
  const linked = errByQueueId.get(row.id);
  const { category, source } = categorise(row, linked);
  buckets[category] = (buckets[category] ?? 0) + 1;
  if (!sampleByCategory[category]) sampleByCategory[category] = [];
  if (sampleByCategory[category].length < 3) {
    sampleByCategory[category].push({
      url: row.candidate_url,
      err: (row.last_error ?? linked?.last_error ?? "").slice(0, 120),
      source,
    });
  }
}

// ─── refine dns_probable via a real DNS lookup ───────────────────────
// Convert "probable" into "certain" — safe · one lookup per unique domain ·
// upgrades dns_probable → dns (resolved-then-failed = not DNS) or dns (unresolved).
const probableRows = queue.filter((r) => {
  const linked = errByQueueId.get(r.id);
  return categorise(r, linked).category === "dns_probable";
});
if (probableRows.length) {
  console.log(`Verifying ${probableRows.length} dns_probable domains with a real DNS lookup…`);
  const uniqueDomains = [...new Set(probableRows.map((r) => r.target_domain).filter(Boolean))];
  const resolved = new Map(); // domain → boolean
  const CONCURRENCY = 12;
  let inflight = 0, idx = 0, done = 0;
  await new Promise((resolve) => {
    function pump() {
      while (inflight < CONCURRENCY && idx < uniqueDomains.length) {
        const d = uniqueDomains[idx++]; inflight++;
        Promise.race([
          dnsp.lookup(d).then(() => true).catch(() => false),
          new Promise((r) => setTimeout(() => r(false), 4000)),
        ]).then((ok) => {
          resolved.set(d, ok);
          inflight--; done++;
          if (done === uniqueDomains.length) resolve();
          else pump();
        });
      }
    }
    pump();
  });
  const unresolvableCount = [...resolved.values()].filter((v) => !v).length;
  console.log(`  ${unresolvableCount}/${uniqueDomains.length} domains do not resolve.`);
  // Rewrite buckets — anything with a resolvable domain but bare "fetch failed" is
  // reclassified as "transient_or_blocked" (real host, unknown reason at capture time).
  for (const r of probableRows) {
    const ok = resolved.get(r.target_domain);
    buckets.dns_probable -= 1;
    if (ok === false) {
      buckets.dns = (buckets.dns ?? 0) + 1;
      (sampleByCategory.dns ??= []).length < 3 && sampleByCategory.dns.push({
        url: r.candidate_url, err: (r.last_error ?? "").slice(0, 120), source: "reclassified_via_dns_lookup_unresolvable",
      });
    } else {
      buckets.transient_or_blocked = (buckets.transient_or_blocked ?? 0) + 1;
      (sampleByCategory.transient_or_blocked ??= []).length < 3 && sampleByCategory.transient_or_blocked.push({
        url: r.candidate_url, err: (r.last_error ?? "").slice(0, 120), source: "reclassified_domain_resolves",
      });
    }
  }
  if (buckets.dns_probable === 0) delete buckets.dns_probable;
}

const total = queue.length;
const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]);

console.log("");
console.log("Breakdown:");
console.log("  category         count   %      ");
console.log("  ────────────    ──────  ─────   ");
for (const [k, n] of sorted) {
  const pct = ((n / total) * 100).toFixed(1) + "%";
  console.log(`  ${k.padEnd(14)}  ${String(n).padStart(6)}  ${pct.padStart(5)}`);
}
console.log("  ────────────    ──────         ");
console.log(`  total           ${String(total).padStart(6)}`);
console.log("");

console.log("Sample per category (up to 3 each):");
for (const [k, samples] of Object.entries(sampleByCategory)) {
  console.log(`  ── ${k} ─────`);
  for (const s of samples) {
    console.log(`    · ${s.url}`);
    if (s.err) console.log(`        err: ${s.err}`);
  }
}
console.log("");

const OUT_DIR = join(process.cwd(), "data", "audit");
mkdirSync(OUT_DIR, { recursive: true });
const OUT = join(OUT_DIR, `failed-url-queue-breakdown-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(OUT, JSON.stringify({
  ran_at: new Date().toISOString(),
  total,
  by_category: Object.fromEntries(sorted),
  samples: sampleByCategory,
  rows: queue.map((r) => {
    const linked = errByQueueId.get(r.id);
    return { ...r, linked_error_category: linked?.error_category ?? null, ...categorise(r, linked) };
  }),
}, null, 2), "utf8");
console.log(`Full report: ${OUT}`);
console.log("");
console.log("NOTE · This report is READ-ONLY. It does not reprocess, retry, or modify any queue row.");
console.log("        Preserves every failed row for audit per NEX URL Provenance rule.");
