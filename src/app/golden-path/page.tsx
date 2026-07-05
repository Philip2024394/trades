// Golden Path Demo — /golden-path
//
// End-to-end proof of the flywheel for Phil's Carpentry (Dublin, IE).
// One business, one goal: prove that a tradesperson would happily pay
// for what this platform produces.
//
// Every panel on this page is generated from real registry data +
// composers + the coach. Nothing is hand-authored for the demo.

import type { Metadata } from "next";
import "@/platform/business";     // side-effect: register profile/strategy/recipes/trades/evidence/patterns/playbooks
import "@/platform/content";      // side-effect: register composers
import "@/platform/coach";        // side-effect: register recommendations
import {
  composePhilManifest,
  PHIL_PROFILE_SLUG,
  PHIL_STRATEGY_SLUG,
  PHIL_RECIPE_SLUG,
  resolvePhilStrategy,
  scenarioAfter,
  scenarioBefore,
  PHIL_PROJECTS_AFTER,
  PHIL_PROJECTS_BEFORE
} from "@/platform/goldenPath";
import { GoldenPathDemo } from "./GoldenPathDemo";

export const metadata: Metadata = {
  title: "Golden Path — Phil's Carpentry",
  description:
    "End-to-end proof: what the Xrated Trades platform produces for one real business.",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function GoldenPathPage() {
  const strategy = resolvePhilStrategy();
  const before = scenarioBefore(strategy);
  const after = scenarioAfter(strategy);

  const [manifestBefore, manifestAfter] = await Promise.all([
    composePhilManifest(strategy, PHIL_PROJECTS_BEFORE),
    composePhilManifest(strategy, PHIL_PROJECTS_AFTER)
  ]);

  return (
    <GoldenPathDemo
      profileSlug={PHIL_PROFILE_SLUG}
      strategySlug={PHIL_STRATEGY_SLUG}
      recipeSlug={PHIL_RECIPE_SLUG}
      strategyDescribe={strategy.describe()}
      manifestBefore={manifestBefore}
      manifestAfter={manifestAfter}
      coachBefore={{
        projectCount: before.projectCount ?? 0,
        reviewCount: before.reviewCount ?? 0,
        certificationsHeld: before.certificationsHeld ?? [],
        lastStrategyReviewAt: before.lastStrategyReviewAt ?? null
      }}
      coachAfter={{
        projectCount: after.projectCount ?? 0,
        reviewCount: after.reviewCount ?? 0,
        certificationsHeld: after.certificationsHeld ?? [],
        lastStrategyReviewAt: after.lastStrategyReviewAt ?? null
      }}
    />
  );
}
