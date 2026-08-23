#!/usr/bin/env node
// NEX Food · Enrichment agent 'web_search' · Phase 8.1.3.
//
// No-key fallback · uses DuckDuckGo's public HTML endpoint to scrape search
// snippets + top-result URLs for each no-contact business. Extracts wa.me,
// tel:, phone patterns, and candidate business website URLs.
//
// LEGAL NOTE · DuckDuckGo's HTML endpoint is public. We use a conservative
// rate limit (1 req / 2s), identifying User-Agent, and never store the raw
// search results · only extracted contact fields. Not a bulk-scrape tool.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/enrich-from-web-search.mjs
//     [--dry-run]  [--limit=N]  [--batch=0..3]
//     --batch splits the workload into 4 chunks so you can partially run

import pg from "pg";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const batchArg = args.find((a) => a.startsWith("--batch="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : null;
const batch = batchArg ? Number(batchArg) : null;

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const UA = "NEX-Food-Enrichment/1.0 (+https://nex.example/food · respects rate limits)";
const FETCH_TIMEOUT_MS = 15000;
const REQUEST_INTERVAL_MS = 2200;   // 1 req per 2.2 sec · gentle on DDG

async function fetchHtml(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      },
      redirect: "follow",
      signal: ac.signal,
    });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, body: await r.text() };
  } catch (err) {
    return { ok: false, reason: err.name === "AbortError" ? "timeout" : err.message };
  } finally { clearTimeout(t); }
}

// DDG returns anchors like <a class="result__a" href="https://.../">…</a>
// and snippet text in <a class="result__snippet">…</a>. It also uses redirect
// URLs like /l/?uddg=<encoded> — we decode when present.
function extractDdgResults(html) {
  const results = [];
  // Match result blocks
  const anchorRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = [];
  let m;
  while ((m = anchorRe.exec(html)) !== null) anchors.push({ href: decodeDdgHref(m[1]), title: m[2].trim() });
  const snippets = [];
  while ((m = snippetRe.exec(html)) !== null) {
    // strip HTML tags for text extraction
    snippets.push(m[1].replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&"));
  }
  for (let i = 0; i < Math.min(anchors.length, snippets.length, 5); i++) {
    results.push({ href: anchors[i].href, title: anchors[i].title, snippet: snippets[i] });
  }
  return results;
}

function decodeDdgHref(raw) {
  try {
    const u = new URL(raw, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : raw;
  } catch { return raw; }
}

function extractContactsFromText(text) {
  const whatsapps = new Set();
  const phones = new Set();
  const websites = new Set();
  const socials = { instagram: null, facebook: null, tiktok: null };

  const waRe = /wa\.me\/([+\d\s()-]{6,20})|api\.whatsapp\.com\/send\?phone=([+\d\s()-]{6,20})/gi;
  let m;
  while ((m = waRe.exec(text)) !== null) {
    const raw = m[1] ?? m[2] ?? "";
    const digits = raw.replace(/\D+/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      whatsapps.add(digits.startsWith("0") ? "+62" + digits.slice(1) : "+" + digits);
    }
  }

  const telRe = /tel:([+\d\s()-]{6,20})/gi;
  while ((m = telRe.exec(text)) !== null) {
    const digits = m[1].replace(/\D+/g, "");
    if (digits.length >= 8 && digits.length <= 15) phones.add(m[1].trim());
  }

  const idPhoneRe = /(\+62\s?[0-9-\s()]{8,15}|\b0[0-9]{1,2}[- .()]?[0-9]{3,4}[- .()]?[0-9]{3,6}\b)/g;
  while ((m = idPhoneRe.exec(text)) !== null) {
    const digits = m[0].replace(/\D+/g, "");
    if (digits.length >= 9 && digits.length <= 14) phones.add(m[0].trim().replace(/\s+/g, " "));
  }

  const igRe = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})/gi;
  const skipIg = new Set(["p","reel","reels","stories","explore"]);
  while ((m = igRe.exec(text)) !== null) {
    const h = m[1].trim();
    if (!skipIg.has(h.toLowerCase()) && !socials.instagram) socials.instagram = h;
  }
  const fbRe = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([A-Za-z0-9.\-]{1,50})/gi;
  const skipFb = new Set(["sharer","share","dialog","tr","business"]);
  while ((m = fbRe.exec(text)) !== null) {
    const h = m[1].trim();
    if (!skipFb.has(h.toLowerCase()) && !socials.facebook) socials.facebook = h;
  }

  return { whatsapps: [...whatsapps], phones: [...phones], websites: [...websites], socials };
}

// ── Main ───────────────────────────────────────────────────────────────────

// Task #88 Phase 2 (2026-08-22) · extended to include claim_status='discovered'
// so the Phase 2 owner-contact orchestrator can enrich needs_enrichment rows.
// Prior scope (listed/invited/claimed/paying) preserved · discovered added.
// Also added optional --business=<ref> filter for per-row invocation from the
// orchestrator. Doctrine: still writes only to nex.food_enrichment_evidence,
// still never overwrites owner_verified/admin_verified provenance layers.
const singleBiz = args.find((a) => a.startsWith("--business="))?.split("=")[1];

