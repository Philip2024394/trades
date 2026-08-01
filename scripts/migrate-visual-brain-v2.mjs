// Visual Brain v2 migration (Philip 2026-08-01)
//
// One-time migration:
//   1. Assign every existing record a permanent design_id (NEX-DESIGN-000001 upward)
//   2. Populate title, design_family, primary_brain=staircase
//   3. Populate view_types parallel array from view_labels where possible
//
// Also adds 3 new staircase designs from Philip's 2026-08-01 vision analyses:
//   - Cable balustrade minimalist (URL 01_27_08)
//   - Frameless glass + brushed steel risers (URL 01_19_59)
//   - Walnut + black perforated + illuminated newel + under-stair panel · 4-view set
//     with lighting-off/lighting-on comparison metadata (URLs 01_18_11 · 12_54_37 · 12_54_11 · 12_46_19)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");

const raw = readFileSync(LIBRARY_PATH, "utf8");
const lib = JSON.parse(raw);

const ONE_INDEX_PAD = (n) => String(n).padStart(6, "0");
const DESIGN_ID = (n) => `NEX-DESIGN-${ONE_INDEX_PAD(n)}`;

// ─── Family classifier (heuristic on design_style) ─────────────────
function inferDesignFamily(designStyle, staircaseType) {
  const s = (designStyle + " " + staircaseType).toLowerCase();
  if (s.includes("traditional") || s.includes("heritage") || s.includes("british")) return "Traditional";
  if (s.includes("industrial")) return "Industrial";
  if (s.includes("biophilic") || s.includes("botanical") || s.includes("adaptive")) return "Biophilic";
  if (s.includes("floating") || s.includes("cantilever")) return "Floating";
  if (s.includes("commercial")) return "Commercial";
  if (s.includes("minimalist") || s.includes("contemporary") || s.includes("modern classic")) return "Contemporary";
  if (s.includes("modern")) return "Modern";
  return "Contemporary";
}

// ─── View type inference from label ────────────────────────────────
function labelToViewType(label, index) {
  const l = (label || "").toLowerCase();
  if (index === 0) return "hero";
  if (l.includes("hero")) return "hero";
  if (l.includes("elevation") || l.includes("side")) return "side";
  if (l.includes("three-quarter")) return "front";
  if (l.includes("detail") && !l.includes("alt")) return "detail";
  if (l.includes("detail alt")) return "detail";
  if (l.includes("entry")) return "entry-sequence";
  if (l.includes("close")) return "detail";
  if (l.includes("alt")) return "alt";
  return "alt";
}

// ─── Title synthesizer from design metadata ────────────────────────
function synthesizeTitle(rec) {
  const stype = (rec.staircase_type || "").split(/[·|,]/)[0].trim();
  const stypeShort = stype
    .replace(/staircase|central-column|construction/gi, "")
    .replace(/\s+/g, " ").trim();
  const family = inferDesignFamily(rec.design_style, rec.staircase_type);
  const primaryMaterial = Array.isArray(rec.materials) && rec.materials[0]
    ? String(rec.materials[0]).split(/[·,]/)[0].replace(/timber|hardwood/gi, "").trim()
    : "";
  const balustrade = (rec.balustrade_style || "").split(/[·,]/)[0].trim();
  const balustradeShort = balustrade.length > 30 ? balustrade.slice(0, 30).trim() : balustrade;
  const parts = [family];
  if (primaryMaterial) parts.push(primaryMaterial);
  if (balustradeShort && !balustradeShort.toLowerCase().includes(primaryMaterial.toLowerCase())) {
    parts.push(balustradeShort);
  }
  parts.push(stypeShort || "staircase");
  return parts.filter(Boolean).join(" · ");
}

// ─── Migrate existing records ──────────────────────────────────────
let nextId = 1;
for (const rec of lib.confirmed) {
  if (!rec.design_id) rec.design_id = DESIGN_ID(nextId++);
  else nextId++;

  if (!rec.primary_brain) rec.primary_brain = "staircase";
  if (!rec.design_family) rec.design_family = inferDesignFamily(rec.design_style, rec.staircase_type);
  if (!rec.title) rec.title = synthesizeTitle(rec);

  // Build view_types parallel array (hero + additional)
  if (!rec.view_types) {
    const total = 1 + (Array.isArray(rec.additional_views) ? rec.additional_views.length : 0);
    const labels = Array.isArray(rec.view_labels) ? rec.view_labels : [];
    rec.view_types = Array.from({ length: total }, (_, i) =>
      labelToViewType(labels[i], i),
    );
  }
}

