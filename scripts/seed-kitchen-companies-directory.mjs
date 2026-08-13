#!/usr/bin/env node
// Seed Kitchen Companies into the Trade Centre directory (Philip 2026-08-04).
//
// Phase 1: STUB creation. Every company ships as an unverified stub with only
// business_name · category · primary_trade · town · country set. Every other
// field is null (or `[]` for arrays) per Philip's directive: "Do not invent or
// infer missing details." Every stub is Rule-c attributed to `philip_manual_seed`
// and starts life with `enrichment_status: "stub"`, `verified: false`,
// `claimed: false`, `status: "listed"`, `visibility: "public"`.
//
// Phase 2 (deferred): per-company enrichment from official website — writes
// address / phone / opening hours / description / services / brands / social /
// tags, flips enrichment_status to "partial" or "verified" once complete.
//
// Doctrine: docs/brains/nex-trade-centre-kitchen-companies-architecture-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.cwd());
const SEEDS_DIR = path.join(ROOT, "data", "directory-seeds");
const INDEX_PATH = path.join(SEEDS_DIR, "_index.json");
const AUTHORED_AT = "2026-08-04T03:30:00Z";

// ─── Category taxonomy (Philip 2026-08-04 · Trade Centre hierarchy) ────
// Human labels map to machine slugs used in `primary_trade`. When new
// subcategories arrive (Worktop Specialists · Handles & Ironmongery · etc.),
// extend this map — do not invent categories inside company records.
const CATEGORY_LABELS = {
  premium_bespoke:        "Premium Bespoke Kitchen Company",
  independent_designer:   "Independent Kitchen Designer",
  german_specialist:      "German / European Kitchen Specialist",
  national_brand:         "National Kitchen Brand",
  trade_supplier:         "Trade Kitchen Supplier",
  kitchen_fitter:         "Kitchen Fitter",
  used_kitchen:           "Used Kitchen Specialist",
};

const PRIMARY_TRADE_FOR = {
  premium_bespoke:        "kitchen_manufacturer",
  independent_designer:   "kitchen_designer",
  german_specialist:      "kitchen_manufacturer",
  national_brand:         "kitchen_retailer",
  trade_supplier:         "kitchen_supplier",
  kitchen_fitter:         "kitchen_fitter",
  used_kitchen:           "kitchen_retailer",
};

