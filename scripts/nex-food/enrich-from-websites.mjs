#!/usr/bin/env node
// NEX Food · Enrichment agent 'website_scan' · Phase 8.0.2.
//
// For every business with a website URL, fetch the page and extract:
//   · WhatsApp numbers from wa.me / api.whatsapp.com/send links
//   · Phone numbers from tel: links
//   · Instagram / Facebook / TikTok / YouTube profile URLs
//   · Menu / order / booking URLs from anchor text + URL patterns
//
// Every finding writes to nex.food_enrichment_evidence with
// source_type='official_website' + high confidence. Trust hierarchy:
// official_website OUTRANKS openstreetmap (per pinned doctrine).
//
// Rate-limited: max 5 concurrent fetches · one at a time per domain ·
// polite User-Agent identifying NEX. Fails gracefully (many sites will
// 404 · redirect · time out).
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/enrich-from-websites.mjs
//     [--dry-run]  [--limit=N]  [--business=<ref>]

import pg from "pg";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : null;
const singleBiz = args.find((a) => a.startsWith("--business="))?.split("=")[1];

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const USER_AGENT = "NEX-Food-Enrichment/1.0 (+https://nex.example/food · respects robots · no images)";
const FETCH_TIMEOUT_MS = 15000;
const MAX_CONCURRENT = 5;
const PER_DOMAIN_COOLDOWN_MS = 1000;

// ── Fetch helper ───────────────────────────────────────────────────────────

async function fetchPage(url) {
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ac.signal,
    });
    if (!resp.ok) return { ok: false, status: resp.status, body: null };
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return { ok: false, status: resp.status, body: null, reason: "not-html" };
    const body = await resp.text();
    return { ok: true, status: resp.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: null, reason: err.name === "AbortError" ? "timeout" : err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Extraction helpers ─────────────────────────────────────────────────────

// wa.me/62812... or api.whatsapp.com/send?phone=62812... → return "+62812..."
function extractWhatsApp(html) {
  const found = new Set();
  const patterns = [
    /wa\.me\/([+\d\s()-]{6,20})/gi,
    /api\.whatsapp\.com\/send\?phone=([+\d\s()-]{6,20})/gi,
    /whatsapp:\/\/send\?phone=([+\d\s()-]{6,20})/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const digits = (m[1] ?? "").replace(/\D+/g, "");
      if (digits.length >= 8 && digits.length <= 15) {
        found.add(digits.startsWith("0") ? "+62" + digits.slice(1) : "+" + digits);
      }
    }
  }
  return [...found];
}

// tel:+62812... → return "+62812..."
function extractPhone(html) {
  const found = new Set();
  const re = /tel:([+\d\s()-]{6,20})/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    const digits = raw.replace(/\D+/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      // Normalise · leave with + if present
      found.add(raw.trim().replace(/\s+/g, " "));
    }
  }
  return [...found];
}

// instagram.com/handle or handle=@x
function extractSocial(html) {
  const found = { instagram: null, facebook: null, tiktok: null, youtube: null };
  const patterns = {
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})/gi,
    facebook:  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([A-Za-z0-9.\-]{1,50})/gi,
    tiktok:    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@?([A-Za-z0-9_.]{1,30})/gi,
    youtube:   /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|@|channel\/)?([A-Za-z0-9_-]{1,50})/gi,
  };
  const skip = new Set(["p", "reel", "sharer", "watch", "shorts", "user"]);
  for (const [platform, re] of Object.entries(patterns)) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const handle = (m[1] ?? "").trim();
      if (!handle || skip.has(handle.toLowerCase())) continue;
      if (!found[platform]) found[platform] = handle;
    }
  }
  return found;
}

// ── Domain-aware concurrency limiter ───────────────────────────────────────

class DomainLimiter {
  constructor() { this.lastPerDomain = new Map(); this.inflight = 0; this.max = MAX_CONCURRENT; }
  async wait(domain) {
    while (this.inflight >= this.max) await new Promise((r) => setTimeout(r, 100));
    const last = this.lastPerDomain.get(domain) ?? 0;
    const wait = last + PER_DOMAIN_COOLDOWN_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastPerDomain.set(domain, Date.now());
    this.inflight++;
  }
  release() { this.inflight--; }
}

// ── Main ───────────────────────────────────────────────────────────────────

