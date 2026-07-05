// Phil's Carpentry — the actual composed website rendered as a real
// browsable page. This is the "here's what the platform designed"
// answer to the merchant-experience question the Golden Path raises.
//
// Everything on this page comes from the same ContentManifest the
// Golden Path demo shows — no hand-authored demo copy.

import type { Metadata } from "next";
import "@/platform/business";
import "@/platform/content";
import {
  composePhilManifest,
  PHIL_PROJECTS_AFTER,
  resolvePhilStrategy
} from "@/platform/goldenPath";
import { PhilsSite } from "./PhilsSite";

export const metadata: Metadata = {
  title: "Phil's Carpentry, Dublin",
  description: "Fully composed trade website — Golden Path preview.",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function PhilsSitePreviewPage() {
  const strategy = resolvePhilStrategy();
  // Use the "after" projects — the demo works best when the site
  // actually shows completed case studies.
  const manifest = await composePhilManifest(strategy, PHIL_PROJECTS_AFTER);
  return <PhilsSite manifest={manifest} />;
}
