// Blueprint: Carpenter · Craft Portfolio.
//
// Skilled-trade portfolio positioning. Photography-led hero (portfolio
// mosaic), 12-service grid pulled straight from Appendix D.1, before/
// after slider for restoration work. Positioned for referral-driven
// carpenters where the site is the "yes I'm serious" proof.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "carpenter-craft",
  name: "Carpenter · Craft Portfolio",
  tagline: "Doors, kitchens, staircases, floors — the craft in one page.",
  description:
    "Portfolio-first blueprint for carpenters + joiners. Hero is a mosaic of your best work. Services grid seeded with the full 12-service catalogue (door hanging, skirting, fitted wardrobes, staircases, sash restoration, loft carpentry, kitchen fits, flooring, fire doors). Testimonials + FAQ tuned to the 'is this person good enough for my house' question.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: ["carpenter", "joiner"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "premium",

  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Doors that shut. Kitchens that last. Staircases that sing.",
          subhead:
            "Bespoke carpentry + joinery across the region. Fitted wardrobes to sash restoration.",
          primaryCtaLabel: "See recent work",
          secondaryCtaLabel: "Get a quote"
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full craft catalogue",
          items: [
            { title: "Door hanging (internal + external)" },
            { title: "Skirting + architrave" },
            { title: "Fitted wardrobes" },
            { title: "Bespoke shelving + cupboards" },
            { title: "Staircase build + repair" },
            { title: "Sash window restoration" },
            { title: "Loft-conversion carpentry" },
            { title: "Kitchen carcass fit" },
            { title: "Wood flooring install" },
            { title: "Fire door install (FD30/FD60)" },
            { title: "Boarding-up (emergency)" },
            { title: "Flat-pack + made-to-measure assembly" }
          ]
        }
      },
      {
        key: "gallery.grid_1",
        slotHint: "body",
        config: {
          heading: "Recent commissions",
          minTiles: 8
        }
      },
      {
        key: "hero.before_after_slider_1",
        slotHint: "body",
        config: {
          heading: "Restoration: before + after",
          subhead: "Sash windows, staircases, panelling."
        }
      },
      {
        key: "testimonials.card_grid_1",
        slotHint: "body",
        config: {
          heading: "What clients said",
          minCards: 3
        }
      },
      {
        key: "hero.postcode_local_1",
        slotHint: "body",
        config: { heading: "Where do you need it?" }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Common questions",
          preseed: [
            { q: "How far ahead do you book?", a: "Small jobs 2–3 weeks. Full staircases + kitchen fits 6–10 weeks." },
            { q: "Do you supply or fit-only?", a: "Both. We source materials for you or fit what you supply — priced separately for transparency." },
            { q: "Fire doors — do you certify?", a: "We install to the FD rating specified. Third-party certifier attends where required." },
            { q: "Do you do small jobs?", a: "Yes — day-rate on request. Minimum half-day booking." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: { heading: "Send a photo + a note", ctaLabel: "Send" }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ],
    services: [
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Every service, with a photo",
          items: [
            { title: "Door hanging" },
            { title: "Skirting + architrave" },
            { title: "Fitted wardrobes" },
            { title: "Bespoke shelving" },
            { title: "Staircase build + repair" },
            { title: "Sash window restoration" },
            { title: "Loft carpentry" },
            { title: "Kitchen carcass fit" },
            { title: "Wood flooring" },
            { title: "Fire doors" },
            { title: "Boarding-up" },
            { title: "Flat-pack assembly" }
          ]
        }
      }
    ]
  },

  score: {
    conversion: 84,
    seo: 86,
    trust: 91,
    mobile: 91,
    accessibility: 93,
    speed: 90,
    brandConsistency: 94
  },

  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: [
    "job_diary",
    "quote_pipeline",
    "trade_connections",
    "meet_the_team",
    "faq_page",
    "online_payments"
  ],
  compliance: [
    "consumer-contracts-14day",
    "asa-superlative-guard",
    "gdpr-form-auditor"
  ],

  browserCard: {
    oneLiner: "Portfolio-led carpentry site — photography-first, referral-friendly.",
    benefits: [
      "Mosaic hero — your work IS the pitch",
      "Before/after slider for restoration jobs",
      "12-service grid from the UK carpenter service library",
      "Made-to-measure enquiry form with photo attachment"
    ],
    priceLabel: "Free for carpenters",
    estimatedBuildMinutes: 11
  }
};

blueprintRegistry.register(manifest);
export default manifest;
