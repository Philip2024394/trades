// Blueprint: Extension Specialist · Architect-to-Sign-off.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "extension-specialist-managed",
  name: "Extension Specialist · Managed Build",
  tagline: "Rear + side extensions. Architect. Planning. Build. Sign-off.",
  description:
    "Extension-only managed-build specialist blueprint. Distinct from a general builder — foregrounds the end-to-end managed service (architect, planning, structural engineer, party wall, build, sign-off). Positioned for homeowners who don't want to project-manage.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["extension-builder", "renovation-specialist", "builder"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "One team from architect to sign-off.",
          subhead:
            "Rear + side + wrap-around extensions. Design, planning, party wall, build, Building Control certificate. You have one number.",
          primaryCtaLabel: "Book a home visit",
          secondaryCtaLabel: "See recent extensions"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent extensions", minTiles: 9 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Every stage handled",
          items: [
            { title: "Architect + design", body: "In-house architect. Planning-optimised layouts, permitted development where possible." },
            { title: "Planning + Building Control", body: "We submit + track. You get updates, not council forms." },
            { title: "Structural engineer + party wall", body: "Coordinated + priced up-front. No 'we didn't budget for that' letters." },
            { title: "Build + snag", body: "Managed trades. Site foreman on every project. Walk-through + 12-month warranty." }
          ]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Extension types",
          items: [
            { title: "Rear extension (single-storey)" },
            { title: "Rear extension (double-storey)" },
            { title: "Side + wrap-around extension" },
            { title: "Loft conversion (dormer + mansard)" },
            { title: "Garage conversion" },
            { title: "Basement / cellar conversion" },
            { title: "Porch + conservatory" },
            { title: "Full home refurbishment" },
            { title: "Party-wall coordination" },
            { title: "Structural engineer sign-off" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the property?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Extension FAQ",
          preseed: [
            { q: "Do I need planning?", a: "Rear extensions under permitted development often don't. Corner + double-storey usually do. We check at survey — no obligation." },
            { q: "How long does an extension take?", a: "Single-storey side/rear 12–18 weeks total (planning + build). Double-storey 20–26 weeks." },
            { q: "Do you do party-wall notices?", a: "Yes — we serve notices + coordinate the surveyors on both sides. Fees clear in the quote." },
            { q: "Fixed-price?", a: "Yes — fixed scope, fixed price. Variations only ever priced in writing before we build them." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a home visit", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 89, trust: 94, mobile: 91, accessibility: 94, speed: 88, brandConsistency: 94 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "fmb", "trustmark"],
  suggestedApps: ["quote_pipeline", "downloads", "meet_the_team", "trade_connections", "faq_page", "job_diary", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "cdm-2015"],
  browserCard: {
    oneLiner: "Extension specialist site with architect-to-sign-off managed-build narrative.",
    benefits: [
      "End-to-end journey narrative (design → planning → build → sign-off)",
      "Party-wall + structural engineer coordination copy",
      "FMB + TrustMark badges for homeowner reassurance",
      "Fixed-price + written variations = no surprise letters"
    ],
    priceLabel: "Free for extension specialists",
    estimatedBuildMinutes: 14
  }
};
blueprintRegistry.register(manifest);
export default manifest;