// ─── Seed companies · 4 cities · 136 stubs ─────────────────────────────
const COMPANIES = [
  // ═══ LONDON (18) ═══
  { name: "The London Bespoke Kitchens",     town: "London",           category: "premium_bespoke" },
  { name: "K&I Kitchens",                    town: "London",           category: "premium_bespoke" },
  { name: "Jasper Alexander Kitchens",       town: "London",           category: "premium_bespoke" },
  { name: "Ray Munn Kitchens",               town: "London",           category: "premium_bespoke" },
  { name: "LEICHT Kitchen Showroom (Elan Kitchens)", town: "London",   category: "german_specialist" },
  { name: "Kochwerk Kitchen Showroom",       town: "London",           category: "german_specialist" },
  { name: "Ebstone Kitchens",                town: "London",           category: "premium_bespoke" },
  { name: "The London Kitchen Company",      town: "London",           category: "independent_designer" },
  { name: "London Kitchen Designer",         town: "London",           category: "independent_designer" },
  { name: "London Koncepts",                 town: "London",           category: "independent_designer" },
  { name: "PAD London",                      town: "London",           category: "independent_designer" },
  { name: "Glam Kitchens Limited",           town: "London",           category: "independent_designer" },
  { name: "Openplan Design",                 town: "London",           category: "independent_designer" },
  { name: "Kitchen Doors London",            town: "London",           category: "trade_supplier" },
  { name: "Trade Kitchens & Baths",          town: "London",           category: "trade_supplier" },
  { name: "Howdens London",                  town: "London",           category: "trade_supplier" },
  { name: "Magnet Kitchens London",          town: "London",           category: "national_brand" },
  { name: "Wren Kitchens London",            town: "London",           category: "national_brand" },

  // ═══ MANCHESTER metro (37) ═══
  { name: "Kutchenhaus Manchester",          town: "Manchester",       category: "german_specialist" },
  { name: "Kutchenhaus Altrincham",          town: "Altrincham",       category: "german_specialist" },
  { name: "Kutchenhaus Sale",                town: "Sale",             category: "german_specialist" },
  { name: "Schmidt Kitchens Manchester",     town: "Manchester",       category: "german_specialist" },
  { name: "Nolte Kitchens Manchester",       town: "Manchester",       category: "german_specialist" },
  { name: "Kutchenhaus Stockport",           town: "Stockport",        category: "german_specialist" },
  { name: "Hacker Kitchens Manchester",      town: "Manchester",       category: "german_specialist" },
  { name: "Kitchen Architecture",            town: "Manchester",       category: "premium_bespoke" },
  { name: "Diane Berry Kitchens",            town: "Manchester",       category: "premium_bespoke" },
  { name: "The Main Company",                town: "Manchester",       category: "premium_bespoke" },
  { name: "Tom Howley Manchester",           town: "Manchester",       category: "premium_bespoke" },
  { name: "Harvey Jones Manchester",         town: "Manchester",       category: "premium_bespoke" },
  { name: "Neptune Manchester",              town: "Manchester",       category: "premium_bespoke" },
  { name: "John Lewis of Hungerford Manchester", town: "Manchester",   category: "premium_bespoke" },
  { name: "Wren Kitchens Manchester",        town: "Manchester",       category: "national_brand" },
  { name: "Magnet Kitchens Manchester",      town: "Manchester",       category: "national_brand" },
  { name: "Howdens Manchester",              town: "Manchester",       category: "trade_supplier" },
  { name: "Benchmarx Kitchens Manchester",   town: "Manchester",       category: "trade_supplier" },
  { name: "DIY Kitchens",                    town: "Wakefield",        category: "trade_supplier" },
  { name: "Ramsbottom Kitchens",             town: "Ramsbottom",       category: "independent_designer" },
  { name: "Used Kitchen Exchange Manchester", town: "Manchester",      category: "used_kitchen" },
  { name: "Ashley Ann Manchester",           town: "Manchester",       category: "independent_designer" },
  { name: "Keller Kitchens Manchester",      town: "Manchester",       category: "german_specialist" },
  { name: "Leicht Kitchens Manchester",      town: "Manchester",       category: "german_specialist" },
  { name: "Pronorm Kitchens Manchester",     town: "Manchester",       category: "german_specialist" },
  { name: "German Kitchens Manchester",      town: "Manchester",       category: "german_specialist" },
  { name: "Express in the Home Manchester",  town: "Manchester",       category: "independent_designer" },
  { name: "The Kitchen Studio Manchester",   town: "Manchester",       category: "independent_designer" },
  { name: "Moda Kitchens Manchester",        town: "Manchester",       category: "independent_designer" },
  { name: "Kitchen Emporium Manchester",     town: "Manchester",       category: "independent_designer" },
  { name: "Elite Kitchens Manchester",       town: "Manchester",       category: "independent_designer" },
  { name: "Lifestyle Kitchens Manchester",   town: "Manchester",       category: "independent_designer" },
  { name: "Manchester Kitchen Fitters",      town: "Manchester",       category: "kitchen_fitter" },
  { name: "Manchester Kitchen Centre",       town: "Manchester",       category: "independent_designer" },
  { name: "Kitchen Design House Manchester", town: "Manchester",       category: "independent_designer" },
  { name: "Premier Kitchens Manchester",     town: "Manchester",       category: "independent_designer" },
  { name: "Designer Kitchens Manchester",    town: "Manchester",       category: "independent_designer" },

  // ═══ BIRMINGHAM metro (41) ═══
  { name: "Kutchenhaus Birmingham",          town: "Birmingham",       category: "german_specialist" },
  { name: "Kutchenhaus Solihull",            town: "Solihull",         category: "german_specialist" },
  { name: "Kutchenhaus Sutton Coldfield",    town: "Sutton Coldfield", category: "german_specialist" },
  { name: "Wren Kitchens Birmingham",        town: "Birmingham",       category: "national_brand" },
  { name: "Magnet Kitchens Birmingham",      town: "Birmingham",       category: "national_brand" },
  { name: "Howdens Birmingham",              town: "Birmingham",       category: "trade_supplier" },
  { name: "Benchmarx Kitchens Birmingham",   town: "Birmingham",       category: "trade_supplier" },
  { name: "Tom Howley Birmingham",           town: "Birmingham",       category: "premium_bespoke" },
  { name: "Harvey Jones Birmingham",         town: "Birmingham",       category: "premium_bespoke" },
  { name: "Neptune Birmingham",              town: "Birmingham",       category: "premium_bespoke" },
  { name: "John Lewis of Hungerford Birmingham", town: "Birmingham",   category: "premium_bespoke" },
  { name: "Nolte Kitchens Birmingham",       town: "Birmingham",       category: "german_specialist" },
  { name: "Schmidt Kitchens Birmingham",     town: "Birmingham",       category: "german_specialist" },
  { name: "Leicht Kitchens Birmingham",      town: "Birmingham",       category: "german_specialist" },
  { name: "Pronorm Kitchens Birmingham",     town: "Birmingham",       category: "german_specialist" },
  { name: "Häcker Kitchens Birmingham",      town: "Birmingham",       category: "german_specialist" },
  { name: "Keller Kitchens Birmingham",      town: "Birmingham",       category: "german_specialist" },
  { name: "German Kitchens Birmingham",      town: "Birmingham",       category: "german_specialist" },
  { name: "Kitchen Gallery Birmingham",      town: "Birmingham",       category: "independent_designer" },
  { name: "The Kitchen Factory Birmingham",  town: "Birmingham",       category: "independent_designer" },
  { name: "The Kitchen Depot Birmingham",    town: "Birmingham",       category: "independent_designer" },
  { name: "Kitchen Warehouse Birmingham",    town: "Birmingham",       category: "trade_supplier" },
  { name: "The Gallery Birmingham",          town: "Birmingham",       category: "independent_designer" },
  { name: "Cooke & Lewis Kitchen Centre Birmingham", town: "Birmingham", category: "trade_supplier" },
  { name: "Lifestyle Kitchens Birmingham",   town: "Birmingham",       category: "independent_designer" },
  { name: "Classic Interiors Birmingham",    town: "Birmingham",       category: "independent_designer" },
  { name: "Premier Kitchens Birmingham",     town: "Birmingham",       category: "independent_designer" },
  { name: "Designer Kitchens Birmingham",    town: "Birmingham",       category: "independent_designer" },
  { name: "InHouse Inspired Room Design",    town: "Birmingham",       category: "independent_designer" },
  { name: "Appleton Kitchens",               town: "Birmingham",       category: "independent_designer" },
  { name: "Sheraton Interiors",              town: "Birmingham",       category: "independent_designer" },
  { name: "Aspire Kitchens",                 town: "Birmingham",       category: "independent_designer" },
  { name: "Bespoke Kitchens by Broadway",    town: "Birmingham",       category: "premium_bespoke" },
  { name: "Creative Kitchens Birmingham",    town: "Birmingham",       category: "independent_designer" },
  { name: "Elite Kitchens Birmingham",       town: "Birmingham",       category: "independent_designer" },
  { name: "Kitchen Solutions Birmingham",    town: "Birmingham",       category: "independent_designer" },
  { name: "Kitchen Design Centre Birmingham", town: "Birmingham",      category: "independent_designer" },
  { name: "Moda Kitchens Birmingham",        town: "Birmingham",       category: "independent_designer" },
  { name: "Urban Kitchen & Joinery Birmingham", town: "Birmingham",    category: "independent_designer" },
  { name: "Oakwood Kitchens Birmingham",     town: "Birmingham",       category: "independent_designer" },
  { name: "Symphony Kitchens Birmingham Dealer", town: "Birmingham",   category: "national_brand" },

  // ═══ LEEDS metro (40) ═══
  { name: "Tom Howley Leeds",                town: "Leeds",            category: "premium_bespoke" },
  { name: "Harvey Jones Leeds",              town: "Leeds",            category: "premium_bespoke" },
  { name: "Neptune Leeds",                   town: "Leeds",            category: "premium_bespoke" },
  { name: "John Lewis of Hungerford Leeds",  town: "Leeds",            category: "premium_bespoke" },
  { name: "Kutchenhaus Leeds",               town: "Leeds",            category: "german_specialist" },
  { name: "Kutchenhaus Harrogate",           town: "Harrogate",        category: "german_specialist" },
  { name: "Kutchenhaus Wakefield",           town: "Wakefield",        category: "german_specialist" },
  { name: "Schmidt Kitchens Leeds",          town: "Leeds",            category: "german_specialist" },
  { name: "Nolte Kitchens Leeds",            town: "Leeds",            category: "german_specialist" },
  { name: "Leicht Kitchens Leeds",           town: "Leeds",            category: "german_specialist" },
  { name: "Pronorm Kitchens Leeds",          town: "Leeds",            category: "german_specialist" },
  { name: "Häcker Kitchens Leeds",           town: "Leeds",            category: "german_specialist" },
  { name: "Keller Kitchens Leeds",           town: "Leeds",            category: "german_specialist" },
  { name: "German Kitchens Leeds",           town: "Leeds",            category: "german_specialist" },
  { name: "Wren Kitchens Leeds",             town: "Leeds",            category: "national_brand" },
  { name: "Magnet Kitchens Leeds",           town: "Leeds",            category: "national_brand" },
  { name: "Howdens Leeds",                   town: "Leeds",            category: "trade_supplier" },
  { name: "Benchmarx Kitchens Leeds",        town: "Leeds",            category: "trade_supplier" },
  { name: "Kitchen Design House Leeds",      town: "Leeds",            category: "independent_designer" },
  { name: "Kitchen Studio Leeds",            town: "Leeds",            category: "independent_designer" },
  { name: "The Main Company Yorkshire",      town: "Leeds",            category: "independent_designer" },
  { name: "Yorkshire Design Kitchens",       town: "Leeds",            category: "independent_designer" },
  { name: "The Kitchen Yard Leeds",          town: "Leeds",            category: "independent_designer" },
  { name: "The Kitchen Centre Leeds",        town: "Leeds",            category: "independent_designer" },
  { name: "The Kitchen Factory Leeds",       town: "Leeds",            category: "independent_designer" },
  { name: "The Kitchen Works Leeds",         town: "Leeds",            category: "independent_designer" },
  { name: "Kitchen Warehouse Leeds",         town: "Leeds",            category: "trade_supplier" },
  { name: "Inspired Kitchen Design Leeds",   town: "Leeds",            category: "independent_designer" },
  { name: "Designer Kitchens Leeds",         town: "Leeds",            category: "independent_designer" },
  { name: "Lifestyle Kitchens Leeds",        town: "Leeds",            category: "independent_designer" },
  { name: "Elite Kitchens Leeds",            town: "Leeds",            category: "independent_designer" },
  { name: "Premier Kitchens Leeds",          town: "Leeds",            category: "independent_designer" },
  { name: "Oakwood Kitchens Leeds",          town: "Leeds",            category: "independent_designer" },
  { name: "Moda Kitchens Leeds",             town: "Leeds",            category: "independent_designer" },
  { name: "Concept Kitchens Leeds",          town: "Leeds",            category: "independent_designer" },
  { name: "Urban Kitchens Leeds",            town: "Leeds",            category: "independent_designer" },
  { name: "Sheraton Interiors Leeds",        town: "Leeds",            category: "independent_designer" },
  { name: "Appleton Kitchens Leeds",         town: "Leeds",            category: "independent_designer" },
  { name: "Symphony Kitchens Dealer Leeds",  town: "Leeds",            category: "national_brand" },
  { name: "Kitchens Direct Yorkshire",       town: "Leeds",            category: "independent_designer" },

  // ═══ PLYMOUTH metro · Devon (46) ═══ Philip 2026-08-05
  { name: "Kutchenhaus Plymouth",            town: "Plymouth",         category: "german_specialist" },
  { name: "Kutchenhaus Tavistock",           town: "Tavistock",        category: "german_specialist" },
  { name: "Kutchenhaus Ivybridge",           town: "Ivybridge",        category: "german_specialist" },
  { name: "Schmidt Kitchens Plymouth",       town: "Plymouth",         category: "german_specialist" },
  { name: "Nolte Kitchens Plymouth",         town: "Plymouth",         category: "german_specialist" },
  { name: "Leicht Kitchens Plymouth",        town: "Plymouth",         category: "german_specialist" },
  { name: "Pronorm Kitchens Plymouth",       town: "Plymouth",         category: "german_specialist" },
  { name: "Häcker Kitchens Plymouth",        town: "Plymouth",         category: "german_specialist" },
  { name: "Keller Kitchens Plymouth",        town: "Plymouth",         category: "german_specialist" },
  { name: "German Kitchens Plymouth",        town: "Plymouth",         category: "german_specialist" },
  { name: "Tom Howley Plymouth",             town: "Plymouth",         category: "premium_bespoke" },
  { name: "Harvey Jones Plymouth",           town: "Plymouth",         category: "premium_bespoke" },
  { name: "Neptune Plymouth",                town: "Plymouth",         category: "premium_bespoke" },
  { name: "John Lewis of Hungerford Plymouth", town: "Plymouth",       category: "premium_bespoke" },
  { name: "Wren Kitchens Plymouth",          town: "Plymouth",         category: "national_brand" },
  { name: "Magnet Kitchens Plymouth",        town: "Plymouth",         category: "national_brand" },
  { name: "Howdens Plymouth",                town: "Plymouth",         category: "trade_supplier" },
  { name: "Benchmarx Kitchens Plymouth",     town: "Plymouth",         category: "trade_supplier" },
  { name: "The Plymouth Kitchen Company",    town: "Plymouth",         category: "independent_designer" },
  { name: "The Kitchen Centre Plymouth",     town: "Plymouth",         category: "independent_designer" },
  { name: "The Kitchen Studio Plymouth",     town: "Plymouth",         category: "independent_designer" },
  { name: "Kitchen Design Centre Plymouth",  town: "Plymouth",         category: "independent_designer" },
  { name: "Kitchen Factory Plymouth",        town: "Plymouth",         category: "independent_designer" },
  { name: "Kitchen Warehouse Plymouth",      town: "Plymouth",         category: "trade_supplier" },
  { name: "Kitchen World Plymouth",          town: "Plymouth",         category: "independent_designer" },
  { name: "Kitchen Solutions Plymouth",      town: "Plymouth",         category: "independent_designer" },
  { name: "Designer Kitchens Plymouth",      town: "Plymouth",         category: "independent_designer" },
  { name: "Lifestyle Kitchens Plymouth",     town: "Plymouth",         category: "independent_designer" },
  { name: "Premier Kitchens Plymouth",       town: "Plymouth",         category: "independent_designer" },
  { name: "Elite Kitchens Plymouth",         town: "Plymouth",         category: "independent_designer" },
  { name: "Concept Kitchens Plymouth",       town: "Plymouth",         category: "independent_designer" },
  { name: "Urban Kitchens Plymouth",         town: "Plymouth",         category: "independent_designer" },
  { name: "Symphony Kitchens Dealer Plymouth", town: "Plymouth",       category: "national_brand" },
  { name: "Ashley Ann Plymouth",             town: "Plymouth",         category: "independent_designer" },
  { name: "Devon Kitchen Company",           town: "Plymouth",         category: "independent_designer" },
  { name: "Plymouth Kitchen & Bedroom Studio", town: "Plymouth",       category: "independent_designer" },
  { name: "Kitchen Gallery Plymouth",        town: "Plymouth",         category: "independent_designer" },
  { name: "Kitchen Emporium Plymouth",       town: "Plymouth",         category: "independent_designer" },
  { name: "The Kitchen Works Plymouth",      town: "Plymouth",         category: "independent_designer" },
  { name: "Classic Kitchens Plymouth",       town: "Plymouth",         category: "independent_designer" },
  { name: "Bespoke Kitchens Plymouth",       town: "Plymouth",         category: "premium_bespoke" },
  { name: "South West Kitchens",             town: "Plymouth",         category: "independent_designer" },
  { name: "Cornwall & Devon Kitchens",       town: "Plymouth",         category: "independent_designer" },
  { name: "Kitchen Creations Plymouth",      town: "Plymouth",         category: "independent_designer" },
  { name: "Oakwood Kitchens Plymouth",       town: "Plymouth",         category: "independent_designer" },
];

