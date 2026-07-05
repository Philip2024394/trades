// Knowledge Package: Painter & Decorator.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Interior + exterior painting, wallpaper, spray finishing, and the
// landlord-void recurring segment. Grounded in PRD Appendix D.8 +
// existing Painter blueprint.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "painter-decorator",
  name: "Painter & Decorator",
  emoji: "🎨",
  tagline: "Rooms, exteriors, sprays — done neatly and on time.",
  description:
    "Full-service painter + decorator. Interior + exterior, wallpaper, spray finishing (kitchens + doors), landlord voids. Recurring letting-agent segment is the highest-repeat revenue driver.",
  version: "1.0.0",
  trades: ["painter", "decorator"],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Painting estimates are surface area × coats × coverage rate + prep hours. Coverage rate is manufacturer-specified (typical emulsion 12–14 m²/litre @ 2 coats). Landlord voids priced per room typically.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            room_type: "string",
            wall_area_m2: "number",
            ceiling_area_m2: "number",
            paint_coats: "number",
            coverage_m2_per_litre: "number",
            prep_hours: "number"
          },
          reason:
            "Every paint estimate needs area × coats × coverage to compute paint volume + prep time separately (prep is the hidden margin killer)."
        }
      ],
      capabilities: [
        {
          capabilityId: "material-calculator",
          slug: "paint-volume-calculator",
          name: "Paint volume calculator",
          description:
            "Wall area × coats ÷ coverage rate → litres needed. Coverage rate is manufacturer-declared and varies by paint class."
        },
        {
          capabilityId: "labour-calculator",
          slug: "prep-hours-calculator",
          name: "Prep hours calculator",
          description:
            "Fill + sand + mask + protect. Typical prep is 30-50% of total paint time — often mis-quoted."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Interior paint is not regulator-heavy but pre-1978 lead paint on woodwork is a real HSE surface for restoration jobs. Exterior work over 2m triggers Work at Height. Solvent VOC limits apply to trade paint.",
      compliance: [
        {
          id: "eu-voc-paints-directive",
          name: "The Volatile Organic Compounds in Paints, Varnishes and Vehicle Refinishing Products Regulations 2012",
          regulator: "HSE / DEFRA",
          source:
            "https://www.legislation.gov.uk/uksi/2012/1715/contents/made"
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Letting agents are the highest-repeat customer segment. Every void = a paint job. Track void-turnaround time as a KPI — sub-48hr response wins accounts.",
      entityExtensions: [
        {
          entityId: "company",
          additionalFields: {
            managed_property_count: "number",
            typical_voids_per_month: "number",
            standard_paint_spec: "string"
          },
          reason:
            "Letting agents have consistent paint specs across their portfolio — saves quote time + enables bulk buying."
        }
      ]
    }
  ],

  services: [
    { slug: "interior-room-repaint", name: "Interior room repaint", frequency: "core", pricingModel: "fixed-price", description: "Walls + ceiling + woodwork. Prep included." },
    { slug: "full-house-repaint", name: "Full house repaint", frequency: "core", pricingModel: "quote-required", description: "Multi-room programme. Timeline confirmed at quote." },
    { slug: "exterior-masonry-paint", name: "Exterior masonry paint", frequency: "core", pricingModel: "quote-required", description: "Render/masonry weather coating. Scaffold factored in." },
    { slug: "woodwork-sash-paint", name: "Woodwork + sash paint", frequency: "core", pricingModel: "fixed-price", description: "Windows, doors, skirting. Careful cutting-in." },
    { slug: "wallpaper-hanging", name: "Wallpaper hanging", frequency: "core", pricingModel: "fixed-price", description: "Standard, feature walls, murals. Pattern matching." },
    { slug: "spray-finishing", name: "Spray finishing (kitchens + doors)", frequency: "specialism", pricingModel: "fixed-price", description: "HVLP airless refinish. Off-site booth turnaround 3–5 days." },
    { slug: "landlord-void", name: "Landlord / letting void repaint", frequency: "common", pricingModel: "quote-required", description: "Fast-turn rental repaint. Sub-48hr response for account customers." },
    { slug: "heritage-colour-matching", name: "Heritage colour matching", frequency: "specialism", pricingModel: "quote-required", description: "National Trust / Farrow & Ball specification jobs." },
    { slug: "damp-stain-block", name: "Damp / mould stain block", frequency: "common", pricingModel: "fixed-price", description: "Stain block + finish over problem area. Not damp treatment — remediation quoted separately." }
  ],

  customerTypes: [
    { slug: "homeowner", name: "Homeowner", description: "One-off room + full-house repaints. Multi-quote comparison." },
    { slug: "letting-agent", name: "Letting agent (void turnaround)", description: "Highest-repeat segment. Values sub-48hr response + consolidated invoicing." },
    { slug: "landlord-direct", name: "Landlord direct", description: "Between-tenant repaint. Values speed + reliability." },
    { slug: "commercial-office", name: "Commercial (out-of-hours)", description: "Office repaint outside working hours. Values low-disruption + fast turnaround." }
  ],

  workflow: [
    { slug: "enquiry", name: "Enquiry", description: "Photo + rough dimensions preferred. Homeowner or letting-agent portal.", poweredByCapability: "lead-capture" },
    { slug: "survey-and-quote", name: "Survey + quote", description: "Site walkover if larger job; photo-quote for landlord voids. Paint volume + prep time computed." },
    { slug: "schedule-and-work", name: "Schedule + work", description: "Weather-check for exterior. Protect + prep + paint. Multiple coats with cure time." },
    { slug: "sign-off-and-clean", name: "Sign-off + clean", description: "Snag walk + touch-ups + all masking removed. Zero-drop policy." }
  ],

  commonFaqs: [
    { question: "Do you supply the paint?", answer: "Both. Trade-priced paint from our merchant, or you supply — we quote labour + prep separately." },
    { question: "How long does a room take?", answer: "Standard bedroom 1–2 days including prep. Full house 5–10 days." },
    { question: "Do you handle landlord voids?", answer: "Yes — often on 48-hour turnarounds. Photo report at handover." },
    { question: "Can you spray kitchen doors?", answer: "Yes — HVLP airless in our booth. Turnaround typically 3–5 days off-site." },
    { question: "Do you have insurance?", answer: "£2m Public Liability minimum. Certificate on request." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "trade-connections", "meet-the-team", "material-calculators", "payments"],
  canonicalBlueprint: "painter-decorator",

  industryIntelligence: [
    "Prep time is 30–50% of paint time and the biggest under-quoted item",
    "Letting agents are the highest-repeat revenue segment — sub-48hr void turnaround wins accounts",
    "Coverage rate is manufacturer-declared — always check before quoting paint volume",
    "Solvent VOC limits apply to trade paint (2012 Regs)",
    "Spray-finishing kitchens + doors is a high-margin off-site specialism"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;
