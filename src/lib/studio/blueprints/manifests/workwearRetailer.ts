// Blueprint: Workwear & PPE Retailer.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "workwear-ppe-retailer",
  name: "Workwear & PPE Retailer",
  tagline: "Boots, hi-vis, hard-hats, coveralls. Embroidery on request.",
  description:
    "Workwear + PPE ecommerce blueprint. Product-first hero, category grid (footwear / hi-vis / hard-hats / coveralls / gloves / eye-ear / harness / respirators), embroidery + branding service callout, trade account funnel.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["workwear-supplier", "ppe-supplier", "safety-equipment"],
  outcomes: ["product-sales", "trade-account", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Kit that survives Monday.",
          subhead: "Workwear + PPE. Trade prices for accounts, embroidery on request, next-day dispatch.",
          primaryCtaLabel: "Shop workwear",
          secondaryCtaLabel: "Open a trade account"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "Shop by kit",
          minTiles: 8,
          preseed: [
            { title: "Safety footwear", body: "Boots + rigger + trainer" },
            { title: "Hi-vis", body: "Jackets, vests, trousers" },
            { title: "Hard hats + head protection", body: "Vented + non-vented" },
            { title: "Coveralls + overalls", body: "Disposable + reusable" },
            { title: "Gloves", body: "Cut / thermal / chemical" },
            { title: "Eye + ear protection", body: "Goggles + ear defenders" },
            { title: "Harness + fall arrest", body: "IPAF-ready" },
            { title: "Respirators + masks", body: "P3 + fit-tested" }
          ]
        }
      },
      { key: "product_grid.classic_3col_1", slotHint: "body", config: { heading: "Best sellers", minProducts: 9, dualPricingEnabled: true } },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Embroidery + printing",
          message: "Company logo on hi-vis, hoodies, hard-hat stickers. From 5 units.",
          ctaLabel: "See embroidery options"
        }
      },
      { key: "brands.strip_1", slotHint: "body", config: { heading: "Brands we stock", minBrands: 8 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Workwear FAQ",
          preseed: [
            { q: "Delivery?", a: "Free UK mainland orders over £75. Next-day dispatch on stock items ordered before 3pm." },
            { q: "Do you do embroidery?", a: "Yes — logo digitised once (one-off), then run on any garment. Turnaround 5–10 working days." },
            { q: "Trade account?", a: "12 months trading history + 2 references. 30-day terms + trade prices for regulars." },
            { q: "Returns?", a: "30-day returns on unworn stock items. Embroidered / bespoke items are non-returnable." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Bulk quote? Send a list", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 88, trust: 88, mobile: 92, accessibility: 94, speed: 89, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "vat"],
  suggestedApps: ["shop_mode", "wholesale_mode", "downloads", "trade_center_picks", "trade_connections", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Workwear + PPE ecommerce with embroidery + trade-account funnel.",
    benefits: [
      "8-category kit grid",
      "Trade + retail dual pricing on featured lines",
      "Embroidery service callout for repeat B2B business",
      "Trade account application flow with credit terms"
    ],
    priceLabel: "Free for retailers",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;
