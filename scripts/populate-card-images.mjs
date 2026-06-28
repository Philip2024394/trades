// Populate topic-matched Pexels photos for every priced_service across
// all 106 demo trade profiles.
//
// **Quality rules**:
//   1. One Pexels call per unique query; cache up to 10 photos per query.
//   2. Within a single trade, every service gets a DIFFERENT photo —
//      pick the first photo from the query's pool that hasn't already
//      been used on a sibling service of the same trade.
//   3. If all 10 photos in a query's pool have been used on siblings,
//      we run a FALLBACK query with the trade context + a fresh modifier
//      ("workshop", "site", "tools") to source more.
//   4. Final-fallback: the trade's banner art, so every card always has
//      an image.
//
// **Resume-safe**: persists progress to `scripts/.pexels-results.json`
// after every entry. Restart picks up exactly where it left off.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { DEMO_TRADE_SEEDS } from "../src/lib/demoTradeSeeds.ts";
import { TRADE_OFF_HERO_IMAGES } from "../src/lib/tradeOffHeroes.ts";

const ENV_TEXT = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
const KEY = (ENV_TEXT.match(/^PEXELS_API_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!KEY) throw new Error("PEXELS_API_KEY missing");

const CACHE_PATH = "C:\\Users\\Victus\\trades\\scripts\\.pexels-results.json";
const QUERY_CACHE_PATH = "C:\\Users\\Victus\\trades\\scripts\\.pexels-query-cache.json";
const OUT_PATH = "C:\\Users\\Victus\\trades\\src\\lib\\demoServiceImages.ts";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TRADE_CONTEXT = {
  drywaller: "drywall",
  plasterer: "plastering",
  electrician: "electrician",
  scaffolder: "scaffolding",
  tiler: "tiling",
  plumber: "plumbing",
  carpenter: "carpentry",
  joiner: "joinery woodwork",
  painter: "house painting",
  roofer: "roofing",
  bricklayer: "bricklaying",
  stonemason: "stonework",
  groundworker: "groundwork",
  "general-builder": "construction site",
  "concrete-specialist": "concrete",
  renderer: "render",
  "taper-and-finisher": "drywall taping",
  landscaper: "landscaping",
  "gas-engineer": "boiler installation",
  "concrete-finisher": "concrete finishing",
  "crane-operator": "construction crane",
  formworker: "formwork",
  "block-layer": "block wall",
  "site-safety": "construction safety",
  "water-drilling": "borehole drilling",
  demolition: "demolition",
  "site-canteen": "construction catering",
  "fascia-and-soffit": "fascia roof",
  "insulation-installer": "wall insulation",
  "trim-carpenter": "trim carpentry",
  "metal-engineer": "metal fabrication",
  "building-merchant": "builders merchant",
  "builders-supplies": "construction supplies",
  "heavy-machinery": "construction machinery",
  "tool-hire": "construction tools",
  "kitchen-fitter": "kitchen installation",
  "stair-fitter": "staircase installation",
  "window-fitter": "window installation",
  "security-installer": "cctv security install",
  "damp-proofer": "damp proofing",
  "drainage-engineer": "drainage",
  "chimney-sweep": "chimney sweep",
  "tree-surgeon": "tree surgery",
  "pest-control": "pest control",
  "asbestos-removal": "asbestos",
  "lead-worker": "lead roofing",
  "sash-window-restorer": "sash window restoration",
  "post-construction-cleaner": "post construction clean",
  "garden-designer": "garden design",
  "mobile-mechanic": "vehicle mechanic",
  "pump-service": "water pump",
  "door-fitter": "door installation",
  "flooring-installer": "flooring",
  "bathroom-fitter": "bathroom renovation",
  "conservatory-installer": "conservatory",
  "solar-installer": "solar panel",
  "ev-charger-installer": "ev charger",
  "heat-pump-installer": "heat pump",
  "smart-home-installer": "smart home",
  "garage-door-installer": "garage door",
  "gutter-installer": "guttering",
  "driveway-installer": "block paving driveway",
  "fencing-installer": "fence",
  "shutter-installer": "plantation shutters",
  "aerial-satellite-installer": "tv aerial",
  "garden-room-installer": "garden room",
  "awning-installer": "patio awning",
  "kitchen-manufacturer": "bespoke kitchen",
  "staircase-manufacturer": "oak staircase",
  "door-manufacturer": "solid wood door",
  "window-manufacturer": "timber window",
  "flooring-manufacturer": "engineered wood floor",
  "conservatory-manufacturer": "orangery",
  "wardrobe-maker": "fitted wardrobe",
  "furniture-maker": "bespoke furniture",
  "joinery-workshop": "joinery workshop",
  "worktop-manufacturer": "hardwood worktop",
  "glass-manufacturer": "glass balustrade",
  "shed-manufacturer": "garden shed",
  "garden-room-manufacturer": "insulated garden room",
  "steel-fabricator": "steel fabrication",
  "timber-merchant": "timber yard",
  "plumbing-merchant": "plumbing supplies",
  "electrical-wholesaler": "electrical supplies",
  "tile-shop": "wall tiles",
  "flooring-shop": "flooring showroom",
  "door-showroom": "door showroom",
  "kitchen-showroom": "kitchen showroom",
  "window-showroom": "window showroom",
  "bathroom-showroom": "bathroom showroom",
  "paint-merchant": "paint cans",
  ironmongery: "door hardware",
  "ppe-supplier": "ppe safety gear",
  "tool-shop": "power tools",
  "landscape-supplies": "paving stones",
  "aggregate-supplier": "gravel sand",
  "roofing-supplies": "roof tiles",
  "insulation-supplies": "insulation board",
  "plant-hire": "excavator",
  "skip-hire": "skip",
  "portaloo-hire": "portable toilet",
  "scaffolding-hire": "scaffolding tower",
  "generator-hire": "generator",
  "van-hire": "van",
  "crane-hire": "mobile crane",
  "waste-removal": "skip removal",
  "minidigger-hire": "mini excavator",
  "storage-container-hire": "shipping container"
};

// Fallback modifiers — used when a query's photos are all already used
// on sibling services of the same trade. Cycles through these to broaden
// the search.
const FALLBACK_MODIFIERS = ["workshop", "site", "tools", "interior", "exterior", "build"];

function stripGenerics(name) {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !["per", "from", "fixed", "sqm", "linear", "package", "starter", "kit", "and", "the", "of", "for", "with", "to", "a", "an", "is", "in", "on", "at"].includes(w))
    .slice(0, 4)
    .join(" ");
}

