// Blueprint: Bathroom Fitter · Full Refit.
//
// End-to-end bathroom fitter. Trust proof + wet-room specialism +
// accessible-bath variant callout. FAQ handles tanking + waterproof
// guarantee questions carefully (must reference tanking-system
// manufacturer warranty per CAP 3.53).

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "bathroom-fitter-full",
  name: "Bathroom Fitter · Full Refit",
  tagline: "Wetrooms, en-suites, accessible showers — done once, done right.",
  description:
    "Blueprint for bathroom fitters who take full projects (plumb + tile + electric + carpentry). Portfolio-led hero, wetroom + accessible-bathroom specialism callouts, WRAS-safe waterproof warranty language, 12-service catalogue seeded from Appendix D.12.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: ["bathroom-fitter"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "premium",

  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Bathrooms that work every day. Wetrooms that last.",
          subhead:
            "Full refits from strip-out to final grout. Accessible bathrooms + level-access wetrooms our specialism.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See recent bathrooms"
        }
      },
      {
        key: "gallery.grid_1",
        slotHint: "body",
        config: { heading: "Recent refits", minTiles: 9 }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Every bathroom service",
          items: [
            { title: "Full bathroom refit" },
            { title: "Shower room install" },
            { title: "Wetroom install (tanked)" },
            { title: "En-suite install" },
            { title: "Bath / basin / WC replacement" },
            { title: "Shower valve / mixer install" },
            { title: "Bathroom wall + floor tiling" },
            { title: "Underfloor heating (electric)" },
            { title: "Accessible + level-access bathroom" },
            { title: "Luxury spec bathroom" },
            { title: "Bathroom design service" },
            { title: "Plumbing 1st + 2nd fix" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How a refit runs",
          items: [
            { title: "Survey + design", body: "Home visit, layout options, itemised quote." },
            { title: "Strip-out + 1st fix", body: "We manage waste removal (registered waste carrier)." },
            { title: "Tile + tank + fit", body: "Tanking system to manufacturer spec, warranty attached." },
            { title: "Sign-off + snag", body: "Walk-through + snag list, all certificates handed over." }
          ]
        }
      },
      {
        key: "testimonials.card_grid_1",
        slotHint: "body",
        config: { heading: "What homeowners said", minCards: 3 }
      },
      {
        key: "hero.postcode_local_1",
        slotHint: "body",
        config: { heading: "Where's the bathroom?" }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Bathroom refit FAQ",
          preseed: [
            { q: "How long does a full refit take?", a: "Typical 8–14 working days. Wetrooms 12–18. Timeline confirmed at survey." },
            { q: "What waterproof warranty do you offer?", a: "Tanking system warranty is the manufacturer's (e.g. Schlüter, Mapei). Our workmanship is separately guaranteed for 24 months." },
            { q: "Do you handle accessible / mobility bathrooms?", a: "Yes — level-access showers, grab rails, walk-in baths. We survey to your OT's recommendations." },
            { q: "Can you match my existing tile?", a: "Yes for current ranges; discontinued patterns we can usually source through our merchant." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: { heading: "Book a survey", ctaLabel: "Send request" }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },

  score: {
    conversion: 86,
    seo: 86,
    trust: 90,
    mobile: 92,
    accessibility: 95,
    speed: 89,
    brandConsistency: 93
  },

  requiredCredentials: ["companies-house", "public-liability", "waste-carrier"],
  suggestedApps: [
    "quote_pipeline",
    "job_diary",
    "trade_connections",
    "meet_the_team",
    "faq_page",
    "online_payments",
    "downloads"
  ],
  compliance: [
    "consumer-contracts-14day",
    "asa-superlative-guard",
    "gdpr-form-auditor",
    "wras-water-cold"
  ],

  browserCard: {
    oneLiner: "Full-refit bathroom-fitter site with WRAS-safe warranty language.",
    benefits: [
      "Portfolio hero + recent-refits gallery",
      "Wetroom + accessible-bath specialism callouts",
      "12-service grid + CAP-safe warranty FAQ",
      "Waste Carrier badge auto-lights when you add your number"
    ],
    priceLabel: "Free for bathroom fitters",
    estimatedBuildMinutes: 12
  }
};

blueprintRegistry.register(manifest);
export default manifest;
