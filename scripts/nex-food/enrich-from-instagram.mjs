#!/usr/bin/env node
// NEX Food · Enrichment agent 'instagram_scan' · Phase 8.1.1.
//
// For every business with a social:instagram evidence row, fetch the public
// profile page and extract WhatsApp / phone / website / linktr.ee from the
// og:description bio. Then follow any linktr.ee link (which is fetch-friendly
// and typically contains rich contact info: wa.me · tel: · order links).
//
// Instagram is aggressive about bot detection. Expect ~30-50% success. Every
// success is a business unlocked · every failure is quietly recorded.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/enrich-from-instagram.mjs
//     [--dry-run]  [--limit=N]

import pg from "pg";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : null;

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

// Browser-like User-Agent · Instagram blocks obvious bots.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20000;

async function fetchPage(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      },
      redirect: "follow",
      signal: ac.signal,
    });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, status: r.status, body: await r.text() };
  } catch (err) {
    return { ok: false, status: 0, reason: err.name === "AbortError" ? "timeout" : err.message };
  } finally {
    clearTimeout(t);
  }
}

// Normalise handle → "https://www.instagram.com/<handle>/"
function normaliseIgHandle(raw) {
  let h = String(raw).trim();
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  h = h.replace(/^@/, "");
  h = h.replace(/\/.*$/, "");
  h = h.replace(/\?.*$/, "");
  if (!/^[A-Za-z0-9_.]{1,30}$/.test(h)) return null;
  return `https://www.instagram.com/${h}/`;
}

