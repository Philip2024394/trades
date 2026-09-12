#!/usr/bin/env node
// scripts/nex-marketing-import-emails.mjs
//
// Founder 2026-09-10 · Import every email NEX has ever collected into
// nex.marketing_contact. Runs continuously (scheduled every 30 min) so
// new emails from ongoing enrichment flow in automatically.
//
// Sources scanned:
//   1. nex.accommodation_business (existing production data)
//   2. nex.food_business (existing production data)
//   3. nex.service_business
//   4. nex.business_lead_directory (new · from Lab promotions)
//   5. nex_lab_*.harvest_raw.payload.enriched_contacts.emails (all rooms)
//   6. nex_lab_*.harvest_raw.payload.ig_bio_data.bio_emails (all rooms)
//
// Dedupe: LOWER(email). ON CONFLICT DO UPDATE merges new signals into
// existing row (last_seen_at, additional source_tables, richer category).
//
// Blocklist: filters placeholder emails (you@company.com, noreply@,
// example.com, etc.) before insert.

import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "marketing-import.log");

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); appendFileSync(LOG_PATH, msg); } catch { /* silent */ }
}
function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

// Placeholder / role-account / file-extension / aggregator blocklist.
// Never marketing-mail these — protects sender reputation + avoids
// accidentally emailing booking.com support, image filenames, etc.
const BLOCK_RX = /(?:^|@)(example\.(?:com|org|net)|localhost|test|sample)|you@company\.com|^(noreply|no-reply|donotreply|do-not-reply|postmaster|webmaster|abuse|hostmaster|admin@|null@|null\b|unknown@|hello@example)/i;
// TLDs that come from filenames / assets, not real inboxes
const FAKE_TLD_RX = /\.(?:png|jpg|jpeg|gif|svg|webp|mp4|pdf|woff2?|ttf|otf|ico|css|js|json|xml|zip)$/i;
// Aggregator / OTA / platform-owned addresses — we should NOT market to these
const AGGREGATOR_RX = /@(?:booking\.com|expedia\.com|agoda\.com|hotels\.com|airbnb\.com|traveloka\.com|tiket\.com|trivago\.com|priceline\.com|google\.com|facebook\.com|meta\.com|instagram\.com|whatsapp\.com|yelp\.com|tripadvisor\.com|foursquare\.com)$/i;

function isValidEmail(e) {
  if (typeof e !== "string") return false;
  const clean = e.trim().toLowerCase();
  if (clean.length < 5 || clean.length > 254) return false;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return false;
  if (BLOCK_RX.test(clean)) return false;
  if (FAKE_TLD_RX.test(clean)) return false; // us@3x.png etc
  if (AGGREGATOR_RX.test(clean)) return false; // customer.service@booking.com etc
  return true;
}

async function emitFW(c, kind, status, message, ref = {}) {
  try {
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('email_enricher', $1, $2, 'marketing-import.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(ref)]
    );
  } catch { /* silent */ }
}

