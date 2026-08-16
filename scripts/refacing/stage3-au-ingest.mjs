#!/usr/bin/env node
// Stage 3-AU · convert Stage-2 discovery output for the Australian staircase
// market into DirectorySeed rows and upsert them into the public.directory_seeds
// Supabase table. Same shape/rules as the UK/US/IE production_ready.json
// archives so the Trade Centre feed picks them up as first-class country=AU
// records.
//
// Idempotent: writes/re-reads _staircase_au_master/production_ready.json so
// each business keeps a stable UUID across re-runs. Re-invoking upserts by id.
//
// Usage:
//   node scripts/refacing/stage3-au-ingest.mjs [--dry-run]

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const ROOT = path.join(process.cwd(), "data", "directory-seeds");
const SRC  = path.join(ROOT, "_staircase_au_stage2", "stage2-au-consolidated.json");
const MASTER_DIR = path.join(ROOT, "_staircase_au_master");
const MASTER_FILE = path.join(MASTER_DIR, "production_ready.json");

const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!url || !key)) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = DRY ? null : createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NOW = new Date().toISOString();

function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Deterministic UUID v5-ish from a stable key so a re-run of the script keeps
// the same id per business (upsert onConflict: id then acts as UPDATE, never
// creating a duplicate).
function stableUuid(key) {
  const h = crypto.createHash("sha1").update(`nex-au-directory-seed:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16),                       // version 5
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.slice(18, 20), // variant
    h.slice(20, 32),
  ].join("-");
}

// business_type_claim → (category, primary_trade)
const TYPE_MAP = {
  STAIRCASE_MANUFACTURER:                   ["Staircase Manufacturer",              "staircase_manufacture"],
  MULTI_SERVICE_COMPANY:                    ["Multi-Service Staircase Company",     "staircase_manufacture"],
  REFACING_SERVICE_SPECIALIST:              ["Staircase Refacing Specialist",       "staircase_refacing"],
  REFURBISHMENT_SERVICE_SPECIALIST:         ["Staircase Refurbishment Specialist",  "staircase_refurbishment"],
  REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER: ["Staircase Kit or Product Supplier", "staircase_kit_supply"],
  STAIRCASE_INSTALLER:                      ["Staircase Installer",                 "staircase_installation"],
};

// Capabilities the DirectorySeed uses. Missing keys default to "unknown".
const CAPABILITY_KEYS = [
  "manufacture", "installation", "design",
  "refurbishment", "refacing",
  "balustrade", "handrail",
  "glass", "metal", "timber",
  "bespoke", "kit_or_product_supplier",
];

function capabilitiesObject(claims, evidence) {
  const out = {};
  const claimSet = new Set(claims ?? []);
  for (const k of CAPABILITY_KEYS) {
    out[k] = claimSet.has(k) ? "yes" : "unknown";
  }
  // Evidence hints — promote to "yes" if evidence text mentions the capability.
  const ev = evidence ?? {};
  for (const [k, v] of Object.entries(ev)) {
    if (CAPABILITY_KEYS.includes(k) && v) out[k] = "yes";
  }
  return out;
}

function tagsFrom(candidate) {
  const t = new Set();
  const type = candidate.business_type_claim ?? "";
  if (type === "STAIRCASE_MANUFACTURER") t.add("staircase-manufacture");
  if (type === "REFACING_SERVICE_SPECIALIST") t.add("staircase-refacing");
  if (type === "REFURBISHMENT_SERVICE_SPECIALIST") t.add("staircase-refurbishment");
  if (type === "STAIRCASE_INSTALLER") t.add("staircase-installation");
  if (type === "REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER") t.add("staircase-kit-supply");
  for (const c of candidate.capability_claims ?? []) {
    if (c === "manufacture") t.add("staircase-manufacture");
    if (c === "installation") t.add("staircase-installation");
    if (c === "refurbishment") t.add("staircase-refurbishment");
    if (c === "refacing") t.add("staircase-refacing");
    if (c === "glass") t.add("material-glass");
    if (c === "metal") t.add("material-steel");
    if (c === "timber") t.add("material-timber");
    if (c === "bespoke") t.add("bespoke");
    if (c === "design") t.add("design");
    if (c === "balustrade") t.add("balustrade");
    if (c === "handrail") t.add("handrail");
    if (c === "kit_or_product_supplier") t.add("kit-supplier");
  }
  return [...t];
}

function refacingEvidenceFrom(candidate) {
  const src = candidate.source_url || candidate.website || null;
  const notes = candidate.evidence_notes ?? "";
  const out = [];
  const ev = candidate.capability_evidence ?? {};
  const claimedAt = String(candidate.discovery_timestamp ?? NOW).slice(0, 10);
  for (const [cap, summary] of Object.entries(ev)) {
    if (!summary) continue;
    out.push({
      url: src ?? "",
      type: "company_website",
      category:
        cap === "refacing" ? "staircase_refacing" :
        cap === "refurbishment" ? "staircase_refurbishment" :
        cap === "installation" ? "installation" :
        cap === "balustrade" || cap === "handrail" ? "balustrade_replacement" :
        cap === "manufacture" ? "other" : "other",
      summary: String(summary).slice(0, 500),
      checked_at: claimedAt,
    });
  }
  if (notes) {
    out.push({
      url: src ?? "",
      type: "company_website",
      category: "other",
      summary: notes.slice(0, 500),
      checked_at: claimedAt,
    });
  }
  return out;
}

function candidateToSeed(candidate, existingBySlug) {
  const town = candidate.city || candidate.suburb || null;
  const state = candidate.state || null;
  const [category, primary] = TYPE_MAP[candidate.business_type_claim] ?? [
    "Staircase", "staircase",
  ];
  const baseSlug = slugify(candidate.business_name);
  const geoHint  = slugify(candidate.suburb || candidate.city || state || "au");
  let slug = baseSlug ? `${baseSlug}-${geoHint || "au"}` : slugify(candidate.domain || "au-listing");
  // Ensure uniqueness within this batch — very rare given Stage-2 dedup
  // (332 unique), but defensive.
  if (existingBySlug.has(slug) && existingBySlug.get(slug) !== candidate.domain) {
    slug = `${slug}-${slugify(candidate.domain || crypto.randomUUID().slice(0, 6))}`;
  }
  existingBySlug.set(slug, candidate.domain);

  const stableKey = (candidate.domain || candidate.website || candidate.business_name || slug).toLowerCase();
  const id = stableUuid(stableKey);

  const description =
    candidate.evidence_notes ||
    Object.values(candidate.capability_evidence ?? {}).find(Boolean) ||
    null;

  const services = (candidate.capability_claims ?? []).slice();

  return {
    id,
    slug,
    business_name: candidate.business_name,
    category,
    primary_trade: primary,
    business_type: candidate.business_type_claim ?? null,
    capabilities: capabilitiesObject(candidate.capability_claims, candidate.capability_evidence),
    tags: tagsFrom(candidate),
    enrichment_status: "verified",
    last_verified_at: String(candidate.discovery_timestamp ?? NOW),

    address_line_1: null,
    address_line_2: candidate.suburb ?? null,
    town,
    county: null,
    postcode: candidate.postcode ?? null,
    country: "Australia",
    region: state,

    telephone: candidate.telephone ?? null,
    website: candidate.website ?? null,
    email: candidate.email ?? null,

    opening_hours: null,
    description,
    services,

    google_rating: null,
    google_review_count: null,
    google_maps_url: null,

    latitude: null,
    longitude: null,

    status: "listed",
    claimed: false,
    verified: false,
    visibility: "public",

    photos: [],
    cover_image: null,

    source: "refacing_discovery",
    imported_at: NOW,

    refacing_evidence: refacingEvidenceFrom(candidate),
    refacing_qualification: null,
    email_source: candidate.email ? "company_website" : null,
    email_verified: false,
    email_checked_at: null,
    lifecycle_status: "unclaimed",
    directory_state: "listed",
    email_status: candidate.email ? "needs_manual_verification" : "not_found",
  };
}

// DB row shape (subset present in schema; identical to what
// import-json-seeds-to-supabase.mjs sends).
function seedToRow(seed) {
  return {
    id:                     seed.id,
    slug:                   seed.slug,
    business_name:          seed.business_name,
    trading_name:           null,
    category:               seed.category,
    primary_trade:          seed.primary_trade,
    tags:                   seed.tags,
    enrichment_status:      seed.enrichment_status,
    last_verified_at:       seed.last_verified_at,

    address_line_1:         seed.address_line_1,
    address_line_2:         seed.address_line_2,
    town:                   seed.town,
    county:                 seed.county,
    postcode:               seed.postcode,
    country:                seed.country,

    telephone:              seed.telephone,
    website:                seed.website,
    email:                  seed.email,

    opening_hours:          seed.opening_hours,
    description:            seed.description,
    services:               seed.services,

    google_rating:          seed.google_rating,
    google_review_count:    seed.google_review_count,
    google_maps_url:        seed.google_maps_url,

    latitude:               seed.latitude,
    longitude:              seed.longitude,

    status:                 seed.status,
    claimed:                seed.claimed,
    verified:               seed.verified,
    visibility:             seed.visibility,

    photos:                 seed.photos,
    cover_image:            seed.cover_image,

    source:                 seed.source,
    imported_at:            seed.imported_at,

    capabilities:           seed.capabilities,
    refacing_evidence:      seed.refacing_evidence,
    refacing_qualification: seed.refacing_qualification,
    email_source:           seed.email_source,
    email_verified:         seed.email_verified,
    email_checked_at:       seed.email_checked_at,
    lifecycle_status:       seed.lifecycle_status,
    directory_state:        seed.directory_state,
    email_status:           seed.email_status,

    region:                 seed.region,
  };
}

async function main() {
  console.log(`[stage3-au] reading ${SRC}`);
  const raw = await fs.readFile(SRC, "utf8");
  const candidates = JSON.parse(raw);
  console.log(`[stage3-au] ${candidates.length} candidates`);

  // Preserve stable ids across re-runs if we've already written master.
  const existingById = new Map();
  try {
    const prior = JSON.parse(await fs.readFile(MASTER_FILE, "utf8"));
    for (const s of prior) if (s.id && s.slug) existingById.set(s.slug, s.id);
    console.log(`[stage3-au] loaded ${existingById.size} existing seeds from master`);
  } catch {
    console.log(`[stage3-au] no prior master · first run`);
  }

  const existingBySlug = new Map();
  const seeds = [];
  for (const c of candidates) {
    if (!c.business_name) continue;
    const seed = candidateToSeed(c, existingBySlug);
    if (existingById.has(seed.slug)) seed.id = existingById.get(seed.slug);
    seeds.push(seed);
  }

  const byState = seeds.reduce((m, s) => { m[s.region ?? "?"] = (m[s.region ?? "?"] ?? 0) + 1; return m; }, {});
  console.log(`[stage3-au] converted ${seeds.length} seeds · by state:`, byState);

  await fs.mkdir(MASTER_DIR, { recursive: true });
  await fs.writeFile(MASTER_FILE, JSON.stringify(seeds, null, 2), "utf8");
  console.log(`[stage3-au] wrote master archive → ${MASTER_FILE}`);

  if (DRY) {
    console.log("[stage3-au] --dry-run · no DB writes");
    console.log("[stage3-au] sample seed:", JSON.stringify(seeds[0], null, 2).slice(0, 1200));
    return;
  }

  const BATCH = 100;
  let upserted = 0, errors = 0, emailNulled = 0;
  for (let i = 0; i < seeds.length; i += BATCH) {
    const chunk = seeds.slice(i, i + BATCH).map(seedToRow);
    const res = await supabase.from("directory_seeds").upsert(chunk, { onConflict: "id" });
    if (!res.error) {
      upserted += chunk.length;
      console.log(`[stage3-au] upserted ${upserted}/${seeds.length}`);
      continue;
    }

    // Batch failed. Fall back to per-row so one bad row can't sink 99 good ones.
    // Common cause: email collides with another country's seed. Null out email
    // and retry — the DirectorySeed loader tolerates null emails everywhere.
    console.warn(`[stage3-au] batch ${i}-${i + chunk.length} failed (${res.error.message}) · retrying per-row`);
    for (const row of chunk) {
      const r1 = await supabase.from("directory_seeds").upsert([row], { onConflict: "id" });
      if (!r1.error) { upserted++; continue; }
      if (/email/i.test(r1.error.message) && row.email) {
        const r2 = await supabase.from("directory_seeds")
          .upsert([{ ...row, email: null, email_source: null, email_status: "not_found" }], { onConflict: "id" });
        if (!r2.error) { upserted++; emailNulled++; continue; }
        console.error(`[stage3-au]   row ${row.slug} failed after email-null retry:`, r2.error.message);
      } else {
        console.error(`[stage3-au]   row ${row.slug} failed:`, r1.error.message);
      }
      errors++;
    }
    console.log(`[stage3-au] upserted ${upserted}/${seeds.length}`);
  }
  if (emailNulled) console.log(`[stage3-au] nulled ${emailNulled} colliding emails to satisfy uq_directory_seeds_email_lower`);

  const verify = await supabase
    .from("directory_seeds")
    .select("*", { count: "exact", head: true })
    .eq("country", "Australia");
  console.log(`[stage3-au] AU rows in DB after ingest: ${verify.count ?? "?"}`);
  console.log(`[stage3-au] complete · upserted ${upserted} · errors ${errors}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
