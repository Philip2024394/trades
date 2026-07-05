// Blueprint: Driveway Specialist · Block Paving, Resin, Tarmac.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "driveway-specialist",
  name: "Driveway Specialist",
  tagline: "Block paving. Resin-bound. Tarmac. SuDS-compliant.",
  description:
    "Portfolio-first driveway specialist site. Foregrounds SuDS-compliant materials for front driveways > 5 m² (planning-permission trigger). Before/after slider + material comparison. Trust-focused because driveways are 5-figure decisions.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["driveway-specialist", "paving-specialist"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "tradesman",
  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Driveways done properly. First time.",
          subhead: "Block paving, resin-bound, tarmac, gravel. SuDS-compliant. Full sub-base + drainage — no cheap shortcuts.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See recent driveways"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent driveways", minTiles: 9 } },
      { key: "hero.before_after_slider_1", slotHint: "body", config: { heading: "Before → after", subhead: "Tired concrete to new paving." } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Driveway services",
          items: [
            { title: "Block paving (Marshalls / Brett / Tobermore)" },
            { title: "Resin-bound driveways" },
            { title: "Tarmac driveways" },
            { title: "Gravel driveways (SuDS-compliant)" },
            { title: "Natural stone + porcelain paving" },
            { title: "Driveway extensions" },
            { title: "Full drainage upgrade" },
            { title: "Kerbs + edging" },
            { title: "Old-driveway removal + disposal" },
            { title: "Pressure washing + sealing" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How the install runs",
          items: [
            { title: "Survey + design", body: "Layout options, material samples, itemised quote." },
            { title: "Dig-out + sub-base", body: "150mm+ MOT type 1 sub-base — not the 50mm cheap fix." },
            { title: "Drainage + edging", body: "SuDS + linear drains as required. Kerbs set true." },
            { title: "Surface + finish", body: "Blocks / resin / tarmac laid + finished. Pointed + sealed." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the driveway?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Driveway FAQ",
          preseed: [
            { q: "Do I need planning permission?", a: "For front driveways > 5 m² using non-permeable materials — yes. SuDS-compliant surfaces (resin-bound, block with permeable joints, gravel) don't need planning." },
            { q: "How long does a driveway take?", a: "Typical 50 m² block-paved 4–6 days. Resin-bound faster (2–3 days). Tarmac 2 days plus base." },
            { q: "What warranty?", a: "10-year workmanship guarantee. Manufacturer's material warranty separately (5-25 years depending on system)." },
            { q: "Can you match neighbours' driveways?", a: "Yes — sample match at survey. Discontinued patterns we source from salvage or specify equivalents." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 88, trust: 90, mobile: 91, accessibility: 93, speed: 89, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "waste-carrier"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Driveway specialist site with SuDS-compliant materials + before/after slider.",
    benefits: [
      "Portfolio hero + full recent-driveways gallery",
      "SuDS + planning-permission FAQ preloaded",
      "Sub-base narrative — the honesty differentiator for 5-figure jobs",
      "Waste Carrier badge auto-lights on rip-out disposal"
    ],
    priceLabel: "Free for driveway specialists",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;
