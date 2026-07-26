// Extend design recommendation engine with 4 hybrid styles that Philip
// specified: modern_farmhouse, industrial_luxury, scandinavian,
// contemporary_classic. These were flagged as "not in V1" in the design
// engine spec - this fills that gap.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "data", "staircase-design-recommendation-rules.json");

const rules = JSON.parse(readFileSync(FILE, "utf8"));

// Add hybrid styles to house_style input dimension
rules.input_dimensions.house_style.push(
  { id: "modern_farmhouse", label: "Modern Farmhouse", signals: ["shaker cabinetry", "white walls with warm timber accents", "black metal light fittings", "engineered oak floor"] },
  { id: "industrial_luxury", label: "Industrial Luxury", signals: ["exposed brick or concrete plus premium timber", "black steel structural elements", "large-format tile floors", "designer lighting"] },
  { id: "scandinavian", label: "Scandinavian", signals: ["pale timber floors", "white or off-white walls", "minimal ornament", "wool textiles", "clean lines with warmth"] },
  { id: "contemporary_classic", label: "Contemporary Classic", signals: ["traditional architecture with modern finishes", "restored period features", "muted neutral palette", "quality hardware"] },
);

// Add the hybrid style recommendations
rules.recommendations_by_style.modern_farmhouse = {
  reasoning: "Bridges the farmhouse warmth of natural timber with modern minimal lines. White oak grounds the space, painted risers keep it fresh, black metal or glass provides the modern edge. Avoids the busy detail of traditional farmhouse and the coldness of pure modern minimal.",
  default_spec: {
    stair_type: "closed_string",
    treads: "American White Oak 40mm solid",
    risers: "painted MDF - warm off-white or crisp white",
    strings: "painted string in matched tone",
    handrail: "square-profile oak matched to treads",
    balustrade: "square black metal balusters at 99mm centres, OR 12mm toughened glass with black bosses",
    finish: "matt hardwax oil (Osmo Polyx) on timber",
    lighting: "warm 2700K under-handrail LED plus black metal wall lights",
    under_stair: "hallway bench with black metal hooks above and painted panelled cupboards below"
  },
  budget_variants: {
    entry: { swap: { treads: "engineered oak with genuine oak wear layer", balustrade: "square black metal balusters" }, reasoning_change: "Engineered treads + metal balusters at accessible price." },
    mid: { keep: "default_spec" },
    premium: { add: { treads: "wider oak treads with shadow gap detail to risers", balustrade: "frameless glass with matte black hardware" }, reasoning_change: "Cleaner detail + statement balustrade." },
    luxury: { add: { treads: "American White Oak 45mm with book-matched grain", under_stair: "boot room / cloakroom with bench + hooks + mirror" }, reasoning_change: "Full farmhouse-lifestyle features at contemporary quality." }
  },
  space_variants: {
    small_hallway: { override: { balustrade: "frameless glass to open sightlines" } },
    large_entrance: { add: { treads: "wider proportions suit the space" } }
  },
  compatible_stair_types: ["straight", "quarter_turn", "half_turn"],
  avoid: ["turned spindles (too traditional-farmhouse)", "curved staircase (too formal)", "brass hardware (breaks the black-metal palette)", "carpet runner (too traditional)"]
};

rules.recommendations_by_style.industrial_luxury = {
  reasoning: "Combines the raw material honesty of industrial with premium timber and finishing. Steel structural elements paired with walnut or smoked oak, matte black hardware, frameless glass. The industrial roots stay visible but every surface is refined.",
  default_spec: {
    stair_type: "floating with hidden steel stringer",
    treads: "American Black Walnut or smoked/fumed oak, 40mm",
    risers: "open riser (no riser at all)",
    strings: "matte black powder-coated steel, exposed",
    handrail: "matte black steel square section, OR brushed stainless",
    balustrade: "12mm smoked laminated glass with matte black bosses, OR square black steel balusters",
    finish: "matt hardwax oil on timber, matte powder coat on steel",
    lighting: "under-tread LED strip + industrial-style pendant over stairwell + optional black metal wall sconces",
    under_stair: "open architectural volume with feature wall (exposed brick, or dark stained timber)"
  },
  budget_variants: {
    entry: { note: "Industrial luxury is spec-driven and hard to achieve at entry budget. Recommend stepping up to premium or shifting to plain industrial." },
    mid: { swap: { treads: "American White Oak instead of walnut", balustrade: "square black metal balusters" }, reasoning_change: "Retain industrial-luxury language with less premium timber." },
    premium: { keep: "default_spec" },
    luxury: { add: { stair_type: "curved floating on steel spine", treads: "book-matched walnut with shadow gap", lighting: "three-layer full scheme with feature pendant" }, reasoning_change: "Curved cantilevered fabrication is the luxury statement." }
  },
  space_variants: {
    large_entrance: { override: { stair_type: "cantilevered curved becomes the room feature" } },
    small_hallway: { note: "Style mismatch — industrial luxury needs volume and exposed materials to breathe." }
  },
  compatible_stair_types: ["floating", "cantilevered", "spine_stringer", "curved"],
  avoid: ["closed string in painted MDF", "turned spindles", "carpet runner", "brass fittings (unless deliberately styled as a single accent)", "pale flooring"]
};

