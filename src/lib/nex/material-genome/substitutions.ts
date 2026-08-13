// Material Genome · substitutions seed (Philip 2026-08-04).
//
// Fourth relationship type · every substitution is a decision-aid, not a
// clone. Each carries a reason (why this alt) and a trade_off (what the user
// loses by substituting). Used by explainRecommendation() to phrase
// budget/sustainability/appearance-alternative suggestions in a way the user
// can trust.
//
// Doctrine: docs/brains/nex-material-genome-tenth-library-philip-2026-08-04.md

import type { Substitution } from "./types";

export const SEED_SUBSTITUTIONS: Record<string, readonly Substitution[]> = {
  european_walnut_matt_lacquer: [
    { kind: "premium",     material_id: "mahogany_polished",                    reason: "Mahogany matches walnut's premium warmth with a heritage-grand register.",              trade_off: "Higher lead time · lower sustainability score." },
    { kind: "economical",  material_id: "oak_american_white_satin_lacquer",     reason: "American White Oak accepts a dark stain that mimics walnut at ~55% of the cost.",       trade_off: "Grain figure less dramatic · book-matching less striking." },
    { kind: "sustainable", material_id: "ash_white",                            reason: "Thermally-modified ash reads warm walnut-brown while scoring higher on sustainability.", trade_off: "Slightly less UV-stable · lighter overall visual density." },
    { kind: "appearance",  material_id: "oak_american_white_satin_lacquer",     reason: "Walnut-stained oak preserves much of the visual character while reducing cost." },
  ],
  oak_american_white_satin_lacquer: [
    { kind: "premium",     material_id: "european_walnut_matt_lacquer",         reason: "European walnut lifts oak's honest character into luxury with book-matched grain.",       trade_off: "~2× cost · softer on flooring." },
    { kind: "economical",  material_id: "scandinavian_pine",                    reason: "Scandinavian pine is a paint-grade budget alternative for cabinet + panelling work.",     trade_off: "Softer · dents easily · needs UV-blocking finish." },
    { kind: "sustainable", material_id: "ash_white",                            reason: "White ash grows faster than oak and delivers similar strength for treads and floors.",    trade_off: "Grain less deep · fewer heritage associations." },
    { kind: "durability",  material_id: "ash_white",                            reason: "Ash's shock-resistance beats oak for high-traffic treads and handrails." },
  ],
  mahogany_polished: [
    { kind: "sustainable", material_id: "european_walnut_matt_lacquer",         reason: "Walnut delivers a comparable dark heritage tone with a much better sustainability score." },
    { kind: "economical",  material_id: "oak_american_white_satin_lacquer",     reason: "Dark-stained oak captures the warm reddish register at a fraction of mahogany's cost." },
  ],
  scandinavian_pine: [
    { kind: "premium",     material_id: "oak_american_white_satin_lacquer",     reason: "Oak upgrades a pine build to hardwood durability while keeping the light Scandinavian palette." },
    { kind: "durability",  material_id: "ash_white",                            reason: "Ash resists denting where pine would mark · same visual weight." },
  ],
  ash_white: [
    { kind: "premium",     material_id: "european_walnut_matt_lacquer",         reason: "Swap ash for walnut when the project needs a richer, darker luxury register." },
    { kind: "economical",  material_id: "oak_american_white_satin_lacquer",     reason: "Oak carries similar strength and a warmer visual tone at a lower spec." },
  ],
  brass_polished: [
    { kind: "economical",  material_id: "aluminium_anodised",                   reason: "Anodised aluminium (champagne/gold) approximates polished brass on hardware at ~30% cost.", trade_off: "No warm patina develops · reads cooler." },
    { kind: "durability",  material_id: "stainless_steel_brushed",              reason: "Stainless is more durable in wet zones · but coordinate the whole scheme (do not mix with brass elsewhere)." },
  ],
  stainless_steel_brushed: [
    { kind: "economical",  material_id: "aluminium_anodised",                   reason: "Anodised aluminium is lighter and cheaper for non-structural surface treatments.",           trade_off: "Lower durability · not suitable for worktops." },
    { kind: "sustainable", material_id: "concrete_polished",                    reason: "Cast concrete worktops carry a similar industrial register with a lower embodied-carbon footprint." },
  ],
  steel_black_powder_coated: [
    { kind: "durability",  material_id: "stainless_steel_brushed",              reason: "Stainless removes the risk of powder-coat chipping in high-touch areas." },
  ],
  aluminium_anodised: [
    { kind: "premium",     material_id: "stainless_steel_brushed",              reason: "Brushed stainless upgrades cabinet + door hardware to a durable premium tier." },
    { kind: "appearance",  material_id: "brass_polished",                       reason: "Polished brass swap for a warmer, more decorative kitchen register." },
  ],
  quartz_worktop_white: [
    { kind: "premium",     material_id: "granite_black",                        reason: "Black granite delivers a heavier, more sculptural worktop presence in luxury schemes.",       trade_off: "Cool colour palette shift · requires darker cabinet coordination." },
    { kind: "economical",  material_id: "oak_american_white_satin_lacquer",     reason: "Solid oak butcher-block worktop is warmer and cheaper · needs 6-monthly re-oiling.",         trade_off: "Water-resistance depends on maintenance discipline." },
    { kind: "sustainable", material_id: "concrete_polished",                    reason: "Cast concrete has lower embodied carbon than engineered quartz." },
  ],
  granite_black: [
    { kind: "economical",  material_id: "quartz_worktop_white",                 reason: "Engineered quartz gives a similarly bulletproof worktop at lower cost with more colour options." },
    { kind: "sustainable", material_id: "porcelain_grey_large_format",          reason: "Large-format porcelain can mimic dense stone with less quarrying impact." },
  ],
  porcelain_grey_large_format: [
    { kind: "economical",  material_id: "concrete_polished",                    reason: "Poured concrete is cheaper per square metre when the space suits an industrial finish." },
  ],
  glass_toughened_10mm: [
    { kind: "appearance",  material_id: "steel_black_powder_coated",            reason: "Steel balustrade panels + posts read industrial where glass reads minimal-luxury." },
  ],
  paint_matt_emulsion_white_shaker: [
    { kind: "premium",     material_id: "oak_american_white_satin_lacquer",     reason: "Solid oak in-frame doors upgrade painted shaker to timber shaker with unmistakable material honesty." },
    { kind: "durability",  material_id: "oak_american_white_satin_lacquer",     reason: "Painted MDF chips at edges · solid oak resists knocks for decades." },
  ],
  concrete_polished: [
    { kind: "durability",  material_id: "porcelain_grey_large_format",          reason: "Large-format porcelain skips the crack-risk of a poured slab while keeping the concrete look." },
  ],
};