// ─── New records (Philip 2026-08-01 vision analyses) ───────────────
const now = new Date().toISOString();

const newRecords = [
  {
    design_id:            DESIGN_ID(nextId++),
    title:                "Contemporary · Cable Balustrade Open-Riser · Timber Side String",
    design_family:        "Contemporary",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_27_08%20AM.png",
    view_types:           ["hero"],
    staircase_type:       "straight flight · open-riser · minimalist contemporary",
    layout:               "single solid closed outer string · full-width open-riser treads · no visible newel posts · floating tread appearance",
    materials:            [
      "dark walnut or stained oak treads",
      "thick engineered timber side string",
      "stainless steel cable balustrade",
      "stainless steel cable fittings",
      "warm LED lighting",
      "polished concrete or stone floor",
    ],
    balustrade_style:     "vertical stainless steel tension cables · ceiling-to-tread fixings · slim brushed fittings · almost transparent",
    handrail_style:       "integrated timber top rail on cable balustrade · separate wall-mounted timber handrail with slim rectangular profile · concealed brackets",
    newel_style:          "no visible newel posts · structural side string is the dominant architectural feature",
    design_style:         "contemporary minimalist · architectural · open-plan luxury",
    project_suitability:  ["modern_home", "luxury_home", "open_plan_home", "double_height_hall", "architectural_feature"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A minimalist contemporary open-riser staircase built around a substantial timber side string. Vertical stainless-steel tension cables form the balustrade, warm LED strips wash the underside of every tread, and small recessed wall lights follow the pitch. Dark walnut/stained oak treads on a white-walled feature staircase with a separate slim timber wall handrail.",
    designer_notes:       "Defining features: (1) large structural timber string as sole visual anchor · (2) ceiling-mounted stainless cable balustrade for maximum transparency · (3) continuous under-tread LED · (4) independent slim wall handrail. No newel posts by design. Sits within double-height open-plan interior with dining beneath.",
    confirmed_by:         "Philip O'Farrell",
    confirmed_at:         now,
  },
  {
    design_id:            DESIGN_ID(nextId++),
    title:                "Contemporary · Frameless Glass · Brushed Steel Illuminated Risers",
    design_family:        "Contemporary",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_19_59%20AM.png",
    view_types:           ["hero"],
    staircase_type:       "straight flight · closed-string · closed-riser · minimalist contemporary",
    layout:               "single exposed structural timber string · full-width brushed steel risers · continuous flight to landing",
    materials:            [
      "walnut or stained oak treads",
      "walnut structural side string",
      "satin brushed stainless-steel riser panels",
      "toughened clear frameless glass balustrade",
      "brushed stainless-steel point-fix standoffs",
      "walnut timber cap handrail",
      "concealed warm LED lighting",
      "large-format polished stone flooring",
    ],
    balustrade_style:     "frameless toughened clear glass panels · exposed brushed stainless-steel standoff point-fixings · no vertical metal posts",
    handrail_style:       "square-profile walnut timber cap · mounted directly above glass · continuous from flight to landing",
    newel_style:          "no traditional newel · large timber string is the primary structural element",
    design_style:         "contemporary minimalist · architectural luxury · high-end residential",
    project_suitability:  ["modern_home", "luxury_home", "open_plan_home", "high_end_residential", "architectural_feature"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A high-end contemporary straight-flight staircase pairing a substantial walnut side string with satin brushed stainless-steel risers and a frameless toughened glass balustrade. Concealed warm LEDs wash each metallic riser and every tread nosing, giving the flight a floating illusion while the glass keeps the space visually open. Timber cap handrail runs continuously above the glass.",
    designer_notes:       "Defining features: (1) monolithic timber string · (2) brushed steel risers reflecting warm LED · (3) frameless glass with exposed point-fix standoffs as deliberate design feature · (4) walnut cap handrail. Sits within double-height open-plan interior with dining beneath.",
    confirmed_by:         "Philip O'Farrell",
    confirmed_at:         now,
  },
  {
    design_id:            DESIGN_ID(nextId++),
    title:                "Luxury · Walnut · Black Perforated Steel · Illuminated Newel · Lighting Comparison Set",
    design_family:        "Contemporary",
    primary_brain:        "staircase",
    url:                  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_46_19%20AM.png",
    additional_views:     [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_18_11%20AM.png",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_54_37%20AM.png",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_54_11%20AM.png",
    ],
    view_labels:          ["hero · lighting-on · full", "detail · lighting-on", "lighting-off", "lighting-on"],
    view_types:           ["hero", "detail", "lighting-off", "lighting-on"],
    staircase_type:       "straight flight · closed-string · feature entrance",
    layout:               "closed-string · closed-riser · full-height square starting newel · decorative under-stair panel",
    materials:            [
      "walnut timber treads",
      "walnut structural strings",
      "matte black painted risers",
      "matte black perforated steel infill panels (circular perforation)",
      "walnut solid timber handrail",
      "warm LED lighting",
      "concealed under-stair LED",
      "polished timber flooring",
    ],
    balustrade_style:     "matte black perforated steel panels · decorative circular perforation pattern · heavy steel frame · precision black fixing brackets",
    handrail_style:       "solid walnut · continuous · square-edged · flush integration with balustrade",
    newel_style:          "large square walnut starting newel · vertical recessed LED light channel · black plinth base · black cap",
    design_style:         "contemporary luxury · modern classic · statement entrance · industrial-influenced luxury",
    project_suitability:  ["luxury_home", "modern_home", "high_end_residential", "architectural_feature", "statement_entrance"],
    related_articles:     [
      "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
      "nex-knowledge-base-staircase-materials-overview.md",
    ],
    customer_description: "A luxury contemporary straight-flight staircase in walnut and matte black. The illuminated square walnut starting newel houses a vertical LED strip; the balustrade is bespoke matte black perforated steel with a circular perforation pattern; a decorative framed under-stair panel with concealed LED gives a floating base effect. Shown as a lighting-off vs lighting-on comparison so customers can judge the visual impact of integrated staircase lighting.",
    designer_notes:       "Image Set · 4 views merged: (1) hero-with-lights-on-full context · (2) close detail with lighting on · (3) lighting-off daytime · (4) lighting-on evening. IMPORTANT · lighting-off + lighting-on pair should be shown together whenever a customer asks 'does staircase lighting make a real difference'. Defining features: walnut closed-string · illuminated feature newel · matte black perforated balustrade · framed geometric under-stair panel with concealed LED · black risers for step definition · warm LED palette throughout.",
    confirmed_by:         "Philip O'Farrell",
    confirmed_at:         now,
  },
];

// Fix stray typo in one property key of new record 3 (defensive · will throw if uncorrected)
for (const rec of newRecords) {
  // Some IDEs allow `newel_style":` — validate keys are clean strings
  for (const key of Object.keys(rec)) {
    if (key.includes('"') || key.includes("'")) {
      throw new Error(`Invalid property key in new record: ${JSON.stringify(key)}`);
    }
  }
}

// Idempotency: don't re-add if design_id or URL already exists
for (const rec of newRecords) {
  const dupById  = lib.confirmed.find((r) => r.design_id === rec.design_id);
  const dupByUrl = lib.confirmed.find((r) => r.url === rec.url);
  if (dupById || dupByUrl) {
    console.log(`skip existing · ${rec.design_id} · ${rec.title}`);
    continue;
  }
  lib.confirmed.push(rec);
  console.log(`added · ${rec.design_id} · ${rec.title}`);
}

lib.version = 2;
lib.updated_at = now;

writeFileSync(LIBRARY_PATH, JSON.stringify(lib, null, 2), "utf8");
console.log(`\nVisual Brain v2 · ${lib.confirmed.length} designs · ${lib.confirmed.reduce((sum, r) => sum + 1 + (r.additional_views?.length ?? 0), 0)} image URLs`);
