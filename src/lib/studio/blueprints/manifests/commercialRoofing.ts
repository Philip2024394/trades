// Blueprint: Commercial Roofing Contractor.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "commercial-roofing-contractor",
  name: "Commercial Roofing · B2B",
  tagline: "Industrial roofs, cut edges, cladding, flat systems. Full compliance packs.",
  description:
    "B2B commercial roofing contractor blueprint. Positioned for main-contractor + FM buyer. CHAS / Constructionline / SafeContractor + CDM 2015 compliance narrative baked in. Fleet + capacity showcased for larger tenders.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["commercial-roofing", "flat-roofing", "roofer"],
  outcomes: ["quote-requests", "project-showcase", "trade-account"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Commercial roofing. Compliance packs. On-site delivery.",
          subhead:
            "Cut edges, cladding, flat roof systems, refurbs. CHAS + Constructionline + SafeContractor. CDM-ready from day one.",
          primaryCtaLabel: "Send a tender pack",
          secondaryCtaLabel: "See recent projects"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent commercial projects", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Commercial roofing capability",
          items: [
            { title: "Single-ply membrane (TPO / PVC)" },
            { title: "Bituminous felt built-up" },
            { title: "Liquid-applied waterproofing" },
            { title: "Standing-seam metal" },
            { title: "Industrial cut-edge sealing" },
            { title: "Wall + roof cladding" },
            { title: "Rooflight + smoke vent install" },
            { title: "Gutter refurb + upgrade" },
            { title: "Fall-arrest + man-safe systems" },
            { title: "Insurance + storm-damage reinstatement" },
            { title: "Roof safety survey + report" },
            { title: "Planned maintenance contracts" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How we run a commercial project",
          items: [
            { title: "CDM Principal Contractor", body: "Full CPP + F10 + welfare + risk assessments before boots on roof." },
            { title: "SSIP-verified", body: "CHAS + SafeContractor + SMAS mutual recognition." },
            { title: "In-house scaffold + edge protection", body: "Own MEWPs + trained IPAF operators." },
            { title: "Manufacturer-approved installer", body: "System warranties honoured — Sika, Icopal, IKO, Kingspan." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What buyers said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Buyer FAQ",
          preseed: [
            { q: "Are you on our approved supplier list?", a: "We're CHAS + Constructionline + SafeContractor approved. Additional pre-quals handled inline." },
            { q: "What's your Max operator count on site?", a: "Depending on scope 4–24 operators + supervisors. Larger projects sub-contracted through our vetted partner network with full audit trail." },
            { q: "System warranties?", a: "Manufacturer warranty 15–25 years depending on system. Our workmanship 12-month standalone." },
            { q: "Do you TUPE staff for planned maintenance takeover?", a: "Yes — TUPE processed with our HR team on award of contract." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a tender pack", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 84, seo: 87, trust: 96, mobile: 89, accessibility: 93, speed: 87, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "chas", "safecontractor", "constructionline", "ipaf"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments", "job_diary"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "cdm-2015"],
  browserCard: {
    oneLiner: "B2B commercial roofing site with CDM + SSIP compliance packs baked in.",
    benefits: [
      "SSIP mutual-recognition badges auto-light",
      "12-service catalogue including man-safe + fall-arrest",
      "TUPE + planned maintenance takeover narrative",
      "Manufacturer-approved-installer copy for system warranties"
    ],
    priceLabel: "Free for commercial roofers",
    estimatedBuildMinutes: 13
  }
};
blueprintRegistry.register(manifest);
export default manifest;
