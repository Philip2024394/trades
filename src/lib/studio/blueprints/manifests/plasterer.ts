// Blueprint: Plasterer · Skim, Render, Screed.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "plasterer-craft",
  name: "Plasterer · Skim, Render, Screed",
  tagline: "Flat walls, sharp corners, clean edges.",
  description:
    "Portfolio-first plasterer site. Full 12-service catalogue from Appendix D.7 covering skim + full re-plaster + external render + specialisms (lime plaster, silicone K-Rend, Venetian polished). Pre-1999 Artex FAQ references asbestos duty (CAR 2012).",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["plasterer", "drywaller"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "minimal",
  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Plaster that dries flat. Render that lasts.",
          subhead: "Skim, plasterboard, external render, screed, heritage lime. Small patches to full re-plaster.",
          primaryCtaLabel: "Get a quote",
          secondaryCtaLabel: "See recent work"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent finishes", minTiles: 8 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Plastering services",
          items: [
            { title: "Skim (walls + ceilings)" },
            { title: "Full re-plaster (bond + skim)" },
            { title: "Plasterboard + dot & dab" },
            { title: "Artex removal or skim-over" },
            { title: "External sand/cement render" },
            { title: "Silicone / K-Rend / monocouche" },
            { title: "Lime plaster + lime render" },
            { title: "Coving + cornice fit" },
            { title: "Small patch repair" },
            { title: "Venetian polished plaster" },
            { title: "Floor screeding" },
            { title: "Damp-patch prep + skim" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the job?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Plastering FAQ",
          preseed: [
            { q: "How long does a skim take?", a: "Small room 1 day. Whole floor 2–3 days including drying between coats." },
            { q: "Pre-1999 Artex — is it safe to remove?", a: "Pre-1999 Artex may contain asbestos. We arrange sampling first. Skim-over is safer where feasible." },
            { q: "Do you do external render?", a: "Yes — sand/cement, silicone through-render, K-Rend. Scheme warranty applies to system." },
            { q: "How long before I can paint?", a: "Skim needs 5–7 days to fully cure. We advise mist coat first." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a photo + a note", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 82, seo: 82, trust: 86, mobile: 90, accessibility: 92, speed: 91, brandConsistency: 89 },
  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Portfolio-led plasterer site with Artex + asbestos FAQ pre-loaded.",
    benefits: [
      "Mosaic hero + recent-finishes gallery",
      "12-service grid including lime + polished specialisms",
      "Pre-1999 Artex asbestos disclosure baked in",
      "External render specialism callout with system warranty language"
    ],
    priceLabel: "Free for plasterers",
    estimatedBuildMinutes: 9
  }
};
blueprintRegistry.register(manifest);
export default manifest;
