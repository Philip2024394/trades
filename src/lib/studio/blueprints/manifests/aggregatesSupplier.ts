// Blueprint: Aggregates Supplier · Yard + Delivery.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "aggregates-supplier",
  name: "Aggregates Supplier · Yard + Delivery",
  tagline: "Sand, gravel, MOT, ballast — bag, bulk, tipper.",
  description:
    "Aggregates supplier blueprint. Instant product grid with per-tonne pricing, bag + bulk + tipper options, delivery radius calculator hook. Trade accounts for regulars.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["aggregate-supplier", "building-merchant"],
  outcomes: ["product-sales", "trade-account", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Aggregates. Bagged, bulk, tipper.",
          subhead: "Sharp sand, MOT type 1, ballast, gravel. Same-day tipper delivery inside our radius.",
          primaryCtaLabel: "See aggregates",
          secondaryCtaLabel: "Open a trade account"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "By material",
          minTiles: 8,
          preseed: [
            { title: "Sharp sand", body: "Bulk bag + tipper" },
            { title: "Building sand", body: "Bulk bag + tipper" },
            { title: "Ballast (all-in)", body: "Concreting mix" },
            { title: "MOT type 1", body: "Sub-base" },
            { title: "Gravel + shingle", body: "Decorative + drainage" },
            { title: "Topsoil", body: "Screened + graded" },
            { title: "Slate + decorative chippings", body: "Landscape finish" },
            { title: "Concrete blocks + cement", body: "Bagged palletised" }
          ]
        }
      },
      { key: "product_grid.classic_3col_1", slotHint: "body", config: { heading: "Prices this week", minProducts: 6, dualPricingEnabled: true } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Delivery + collection",
          items: [
            { title: "Tipper delivery", body: "6-wheeler + grab. Free within 10 miles over 2 tonnes." },
            { title: "Bulk-bag delivery", body: "Hiab crane offload — driveway or garden." },
            { title: "Yard collection", body: "Loose or bag. Weighbridge on site." },
            { title: "Trade accounts", body: "30-day credit terms + trade prices for regulars." }
          ]
        }
      },
      { key: "map.embed_1", slotHint: "body", config: { heading: "Find the yard" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Aggregates FAQ",
          preseed: [
            { q: "How much does a bulk bag cover?", a: "A tonne bag of MOT type 1 covers ~11 m² at 50mm compacted depth. Tell us your area — we'll calculate for you." },
            { q: "Do you deliver Saturday?", a: "Yes to trade accounts. Book by Friday 3pm." },
            { q: "What's your minimum delivery?", a: "Bulk bag 1× minimum. Tipper 2 tonne minimum inside 10-mile radius." },
            { q: "Trade account terms?", a: "12 months trading history + 2 references. Approval 24–48 hours." }
          ]
        }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 86, seo: 87, trust: 88, mobile: 91, accessibility: 93, speed: 89, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["shop_mode", "downloads", "trade_center_picks", "trade_connections", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Aggregates yard with tipper + bulk delivery + trade accounts.",
    benefits: [
      "8-category yard grid with per-tonne pricing",
      "Trade + retail dual pricing on featured lines",
      "Tipper delivery radius + hiab crane offload copy",
      "Coverage calculator hook (aggregates volume calc)"
    ],
    priceLabel: "Included in Merchant Pro",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;
