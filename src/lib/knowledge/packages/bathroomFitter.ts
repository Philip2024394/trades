// Knowledge Package: Bathroom Fitter.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Full-scope bathroom refit — 1st fix + 2nd fix + tanking + tiling +
// electrical (via Part-P partner) + snag. Distinct from Plumber in
// that a bathroom fitter is a project-manager AS WELL as the trade.
// Grounded in Appendix D.12.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "bathroom-fitter",
  name: "Bathroom Fitter",
  emoji: "🛁",
  tagline: "Full refits — plumbed, tiled, sparked, signed off.",
  description:
    "Whole-bathroom refit specialist. Manages 1st + 2nd fix plumbing, tanking, tiling, electrical (via Part-P partner), and sign-off. Wetrooms + accessible bathrooms (VAT relief) are the high-value specialisms.",
  version: "1.0.0",
  trades: ["bathroom-fitter"],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Bathroom estimates are per-fixture labour + tile area + tanking area + electrical uplift + skip + waste. Tanking system warranty depends on manufacturer training — quote must reference the system.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            fixture_type: "string",
            tile_area_m2: "number",
            tanking_area_m2: "number",
            wetroom: "boolean",
            tanking_system: "string"
          },
          reason:
            "Wetroom flag + tanking system determine warranty terms + install time. Tile area × grade × waste factor drives materials cost."
        }
      ],
      capabilities: [
        {
          capabilityId: "material-calculator",
          slug: "tile-area-calculator",
          name: "Tile area calculator",
          description:
            "Wall + floor area × waste factor (10% typical, 15% for large-format). Grout gap × tile size gives grout quantity."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Electrical work in bathrooms is notifiable (Part P Zone rules). Tanking warranty is manufacturer-specific. VAT relief on qualifying disability-adapted work handled via HMRC declaration.",
      compliance: [
        {
          id: "bs-7671-zones",
          name: "BS 7671 — Special locations (Section 701 Bathrooms + shower rooms)",
          regulator: "IET / BSI",
          source: "https://electrical.theiet.org/bs-7671/"
        },
        {
          id: "vat-notice-701-7",
          name: "VAT Notice 701/7 — Zero-rating for disability-adapted work",
          regulator: "HMRC",
          source:
            "https://www.gov.uk/guidance/reliefs-from-vat-for-disabled-and-older-people-notice-7017"
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Bathroom-fitter Deals are longer-cycle than plumber Deals (survey → 3D design → quote → deposit → 8-14 day build). Accessible bathroom customers have VAT relief paperwork requirements.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            wetroom: "boolean",
            accessible: "boolean",
            vat_relief_form_signed: "boolean",
            design_pack_url: "string"
          },
          reason:
            "Accessible bathroom accounts need the VAT declaration on file before invoice; wetroom flag drives longer install window in the quote."
        }
      ]
    }
  ],

  services: [
    { slug: "full-refit", name: "Full bathroom refit", frequency: "core", pricingModel: "quote-required", description: "Strip-out → 1st fix → tank → tile → 2nd fix → sign-off. Typical 8–14 working days." },
    { slug: "shower-room", name: "Shower room install", frequency: "core", pricingModel: "quote-required", description: "Cubicle, tray, valve, tiling. Typical 5–8 days." },
    { slug: "wetroom-tanked", name: "Wetroom (tanked, level-access)", frequency: "specialism", pricingModel: "quote-required", description: "Full tanking + level-access former. 12–18 days. Manufacturer-warranted system." },
    { slug: "en-suite", name: "En-suite install", frequency: "core", pricingModel: "quote-required", description: "Small footprint. Common on new-build snag work." },
    { slug: "fixture-replacement", name: "Bath / basin / WC replacement", frequency: "common", pricingModel: "fixed-price", description: "Like-for-like fixture swap. 1–2 days." },
    { slug: "shower-valve", name: "Shower valve / mixer install", frequency: "common", pricingModel: "fixed-price", description: "Thermostatic mixer or electric shower. Part P for electric." },
    { slug: "wall-floor-tiling", name: "Bathroom wall + floor tiling", frequency: "core", pricingModel: "quote-required", description: "Ceramic, porcelain, natural stone. Waterproof-membrane bonded." },
    { slug: "underfloor-heating", name: "Underfloor heating (electric)", frequency: "common", pricingModel: "fixed-price", description: "Mat + thermostat under tile. Part P for supply." },
    { slug: "accessible-bathroom", name: "Accessible / level-access bathroom", frequency: "specialism", pricingModel: "quote-required", description: "Grab rails, walk-in bath, level shower. VAT-relief paperwork handled." },
    { slug: "luxury-spec", name: "Luxury / spec bathroom", frequency: "specialism", pricingModel: "quote-required", description: "Freestanding bath, brassware upgrade, feature tile." },
    { slug: "design-service", name: "Bathroom design service", frequency: "common", pricingModel: "fixed-price", description: "Layout + mood board + spec sheet." }
  ],

  customerTypes: [
    { slug: "homeowner-planned", name: "Homeowner (planned refit)", description: "Multi-quote shopper. Values 3D design + fixed price + clear timeline." },
    { slug: "showroom-referral", name: "Showroom referral", description: "Kitchen/bathroom showroom sends the customer to a vetted fitter. Values reliability + spec adherence." },
    { slug: "accessible-adaptation", name: "Accessible bathroom customer", description: "Disability-adapted work with VAT relief. Values OT collaboration + paperwork handling." },
    { slug: "landlord-buy-to-let", name: "Landlord (buy-to-let refit)", description: "Between-tenant refit. Values fast turnaround + hard-wearing spec." }
  ],

  workflow: [
    { slug: "enquiry", name: "Enquiry + rough spec", description: "Homeowner form or showroom referral. Photos + room dimensions.", poweredByCapability: "lead-capture" },
    { slug: "survey-and-design", name: "Site survey + 3D design", description: "Measure, layout options, spec sheet." },
    { slug: "quote-and-deposit", name: "Quote + deposit", description: "Fixed-price quote with staged payments. Deposit secures the install slot." },
    { slug: "install-8-14-days", name: "Install (8–14 days)", description: "Strip-out → 1st fix → plaster → tank → tile → 2nd fix." },
    { slug: "sign-off-and-warranty", name: "Sign-off + warranty registration", description: "Snag walk + certificates + manufacturer warranty registered." }
  ],

  commonFaqs: [
    { question: "How long does a full refit take?", answer: "Typical 8–14 working days. Wetrooms 12–18. Firm window at quote after survey." },
    { question: "What waterproof warranty?", answer: "Tanking system warranty is the manufacturer's (Schlüter, Mapei, etc.). Our workmanship guarantee is 24 months separately." },
    { question: "Accessible / disability bathrooms?", answer: "Yes — level-access, grab rails, walk-in baths. VAT relief on qualifying adaptations — we handle the HMRC declaration." },
    { question: "Do you supply the fixtures?", answer: "Both. Supply-and-fit gives us one accountable price. Fit-only from your showroom range is fine — priced separately." },
    { question: "How is Part P handled?", answer: "Notifiable electrical work in bathroom zones runs through our Part P partner. Certificate handed over on completion." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "meet-the-team", "trade-connections", "material-calculators", "payments"],
  canonicalBlueprint: "bathroom-fitter-full",

  industryIntelligence: [
    "Tanking system warranty is manufacturer-specific — always quote the system name",
    "Part P Zone rules apply in every bathroom electrical job",
    "VAT relief on accessible adaptations requires customer-signed HMRC declaration",
    "Wetrooms take 12–18 days vs 8–14 for standard bathrooms — quote timelines separately",
    "Showroom referrals are the highest-quality non-repeat customer segment"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;