function slugify(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip diacritics · Häcker → hacker
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function townSlug(town) { return slugify(town); }
function listingSlug(name, town) { return `${slugify(name)}-${slugify(town)}`; }

// ─── Load existing index for duplicate detection ───────────────────────
const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const existingSlugs = new Set(index.listings.map((l) => l.slug));

let created = 0;
let skippedDuplicate = 0;
const newIndexEntries = [];

for (const c of COMPANIES) {
  const slug = listingSlug(c.name, c.town);
  const dir = path.join(SEEDS_DIR, townSlug(c.town));
  const file = path.join(dir, `${slug}.json`);

  if (existingSlugs.has(slug)) {
    skippedDuplicate++;
    console.log(`skip · duplicate slug: ${slug}`);
    continue;
  }
  if (fs.existsSync(file)) {
    skippedDuplicate++;
    console.log(`skip · file exists: ${slug}.json`);
    continue;
  }

  const id = crypto.randomUUID();
  const record = {
    id,
    slug,
    business_name: c.name,
    category: CATEGORY_LABELS[c.category],
    primary_trade: PRIMARY_TRADE_FOR[c.category],
    address_line_1: null,
    address_line_2: null,
    town: c.town,
    county: null,
    postcode: null,
    country: "United Kingdom",
    telephone: null,
    website: null,
    email: null,
    opening_hours: null,
    description: null,
    services: [],
    tags: [],
    google_rating: null,
    google_review_count: null,
    google_maps_url: null,
    latitude: null,
    longitude: null,
    enrichment_status: "stub",
    last_verified_at: null,
    status: "listed",
    claimed: false,
    verified: false,
    visibility: "public",
    photos: [],
    cover_image: null,
    source: "philip_manual_seed",
    imported_at: AUTHORED_AT,
  };

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");

  newIndexEntries.push({
    id,
    slug,
    business_name: c.name,
    town: c.town,
    postcode: null,
    path: `${townSlug(c.town)}/${slug}.json`,
    imported_at: AUTHORED_AT,
  });
  existingSlugs.add(slug);
  created++;
}

if (newIndexEntries.length > 0) {
  index.listings.push(...newIndexEntries);
  index.count = index.listings.length;
  index.generated_at = new Date().toISOString();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n");
}

// ─── Category rollup ───────────────────────────────────────────────────
const byCategoryCity = {};
for (const c of COMPANIES) {
  byCategoryCity[c.category] ??= {};
  byCategoryCity[c.category][c.town] = (byCategoryCity[c.category][c.town] ?? 0) + 1;
}

console.log(`\n══ Kitchen Companies seed complete ══`);
console.log(`Created: ${created} · Skipped duplicates: ${skippedDuplicate} · Total attempted: ${COMPANIES.length}`);
console.log(`Index now has ${index.count} listings across all trades.`);
console.log(`\nBy category:`);
for (const cat of Object.keys(CATEGORY_LABELS)) {
  const cities = byCategoryCity[cat] ?? {};
  const totalCat = Object.values(cities).reduce((a, b) => a + b, 0);
  const breakdown = Object.entries(cities).map(([t, n]) => `${t}=${n}`).join(" · ");
  console.log(`  ${cat.padEnd(25)} · ${String(totalCat).padStart(3)} · ${breakdown}`);
}
console.log(`\nStubs land in Phase 1 (name+category+town+country only). Phase 3 enrichment happens per-company from official websites — never batched.`);
