// Blueprint: Groundworker · Foundations, Drainage, Driveways.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "groundworker-full",
  name: "Groundworker · Foundations & Drainage",
  tagline: "Foundations, drainage, driveways, slabs — done right first time.",
  description:
    "B2B / self-build groundworker blueprint. Positioned as the trusted early-stage sub for extensions + new builds. Full 12-service catalogue from Appendix D.14. SuDS + Building Regs Part H language in FAQ. CDM 2015 compliance block baked in.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["groundworker", "excavator", "drainage-contractor", "foundation-specialist", "earthworks"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Foundations. Drainage. Driveways. The bit that has to be right.",
          subhead: "Groundworks for extensions, new builds, self-build. Registered waste carrier, insured, CPCS-carded plant operators.",
          primaryCtaLabel: "Book a site visit",
          secondaryCtaLabel: "See recent groundworks"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent sites", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Groundworks catalogue",
          items: [
            { title: "Foundations (strip / trench)" },
            { title: "Site clearance" },
            { title: "Excavation / dig-out" },
            { title: "Drainage install (foul + surface)" },
            { title: "Soakaway install" },
            { title: "Driveway groundworks" },
            { title: "Concrete slab / oversite" },
            { title: "Retaining wall (structural)" },
            { title: "Utility trenching" },
            { title: "Basement dig-out" },
            { title: "Blocked / collapsed drain repair" },
            { title: "Kerbs + edgings" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What contractors said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the site?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Groundworks FAQ",
          preseed: [
            { q: "Do you work with builders or homeowners?", a: "Both — most extensions come through a main contractor, but we take direct self-build enquiries too." },
            { q: "Do I need SuDS-compliant drainage?", a: "Front driveways > 5 m² non-permeable need planning OR SuDS-compliant surfacing. Rear + side drainage falls under Building Regs Part H — we design + install to spec." },
            { q: "Are your plant operators carded?", a: "Yes — CPCS or NPORS tickets for every operator. Cards checked at induction, on file for your records." },
            { q: "Do you provide the structural engineer?", a: "For retaining walls + foundations on unstable ground yes — engineer sign-off included in the quote." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a site plan + address", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 84, seo: 85, trust: 90, mobile: 91, accessibility: 92, speed: 90, brandConsistency: 91 },
  requiredCredentials: ["companies-house", "public-liability", "waste-carrier", "chas"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "cdm-2015"],
  browserCard: {
    oneLiner: "B2B groundworker site with SuDS + Building Regs Part H copy baked in.",
    benefits: [
      "12-service groundworks catalogue",
      "CDM 2015 compliance block",
      "CPCS / NPORS operator-card assurance copy",
      "Waste Carrier + CHAS badges auto-light when you add them"
    ],
    priceLabel: "Free for groundworkers",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;
