// businessProfileRegistry — seed templates.

import { businessProfileRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

businessProfileRegistry.register({
  manifestVersion: 1,
  slug: "premium-carpenter-ireland",
  name: "Premium Carpenter · Ireland",
  description:
    "Established residential carpenter serving Irish homeowners with premium door + finish carpentry.",
  version: "1.0.0",
  trade: "carpenter",
  country: "IE",
  regions: ["dublin", "cork", "galway"],
  currency: "EUR",
  serviceRadius: { kind: "km", value: 60 },
  yearsTrading: 15,
  size: "micro",
  customerType: "residential",
  positioning: "premium",
  primaryServices: ["door-installation", "fire-doors", "custom-doors"],
  secondaryServices: ["flooring", "architraves"],
  futureServices: ["wardrobes", "kitchen-carpentry"],
  averageJobValue: { min: 1800, max: 8000, currency: "EUR" },
  isPremium: true,
  isLuxury: false,
  isEmergency: false,
  isCommercial: false,
  isResidential: true,
  certifications: ["c-and-g-nvq-2", "fire-door-certified"],
  publisher: P
});

businessProfileRegistry.register({
  manifestVersion: 1,
  slug: "emergency-plumber-uk",
  name: "24/7 Emergency Plumber · UK",
  description:
    "Reactive plumbing service prioritising same-day emergency callouts across a metro area.",
  version: "1.0.0",
  trade: "plumber",
  country: "GB",
  currency: "GBP",
  serviceRadius: { kind: "km", value: 25 },
  yearsTrading: 8,
  size: "small",
  customerType: "mixed",
  positioning: "value",
  primaryServices: ["emergency-callout", "leak-repair", "boiler-repair"],
  secondaryServices: ["installation", "bathroom-fitting"],
  averageJobValue: { min: 120, max: 900, currency: "GBP" },
  isPremium: false,
  isLuxury: false,
  isEmergency: true,
  isCommercial: false,
  isResidential: true,
  certifications: ["gas-safe", "watersafe"],
  publisher: P
});

businessProfileRegistry.register({
  manifestVersion: 1,
  slug: "luxury-kitchen-showroom",
  name: "Luxury Kitchen Showroom",
  description:
    "Design-led kitchen showroom serving high-end homeowners with bespoke kitchen fitting.",
  version: "1.0.0",
  trade: "kitchen-fitter",
  country: "GB",
  currency: "GBP",
  serviceRadius: { kind: "km", value: 80 },
  yearsTrading: 22,
  size: "small",
  customerType: "residential",
  positioning: "luxury",
  primaryServices: ["kitchen-design", "kitchen-installation", "bespoke-cabinetry"],
  secondaryServices: ["utility-rooms", "boot-rooms"],
  averageJobValue: { min: 25000, max: 150000, currency: "GBP" },
  isPremium: true,
  isLuxury: true,
  isEmergency: false,
  isCommercial: false,
  isResidential: true,
  certifications: ["kbb-accredited"],
  publisher: P
});