// Extract og:description from HTML head (contains IG bio)
function extractOgDescription(html) {
  const m = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (!m) return "";
  return m[1]
    .replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// Extract text-form patterns (broader than link-form)
function extractContactsFromText(text) {
  const whatsapps = new Set();
  const phones = new Set();
  const externalUrls = new Set();

  // wa.me · api.whatsapp.com/send?phone
  const waPatterns = [
    /wa\.me\/([+\d\s()-]{6,20})/gi,
    /api\.whatsapp\.com\/send\?phone=([+\d\s()-]{6,20})/gi,
    /whatsapp:\/\/send\?phone=([+\d\s()-]{6,20})/gi,
  ];
  for (const re of waPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const digits = m[1].replace(/\D+/g, "");
      if (digits.length >= 8 && digits.length <= 15) {
        whatsapps.add(digits.startsWith("0") ? "+62" + digits.slice(1) : "+" + digits);
      }
    }
  }

  // Indonesian phone patterns in bio text: 08XX-XXXX-XXXX · +62 8XX-XXXX · 021-...
  const idPhoneRe = /(\+62\s?[0-9-\s()]{8,15}|0[0-9]{1}[0-9-\s()]{7,15})/g;
  let pm;
  while ((pm = idPhoneRe.exec(text)) !== null) {
    const digits = pm[0].replace(/\D+/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      phones.add(pm[0].trim().replace(/\s+/g, " "));
    }
  }

  // Any external URL (excluding instagram itself · we want the linktr.ee / linkin.bio / website)
  const urlRe = /https?:\/\/[^\s"'<>]{4,150}/g;
  let um;
  while ((um = urlRe.exec(text)) !== null) {
    const u = um[0];
    if (/instagram\.com/i.test(u)) continue;
    externalUrls.add(u);
  }

  return { whatsapps: [...whatsapps], phones: [...phones], externalUrls: [...externalUrls] };
}

// linktr.ee pages are fetch-friendly and typically contain all the wa.me / tel links
async function scanLinktreePage(url) {
  const r = await fetchPage(url);
  if (!r.ok) return null;
  return extractContactsFromText(r.body);
}

// ── Main ───────────────────────────────────────────────────────────────────

// Load businesses that have an Instagram handle in evidence (or in typed jsonb)
const rows = (await pool.query(`
  WITH ig_evidence AS (
    SELECT DISTINCT business_ref, value AS handle
    FROM nex.food_enrichment_evidence
    WHERE field_name = 'social:instagram'
  )
  SELECT b.public_listing_ref, b.whatsapp_number, b.phone, b.website, ie.handle
  FROM nex.food_business b
  JOIN ig_evidence ie ON ie.business_ref = b.public_listing_ref
  ORDER BY b.public_listing_ref
`)).rows;

const workload = limit ? rows.slice(0, limit) : rows;
console.log(`── instagram_scan · ${workload.length} businesses with IG handle in evidence ──`);
console.log(`  mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
console.log("");

const provenance = new Map();
(await pool.query(`SELECT business_ref, field_name, trust_layer FROM nex.food_business_field_provenance`))
  .rows.forEach((r) => provenance.set(`${r.business_ref}|${r.field_name}`, r.trust_layer));

let sitesOk = 0;
let sitesFailed = 0;
let evidenceWritten = 0;
const perField = {};

for (const row of workload) {
  const igUrl = normaliseIgHandle(row.handle);
  if (!igUrl) {
    console.log(`  ✗ ${row.public_listing_ref}  bad handle "${row.handle}"`);
    continue;
  }
  // Small cooldown between IG hits · Instagram rate-limits aggressively
  await new Promise((r) => setTimeout(r, 3000));

  const fetched = await fetchPage(igUrl);
  if (!fetched.ok) {
    sitesFailed++;
    if (fetched.status === 429) console.log(`  ⚠ ${row.public_listing_ref}  IG rate-limited us · aborting run`);
    if (fetched.status === 429) break;   // stop if IG blocks us
    continue;
  }
  sitesOk++;

  const bio = extractOgDescription(fetched.body);
  const bioContacts = extractContactsFromText(bio);

  // For every external URL in the bio · fetch it (linktr.ee, linkin.bio etc.)
  const allWhatsApps = new Set(bioContacts.whatsapps);
  const allPhones = new Set(bioContacts.phones);
  const allSources = [{ url: igUrl, note: "instagram bio og:description" }];

  for (const extUrl of bioContacts.externalUrls.slice(0, 3)) {
    if (/linktr\.ee|linkin\.bio|beacons\.ai|milkshake\.app|carrd\.co/i.test(extUrl)) {
      const linktree = await scanLinktreePage(extUrl);
      if (linktree) {
        linktree.whatsapps.forEach((w) => allWhatsApps.add(w));
        linktree.phones.forEach((p) => allPhones.add(p));
        allSources.push({ url: extUrl, note: "linktr.ee-style bio link" });
      }
    }
  }

  const evidenceRows = [];
  for (const w of allWhatsApps) evidenceRows.push({ field: "whatsapp_number", value: w, conf: 0.90 });
  for (const p of allPhones) evidenceRows.push({ field: "phone", value: p, conf: 0.80 });

  for (const ev of evidenceRows) {
    const provKey = `${row.public_listing_ref}|${ev.field}`;
    const layer = provenance.get(provKey);
    if (layer === "owner_verified" || layer === "admin_verified") continue;
    perField[ev.field] = (perField[ev.field] ?? 0) + 1;
    if (!dryRun) {
      await pool.query(
        `INSERT INTO nex.food_enrichment_evidence
           (business_ref, field_name, value, value_normalised,
            source, source_type, source_url, confidence, agent_name, provenance_layer)
         VALUES ($1, $2, $3, $4, 'instagram_scan', 'official_social', $5, $6, 'contact', 'source_import')`,
        [row.public_listing_ref, ev.field, ev.value, ev.value.toLowerCase(),
         allSources[0].url, ev.conf]
      );
    }
    evidenceWritten++;
  }

  if (evidenceRows.length > 0) {
    console.log(`  ✓ ${row.public_listing_ref}  ${igUrl}  → ${evidenceRows.length} evidence rows`);
  }
}

console.log("");
console.log("── Summary ──");
console.log(`  IG profiles reachable  : ${sitesOk}`);
console.log(`  IG profiles blocked    : ${sitesFailed}`);
console.log(`  evidence rows written  : ${evidenceWritten}`);
for (const [f, n] of Object.entries(perField).sort((a,b)=>b[1]-a[1])) {
  console.log(`    ${f.padEnd(24)} ${n}`);
}

await pool.end();
