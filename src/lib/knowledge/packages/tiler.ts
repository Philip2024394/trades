// Knowledge Package: Tiler.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Wall + floor + wet-room tiling. BS 5385 is the workmanship standard;
// tanking regs matter on wet rooms; VOC-limited adhesives on interior
// work. Grounded in real BSI + DEFRA sources.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "tiler",
  name: "Tiler",
  emoji: "🧱",
  tagline: "Wall, floor, wet-room — BS 5385 tiled, correctly.",
  description:
    "Full-service tiler. Bathrooms, kitchens, wet rooms, splashbacks, feature walls, porcelain floors, natural stone. Tanking + underfloor-heating aware. Works standalone or alongside bathroom + kitchen fitters.",
  version: "1.0.0",
  trades: ["tiler", "wall-tiler", "floor-tiler"],

  usesDomains: ["estimating", "quoting", "compliance", "crm", "materials"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Tiling estimates are area × per-m² rate + adhesive + grout + trim. Waste factor 10-15% for cut-heavy layouts (herringbone, small format). Natural stone quoted separately for sealing.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            tile_format: "string",
            surface_area_m2: "number",
            tile_size: "string",
            substrate: "enum",
            adhesive_grade: "string",
            waste_factor_pct: "number"
          },
          reason:
            "Small-format + patterned layouts drive waste factor up; substrate (plaster, cement board, concrete) drives adhesive class."
        }
      ],
      capabilities: [
        {
          capabilityId: "material-calculator",
          slug: "tile-quantity-calculator",
          name: "Tile quantity calculator",
          description:
            "Area × waste factor ÷ pack coverage → packs needed. Waste factor 10% straight-lay, 15% diagonal / herringbone."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "BS 5385 is the UK workmanship standard for tiling. Wet rooms need tanking + BS 5385-4 compliant slope. Adhesives + grouts are subject to VOC regulations. No specific credential scheme unlike Gas Safe.",
      compliance: [
        {
          id: "bs-5385-tiling-standard",
          name: "BS 5385 — Wall + floor tiling workmanship standards",
          regulator: "BSI",
          source:
            "https://knowledge.bsigroup.com/products/wall-and-floor-tiling"
        },
        {
          id: "eu-voc-adhesives-2012",
          name: "The Volatile Organic Compounds in Paints, Varnishes and Vehicle Refinishing Products Regulations 2012 — adhesive coverage",
          regulator: "HSE / DEFRA",
          source:
            "https://www.legislation.gov.uk/uksi/2012/1715/contents/made"
        },
        {
          id: "building-regs-approved-doc-c",
          name: "Building Regulations Approved Document C — resistance to moisture (wet-room tanking)",
          regulator: "MHCLG",
          source:
            "https://www.gov.uk/government/publications/site-preparation-and-resistance-to-contaminates-and-moisture-approved-document-c"
        }
      ]
    },
    {
      domainId: "materials",
      notes:
        "Tilers buy tiles by pack (usually 1-1.5m² per pack); adhesive + grout by weight; trim by 2.5m length. Under-orders + one-tone-different reorders are the classic error.",
      entityExtensions: [
        {
          entityId: "material-item",
          additionalFields: {
            batch_reference: "string",
            slip_rating: "string",
            water_absorption_pct: "number"
          },
          reason:
            "Batch reference matters for reorders (colour vary between batches). Slip rating drives wet-area suitability (R10+ for wet-room floors)."
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Kitchen + bathroom fitters are the highest-repeat referral source. Homeowners direct are single-project + design-driven. Feature-wall gallery is the strongest lead magnet.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            room_type: "string",
            substrate_condition: "string",
            underfloor_heating: "boolean"
          },
          reason:
            "Substrate condition drives prep hours; UFH drives adhesive class + priming. Room type frames the pattern conversation."
        }
      ]
    }
  ],

  services: [
    { slug: "bathroom-wall-tile", name: "Bathroom wall tiling", frequency: "core", pricingModel: "quote-required", description: "Full bathroom walls, splashbacks, shower zones." },
    { slug: "bathroom-floor-tile", name: "Bathroom floor tiling", frequency: "core", pricingModel: "quote-required", description: "Ceramic or porcelain, UFH-compatible install." },
    { slug: "wet-room-fit", name: "Wet room tanking + tile", frequency: "specialism", pricingModel: "quote-required", description: "Full tank membrane, sloped screed, tile finish. BS 5385-4 compliant." },
    { slug: "kitchen-splashback", name: "Kitchen splashback", frequency: "core", pricingModel: "fixed-price", description: "Metro, subway, patterned splashbacks. Under 3m² typically." },
    { slug: "kitchen-floor-tile", name: "Kitchen floor tiling", frequency: "common", pricingModel: "quote-required", description: "Large-format porcelain, ceramic. Substrate prep + levelling included." },
    { slug: "porcelain-large-format", name: "Large-format porcelain (600+mm)", frequency: "specialism", pricingModel: "quote-required", description: "Two-person install for slabs > 60cm. Special adhesive + framing." },
    { slug: "natural-stone", name: "Natural stone (marble / travertine)", frequency: "specialism", pricingModel: "quote-required", description: "Sealed + polished install. Book-matching layout on request." },
    { slug: "underfloor-heating-tile", name: "UFH-compatible tile install", frequency: "common", pricingModel: "quote-required", description: "Flexible adhesive over electric mat / wet UFH." },
    { slug: "commercial-tile", name: "Commercial (retail, healthcare)", frequency: "common", pricingModel: "quote-required", description: "Slip-rated tile install for commercial floors." },
    { slug: "tile-repair", name: "Tile repair + regrout", frequency: "common", pricingModel: "fixed-price", description: "Cracked tile replace, regrout, re-silicone." }
  ],

  customerTypes: [
    { slug: "homeowner-design-led", name: "Homeowner (design-led)", description: "Pattern-conscious. Values design consultation + samples on-site." },
    { slug: "bathroom-fitter-referral", name: "Bathroom fitter referral", description: "Repeat trade referral. Values reliability + fast slot response." },
    { slug: "kitchen-fitter-referral", name: "Kitchen fitter referral", description: "Splashback + floor tie-ins around cabinets." },
    { slug: "commercial", name: "Commercial (retail / healthcare)", description: "Slip-rated + spec-driven. Values compliance certification." }
  ],

  workflow: [
    { slug: "enquiry-and-consult", name: "Enquiry + consultation", description: "Room type, dimensions, tile preference. Photo + measurement.", poweredByCapability: "lead-capture" },
    { slug: "quote-and-samples", name: "Quote + samples", description: "Priced quote with pack count + waste factor. On-site samples for pattern choice." },
    { slug: "prep-and-substrate", name: "Prep + substrate", description: "Screed level, prime, board where needed. Tanking on wet rooms." },
    { slug: "tile-install", name: "Tile install", description: "Set out, cut, adhesive, tile, grout. Full-room typically 2-4 days." },
    { slug: "finish-and-clean", name: "Finish + clean", description: "Silicone joints, seal (stone only), clean-down. Sub-24hr grout cure." }
  ],

  commonFaqs: [
    { question: "How much waste do I need to allow?", answer: "10% for straight-lay, 15% for diagonal or herringbone. We measure exactly and quote the packs needed." },
    { question: "Can you tile over existing tiles?", answer: "Sometimes — if the substrate is sound and doesn't crack. Usually cheaper to strip and start clean." },
    { question: "Do you tank the wet room?", answer: "Yes — full membrane system to BS 5385-4. Trays and dry-set slope for shower drainage." },
    { question: "Do you supply the tiles?", answer: "Both. We supply via our merchants at trade rates, or you supply — we quote labour + adhesive separately." },
    { question: "How soon can I use the shower?", answer: "Grout cures in 24h; silicone in 24h. Full-strength wet use after 72h." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "trade-connections", "material-calculators", "meet-the-team"],
  canonicalBlueprint: undefined,

  industryIntelligence: [
    "BS 5385 is the UK workmanship standard — always cite in disputes",
    "Waste factor 10% straight, 15% diagonal / herringbone / small format",
    "Batch reference matters for reorders — colour varies pack to pack",
    "Wet-room tanking must comply with Building Regs Approved Document C",
    "UFH needs flexible adhesive (C2 S1 minimum) — standard adhesive will crack"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;
