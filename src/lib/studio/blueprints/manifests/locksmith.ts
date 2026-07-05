// Blueprint: Locksmith · 24/7 Emergency Callout.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "locksmith-emergency",
  name: "Locksmith · Emergency Callout",
  tagline: "Locked out? Lost keys? On the doorstep in 30 minutes.",
  description:
    "24/7 emergency locksmith blueprint. Phone-first, sticky call ribbon, honest response-time promise, transparent call-out fee (ASA-safe — diagnostic fee disclosed inline). MLA (Master Locksmiths Association) badge callout for vetted-locksmith trust.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["locksmith", "security-installer"],
  outcomes: ["emergency-callout", "phone-calls", "local-coverage"],
  variant: "emergency",
  layout: {
    home: [
      {
        key: "hero.emergency_247_1",
        slotHint: "hero",
        config: {
          headline: "Locked out? Lost keys? Call now.",
          subhead: "24/7 local locksmith. On the doorstep in 30 minutes. Non-destructive entry where possible. Fee shown before we dispatch.",
          primaryCtaLabel: "Call now",
          secondaryCtaLabel: "WhatsApp us",
          responsePromiseMinutes: 30
        }
      },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Transparent fees",
          message: "Call-out fee £X + parts. Written quote at your door before we start.",
          ctaLabel: "See our pricing"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Common callouts",
          items: [
            { title: "Locked out", body: "Non-destructive entry where possible." },
            { title: "Broken key in lock", body: "Extract + replace lock or barrel." },
            { title: "Post-burglary boarding + lock change", body: "Emergency board + full new locks." },
            { title: "Lock changes + upgrades", body: "British Standard 3621 / TS007 3-star." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where are you locked out?" } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full service list",
          items: [
            { title: "Emergency lockout (24/7)" },
            { title: "Broken-key extraction" },
            { title: "Lock change + upgrade" },
            { title: "uPVC door lock repair" },
            { title: "Multi-point lock repair" },
            { title: "Anti-snap lock upgrade (TS007 3-star)" },
            { title: "Boarding-up (post-burglary)" },
            { title: "Safe opening + repair" },
            { title: "Insurance report + quote" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "Recent emergency callouts", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Locksmith FAQ",
          preseed: [
            { q: "How fast can you get here?", a: "30 minutes inside our coverage area. Out-of-hours honestly quoted on the call." },
            { q: "Will you damage my door?", a: "We prioritise non-destructive entry — picking + bypass. Some locks require destructive entry; you're told first." },
            { q: "Are you MLA registered?", a: "MLA members carry the badge (auto-verified where you've added your registration number)." },
            { q: "Insurance claim?", a: "Photo report + itemised invoice for your insurer at no extra charge." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Not urgent? Send a message", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 94, seo: 83, trust: 84, mobile: 97, accessibility: 94, speed: 93, brandConsistency: 89 },
  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: ["job_diary", "lead_alerts", "quote_pipeline", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "24/7 locksmith site with transparent-fee disclosure + non-destructive entry copy.",
    benefits: [
      "Sticky call ribbon — never leaves the viewport",
      "ASA-safe call-out fee disclosure (per Rightio + Town Force rulings)",
      "Non-destructive entry promise builds trust",
      "TS007 anti-snap upgrade cross-sell for repeat revenue"
    ],
    priceLabel: "Free for locksmiths",
    estimatedBuildMinutes: 10
  }
};
blueprintRegistry.register(manifest);
export default manifest;