rules.recommendations_by_style.scandinavian = {
  reasoning: "Warm minimalism. Pale oak, white walls, functional joinery with beautiful proportions. No visual clutter — every line intentional. Softer than pure modern minimal, warmer than luxury contemporary.",
  default_spec: {
    stair_type: "closed_string or open_riser (both work)",
    treads: "pale European or American White Oak 40mm, whitewash or ultra-pale oil finish",
    risers: "painted MDF in off-white / linen tone",
    strings: "painted string in matched tone",
    handrail: "slim oval or round oak - understated",
    balustrade: "slim vertical square oak balusters, OR minimal frameless glass with hidden fixings",
    finish: "hardwax oil with white pigment (Osmo White) or Rubio Monocoat white",
    lighting: "single warm pendant or simple under-handrail LED - never busy",
    under_stair: "open architectural, OR hidden-door storage with flush finish"
  },
  budget_variants: {
    entry: { swap: { treads: "pine treads with white pigmented finish (looks scandi at pine price)" }, reasoning_change: "Pine + whitewash reads scandinavian if grain is calm." },
    mid: { keep: "default_spec" },
    premium: { add: { treads: "wider oak treads with shadow gap", under_stair: "purpose-designed shelving unit in matched pale timber" }, reasoning_change: "Detail-tier of the same restrained palette." },
    luxury: { add: { balustrade: "single-panel frameless low-iron glass full-flight", lighting: "integrated feature designer pendant" }, reasoning_change: "Statement pieces used sparingly — one strong feature not many." }
  },
  space_variants: {
    small_hallway: { override: { balustrade: "frameless glass essential for light and openness" } },
    dark_hallway: { add: { lighting: "additional wall lights + under-handrail LED" } }
  },
  compatible_stair_types: ["straight", "open_riser", "half_turn"],
  avoid: ["turned spindles", "dark timber", "curved staircase", "black metal (too heavy for the palette)", "brass fittings", "carpet runner"]
};

rules.recommendations_by_style.contemporary_classic = {
  reasoning: "Traditional architecture treated with modern finishes. Restores or references period features (turned newels, panelled string) but with contemporary materials (glass balustrade, clean paint, integrated lighting). The 'right way' to update a period property without erasing its character.",
  default_spec: {
    stair_type: "closed_string with cut string detail on open side",
    treads: "European Oak solid 40mm - warm honey tone",
    risers: "painted timber - warm off-white or heritage colour",
    strings: "painted string with beading detail",
    handrail: "profiled oak or restored original handrail if present",
    balustrade: "turned oak spindles at 99mm centres for character, OR 12mm glass for modern update on newel-and-cap frame",
    finish: "matt hardwax oil on treads and handrail, satin paint on painted elements",
    lighting: "wall lights in period-appropriate style (bronze or brass acceptable here), plus under-handrail LED subtle",
    under_stair: "panelled cupboard door matched to hallway panelling, OR wine display behind glass"
  },
  budget_variants: {
    entry: { swap: { treads: "existing treads sanded and refinished" }, reasoning_change: "Refurbishment is often more appropriate than replacement in period property." },
    mid: { keep: "default_spec" },
    premium: { add: { handrail: "restored or heritage-copy hardwood", balustrade: "custom-turned spindles to original profile" }, reasoning_change: "Craft detail matches period." },
    luxury: { add: { treads: "reclaimed period oak matched to original", under_stair: "wine cellar with period-appropriate glass door and integrated lighting" }, reasoning_change: "Restoration to museum standard with contemporary lifestyle feature." }
  },
  space_variants: {
    small_hallway: { override: { balustrade: "slimmer turned spindle profile at same centres" } },
    large_entrance: { add: { handrail: "custom-profiled with volute at bottom newel", note: "large entrance rewards the traditional detail" } }
  },
  compatible_stair_types: ["straight", "quarter_turn", "half_turn"],
  avoid: ["floating stair (destroys period character)", "matt black metalwork (too industrial)", "cool grey paint (fights the warm tones)", "shadow-gap detail (too modern)"]
};

writeFileSync(FILE, JSON.stringify(rules, null, 2));
console.log("Added 4 hybrid styles:");
console.log(" - modern_farmhouse");
console.log(" - industrial_luxury");
console.log(" - scandinavian");
console.log(" - contemporary_classic");
console.log("Total styles now:", Object.keys(rules.recommendations_by_style).length);
