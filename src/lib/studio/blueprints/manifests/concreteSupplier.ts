// Blueprint: Concrete Supplier · Ready-Mix + Volumetric.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "concrete-supplier",
  name: "Concrete Supplier · Ready-Mix",
  tagline: "Ready-mix + volumetric. Delivered to the pour, no waste.",
  description:
    "Concrete supplier blueprint. Instant mix picker (C20/C25/C30/C40 + fibre), volumetric truck for exact-cubic-metre pours, live batch times. Payment on delivery or trade account.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["concrete-supplier"],
  outcomes: ["product-sales", "trade-account", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Ready-mix concrete. Delivered to the pour.",
          subhead: "Volumetric trucks for exact cubic metres — pay for what you use, no waste. C20 to C40, fibre + admix on request.",
          primaryCtaLabel: "Book a pour",
          secondaryCtaLabel: "See mix strengths"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "Mix strengths",
          minTiles: 8,
          preseed: [
            { title: "C10 / C15", body: "Blinding, back-fill, non-structural" },
            { title: "C20", body: "Standard domestic slab, garden" },
            { title: "C25", body: "Domestic foundations, low-load" },
            { title: "C30", body: "Domestic + light industrial slab" },
            { title: "C35", body: "Industrial + suspended slab" },
            { title: "C40", body: "High-load, structural" },
            { title: "Fibre concrete", body: "Steel or polymer fibre reinforced" },
            { title: "Coloured + decorative", body: "Pigmented + exposed aggregate" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Why volumetric",
          items: [
            { title: "Pay for what you use", body: "Truck batches on site. Order 3 m³, use 2.4 m³, pay for 2.4." },
            { title: "No premature setting", body: "Mixed on delivery — no 90-minute countdown from batch." },
            { title: "Multiple mixes one delivery", body: "Change mix mid-pour without a second truck." },
            { title: "Same-day service", body: "Standard mixes normally same-day; complex admix 24h notice." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the pour?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Concrete FAQ",
          preseed: [
            { q: "How much do I need for a slab?", a: "Length × width × depth (m) = cubic metres. 5 × 3 × 0.1 = 1.5 m³. We recommend +10% for compaction and spillage." },
            { q: "Do I need reinforcement?", a: "Depends on load — domestic drives usually mesh + fibre. Structural: engineer specification." },
            { q: "Minimum order?", a: "0.5 m³ minimum on volumetric. No minimum for full ready-mix drum." },
            { q: "Can you pour in wet weather?", a: "Rain during pour affects finish. We advise reschedule or covered pour." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a pour", ctaLabel: "Book" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 86, seo: 86, trust: 87, mobile: 92, accessibility: 93, speed: 90, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["shop_mode", "downloads", "trade_center_picks", "trade_connections", "online_payments", "material_calculators"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Ready-mix + volumetric concrete site with mix-picker + pour calculator.",
    benefits: [
      "8-mix strength grid",
      "Volumetric advantage explainer (pay for what you use)",
      "Slab calculator hook (concrete volume calc)",
      "Same-day pour booking with FAQ safety copy"
    ],
    priceLabel: "Free for concrete suppliers",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;
