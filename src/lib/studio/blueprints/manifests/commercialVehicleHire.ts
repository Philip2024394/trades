// Blueprint: Commercial Vehicle Hire · Vans + Trailers.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "commercial-vehicle-hire",
  name: "Commercial Vehicle Hire",
  tagline: "Vans, tippers, trailers, refrigerated — hire by day / week / month.",
  description:
    "Commercial vehicle + trailer hire blueprint. Category grid (panel vans / lutons / tippers / dropsides / refrigerated / trailers), day + week + month rates, insurance + fuel options, delivery + collection service.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["commercial-vehicle-hire"],
  outcomes: ["equipment-hire", "phone-calls", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.plant_hire_bold_1",
        slotHint: "hero",
        config: {
          headline: "Vans, trailers, tippers — hire by the day or by the month.",
          subhead: "Panel vans to 7.5 t. Refrigerated. Tippers. Trailers. Insurance included, fuel on you.",
          primaryCtaLabel: "See vehicles",
          secondaryCtaLabel: "WhatsApp us"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "By vehicle type",
          minTiles: 8,
          preseed: [
            { title: "Small vans (SWB)", body: "Combo, Berlingo, Kangoo" },
            { title: "Medium vans (MWB)", body: "Vivaro, Transporter, Trafic" },
            { title: "Large vans (LWB)", body: "Transit, Sprinter, Boxer" },
            { title: "Lutons + box vans", body: "House-move + delivery" },
            { title: "Tippers + dropsides", body: "3.5 t + 7.5 t" },
            { title: "Refrigerated", body: "Chilled + frozen delivery" },
            { title: "Curtain-siders + flatbeds", body: "Palletised freight" },
            { title: "Car + plant trailers", body: "1.5 t – 3.5 t" }
          ]
        }
      },
      { key: "product_grid.classic_3col_1", slotHint: "body", config: { heading: "In stock now", minProducts: 6 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How hire works",
          items: [
            { title: "Book online or by phone", body: "Confirmed by email + text — deposit + insurance excess taken at booking." },
            { title: "Collect or delivered", body: "Yard collection free. Local delivery quoted by postcode." },
            { title: "Included insurance", body: "Full insurance included — driver excess disclosed at booking. Under-25 supplement applies." },
            { title: "Fuel + AdBlue on you", body: "Return with same fuel level. Fuel top-up chargeable + admin fee." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where do you need it?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Vehicle hire FAQ",
          preseed: [
            { q: "Do I need my own insurance?", a: "Standard insurance included with all hires. Excess disclosed at booking. Own-insurance option available at reduced daily rate." },
            { q: "Age restrictions?", a: "Standard hire from 23. Under 25 — small vans only, £X/day supplement. 21+ available on request with clean licence." },
            { q: "Can I take it to Europe?", a: "Yes with pre-notification + green card. Some ferries + Ireland exclusions — ask at booking." },
            { q: "Weekend rate?", a: "Saturday collection Sunday return = 1-day rate on most vehicles. Confirmed at booking." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a vehicle", ctaLabel: "Book" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 87, trust: 86, mobile: 93, accessibility: 93, speed: 91, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Commercial van + trailer hire site with 8-category vehicle grid.",
    benefits: [
      "8-category vehicle grid (SWB → 7.5 t → refrigerated)",
      "Included insurance narrative for confidence",
      "Weekend-included pricing model (Sat-Sun = 1 day)",
      "Europe travel FAQ preloaded"
    ],
    priceLabel: "Free for vehicle hire",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;
