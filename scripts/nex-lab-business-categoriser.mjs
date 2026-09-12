#!/usr/bin/env node
// scripts/nex-lab-business-categoriser.mjs
//
// Founder 2026-09-10 · Deterministic categoriser for nex_lab_business.
//
// Sweeps harvest_raw rows whose payload has no category (or category=""),
// applies a rules-based mapper over name + tags, and stores the result in
// payload.derived_category + payload.derived_subcategory.
//
// NO LLM · NO GUESS · NO FABRICATION. If no rule matches, marks category as
// "unclassified" with a `needs_manual_classify: true` flag — never leaves the
// field silently blank.
//
// The taxonomy is INTENTIONALLY narrow — matches nex.service_business
// CHECK values and marketing-actionable segments only.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "business-categoriser.log");

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) { args.set(key, next); i++; }
    else args.set(key, "true");
  }
}
const LIMIT = Number(args.get("limit") ?? "500");
const DRY = args.get("dry") === "true";
const ROOM = args.get("room") ?? "business";

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

async function loadPg() {
  try { return (await import("pg")).Client; } catch { return null; }
}
function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

// ─── Taxonomy ──────────────────────────────────────────────────────
// Rules are ordered · first match wins. Each rule maps name/tag patterns
// (case-insensitive) → {category, subcategory}. All strings.
const RULES = [
  // ── Food & Beverage
  { pat: /\b(starbucks|coffee bean|kopi kenangan|janji jiwa|fore coffee|excelso|coffee|kopi|cafe|cafeteria|kafe)\b/i, category: "food-beverage", subcategory: "coffee-cafe" },
  { pat: /\b(mcdonald|kfc|burger king|domino|pizza hut|hoka hoka|hokben|solaria|richeese|geprek bensu|mie gacoan)\b/i, category: "food-beverage", subcategory: "fast-food-chain" },
  { pat: /\b(warung|rumah makan|padang|nasi goreng|soto|bakso|sate|gudeg|nasi ayam|ayam bakar)\b/i, category: "food-beverage", subcategory: "warung-local" },
  { pat: /\b(restaurant|resto|bistro|dining|steak|sushi|ramen|italian|chinese|thai|korean|japanese)\b/i, category: "food-beverage", subcategory: "restaurant" },
  { pat: /\b(bakery|patisserie|donut|dunkin|krispy kreme|breadtalk|tous les jours|roti)\b/i, category: "food-beverage", subcategory: "bakery" },
  { pat: /\b(ice cream|es krim|gelato|frozen yogurt|baskin|haagen)\b/i, category: "food-beverage", subcategory: "ice-cream-dessert" },
  { pat: /\b(bar|pub|lounge|nightclub|karaoke|kfc chicken)\b/i, category: "food-beverage", subcategory: "bar-nightlife" },

  // ── Retail
  { pat: /\b(indomaret|alfamart|alfa midi|circle k|7-?eleven|convenience)\b/i, category: "retail", subcategory: "convenience-store" },
  { pat: /\b(giant|hypermart|carrefour|transmart|superindo|hero|ranch market|farmers market|lotte mart|supermarket|grosir)\b/i, category: "retail", subcategory: "supermarket" },
  { pat: /\b(uniqlo|h&m|zara|gap|mango|pull&bear|bershka|stradivarius|forever 21|matahari|ramayana|centro|sogo|debenhams|marks)\b/i, category: "retail", subcategory: "apparel-fashion" },
  { pat: /\b(samsung|huawei|oppo|xiaomi|vivo|apple|iphone|erafone|erajaya|electronic city|electronics|elektronik)\b/i, category: "retail", subcategory: "electronics-mobile" },
  { pat: /\b(usupso|miniso|daiso|ace hardware|informa|ikea|homepro|home center|home improvement)\b/i, category: "retail", subcategory: "home-lifestyle" },
  { pat: /\b(gramedia|toko buku|book|periplus|kinokuniya|togamas)\b/i, category: "retail", subcategory: "bookstore" },
  { pat: /\b(guardian|watsons|century|kimia farma|apotek|pharmacy|farmasi)\b/i, category: "retail", subcategory: "pharmacy" },
  { pat: /\b(bata|nike|adidas|puma|reebok|new balance|converse|vans|skechers|shoes|sepatu)\b/i, category: "retail", subcategory: "footwear" },
  { pat: /\b(jewelry|jeweler|jewellery|toko emas|goldsmith|watch|jam tangan|rolex|swatch|casio)\b/i, category: "retail", subcategory: "jewellery-watches" },
  { pat: /\b(optik|optical|glasses|kacamata|eye)\b/i, category: "retail", subcategory: "optical" },
  { pat: /\b(furniture|mebel|sofa|kasur|springbed|mattress)\b/i, category: "retail", subcategory: "furniture" },
  { pat: /\b(salon|spa|barber|beauty|kecantikan|nail|hair)\b/i, category: "services", subcategory: "beauty-wellness" },

  // ── Services
  { pat: /\b(laundry|dry clean|cuci|kiloan)\b/i, category: "services", subcategory: "laundry" },
  { pat: /\b(gym|fitness|yoga|pilates|celebrity fitness|gold gym|anytime fitness)\b/i, category: "services", subcategory: "fitness" },
  { pat: /\b(travel|tour|umroh|haji|tiket|agen perjalanan)\b/i, category: "services", subcategory: "travel-agency" },
  { pat: /\b(bank|bca|bri|mandiri|bni|permata|cimb|panin|ocbc|maybank|hsbc|standard chartered|atm)\b/i, category: "services", subcategory: "bank-atm" },
  { pat: /\b(post office|kantor pos|jne|jnt|j&t|sicepat|ninja express|paxel|anteraja|tiki|wahana|kurir)\b/i, category: "services", subcategory: "courier-post" },
  { pat: /\b(bengkel|servis mobil|servis motor|auto repair|car wash|cucian mobil|tune-up)\b/i, category: "services", subcategory: "auto-service" },
  { pat: /\b(kursus|bimbel|bimbingan|ganesha operation|primagama|kumon|english first|wall street english|language)\b/i, category: "services", subcategory: "education-tutoring" },
  { pat: /\b(clinic|klinik|dokter|dentist|dokter gigi|puskesmas|kimia farma medika)\b/i, category: "health", subcategory: "clinic" },
  { pat: /\b(hospital|rumah sakit|rs |rsud|rspad|siloam|mitra keluarga|hermina|omni|awal bros)\b/i, category: "health", subcategory: "hospital" },

  // ── Accommodation / Hospitality (rare in business room but possible)
  { pat: /\b(hotel|resort|inn|suites|homestay|guesthouse|penginapan|wisma|losmen|hostel|villa|kos)\b/i, category: "accommodation", subcategory: "hotel" },

  // ── Automotive
  { pat: /\b(toyota|honda|suzuki|mitsubishi|daihatsu|nissan|mazda|isuzu|hyundai|kia|bmw|mercedes|audi|dealer|showroom)\b/i, category: "retail", subcategory: "auto-dealer" },
  { pat: /\b(pertamina|shell|petronas|bp|spbu|gas station|pom bensin)\b/i, category: "services", subcategory: "petrol-station" },

  // ── Malls & shopping centres (containers, not businesses per se)
  { pat: /\b(mall|plaza|square|city center|trade center|itc|pusat perbelanjaan|shopping center)\b/i, category: "retail", subcategory: "shopping-mall" },
];