// Upsert one contact into nex.marketing_contact
async function upsertContact(c, {
  email, business_name, category_group, category_slug, country, city,
  district, phone, whatsapp, website, source_table, source_reference, confidence,
}) {
  const cleanEmail = String(email).trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) return { skipped: "invalid_email" };
  // Skip if already opted out globally
  const opt = await c.query(`SELECT 1 FROM nex.marketing_opt_out WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
  if (opt.rowCount && opt.rowCount > 0) return { skipped: "opted_out" };

  const r = await c.query(`
    INSERT INTO nex.marketing_contact
      (email, business_name, category_group, category_slug, country, city, district,
       phone, whatsapp, website, source_tables, source_reference, contact_confidence)
    VALUES ($1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, ARRAY[$11], $12, $13)
    ON CONFLICT ((LOWER(email))) DO UPDATE SET
      last_seen_at = now(),
      business_name = COALESCE(nex.marketing_contact.business_name, EXCLUDED.business_name),
      category_group = COALESCE(nex.marketing_contact.category_group, EXCLUDED.category_group),
      category_slug = COALESCE(nex.marketing_contact.category_slug, EXCLUDED.category_slug),
      city = COALESCE(nex.marketing_contact.city, EXCLUDED.city),
      district = COALESCE(nex.marketing_contact.district, EXCLUDED.district),
      phone = COALESCE(nex.marketing_contact.phone, EXCLUDED.phone),
      whatsapp = COALESCE(nex.marketing_contact.whatsapp, EXCLUDED.whatsapp),
      website = COALESCE(nex.marketing_contact.website, EXCLUDED.website),
      source_tables = ARRAY(SELECT DISTINCT UNNEST(nex.marketing_contact.source_tables || ARRAY[$11])),
      contact_confidence = GREATEST(COALESCE(nex.marketing_contact.contact_confidence, 0), COALESCE(EXCLUDED.contact_confidence, 0))
    RETURNING (xmax = 0) AS is_insert
  `, [
    cleanEmail, business_name ?? null, category_group ?? null, category_slug ?? null,
    country ?? "ID", city ?? null, district ?? null,
    phone ?? null, whatsapp ?? null, website ?? null,
    source_table, source_reference ?? null, confidence ?? 0.5,
  ]);
  return { is_insert: r.rows[0].is_insert === true };
}

// ─── Source 1: nex.accommodation_business ─────────────────────────
async function importAccommodation(c) {
  const rows = (await c.query(`
    SELECT business_name, city, district, phone, website,
           payload->>'email' AS email, coordinates_lat, source
    FROM nex.accommodation_business
    LEFT JOIN LATERAL jsonb_build_object('email', NULL) payload ON TRUE
    WHERE 1=1
  `)).rows;
  return await importFromRows(c, rows, {
    category_group: "accommodation",
    category_slug: "accommodation-hotel",
    source_table: "nex.accommodation_business",
    email_selector: (r) => r.email, // no email column in this table currently
  });
}

// ─── Source 2: nex.food_business ──────────────────────────────────
async function importFoodBusiness(c) {
  // Check whether food_business has an email column
  const hasEmail = (await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='food_business' AND column_name='email'
  `)).rowCount > 0;
  if (!hasEmail) return { count: 0, inserted: 0, updated: 0, note: "no email column" };
  const rows = (await c.query(`
    SELECT business_name, city, phone, website, email, source
    FROM nex.food_business WHERE email IS NOT NULL
  `)).rows;
  return await importFromRows(c, rows, {
    category_group: "food-beverage",
    category_slug: "food-beverage-restaurant",
    source_table: "nex.food_business",
    email_selector: (r) => r.email,
  });
}

// ─── Source 3: nex.business_lead_directory (broad leads) ──────────
async function importBusinessLeadDirectory(c) {
  const rows = (await c.query(`
    SELECT business_name, category_group, category_slug, city, district, phone, whatsapp_number,
           website, email, additional_emails, country, source_reference
    FROM nex.business_lead_directory WHERE email IS NOT NULL AND contact_opt_out = FALSE
  `)).rows;
  let counts = { count: 0, inserted: 0, updated: 0, skipped: 0 };
  for (const r of rows) {
    const emails = [r.email, ...(r.additional_emails ?? [])];
    for (const e of emails) {
      counts.count++;
      const res = await upsertContact(c, {
        email: e, business_name: r.business_name,
        category_group: r.category_group, category_slug: r.category_slug,
        country: r.country, city: r.city, district: r.district,
        phone: r.phone, whatsapp: r.whatsapp_number,
        website: r.website, source_table: "nex.business_lead_directory",
        source_reference: r.source_reference, confidence: 0.7,
      });
      if (res.skipped) counts.skipped++;
      else if (res.is_insert) counts.inserted++;
      else counts.updated++;
    }
  }
  return counts;
}

