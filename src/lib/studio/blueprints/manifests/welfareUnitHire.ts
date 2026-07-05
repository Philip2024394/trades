// Blueprint: Welfare Unit Hire · Site Cabins & Toilets.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "welfare-unit-hire",
  name: "Welfare Unit Hire · Site Cabins",
  tagline: "Portable welfare, mobile toilets, drying rooms — delivered ready.",
  description:
    "Welfare unit / portable cabin hire blueprint. Product grid with weekly + monthly rates, hookup requirements, delivery radius. Fits main-contractor + self-build customer segments.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["welfare-unit-hire"],
  outcomes: ["equipment-hire", "phone-calls", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.plant_hire_bold_1",
        slotHint: "hero",
        config: {
          headline: "Site welfare, ready to hook up.",
          subhead: "Mobile welfare, portable toilets, drying rooms, canteen units. Hire by week or month.",
          primaryCtaLabel: "See units",
          secondaryCtaLabel: "WhatsApp us"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "Browse welfare",
          minTiles: 8,
          preseed: [
            { title: "Mobile welfare units", body: "Self-contained, generator + water" },
            { title: "Portable toilets", body: "Single + block units" },
            { title: "Anti-vandal cabins", body: "Site office + storage" },
            { title: "Drying rooms", body: "Wet-weather workwear management" },
            { title: "Canteen units", body: "Hot food service + seating" },
            { title: "Site accommodation", body: "Sleepers for remote sites" },
            { title: "Chemical toilet servicing", body: "Weekly / fortnightly service" },
            { title: "Access ramps + steps", body: "DDA-compliant" }
          ]
        }
      },
      { key: "product_grid.classic_3col_1", slotHint: "body", config: { heading: "In stock now", minProducts: 6 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How the hire works",
          items: [
            { title: "Same-week delivery", body: "Book by Tuesday, delivered Thursday. Standard units in the yard now." },
            { title: "Hook-up done", body: "Water fill, waste tank, generator + fuel — commissioned on delivery." },
            { title: "Servicing included", body: "Fortnightly service on hires over 4 weeks." },
            { title: "Off-hire same day", body: "Ring to release, we collect same or next day." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the site?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Welfare hire FAQ",
          preseed: [
            { q: "Do you deliver?", a: "Yes — hiab + tractor unit for larger cabins. Delivery quoted by postcode." },
            { q: "What do I need on site?", a: "Level ground + safe access. Water + waste connections managed by us." },
            { q: "How long can I hire?", a: "Minimum 1 week. Weekly or monthly rates; long-term contracts available for main contractors." },
            { q: "Do you supply canteen units?", a: "Yes — hot food service units with servery + seating for 10 to 40 persons." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a unit", ctaLabel: "Send booking" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 84, trust: 86, mobile: 92, accessibility: 93, speed: 91, brandConsistency: 89 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "waste-carrier"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "cdm-2015"],
  browserCard: {
    oneLiner: "Site welfare + portable cabin hire depot with week/month pricing.",
    benefits: [
      "8-category welfare grid",
      "Same-week delivery + hook-up service copy",
      "Waste Carrier badge auto-lights when you add your number",
      "Canteen + drying-room specialisms for main-contractor sites"
    ],
    priceLabel: "Free for welfare hirers",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;
