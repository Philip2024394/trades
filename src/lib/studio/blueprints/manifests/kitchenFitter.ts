// Blueprint: Kitchen Fitter · Showroom + Fit.
//
// Showroom-quality kitchen fitter with visualiser hook. Portfolio-heavy
// (kitchens sell on photos). Trust anchor for Companies House + VAT +
// insurance. FAQ addresses knock-through / structural / Part P questions
// that scare homeowners off.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "kitchen-fitter-showroom",
  name: "Kitchen Fitter · Showroom",
  tagline: "Design, supply, fit — one team, one accountable price.",
  description:
    "Blueprint for kitchen fitters who quote whole kitchens (not just labour). Hero showcases finished rooms, service grid covers supply-and-fit vs fit-only, worktop template + stone install, appliance install, bespoke island. FAQ handles the knock-through / Part P / gas-hob concerns that stall enquiries.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: ["kitchen-fitter"],
  outcomes: ["quote-requests", "project-showcase", "trade-account"],
  variant: "premium",

  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Kitchens that feel like the showroom, delivered on your street.",
          subhead:
            "Design, supply, fit, finish. One accountable team from measure-up to worktop template.",
          primaryCtaLabel: "Book a home visit",
          secondaryCtaLabel: "See recent kitchens"
        }
      },
      {
        key: "gallery.grid_1",
        slotHint: "body",
        config: {
          heading: "Recent kitchens",
          minTiles: 9
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "What we do",
          items: [
            { title: "Full kitchen install (supply + fit)" },
            { title: "Fit-only from your chosen range" },
            { title: "Worktop template + stone install" },
            { title: "Laminate + solid-wood worktops" },
            { title: "Splashback fit (glass + stone)" },
            { title: "Appliance install (non-gas)" },
            { title: "Sink + tap install" },
            { title: "Cabinet respray + refurb" },
            { title: "Kitchen island build" },
            { title: "Knock-through management" },
            { title: "Bespoke / handmade kitchen" },
            { title: "Utility room fit" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How the journey runs",
          items: [
            { title: "Home visit", body: "We measure, listen, take photos. Free for local jobs." },
            { title: "Design + quote", body: "Layout options, 3D visual, itemised price. No pressure." },
            { title: "Manage the trades", body: "We coordinate electrician (Part P) + plumber + tiler + plasterer." },
            { title: "Sign-off + snags", body: "Walk-through, snag list, all certificates handed over." }
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
        config: {
          heading: "Where's the kitchen?",
          subhead: "Home visits free inside our radius."
        }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Kitchen refit FAQ",
          preseed: [
            { q: "How long does a full refit take?", a: "Typical 2–3 weeks on the tools + 1 week worktop template lead-time." },
            { q: "Do you handle the electrician + plumber?", a: "Yes — Part P + gas work runs through our vetted subcontractors and we hand you the certificates." },
            { q: "Do you supply the kitchen or do we?", a: "Both work. Supply-and-fit gives us one accountable price. Fit-only from your range is fine — we quote fit + coordination separately." },
            { q: "Can you do a knock-through?", a: "Yes — Building Control notification + RSJ engineered. Timing folded into the schedule." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: { heading: "Book a home visit", ctaLabel: "Send request" }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },

  score: {
    conversion: 87,
    seo: 88,
    trust: 92,
    mobile: 92,
    accessibility: 94,
    speed: 88,
    brandConsistency: 94
  },

  requiredCredentials: ["companies-house", "vat", "public-liability", "trustmark"],
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
    "gdpr-form-auditor"
  ],

  browserCard: {
    oneLiner: "Showroom-quality kitchen-fitter site with trade-managed journey.",
    benefits: [
      "Photo-led hero + full recent-kitchens gallery",
      "Managed-trades narrative (Part P + gas certificates handed over)",
      "Home-visit CTA that respects Consumer Contracts pre-contract rules",
      "12-service grid + kitchen refit FAQ preloaded"
    ],
    priceLabel: "Free for kitchen fitters",
    estimatedBuildMinutes: 13
  }
};

blueprintRegistry.register(manifest);
export default manifest;
