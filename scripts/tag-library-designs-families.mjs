// Tag the 4 library-visible confirmed image records with their families and
// components · Philip 2026-08-02 · 4-layer architecture Phase A.
//
// The `families` array drives Layer 3 retrieval (family Q&A).
// The `components` array drives Layer 2 retrieval (component brains).
// Order in each array is loose · matcher walks all of them.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

const TAGS = {
  // Nex005 · Contemporary Feature Spiral (central column · timber treads · steel outer skirt · horizontal-rod balustrade · LED tread lighting)
  "NEX-DESIGN-000005": {
    families:   ["spiral", "open-riser", "steel-balustrade", "feature-lighting"],
    components: ["stringer","tread","handrail","baluster","lighting-led"],
  },
  // Nex020 · Luxury Sculptural Double-Curved (helical · frameless glass · timber handrail · LED tread + landing lighting)
  "NEX-DESIGN-000020": {
    families:   ["helical", "open-riser", "glass-balustrade", "feature-lighting"],
    components: ["stringer","tread","handrail","balustrade-glass","fixings-glass","lighting-led","landing"],
  },
  // Nex025 · Contemporary Curved Mono-Stringer (curved mono · timber treads · steel balusters · timber handrail)
  "NEX-DESIGN-000025": {
    families:   ["mono-stringer-curved", "open-riser", "steel-balustrade"],
    components: ["stringer","tread","handrail","baluster"],
  },
  // Nex026 · Straight-Flight Floating Cantilever + Glass (straight · cantilever · frameless glass · integrated architectural LED)
  "NEX-DESIGN-000026": {
    families:   ["floating-cantilever", "straight-flight", "open-riser", "glass-balustrade", "feature-lighting"],
    components: ["stringer","tread","balustrade-glass","fixings-glass","lighting-led","landing"],
  },
};

let touched = 0;
for (const rec of d.confirmed) {
  const t = TAGS[rec.design_id];
  if (!t) continue;
  rec.families   = t.families;
  rec.components = t.components;
  touched++;
}
d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

console.log("Library designs tagged with families + components:", touched);
for (const [id, t] of Object.entries(TAGS)) {
  console.log("  " + id + " · families=[" + t.families.join(",") + "] · components=[" + t.components.join(",") + "]");
}
