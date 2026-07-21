// job-builder — App Warehouse manifest.
//
// Guided project wizard that turns "I want to build a driveway"
// into a persistent Job record. Trade-agnostic: reads job_type
// templates from hammerex_job_templates, uses matching pure
// calculator from src/lib/jobCalculators/<slug>.ts.
//
// Mount surfaces:
//   1. Video page — collapsible card at top of AI container
//   2. Trade canteen — installable App via Studio App Store
//   3. /plan — canonical standalone route
//   4. SiteBook — "Add job" flow (via the toggle strip)
//
// The Job record it creates becomes the primitive that every
// other plugin attaches to (materials, quotes, videos, trades,
// merchants, weather, journal, health).
//
// Distinct from calc-concrete: this is the guided flow that
// creates persistent, shareable, AI-enriched Jobs. calc-concrete
// is the quick one-shot calculator with no persistence.

import { Workflow } from "lucide-react";

export const JOB_BUILDER_APP_MANIFEST = {
  slug: "job-builder",
  name: "Job Builder",
  category: "workflow" as const,
  version: "0.1.0",
  description:
    "Guided project wizard. Homeowner picks project type, enters dimensions, answers a few questions → gets a full job spec with materials, cost, KB references, and one-click routing to nearby merchants + trades. Every job becomes a shareable record.",
  icon: Workflow,

  // Any trade that could win work through the guided flow can
  // install this on their canteen. When installed, homeowners
  // visiting that trade's canteen see the builder pre-filtered
  // to the trade's job_types — lead attribution locked to the
  // installing trade.
  tradeAllowlist: [
    "general-builder",
    "groundworker",
    "bricklayer",
    "concrete-specialist",
    "concrete-supplier",
    "driveway-installer",
    "roofer",
    "carpenter",
    "kitchen-fitter",
    "bathroom-fitter",
    "plasterer",
    "tiler"
  ] as const,

  // Job types this app can walk a user through — matches
  // hammerex_job_templates.slug values. Concrete is live; the
  // rest are placeholders that light up as calculators + KB
  // packs are added.
  supportedJobTypes: [
    "concrete"       // live
    // Coming: "decking", "roofing", "kitchen", "staircase",
    //         "plastering", "tiling", "flooring"
  ] as const,

  supportedSizes:      ["portrait", "square", "landscape"] as const,
  compact:             false,
  requiresProductFeed: false,

  // Tier gate — free for homeowners always. Trades install to
  // capture leads on their canteen; tier gate follows the
  // platform's tierCatalog rules:
  //   free tier    → view only, no install on own canteen
  //   starter+     → install on canteen, unlimited leads
  //   professional → install + priority placement in recommender
  tierGates: {
    view:            "public",
    installOnCanteen: "starter"
  } as const
} as const;

export type JobBuilderJobType =
  (typeof JOB_BUILDER_APP_MANIFEST)["supportedJobTypes"][number];
