// Stairplan topic-frequency report — COPYRIGHT-CLEAN.
//
// Extracts topic keywords from URL path segments only.
// Does NOT quote page titles, headings, FAQs, or body text.
// Groups tokens into industry-standard topic categories using MY OWN
// taxonomy (materials, staircase types, parts, regulations, etc.).
//
// Output: a topic × frequency table showing what staircase areas
// have the strongest coverage on merchant sites — used to prioritise
// which Trade Brain topics Philip should Author first from
// independent authoritative sources (Approved Docs, BS, HSE).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const envText = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
function e(name) { return envText.match(new RegExp(`^${name}=(.+)$`, "m"))[1].trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(e("NEXT_PUBLIC_SUPABASE_URL"), e("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const brainId = "9354a294-c058-4a33-b2cd-1a8e54988d26";

// ─── My topic taxonomy (independent — not derived from Stairplan) ────
const TOPICS = {
  "Materials — timber": ["oak", "pine", "walnut", "sapele", "mahogany", "beech", "maple", "cherry", "iroko", "ash", "hemlock", "spruce", "redwood", "whitewood", "hardwood", "softwood", "mdf", "engineered", "veneer"],
  "Materials — other":  ["glass", "steel", "aluminium", "concrete", "brass", "chrome", "stainless"],
  "Staircase types":    ["straight", "spacesaver", "space-saver", "spiral", "helical", "helical-stair", "curved", "l-shape", "u-shape", "quarter-turn", "half-turn", "kite", "winder", "bespoke", "loft", "attic", "openplan", "floating", "cantilever", "standard"],
  "Parts":              ["string", "riser", "tread", "nosing", "spindle", "baluster", "balustrade", "handrail", "newel", "post", "cap", "base", "rail", "fillet", "volute", "curtail", "bullnose", "wreath", "goose", "ramp", "cladding"],
  "Regulations":        ["regulation", "regs", "building-reg", "buildingregs", "approved-doc", "approveddoc", "doc-k", "part-k", "part-m", "fire", "safety", "compliance", "bs5395", "hse"],
  "Design":             ["design", "rise", "going", "headroom", "pitch", "landing", "dimensions", "layout", "planning", "measure", "measurements", "standard-size"],
  "Installation":       ["installation", "install", "fit", "fitting", "fitters", "installer", "assembly", "instructions"],
  "Finishing":          ["stain", "paint", "varnish", "lacquer", "sealer", "oil", "wax", "primer", "prefinished", "polish", "finish"],
  "Renovation":         ["renovate", "renovation", "refurb", "repair", "restore", "cladding-old", "makeover", "upgrade"],
  "Commercial":         ["commercial", "office", "shop", "retail", "public", "workplace"],
  "Bespoke process":    ["quote", "enquiry", "custom", "made-to-measure", "order-process", "how-to-order"],
  "Delivery / lead":    ["delivery", "shipping", "lead-time", "turnaround"],
  "Warranty / support": ["warranty", "guarantee", "aftercare", "returns", "support", "help"],
  "About":              ["about", "our-story", "team", "history", "showroom"]
};

// ─── Load pages and count topic-token hits per URL path ────────────
const { data: pages } = await sb.from("brain_pages")
  .select("url").eq("brain_id", brainId);

const topicCounts = {};
for (const topic of Object.keys(TOPICS)) topicCounts[topic] = { count: 0, samplePaths: new Set() };

for (const p of pages) {
  const path = new URL(p.url).pathname.toLowerCase()
    .replace(/\.(htm|html|php|asp|aspx)$/, "")
    .replace(/[_/]/g, "-");   // normalise separators to dashes
  const tokens = path.split(/[-]/).filter(Boolean);

  for (const [topic, keywords] of Object.entries(TOPICS)) {
    const hit = keywords.some(k => tokens.includes(k));
    if (hit) {
      topicCounts[topic].count++;
      if (topicCounts[topic].samplePaths.size < 3) {
        topicCounts[topic].samplePaths.add(new URL(p.url).pathname);
      }
    }
  }
}

// ─── Print report ─────────────────────────────────────────────────
console.log("═".repeat(72));
console.log("STAIRPLAN TOPIC-FREQUENCY REPORT (URL-metadata only, no page text)");
console.log("═".repeat(72));
console.log(`Source: 1 Business Brain (Stairplan) · ${pages.length} pages crawled`);
console.log(`Method: URL path token → my independent topic taxonomy\n`);

const sorted = Object.entries(topicCounts).sort((a, b) => b[1].count - a[1].count);
for (const [topic, data] of sorted) {
  const bar = "█".repeat(Math.min(30, Math.round(data.count / 2)));
  console.log(`${topic.padEnd(24)} ${String(data.count).padStart(4)}  ${bar}`);
  for (const sample of data.samplePaths) {
    console.log(`  · ${sample}`);
  }
}

console.log("\n" + "═".repeat(72));
console.log("HOW TO USE THIS REPORT (Author workflow)");
console.log("═".repeat(72));
console.log(`
1. Pick topics with strong coverage → those are what real merchants
   care about, so Nex should know them well.

2. For each topic, source facts from INDEPENDENT public authorities:
   · Regulations       → Approved Doc K, Doc M, Doc B (gov.uk)
   · Standards         → BS 5395 series (staircases)
   · Safety            → HSE guidance
   · Materials         → Janka scale (publicly published)
   · Techniques        → BWF (British Woodworking Federation)
                       + trade textbooks

3. Author in Author Studio → Teach Nex → paste independent source
   text → accept/reject each candidate.

4. Never paraphrase Stairplan (or any business's) written text.
   Facts only, from independent sources, in Nex's own voice.
`);