function buildQuery(serviceName, tradeSlug, modifier) {
  const ctx = TRADE_CONTEXT[tradeSlug] ?? "construction";
  const core = stripGenerics(serviceName);
  const q = modifier ? `${ctx} ${core} ${modifier}` : `${ctx} ${core}`;
  return q.replace(/\s+/g, " ").trim();
}

function keyFor(tradeSlug, serviceName) {
  return `${tradeSlug}::${serviceName}`;
}

// --- Persisted state --------------------------------------------

const results = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : {};
const queryCache = existsSync(QUERY_CACHE_PATH) ? JSON.parse(readFileSync(QUERY_CACHE_PATH, "utf-8")) : {};

console.log(`Resuming. Cached results: ${Object.keys(results).length}. Cached queries: ${Object.keys(queryCache).length}.`);

function persist() {
  writeFileSync(CACHE_PATH, JSON.stringify(results, null, 2));
  writeFileSync(QUERY_CACHE_PATH, JSON.stringify(queryCache, null, 2));
}

function writeFinalTs() {
  const banner = `// AUTO-GENERATED by scripts/populate-card-images.mjs.
// Maps "<trade_slug>::<service_name>" → Pexels stock photo URL.
// Do not hand-edit — re-run the populator.

export const DEMO_SERVICE_IMAGES: Record<string, string> = ${JSON.stringify(results, null, 2)};

export function imageForService(tradeSlug: string, serviceName: string): string | null {
  return DEMO_SERVICE_IMAGES[\`\${tradeSlug}::\${serviceName}\`] ?? null;
}
`;
  writeFileSync(OUT_PATH, banner);
}

// --- Pexels client ---------------------------------------------

async function pexelsFetchPhotos(query) {
  if (queryCache[query]) return queryCache[query];
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=square`,
      { headers: { Authorization: KEY } }
    );
    if (r.status === 429) {
      const wait = 2000 * (attempt + 1) ** 2;
      console.log(`  ! 429 backoff ${wait}ms (${query})`);
      await sleep(wait);
      continue;
    }
    if (!r.ok) {
      console.log(`  ! ${query}: ${r.status}`);
      queryCache[query] = [];
      return [];
    }
    const json = await r.json();
    const urls = (json.photos ?? []).map((p) => p.src?.medium).filter(Boolean);
    queryCache[query] = urls;
    return urls;
  }
  queryCache[query] = [];
  return [];
}

// --- Main loop -------------------------------------------------

let processedThisRun = 0;
let napsTaken = 0;

for (const seed of DEMO_TRADE_SEEDS) {
  // Track which photo URLs we've already assigned within THIS trade
  // so siblings never duplicate.
  const usedInTrade = new Set(
    (seed.priced_services ?? [])
      .map((s) => results[keyFor(seed.trade_slug, s.name)])
      .filter(Boolean)
  );

  for (const svc of seed.priced_services ?? []) {
    const key = keyFor(seed.trade_slug, svc.name);
    if (results[key]) continue;

    // Try the primary query first; if all its photos are taken by
    // siblings, run a fallback query with each modifier in order.
    let chosen = null;
    const tried = [null, ...FALLBACK_MODIFIERS];
    for (const modifier of tried) {
      const query = buildQuery(svc.name, seed.trade_slug, modifier);
      const photos = await pexelsFetchPhotos(query);
      // Small inter-call pacing so we never burst.
      if (!queryCache[query] || queryCache[query] === photos) await sleep(200);

      // Pick the first photo NOT yet used in this trade.
      for (const url of photos) {
        if (!usedInTrade.has(url)) {
          chosen = url;
          break;
        }
      }

      if (chosen) break;

      // If no photos at all (rate limit exhausted, all 3 attempts), nap.
      if (photos.length === 0) {
        napsTaken++;
        console.log(`\n=== Quota exhausted after ${processedThisRun} this run — napping 35m (#${napsTaken}) ===`);
        persist();
        writeFinalTs();
        await sleep(35 * 60 * 1000);
        // After nap, retry the same query.
        delete queryCache[query];
        const retry = await pexelsFetchPhotos(query);
        for (const url of retry) {
          if (!usedInTrade.has(url)) {
            chosen = url;
            break;
          }
        }
        if (chosen) break;
      }
    }

    if (!chosen) chosen = TRADE_OFF_HERO_IMAGES[seed.trade_slug] ?? null;

    if (chosen) {
      results[key] = chosen;
      usedInTrade.add(chosen);
    }
    processedThisRun++;

    if (processedThisRun % 10 === 0) {
      persist();
      const total = Object.keys(results).length;
      console.log(`  +${processedThisRun} this run · ${total} cached total`);
    }
  }
}

persist();
writeFinalTs();
console.log(`\nDone. Cached: ${Object.keys(results).length}. This run: ${processedThisRun}. Naps: ${napsTaken}.`);
