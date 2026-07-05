// Blueprint: Roofer · Full Re-Roof & Repair.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "roofer-planned",
  name: "Roofer · Re-Roof & Repair",
  tagline: "Slates, tiles, flat roofs, chimneys — done to last.",
  description:
    "Non-emergency roofer for planned re-roofs, tile repairs, flat roofs, and chimney work. Portfolio-first — roofers sell on jobs completed. Full 12-service catalogue from Appendix D.6. Includes lead-work and moss-treatment specialisms.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["roofer", "flat-roofing", "commercial-roofing"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "tradesman",
  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Roofs that keep the rain out. Full re-roofs to slipped-tile repairs.",
          subhead: "Pitched + flat, tiled + slated. Scaffolded properly, quoted properly, tidied up properly.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See recent roofs"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent roofs", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Roofing services",
          items: [
            { title: "Full pitched roof replacement" },
            { title: "Slipped / broken tile repair" },
            { title: "Roof leak trace + repair" },
            { title: "Flat roof (EPDM / GRP / felt)" },
            { title: "Chimney repair + rebuild" },
            { title: "Chimney removal" },
            { title: "Lead flashing" },
            { title: "Fascia + soffit + bargeboard" },
            { title: "Gutter clean, repair, replace" },
            { title: "Roof insulation top-up" },
            { title: "Moss removal + roof clean" },
            { title: "Velux / rooflight install" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How a re-roof runs",
          items: [
            { title: "Survey + quote", body: "Scaffold + skip factored in. No surprises." },
            { title: "Strip + felt", body: "Old material removed, new membrane fitted, weathertight fast." },
            { title: "Tile / slate + point", body: "New batten + tiles + ridge pointed properly." },
            { title: "Sign-off", body: "Photo report + workmanship guarantee." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the roof?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Roofing FAQ",
          preseed: [
            { q: "How long does a full re-roof take?", a: "Typical 3-bed 5–8 days depending on weather + complexity." },
            { q: "Do you scaffold?", a: "Yes — every re-roof scaffolded to Work at Height Regs 2005. Included in the quote." },
            { q: "What warranty do you give?", a: "Workmanship guarantee 12 months. Materials carry their manufacturer's warranty." },
            { q: "Do you handle emergency callouts?", a: "For storm damage yes — separate 24/7 line. Planned work quoted at survey." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 85, seo: 86, trust: 88, mobile: 91, accessibility: 93, speed: 90, brandConsistency: 91 },
  requiredCredentials: ["companies-house", "public-liability", "waste-carrier"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Planned re-roof + repair blueprint separate from the storm-emergency variant.",
    benefits: [
      "Portfolio hero + recent-roofs gallery",
      "12-service grid from the UK roofer library",
      "Work-at-Height Regs 2005 scaffold copy baked in",
      "Waste Carrier badge auto-lights when you add your number"
    ],
    priceLabel: "Free for roofers",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;
