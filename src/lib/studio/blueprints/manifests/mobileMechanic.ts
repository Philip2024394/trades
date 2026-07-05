// Blueprint: Mobile Mechanic + MOT.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "mobile-mechanic-mot",
  name: "Mobile Mechanic + MOT",
  tagline: "On-the-drive servicing + repair. Yard MOTs.",
  description:
    "Mobile mechanic + MOT operator blueprint. Foregrounds convenience (no garage visit) + honest 'we tell you what we can + can't do on the drive'. MOT booking funnel for the yard-based half of the business.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["mobile-mechanic"],
  outcomes: ["quote-requests", "phone-calls", "service-sales"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Mechanic on the drive. MOT at the yard.",
          subhead:
            "Servicing, brakes, cambelts, diagnostics — on your driveway. MOTs at the yard, courtesy car by arrangement.",
          primaryCtaLabel: "Book a service",
          secondaryCtaLabel: "Book an MOT"
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "What we cover",
          items: [
            { title: "Full + interim service" },
            { title: "MOT test (Class 4)" },
            { title: "Brake pads + discs" },
            { title: "Cambelt + water pump" },
            { title: "Diagnostics + fault codes" },
            { title: "Battery replacement" },
            { title: "Alternator + starter" },
            { title: "Suspension (shocks, springs, arms)" },
            { title: "Exhaust replacement" },
            { title: "Clutch replacement (limited on-drive)" },
            { title: "Air-con regas" },
            { title: "Pre-purchase inspection" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Mobile or yard",
          items: [
            { title: "On the drive", body: "Servicing, brakes, small repairs — no garage visit." },
            { title: "Yard for MOT", body: "Class 4 MOT bay at the yard. Book online." },
            { title: "Honest limits", body: "Some jobs need a lift. We tell you before we arrive." },
            { title: "Fixed labour rate", body: "One rate mobile OR yard. No 'workshop premium'." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the vehicle?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What drivers said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Mechanic FAQ",
          preseed: [
            { q: "Can you do MOT on the drive?", a: "No — MOT tests can only be done at an approved test station. That's why we run a yard MOT bay too." },
            { q: "Do you supply parts?", a: "Yes — OEM or matched-quality parts at trade cost + labour separate. Or you supply parts + we fit." },
            { q: "How long does a service take?", a: "Interim 1 hour on drive. Full service 2–3 hours. Cambelt 3–5 hours (yard usually)." },
            { q: "Warranty on work?", a: "12 months / 12,000 miles on parts + labour we supply." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book on the drive or at the yard", ctaLabel: "Book" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 87, trust: 88, mobile: 94, accessibility: 94, speed: 91, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Mobile mechanic + MOT site with on-drive vs yard split narrative.",
    benefits: [
      "12-service mechanic catalogue",
      "Honest 'we tell you what needs a lift' copy avoids trust drop-offs",
      "MOT booking funnel for the yard revenue stream",
      "Fixed labour rate = no workshop-premium suspicion"
    ],
    priceLabel: "Free for mechanics",
    estimatedBuildMinutes: 10
  }
};
blueprintRegistry.register(manifest);
export default manifest;
