// Blueprint: General Builder · Extensions & Refurbs.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "general-builder-extensions",
  name: "General Builder · Extensions & Refurbs",
  tagline: "Extensions, loft conversions, whole-house refurbs — managed properly.",
  description:
    "Manages the trades, keeps the client informed, hands over certificates at the end. Portfolio-led hero, service grid seeded from Appendix D.2, FAB Master Builder + TrustMark verified widgets. FAQ addresses Building Control notification, structural engineer sign-off, and the 'how do you avoid surprises' concern.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["builder", "house-builder", "renovation-specialist", "extension-builder"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Extensions. Loft conversions. Whole-house refurbs.",
          subhead: "FMB Master Builder. TrustMark registered. Fixed scope, fixed price, no drift.",
          primaryCtaLabel: "Book a site visit",
          secondaryCtaLabel: "See recent builds"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent builds", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Build catalogue",
          items: [
            { title: "Single / double-storey extension" },
            { title: "Loft conversion" },
            { title: "Garage conversion" },
            { title: "House refurbishment" },
            { title: "Kitchen + bathroom management" },
            { title: "Structural alteration (RSJ)" },
            { title: "Damp + timber treatment" },
            { title: "Chimney breast removal" },
            { title: "Basement conversion" },
            { title: "Porch + conservatory" },
            { title: "Garden office" },
            { title: "Insurance reinstatement" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How we run a project",
          items: [
            { title: "Site visit + brief", body: "We walk the property, take photos, listen." },
            { title: "Fixed-scope quote", body: "Itemised, priced, with structural engineer + architect where needed." },
            { title: "Managed trades", body: "One point of contact — we coordinate every trade + inspection." },
            { title: "Sign-off + warranty", body: "Building Control certificate + 12-month workmanship warranty." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "Recent client reviews", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the site?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Extension + refurb FAQ",
          preseed: [
            { q: "Do you handle planning + Building Control?", a: "Yes — we coordinate the architect and the Building Control application." },
            { q: "How long does an extension take?", a: "Single-storey side/rear typically 8–14 weeks on site. Timeline confirmed at quote." },
            { q: "How do you handle changes mid-project?", a: "Variations priced in writing before we build. No 'the price went up' surprises." },
            { q: "Are you insured?", a: "Public Liability £5m, Contract Works cover on all projects." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a site visit", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 86, seo: 88, trust: 94, mobile: 91, accessibility: 93, speed: 88, brandConsistency: 93 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "fmb", "trustmark"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "cdm-2015"],
  browserCard: {
    oneLiner: "Extensions + loft + refurb builder site with FMB / TrustMark verified badges.",
    benefits: [
      "Portfolio hero + full recent-builds gallery",
      "Managed-trades narrative for anxious homeowners",
      "CDM 2015 compliance block baked in",
      "Building Control + Structural Engineer coordination copy"
    ],
    priceLabel: "Free for builders",
    estimatedBuildMinutes: 14
  }
};
blueprintRegistry.register(manifest);
export default manifest;
