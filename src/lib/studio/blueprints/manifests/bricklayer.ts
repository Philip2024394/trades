// Blueprint: Bricklayer · Walls, Extensions, Repointing.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "bricklayer-craft",
  name: "Bricklayer · Walls & Extensions",
  tagline: "Extensions, garden walls, repointing, chimney rebuilds.",
  description:
    "Portfolio-first bricklayer site. Full 12-service catalogue from Appendix D.13 — extension brickwork, new builds, garden walls, repointing, lime-mortar heritage, chimney rebuild + removal, crack stitching, brick matching.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["bricklayer"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "tradesman",
  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Brickwork that sits plumb. Pointing that stays put.",
          subhead: "Extensions, garden walls, chimneys, heritage lime work. Small courses to full elevations.",
          primaryCtaLabel: "Get a quote",
          secondaryCtaLabel: "See recent brickwork"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent brickwork", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Brickwork services",
          items: [
            { title: "Extension brickwork" },
            { title: "New-build elevations" },
            { title: "Garden + boundary walls" },
            { title: "Repointing" },
            { title: "Lime-mortar repointing (heritage)" },
            { title: "Chimney repair + rebuild" },
            { title: "Chimney removal" },
            { title: "Crack stitching (Helibar)" },
            { title: "New window / door openings" },
            { title: "Blockwork (cavity inner leaf)" },
            { title: "Brick matching + restoration" },
            { title: "Stone + flint work" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the wall?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Brickwork FAQ",
          preseed: [
            { q: "Can you match my existing brick?", a: "For most modern brick yes — merchant network. Reclaimed / Victorian brick we source from salvage yards." },
            { q: "How long before I can point in wet weather?", a: "Sand/cement mortar cures 24–48 hours. Lime mortar much slower — we time heritage jobs seasonally." },
            { q: "Do you handle Building Control?", a: "For openings + chimney removal yes — Building Control notified via our scheme." },
            { q: "Warranty?", a: "12-month workmanship guarantee. Materials carry manufacturer warranty." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a photo + note", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 83, seo: 85, trust: 87, mobile: 90, accessibility: 93, speed: 91, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Portfolio-led bricklayer site with lime + heritage specialism callouts.",
    benefits: [
      "Mosaic hero + recent-brickwork gallery",
      "12-service catalogue including lime + heritage",
      "Chimney rebuild / removal Building-Control workflow copy",
      "Crack-stitching specialism for structural remediation"
    ],
    priceLabel: "Free for bricklayers",
    estimatedBuildMinutes: 10
  }
};
blueprintRegistry.register(manifest);
export default manifest;
