// Project Cost — the first SiteBook app.
//
// Rollup tile per active project showing agreed / paid / outstanding
// plus an "Activated" chip when a quote/invoice document is attached.
// Sits in the right rail. Click a project → opens the Cost Ledger
// view (once the Cost Ledger app is installed).
//
// Free. Non-default; homeowners install it from the App Store once
// their first quote lands.

import type { SiteBookAppManifest } from "../_shared/manifest";

const manifest: SiteBookAppManifest = {
  slug:            "project-cost",
  name:            "Project Cost",
  shortName:       "Cost",
  description:     "See what each project has cost so far, who's owed what, and when payments are due.",
  longDescription:
    "A private rollup for every active project. Log agreed prices from any post; the tile shows paid vs agreed with a status chip. When you attach a quote or invoice, an Activated badge appears so you can see at a glance which projects are properly tracked. Pairs with the Cost Ledger app for full payment history.",
  icon:            "Wallet",
  brandColour:     "#F59E0B",
  category:        "money",
  cost:            { kind: "free" },
  defaultInstalled: false,

  slots: [
    { slot: "right-rail", order: 20 }
  ],

  badges: ["Free"]
};

export default manifest;