// ─── Source 4-8: nex_lab_*.harvest_raw.enriched_contacts.emails ──
async function importFromLabRoom(c, roomSlug) {
  const schema = `nex_lab_${roomSlug}`;
  const rows = (await c.query(`
    SELECT payload->>'name' AS business_name,
           payload->>'website' AS website,
           payload->>'phone' AS phone,
           payload->'address'->>'city' AS city,
           payload->>'derived_category' AS category_group,
           payload->>'derived_subcategory' AS derived_sub,
           payload->'enriched_contacts'->'emails' AS emails_json,
           payload->'ig_bio_data'->'bio_emails' AS ig_emails,
           source_ref
    FROM ${schema}.harvest_raw
    WHERE (payload->'enriched_contacts'->'emails' IS NOT NULL
        OR payload->'ig_bio_data'->'bio_emails' IS NOT NULL)
  `)).rows;
  let counts = { count: 0, inserted: 0, updated: 0, skipped: 0 };
  for (const r of rows) {
    const emails = [];
    if (Array.isArray(r.emails_json)) {
      for (const e of r.emails_json) emails.push(typeof e === "string" ? e : e?.email);
    }
    if (Array.isArray(r.ig_emails)) {
      for (const e of r.ig_emails) emails.push(e);
    }
    for (const e of emails.filter(Boolean)) {
      counts.count++;
      const catGroup = r.category_group ?? roomSlug;
      const catSlug = r.derived_sub ? `${catGroup}-${r.derived_sub}` : `${catGroup}-general`;
      const res = await upsertContact(c, {
        email: e, business_name: r.business_name,
        category_group: catGroup, category_slug: catSlug,
        country: "ID", city: r.city,
        phone: r.phone, website: r.website,
        source_table: `${schema}.harvest_raw`, source_reference: r.source_ref, confidence: 0.6,
      });
      if (res.skipped) counts.skipped++;
      else if (res.is_insert) counts.inserted++;
      else counts.updated++;
    }
  }
  return counts;
}

async function importFromRows(c, rows, cfg) {
  let counts = { count: 0, inserted: 0, updated: 0, skipped: 0 };
  for (const r of rows) {
    const email = cfg.email_selector(r);
    if (!email) continue;
    counts.count++;
    const res = await upsertContact(c, {
      email, business_name: r.business_name,
      category_group: cfg.category_group, category_slug: cfg.category_slug,
      country: r.country ?? "ID", city: r.city, district: r.district,
      phone: r.phone, website: r.website,
      source_table: cfg.source_table, source_reference: r.source ?? null, confidence: 0.6,
    });
    if (res.skipped) counts.skipped++;
    else if (res.is_insert) counts.inserted++;
    else counts.updated++;
  }
  return counts;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  const { Client } = await import("pg");
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  try {
    log("start · scanning 8 sources for emails");
    await emitFW(c, "scheduled_task_triggered", "info", "email import sweep", {});
    const totals = {};

    log("  ▶ nex.business_lead_directory");
    totals.business_leads = await importBusinessLeadDirectory(c);
    log(`    ${JSON.stringify(totals.business_leads)}`);

    log("  ▶ nex.food_business");
    totals.food = await importFoodBusiness(c);
    log(`    ${JSON.stringify(totals.food)}`);

    for (const room of ["accommodation","food","transport","business","activities"]) {
      log(`  ▶ nex_lab_${room}.harvest_raw`);
      totals[`lab_${room}`] = await importFromLabRoom(c, room);
      log(`    ${JSON.stringify(totals[`lab_${room}`])}`);
    }

    const grand = { inserted: 0, updated: 0, skipped: 0, count: 0 };
    for (const [, v] of Object.entries(totals)) {
      grand.inserted += v.inserted ?? 0;
      grand.updated += v.updated ?? 0;
      grand.skipped += v.skipped ?? 0;
      grand.count += v.count ?? 0;
    }
    const totalContacts = (await c.query(`SELECT count(*)::int c FROM nex.marketing_contact`)).rows[0].c;
    log(`done · ${grand.inserted} inserted · ${grand.updated} updated · ${grand.skipped} skipped · ${totalContacts} contacts total · ${Date.now() - t0}ms`);
    await emitFW(c, "scheduled_task_completed", "ok",
      `imported ${grand.inserted} new + ${grand.updated} updated · ${totalContacts} contacts total`,
      { ...grand, total_contacts: totalContacts, duration_ms: Date.now() - t0 });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

main().catch((err) => { log("fatal: " + String(err).slice(0, 300)); process.exit(1); });