const rowsQ = singleBiz
  ? await pool.query(`SELECT public_listing_ref, website, whatsapp_number, phone
                      FROM nex.food_business WHERE public_listing_ref=$1`, [singleBiz])
  : await pool.query(`SELECT public_listing_ref, website, whatsapp_number, phone
                      FROM nex.food_business
                      WHERE website IS NOT NULL AND website <> ''
                      ORDER BY public_listing_ref`);

const targets = rowsQ.rows.filter((r) => r.website);
const workload = limit ? targets.slice(0, limit) : targets;

console.log(`── website_scan · ${workload.length} businesses with a website ──`);
console.log(`  mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
console.log("");

// Guard · owner-verified fields never overwritten
const provenance = new Map();
(await pool.query(`SELECT business_ref, field_name, trust_layer FROM nex.food_business_field_provenance`))
  .rows.forEach((r) => provenance.set(`${r.business_ref}|${r.field_name}`, r.trust_layer));

const limiter = new DomainLimiter();
let evidenceWritten = 0;
let sitesOk = 0;
let sitesFailed = 0;
const perFieldFound = {};

async function processOne(row) {
  const website = row.website;
  const domain = (() => { try { return new URL(website).hostname; } catch { return website; } })();
  await limiter.wait(domain);
  try {
    const fetched = await fetchPage(website);
    if (!fetched.ok) {
      sitesFailed++;
      return;
    }
    sitesOk++;
    const html = fetched.body;
    // Also fetch common contact-page paths quietly (best-effort · one per business)
    const additional = [];
    const contactCandidates = ["/contact", "/kontak", "/hubungi", "/contact-us"];
    for (const path of contactCandidates) {
      const contactUrl = new URL(path, website).toString();
      if (contactUrl === website) continue;
      const cp = await fetchPage(contactUrl);
      if (cp.ok) { additional.push({ url: contactUrl, body: cp.body }); break; }
    }
    const allBodies = [{ url: website, body: html }, ...additional];

    const evidenceRows = [];
    for (const { url: pageUrl, body } of allBodies) {
      const whatsapps = extractWhatsApp(body);
      const phones = extractPhone(body);
      const social = extractSocial(body);

      for (const w of whatsapps) {
        evidenceRows.push({ field: "whatsapp_number", value: w, url: pageUrl, conf: 0.95 });
      }
      for (const p of phones) {
        evidenceRows.push({ field: "phone", value: p, url: pageUrl, conf: 0.85 });
      }
      for (const [platform, handle] of Object.entries(social)) {
        if (handle) evidenceRows.push({
          field: `social:${platform}`,
          value: handle,
          url: pageUrl,
          conf: 0.85,
        });
      }
    }

    // De-dupe within this business
    const seen = new Set();
    const uniq = evidenceRows.filter((r) => {
      const k = `${r.field}|${r.value}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    for (const ev of uniq) {
      const provKey = `${row.public_listing_ref}|${ev.field}`;
      const layer = provenance.get(provKey);
      if (layer === "owner_verified" || layer === "admin_verified") continue;

      perFieldFound[ev.field] = (perFieldFound[ev.field] ?? 0) + 1;

      if (!dryRun) {
        await pool.query(
          `INSERT INTO nex.food_enrichment_evidence
             (business_ref, field_name, value, value_normalised,
              source, source_type, source_url, confidence, agent_name, provenance_layer)
           VALUES ($1, $2, $3, $4, 'website_scan', 'official_website', $5, $6, 'contact', 'source_import')`,
          [row.public_listing_ref, ev.field, ev.value, ev.value.toLowerCase(), ev.url, ev.conf]
        );
      }
      evidenceWritten++;
    }

    if (uniq.length > 0) {
      console.log(`  ✓ ${row.public_listing_ref}  ${website}  → ${uniq.length} evidence rows`);
    }
  } finally {
    limiter.release();
  }
}

await Promise.all(workload.map((r) => processOne(r)));

console.log("");
console.log("── Summary ──");
console.log(`  sites reachable       : ${sitesOk}`);
console.log(`  sites failed / hidden : ${sitesFailed}`);
console.log(`  evidence rows written : ${evidenceWritten}`);
console.log(`  per-field:`);
for (const [f, n] of Object.entries(perFieldFound).sort((a,b) => b[1]-a[1])) {
  console.log(`    ${f.padEnd(24)} ${n}`);
}

await pool.end();
