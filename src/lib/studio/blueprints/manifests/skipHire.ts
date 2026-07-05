// Blueprint: Skip Hire · Yard + Grab.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "skip-hire-yard",
  name: "Skip Hire · Yard + Grab",
  tagline: "Skips + grab lorries. Domestic + trade. Same-day delivery.",
  description:
    "Skip hire operator blueprint. Category grid (4yd builders + 6yd mini + 8yd mid + 12yd maxi + roll-on-off), grab-lorry service, permit + placement handling. Registered Waste Carrier + Environmental Permit narrative.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["skip-hire"],
  outcomes: ["product-sales", "equipment-hire", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Skips + grab. On the drive today.",
          subhead: "4yd to roll-on-off. Grab lorries for muck-away. Registered Waste Carrier — legal disposal included.",
          primaryCtaLabel: "Book a skip",
          secondaryCtaLabel: "Grab lorry enquiry"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "Skips by size",
          minTiles: 8,
          preseed: [
            { title: "4yd builders skip", body: "Small refurbs, bathroom strip-outs" },
            { title: "6yd mini", body: "Household clearance, garage clearout" },
            { title: "8yd builders (most popular)", body: "Kitchen refit, small extension" },
            { title: "10yd", body: "Large refurb, house clearance" },
            { title: "12yd maxi", body: "Bulky light waste — sofas, cardboard" },
            { title: "16yd + 20yd roll-on-off", body: "Site clearance, construction" },
            { title: "40yd hook", body: "Long-term project waste stream" },
            { title: "Grab lorry (6 + 8 wheel)", body: "Muck-away, no skip on drive" }
          ]
        }
      },
      { key: "product_grid.classic_3col_1", slotHint: "body", config: { heading: "Prices this week", minProducts: 6 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How hire works",
          items: [
            { title: "Same-day delivery", body: "Book by 10am, on the drive same day (subject to slot)." },
            { title: "Permit handled", body: "Skip on the road — we apply for the local permit + place cones/light." },
            { title: "Wait + load available", body: "Small clearances — driver waits, loads, leaves. No skip on drive." },
            { title: "Recycled properly", body: "80%+ recycled at our transfer station. Waste Transfer Note supplied." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the skip going?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Skip hire FAQ",
          preseed: [
            { q: "Do I need a permit?", a: "Only if the skip's on the public road. On your driveway — no permit. On the road — we handle the council permit + cones + lights included." },
            { q: "What can't I put in?", a: "No fridges, TVs, tyres, asbestos, hazardous liquids, gas cylinders, plasterboard (separate collection). Full list on request." },
            { q: "How long can I keep it?", a: "Standard 2 weeks. Longer stays possible — extra weekly rate. Book longer up-front for the best price." },
            { q: "Trade accounts?", a: "12 months trading history + 2 references. Monthly billing + priority slots." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a skip", ctaLabel: "Book" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 88, seo: 88, trust: 89, mobile: 93, accessibility: 93, speed: 90, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "waste-carrier"],
  suggestedApps: ["shop_mode", "downloads", "trade_center_picks", "trade_connections", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Skip hire operator site with 8-size grid + grab-lorry service + permit handling.",
    benefits: [
      "8-size skip grid with typical-use hints",
      "Grab lorry cross-sell for muck-away without a skip",
      "Permit-handled narrative removes homeowner friction",
      "Waste Carrier badge auto-lights on registration"
    ],
    priceLabel: "Free for skip operators",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;
