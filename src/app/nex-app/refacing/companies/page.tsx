// /nex-app/refacing/companies · Staircase Refacing Trades directory (2026-08-13 · v2).
//
// Wired to the EXISTING NEX Centre feed via GET /api/nex/centre/feed?category=Staircase Refacing.
// No parallel data system · no parallel membership funnel · this is an acquisition
// channel INTO the existing Trade Center membership system per Philip 2026-08-13.
//
// Flow (all downstream stages use existing NEX infrastructure):
//   Discovered seed → unclaimed listing shown here → Claim CTA → existing claim
//   endpoint attaches the seed to a merchant account → existing membership offer →
//   existing Stripe checkout → existing merchant/member becomes paid trade member.
//
// The Claim CTA target `/nex-app/claim?listing_id=<slug>` is the AGREED canonical
// path for the shared claim endpoint. If the endpoint is not yet wired, tapping
// the CTA 404s honestly (never fake a claim).

import { Suspense } from "react";
import CompaniesClient from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Refacing · Companies near you",
  description: "Trusted staircase refacing companies. NEX shows local trades first, then rotates so every verified refacing trade gets a fair chance.",
};

export default function RefacingCompaniesPage() {
  return (
    <Suspense fallback={null}>
      <CompaniesClient />
    </Suspense>
  );
}
