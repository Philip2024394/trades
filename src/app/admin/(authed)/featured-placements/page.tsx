// /admin/featured-placements — Featured Placement manager.
//
// Admin manually adds/removes featured slots today. Stripe purchase
// flow wires in later without touching this page (the "purchased"
// rows land in the same table with billing_source='stripe').

import type { Metadata } from "next";
import { recentPlacements, SEATS_PER_CATEGORY } from "@/lib/featuredPlacements";
import { AdminFeaturedPlacementsShell } from "./AdminFeaturedPlacementsShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Featured Placements | Admin",
  robots: { index: false, follow: false }
};

export default async function AdminFeaturedPlacementsPage() {
  const placements = await recentPlacements(120);
  return (
    <AdminFeaturedPlacementsShell
      initialPlacements={placements}
      seatsPerCategory={SEATS_PER_CATEGORY}
    />
  );
}
