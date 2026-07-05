// growthStrategyRegistry — seed templates.

import { growthStrategyRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

growthStrategyRegistry.register({
  manifestVersion: 1,
  slug: "door-installation-forward",
  name: "Door Installation Forward",
  description:
    "Push door installations as the primary offer, treat flooring as secondary, target higher-value fire + composite door jobs.",
  version: "1.0.0",
  appliesToTrades: ["carpenter", "joiner"],
  appliesToPositioning: ["premium", "luxury"],
  currentGoal: "increase-average-job-value",
  secondaryGoal: "lead-generation",
  quarterGoal: "40 door installations at €1,800+ avg",
  pushServices: [
    "door-installation",
    "fire-doors",
    "composite-doors",
    "internal-doors"
  ],
  reduceServices: ["flooring", "laminate-flooring"],
  targetJobValueMin: 1800,
  targetCustomers: ["homeowners", "landlords"],
  publisher: P
});

growthStrategyRegistry.register({
  manifestVersion: 1,
  slug: "emergency-24h-conversion",
  name: "Emergency 24h Conversion",
  description:
    "Maximise emergency callout conversions. Reduce friction, prioritise Call Now, downplay standard installations.",
  version: "1.0.0",
  appliesToTrades: ["plumber", "electrician", "gas-engineer", "locksmith"],
  currentGoal: "increase-conversion-rate",
  secondaryGoal: "bookings",
  quarterGoal: "Increase emergency booking rate by 25%",
  pushServices: ["emergency-callout", "leak-repair", "boiler-repair"],
  reduceServices: ["bathroom-fitting", "installation"],
  targetJobValueMin: 150,
  targetCustomers: ["homeowners", "letting-agents"],
  publisher: P
});

growthStrategyRegistry.register({
  manifestVersion: 1,
  slug: "premium-showcase-reviews",
  name: "Premium Showcase + Reviews",
  description:
    "Push high-value kitchen + bathroom showroom work. Focus on portfolio quality + reviews to justify premium pricing.",
  version: "1.0.0",
  appliesToTrades: ["kitchen-fitter", "bathroom-fitter", "extension-builder"],
  appliesToPositioning: ["premium", "luxury"],
  currentGoal: "portfolio-showcase",
  secondaryGoal: "increase-reviews",
  quarterGoal: "Publish 6 case studies + collect 20+ Google reviews",
  pushServices: ["bespoke-kitchens", "premium-bathrooms", "extensions"],
  reduceServices: ["budget-refits"],
  targetJobValueMin: 25000,
  targetCustomers: ["high-net-worth-homeowners"],
  publisher: P
});
