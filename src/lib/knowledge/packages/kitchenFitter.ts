// Knowledge Package: Kitchen Fitter.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// End-to-end kitchen refit — cabinet fit + worktop template + install
// + appliance connect + tiling + Part-P + Gas Safe partnership. The
// bespoke / show-room-supplied / self-supply split drives customer
// mix. Grounded in Appendix D.11.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "kitchen-fitter",
  name: "Kitchen Fitter",
  emoji: "🍳",
  tagline: "Cabinet fit, worktops, appliances, sign-off.",
  description:
    "End-to-end kitchen refit specialist. Handles supply-and-fit from a range, fit-only from customer supply, and bespoke handmade kitchens. Coordinates worktop template, electrician (Part P), Gas Safe (hobs), tiler, plasterer.",
  version: "1.0.0",
  trades: ["kitchen-fitter"],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Kitchen estimates are per-unit labour + worktop area + splashback + appliance connect + Part-P/gas partner uplift + skip. Bespoke jobs quoted by design pack rather than unit count.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            unit_count: "number",
            worktop_material: "string",
            worktop_area_m2: "number",
            bespoke: "boolean",
            appliance_connects: "number"
          },
          reason:
            "Unit count drives base labour; worktop material dictates template + lead time (stone 5-10 days); appliance connects flag Part-P + Gas Safe partner uplifts."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "New electrical circuits for appliances are Part P notifiable. Gas hob connection requires Gas Safe registration — kitchen fitters partner rather than dual-badge typically.",
      compliance: [
        {
          id: "part-p-kitchen-circuit",
          name: "Building Regs Part P — new circuits notifiable",
          regulator: "MHCLG",
          source:
            "https://www.gov.uk/government/publications/electrical-safety-approved-document-p"
        },
        {
          id: "gas-safe-hob-connect",
          name: "Gas Safety Regs 1998 — gas hob connection requires Gas Safe engineer",
          regulator: "HSE",
          source:
            "https://www.legislation.gov.uk/uksi/1998/2451/regulation/3/made"
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Kitchen refits are longer-cycle than bathrooms (2–3 weeks tools + 1 week worktop template). Showroom-referred customers are highest-value; self-supply from IKEA/Wren is common but lower-margin.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            supply_source: "enum",
            worktop_material: "string",
            appliance_pack: "string",
            template_slot_at: "date"
          },
          reason:
            "Supply source (bespoke / range / self-supply) drives quote model + margin band. Worktop template slot is the critical path item."
        }
      ]
    }
  ],

  services: [
    { slug: "full-install", name: "Full kitchen install", frequency: "core", pricingModel: "quote-required", description: "Rip-out + fit new units + worktop + appliances + tiling. 2–3 weeks tools + 1 week worktop." },
    { slug: "supply-and-fit-range", name: "Kitchen supply + fit (from range)", frequency: "core", pricingModel: "quote-required", description: "Howdens / Wren / Magnet range supply + fit. One accountable price." },
    { slug: "fit-only", name: "Fit-only from customer supply", frequency: "common", pricingModel: "quote-required", description: "IKEA / self-supply fit. Labour + coordination only." },
    { slug: "stone-worktop-template", name: "Stone worktop template + install", frequency: "core", pricingModel: "fixed-price", description: "Quartz, granite, marble. 5–10 day lead-time from template." },
    { slug: "laminate-solid-worktop", name: "Laminate / solid-wood worktop", frequency: "core", pricingModel: "fixed-price", description: "Cut + joint + seal on-site." },
    { slug: "splashback-fit", name: "Splashback fit (glass / stone)", frequency: "common", pricingModel: "fixed-price", description: "Cut + bond splashback to protected zone." },
    { slug: "appliance-install", name: "Appliance install (non-gas)", frequency: "core", pricingModel: "fixed-price", description: "Oven, hob (electric), extractor, dishwasher, fridge. Part P for new circuit." },
    { slug: "sink-tap-install", name: "Sink + tap install", frequency: "core", pricingModel: "fixed-price", description: "Cut worktop + plumb sink + tap." },
    { slug: "cabinet-respray", name: "Cabinet respray / refurb", frequency: "specialism", pricingModel: "quote-required", description: "Refinish existing carcasses / doors. Off-site spray booth." },
    { slug: "island-build", name: "Kitchen island build", frequency: "common", pricingModel: "quote-required", description: "Bespoke island install. Often includes power + water." },
    { slug: "bespoke-handmade", name: "Bespoke handmade kitchen", frequency: "specialism", pricingModel: "quote-required", description: "In-frame, hand-painted, made-to-measure. 12+ week lead-time." },
    { slug: "utility-room", name: "Utility room fit", frequency: "common", pricingModel: "quote-required", description: "Second-kitchen / laundry room. Same trade stack." }
  ],

  customerTypes: [
    { slug: "homeowner-showroom", name: "Homeowner via showroom", description: "Referred by kitchen showroom. Values fitter reliability + spec adherence." },
    { slug: "homeowner-self-supply", name: "Homeowner (self-supply)", description: "Buys from IKEA/Wren, wants fitter only. Lower margin but higher volume." },
    { slug: "homeowner-bespoke", name: "Homeowner (bespoke)", description: "High-end bespoke handmade kitchen. Longest cycle, highest ticket." },
    { slug: "developer-new-build", name: "Developer (new-build snag)", description: "Multi-plot developer contract. Values speed + consistent spec." }
  ],

  workflow: [
    { slug: "enquiry-and-scope", name: "Enquiry + scope", description: "Photos + rough plan + supply source (bespoke / range / self-supply).", poweredByCapability: "lead-capture" },
    { slug: "home-visit-and-measure", name: "Home visit + measure", description: "Free within radius. Full measurement, layout options, quote." },
    { slug: "order-and-lead-time", name: "Order + lead-time", description: "6–10 weeks typical for range kitchens; 12+ for bespoke. Stone worktop templated after cabinets in." },
    { slug: "install-and-manage-trades", name: "Install + trade coordination", description: "Kitchen fitter drives; electrician (Part P) + Gas Safe engineer + tiler + plasterer scheduled." },
    { slug: "worktop-template-and-fit", name: "Worktop template + fit", description: "Templated once cabinets are set; stone fits 5–10 days later." },
    { slug: "sign-off-and-certificates", name: "Sign-off + certificates", description: "Walk-through, snag list, all certificates (Part P, gas) handed over." }
  ],

  commonFaqs: [
    { question: "How long does a full refit take?", answer: "Typical 2–3 weeks tools + 1 week worktop template lead-time. Bespoke: 4–6 weeks tools + longer design cycle." },
    { question: "Do you handle the electrician + plumber?", answer: "Yes — Part P + gas work run through our vetted partners and we hand you the certificates." },
    { question: "Do you supply the kitchen or do we?", answer: "Both work. Supply-and-fit is one accountable price. Fit-only from your range or self-supply is fine — quoted separately." },
    { question: "Can you do a knock-through?", answer: "Yes — Building Control notification + RSJ engineered. Timing folded into the schedule." },
    { question: "Can you match a discontinued door?", answer: "Bespoke doors + colour matching yes; supply-and-fit from a range only in that range's current colours." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "meet-the-team", "trade-connections", "downloads", "payments"],
  canonicalBlueprint: "kitchen-fitter-showroom",

  industryIntelligence: [
    "Worktop template slot is the critical-path item after cabinets in",
    "Stone worktop lead-time is 5–10 days from template — schedule accordingly",
    "New appliance circuits are Part P notifiable — always partner with a registered electrician",
    "Gas hob connection requires Gas Safe engineer — dual-badging is rare",
    "Bespoke handmade kitchens are 12+ week lead-time and highest ticket"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;