function classify(payload) {
  const name = String(payload?.name ?? "");
  const tags = payload?.tags ?? {};
  const haystack = [
    name,
    tags.amenity, tags.shop, tags.tourism, tags.leisure,
    tags["cuisine"], tags["operator"],
  ].filter(Boolean).join(" ");
  for (const rule of RULES) {
    if (rule.pat.test(haystack)) {
      return { category: rule.category, subcategory: rule.subcategory, matched: rule.pat.source };
    }
  }
  return { category: "unclassified", subcategory: null, matched: null, needs_manual_classify: true };
}

async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("no pg module · aborting"); process.exit(2); }
  const url = readPgUrl();
  const schema = `nex_lab_${ROOM}`;
  log(`start · schema=${schema} · limit=${LIMIT} · dry=${DRY}`);
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();
  let total = 0, classified = 0, unclassified = 0;
  const catCounts = new Map();
  try {
    const rows = (await c.query(`
      SELECT record_id, payload
      FROM ${schema}.harvest_raw
      WHERE (payload->>'derived_category') IS NULL
      ORDER BY harvested_at DESC
      LIMIT $1
    `, [LIMIT])).rows;
    log(`  ${rows.length} rows to classify`);
    for (const row of rows) {
      total++;
      const c1 = classify(row.payload);
      const key = `${c1.category}/${c1.subcategory ?? "none"}`;
      catCounts.set(key, (catCounts.get(key) ?? 0) + 1);
      if (c1.category === "unclassified") unclassified++; else classified++;
      if (!DRY) {
        const newPayload = {
          ...row.payload,
          derived_category: c1.category,
          derived_subcategory: c1.subcategory,
          category_matched_rule: c1.matched,
          categorised_at: new Date().toISOString(),
        };
        if (c1.needs_manual_classify) newPayload.needs_manual_classify = true;
        await c.query(
          `UPDATE ${schema}.harvest_raw SET payload = $1::jsonb WHERE record_id = $2`,
          [JSON.stringify(newPayload), row.record_id]
        );
      }
    }
    log(`  distribution:`);
    for (const [k, v] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
      log(`    ${String(v).padStart(4)}  ${k}`);
    }
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
  log(`done · total=${total} classified=${classified} unclassified=${unclassified} coverage=${((classified/total)*100).toFixed(1)}% · ${Date.now() - t0}ms`);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 300)}`); process.exit(1); });
