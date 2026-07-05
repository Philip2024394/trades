// calc-concrete — App-store manifest.
//
// Wraps src/lib/calculators/concrete.ts (5 UK scenarios). Covers slabs,
// paths, driveways, shed bases, and fence-post bases across the 3
// standard UK mix ratios (1:2:4 / 1:1.5:3 / 1:3:6).
//
// EXCLUDED: plasterer (does not pour concrete) · painter · decorator.
// Fencers get calc-concrete via fence-post-bases scenario BUT the
// wider slab work belongs to groundworkers/general-builders.

import { Container } from "lucide-react";

export const CALC_CONCRETE_APP_MANIFEST = {
  slug: "calc-concrete",
  name: "Concrete Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate m³, cement/sand/ballast weight, 20 kg bag count, mix ratio, and labour cost for 5 UK scenarios: patio slab / path / fence-post bases / shed base / driveway.",
  icon: Container,

  tradeAllowlist: [
    "general-builder",
    "groundworker",
    "concrete-supplier",
    "driveway-specialist",
    "landscape-gardener",
    "fencer"
  ] as const,

  autoInstallOnService: [
    "concrete",
    "concreting",
    "concrete-slab",
    "patio-slab",
    "concrete-path",
    "driveway-concrete",
    "shed-base",
    "fence-post-base",
    "post-concrete",
    "postcrete",
    "groundworks",
    "slab-laying"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcConcreteAppSize =
  (typeof CALC_CONCRETE_APP_MANIFEST)["supportedSizes"][number];