const allNoContact = singleBiz
  ? // Task #88 Phase 2 · --business branch drops the bulk-mode no-contact filter.
    // Orchestrator has made an explicit per-row targeting decision · agent trusts it.
    // Existing safeguards preserved: owner_verified/admin_verified never overwritten,
    // low confidence stamps (0.55-0.65) mean every result is candidate-quality for
    // Phase 3 admin review. Even rows with a phone can benefit from DDG for
    // WhatsApp/social/website discovery.
    (await pool.query(`
      SELECT public_listing_ref, business_name, category, district
      FROM nex.food_business
      WHERE public_listing_ref = $1
    `, [singleBiz])).rows
  : (await pool.query(`
      SELECT public_listing_ref, business_name, category, district
      FROM nex.food_business
      WHERE city = 'Yogyakarta'
        AND claim_status IN ('discovered','listed','invited','claimed','paying')
        AND (whatsapp_number IS NULL OR whatsapp_number = '')
        AND (phone IS NULL OR phone = '')
      ORDER BY public_listing_ref
    `)).rows;

let workload = limit ? allNoContact.slice(0, limit) : allNoContact;
if (batch != null) {
  const chunkSize = Math.ceil(allNoContact.length / 4);
  workload = allNoContact.slice(batch * chunkSize, (batch + 1) * chunkSize);
}

console.log("── web_search enrichment (DDG · no-key fallback) ──");
console.log(`  mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
console.log(`  no-contact businesses in scope: ${allNoContact.length}`);
console.log(`  workload for this run         : ${workload.length}`);
console.log(`  rate limit                    : 1 req per ${REQUEST_INTERVAL_MS}ms`);
console.log(`  estimated duration            : ~${Math.ceil((workload.length * REQUEST_INTERVAL_MS) / 60000)} minutes`);
console.log("");

const provenance = new Map();
(await pool.query(`SELECT business_ref, field_name, trust_layer FROM nex.food_business_field_provenance`))
  .rows.forEach((r) => provenance.set(`${r.business_ref}|${r.field_name}`, r.trust_layer));

let searchesOk = 0;
let searchesFailed = 0;
let evidenceWritten = 0;
const perField = {};
let lastRequestAt = 0;

for (const nex of workload) {
  // Rate limit
  const wait = lastRequestAt + REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const q = `${nex.business_name} ${nex.district ?? "Yogyakarta"} yogyakarta whatsapp`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const r = await fetchHtml(url);
  if (!r.ok) { searchesFailed++; continue; }
  searchesOk++;

  const results = extractDdgResults(r.body);
  if (results.length === 0) continue;

  // Combine top 5 result URLs + titles + snippets · extract everything
  const combined = results.map((x) => `${x.href}\n${x.title}\n${x.snippet}`).join("\n");
  const found = extractContactsFromText(combined);

  const evRows = [];
  for (const w of found.whatsapps) evRows.push({ field: "whatsapp_number", value: w, conf: 0.65, sourceUrl: url });
  for (const p of found.phones) evRows.push({ field: "phone", value: p, conf: 0.55, sourceUrl: url });
  if (found.socials.instagram) evRows.push({ field: "social:instagram", value: found.socials.instagram, conf: 0.55, sourceUrl: url });
  if (found.socials.facebook) evRows.push({ field: "social:facebook", value: found.socials.facebook, conf: 0.55, sourceUrl: url });

  // De-dupe
  const seen = new Set();
  const uniq = evRows.filter((r) => { const k = `${r.field}|${r.value}`; if (seen.has(k)) return false; seen.add(k); return true; });

  for (const ev of uniq) {
    const provKey = `${nex.public_listing_ref}|${ev.field}`;
    const layer = provenance.get(provKey);
    if (layer === "owner_verified" || layer === "admin_verified") continue;
    perField[ev.field] = (perField[ev.field] ?? 0) + 1;
    if (!dryRun) {
      await pool.query(
        `INSERT INTO nex.food_enrichment_evidence
           (business_ref, field_name, value, value_normalised,
            source, source_type, source_url, confidence, agent_name, provenance_layer)
         VALUES ($1, $2, $3, $4, 'web_search:ddg', 'other', $5, $6, 'discovery', 'source_import')`,
        [nex.public_listing_ref, ev.field, ev.value, ev.value.toLowerCase(),
         ev.sourceUrl, ev.conf]
      );
    }
    evidenceWritten++;
  }

  if (uniq.length > 0) {
    console.log(`  ✓ ${nex.public_listing_ref}  ${nex.business_name.slice(0, 40).padEnd(40)}  → ${uniq.length} evidence rows`);
  }
}

console.log("");
console.log("── Summary ──");
console.log(`  DDG searches ok       : ${searchesOk}`);
console.log(`  DDG searches failed   : ${searchesFailed}`);
console.log(`  evidence rows written : ${evidenceWritten}`);
for (const [f, n] of Object.entries(perField).sort((a,b) => b[1]-a[1])) {
  console.log(`    ${f.padEnd(24)} ${n}`);
}
console.log("");
console.log("Note: evidence confidence is LOW (0.55-0.65) because DDG snippets");
console.log("      can contain phones/handles for a DIFFERENT business with the");
console.log("      same name. Do NOT auto-promote to typed columns. HQ review");
console.log("      of any candidate before use in outreach.");

await pool.end();
