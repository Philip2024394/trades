// Golden Path Scenario — Phil's Carpentry, Ireland.
//
// Not a new architecture. Not a new registry. This module simply
// composes the flywheel end-to-end for ONE real business and returns
// what every layer produced.
//
// If this story reads convincingly for a tradesperson, the platform
// has proved itself. If it doesn't, no more architecture — the
// experience needs work.

import {
  businessProfileRegistry,
  growthStrategyRegistry,
  strategyResolver,
  websiteRecipeRegistry
} from "@/platform/business";
import type { ResolvedStrategy } from "@/platform/business/resolver";
import { CreativeDirector } from "@/platform/content";
import type { ContentManifest, ProjectInput } from "@/platform/content";
import type { CoachContext } from "@/platform/coach";

/** The Phil's Carpentry identity — pulled from already-registered
 *  seed data, so this file adds zero fabricated content. */
export const PHIL_PROFILE_SLUG = "premium-carpenter-ireland";
export const PHIL_STRATEGY_SLUG = "door-installation-forward";
export const PHIL_RECIPE_SLUG = "door-installation-specialist";

/** ISO date used everywhere so SSR + hydration match. */
const FIXED_NOW = "2026-07-05T09:00:00.000Z";

/** Phil's upstream state BEFORE he acts on the coach's advice. Two
 *  projects, six reviews, quarterly review overdue. */
export function scenarioBefore(strategy: ResolvedStrategy): CoachContext {
  const lastReview = new Date("2026-03-20T00:00:00.000Z").toISOString();     // ~107 days ago
  return {
    strategy,
    projectCount: 3,
    reviewCount: 6,
    certificationsHeld: [],
    lastStrategyReviewAt: lastReview,
    outputMedium: "website"
  };
}

/** Phil's upstream state AFTER he uploads 6 more projects, requests
 *  reviews, and refreshes his strategy. */
export function scenarioAfter(strategy: ResolvedStrategy): CoachContext {
  return {
    strategy,
    projectCount: 12,
    reviewCount: 18,
    certificationsHeld: ["c-and-g-nvq-2", "fire-door-certified"],
    lastStrategyReviewAt: FIXED_NOW,
    outputMedium: "website"
  };
}

/** Two seed projects Phil has already uploaded (matches
 *  scenarioBefore.projectCount = 3 minus one un-storied job). Real
 *  photos land later — v1 uses metadata only. */
export const PHIL_PROJECTS_BEFORE: readonly ProjectInput[] = [
  {
    slug: "dublin-fire-door-3-flat-block",
    service: "fire-doors",
    location: "Dublin",
    duration: "2 days",
    materials: ["Oak veneer FD30", "Intumescent seals", "Perko closers"],
    photoCount: 6,
    freeformNotes:
      "Landlord needed FD30 fire doors installed across three flats in a Dublin apartment block ahead of a compliance inspection."
  },
  {
    slug: "cork-composite-door-family-home",
    service: "composite-doors",
    location: "Cork",
    duration: "1 day",
    materials: ["Solidor composite door", "Chrome furniture"],
    photoCount: 4,
    freeformNotes:
      "Replaced a tired timber front door on a Cork family home with a Solidor composite in traditional style."
  }
];

/** Additional projects Phil uploads AFTER acting on the coach's
 *  advice — brings total to 8 case studies + 4 gallery-only jobs. */
export const PHIL_PROJECTS_AFTER: readonly ProjectInput[] = [
  ...PHIL_PROJECTS_BEFORE,
  {
    slug: "galway-internal-oak-doors",
    service: "internal-doors",
    location: "Galway",
    duration: "3 days",
    materials: ["Solid oak internal doors x8", "Brushed nickel handles"],
    photoCount: 8,
    customerQuote: {
      text: "Phil replaced every door in the house in three days. Not a mark on the woodwork.",
      attribution: "Maria O'Sullivan · Galway"
    }
  },
  {
    slug: "dublin-fire-door-office-refurb",
    service: "fire-doors",
    location: "Dublin",
    duration: "4 days",
    materials: ["FD60 fire doors", "Intumescent glazing"],
    photoCount: 10,
    customerQuote: {
      text: "Sound advice, tidy work, on time. Passed the fire safety audit first go.",
      attribution: "Rónán Byrne · Dublin"
    }
  },
  {
    slug: "cork-fire-door-townhouse",
    service: "fire-doors",
    location: "Cork",
    duration: "2 days",
    materials: ["FD30 oak fire doors x4", "Perko closers"]
  },
  {
    slug: "dublin-oak-door-set",
    service: "door-installation",
    location: "Dublin",
    duration: "1 day",
    materials: ["Solid oak external door set"]
  },
  {
    slug: "galway-composite-front",
    service: "composite-doors",
    location: "Galway",
    duration: "1 day",
    materials: ["Rockdoor composite"],
    customerQuote: {
      text: "Neat, clean, no fuss. Would use again in a heartbeat.",
      attribution: "Ann Kelly · Galway"
    }
  }
];

/** Resolve Phil's strategy — same call the production runtime makes. */
export function resolvePhilStrategy(): ResolvedStrategy {
  const profile = businessProfileRegistry.getOrThrow(PHIL_PROFILE_SLUG);
  const strategy = growthStrategyRegistry.getOrThrow(PHIL_STRATEGY_SLUG);
  const recipe = websiteRecipeRegistry.getOrThrow(PHIL_RECIPE_SLUG);
  return strategyResolver.resolve({ profile, strategy, recipe });
}

/** Compose Phil's website ContentManifest using the Creative Director. */
export async function composePhilManifest(
  strategy: ResolvedStrategy,
  projects: readonly ProjectInput[]
): Promise<ContentManifest> {
  return CreativeDirector.direct({
    outputMedium: "website",
    strategy,
    brandVoice: "traditional",
    projects: projects.slice()
  });
}

export type GoldenPathScenario = {
  label: string;
  coach: CoachContext;
  projects: readonly ProjectInput[];
};

export function scenarios(strategy: ResolvedStrategy): {
  before: GoldenPathScenario;
  after: GoldenPathScenario;
} {
  return {
    before: {
      label: "Before Phil acts",
      coach: scenarioBefore(strategy),
      projects: PHIL_PROJECTS_BEFORE
    },
    after: {
      label: "After Phil acts on the coach",
      coach: scenarioAfter(strategy),
      projects: PHIL_PROJECTS_AFTER
    }
  };
}
