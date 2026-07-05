// Blueprint: Structural Engineer · Design + Calc.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "structural-engineer-design",
  name: "Structural Engineer · Design & Calc",
  tagline: "Calcs, drawings, sign-offs. Domestic to light commercial.",
  description:
    "Chartered / IStructE structural engineer blueprint. Design-first hero, project reels, calc packages. Positioned for both direct homeowners (extension calcs) and builders (managed sub-consultant).",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["structural-engineer"],
  outcomes: ["quote-requests", "project-showcase", "service-sales"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Structural calcs, drawings, sign-offs.",
          subhead: "Extension RSJs, chimney removals, wall openings, retaining structures. Building Control-ready packs.",
          primaryCtaLabel: "Get a fee proposal",
          secondaryCtaLabel: "See recent projects"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How the calc pack lands",
          items: [
            { title: "Brief + site info", body: "Photos, sketches, existing drawings — whatever you have." },
            { title: "Design + calc", body: "Beam sizing, foundation checks, load path. All to Eurocode." },
            { title: "Building Control pack", body: "Signed calcs + drawings ready for submission." },
            { title: "Site queries", body: "Questions during build handled by email or WhatsApp." }
          ]
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent projects", minTiles: 8 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Services",
          items: [
            { title: "Extension foundation + wall calcs" },
            { title: "Loft conversion calcs" },
            { title: "Chimney breast removal calcs" },
            { title: "RSJ / steel beam design" },
            { title: "Wall opening (knock-through)" },
            { title: "Retaining wall design" },
            { title: "Basement / underpin calcs" },
            { title: "Structural inspection reports" },
            { title: "Party wall calcs (award-side)" },
            { title: "Existing-house structural surveys" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What builders + homeowners said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Structural FAQ",
          preseed: [
            { q: "Do I need a structural engineer for an extension?", a: "Yes — Building Control requires signed calcs for foundations + any load-bearing changes." },
            { q: "How long does a typical calc pack take?", a: "Simple RSJ / chimney breast 5–10 working days. Full extension 2–3 weeks." },
            { q: "Do you visit the site?", a: "For simple calcs — photos are usually enough. Complex builds + underpinning — yes, we visit." },
            { q: "Are you chartered?", a: "Yes — IStructE / ICE member. Building Control accept our stamped calcs." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a brief + photos", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 84, seo: 87, trust: 94, mobile: 90, accessibility: 94, speed: 91, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Structural engineer design-service site — homeowner + builder dual audience.",
    benefits: [
      "Design-led hero + recent-projects gallery",
      "Calc-pack workflow narrative (brief → design → BC pack → site queries)",
      "Chartered-body FAQ preloaded (IStructE / ICE)",
      "Extension + chimney + wall-opening service grid"
    ],
    priceLabel: "Free for engineers",
    estimatedBuildMinutes: 10
  }
};
blueprintRegistry.register(manifest);
export default manifest;
