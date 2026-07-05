// Blueprint: Landscaper · Design + Build.
//
// Design-and-build landscaper positioned for garden renovation season.
// Portfolio-first, service grid from Appendix D.10, driveway SuDS
// language baked into FAQ. Seasonal Storm-mode banner triggers when
// Met Office issues warnings inside the coverage area.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "landscaper-design-build",
  name: "Landscaper · Design + Build",
  tagline: "From concept to lawn — the garden, done properly.",
  description:
    "Design-and-build landscaper blueprint. Hero mosaic of finished gardens, service grid seeded from the 12-service UK landscape catalogue, SuDS-compliant driveway language in the FAQ (for front-of-house paving > 5 m²), regular maintenance mini-funnel for recurring revenue.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: ["landscaper", "garden-designer"],
  outcomes: ["quote-requests", "project-showcase", "service-sales"],
  variant: "tradesman",

  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Gardens designed. Patios laid. Lawns that last.",
          subhead:
            "Design-and-build across the region. Small gardens to full landscape schemes. Ongoing maintenance for spaces we build.",
          primaryCtaLabel: "Book a design visit",
          secondaryCtaLabel: "See recent gardens"
        }
      },
      {
        key: "gallery.grid_1",
        slotHint: "body",
        config: { heading: "Recent gardens", minTiles: 9 }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Design + build catalogue",
          items: [
            { title: "Garden design plan" },
            { title: "Patio install (slabs / porcelain)" },
            { title: "Decking (timber / composite)" },
            { title: "Turfing + new lawn" },
            { title: "Artificial grass install" },
            { title: "Fencing supply + install" },
            { title: "Garden walls + raised beds" },
            { title: "Driveway install (SuDS-compliant)" },
            { title: "Planting scheme" },
            { title: "Water feature / pond" },
            { title: "Garden lighting" },
            { title: "Regular garden maintenance" }
          ]
        }
      },
      {
        key: "hero.before_after_slider_1",
        slotHint: "body",
        config: {
          heading: "Before → after",
          subhead: "Gardens transformed."
        }
      },
      {
        key: "testimonials.card_grid_1",
        slotHint: "body",
        config: { heading: "What clients said", minCards: 3 }
      },
      {
        key: "hero.postcode_local_1",
        slotHint: "body",
        config: { heading: "Where's the garden?" }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Common questions",
          preseed: [
            { q: "Do you offer design-only?", a: "Yes — design pack, planting scheme, drawings. You take it to any landscaper. We prefer design + build so accountability sits in one place." },
            { q: "Do I need planning for a new front driveway?", a: "If it's > 5 m² and non-permeable, you need SuDS-compliant surfacing (planning permission otherwise). We build to SuDS spec." },
            { q: "When can you start?", a: "Landscape season is Mar–Oct. Winter jobs (fencing, driveways) year-round." },
            { q: "Do you look after gardens you build?", a: "Yes — monthly or fortnightly maintenance packages for gardens we install." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: { heading: "Book a design visit", ctaLabel: "Send request" }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },

  score: {
    conversion: 84,
    seo: 87,
    trust: 88,
    mobile: 91,
    accessibility: 92,
    speed: 89,
    brandConsistency: 91
  },

  requiredCredentials: ["companies-house", "public-liability", "waste-carrier"],
  suggestedApps: [
    "quote_pipeline",
    "job_diary",
    "trade_connections",
    "meet_the_team",
    "faq_page",
    "online_payments",
    "services_grid"
  ],
  compliance: [
    "consumer-contracts-14day",
    "asa-superlative-guard",
    "gdpr-form-auditor"
  ],

  browserCard: {
    oneLiner: "Design-and-build landscaper site with maintenance recurring-revenue funnel.",
    benefits: [
      "Portfolio-first hero + full recent-gardens gallery",
      "Before/after slider for transformations",
      "SuDS-compliant driveway copy that keeps you inside planning rules",
      "Ongoing maintenance CTA for recurring revenue on installed gardens"
    ],
    priceLabel: "Free for landscapers",
    estimatedBuildMinutes: 11
  }
};

blueprintRegistry.register(manifest);
export default manifest;
