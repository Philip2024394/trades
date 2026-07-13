// /trade-off/yard/canteens/new — canteen creation form.
//
// The "Start a Canteen" CTA on the index routes here. The form is a
// thin client shell over POST /api/canteens/create. Anonymous callers
// see an inline nudge to log in (the endpoint itself 401s anyway).

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { CanteenCreateShell } from "./CanteenCreateShell";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CREAM = "#FBF6EC";

export const metadata: Metadata = {
  title: "Start a Canteen | The Network",
  description:
    "Start a trade-specific corner of The Yard. Pick a trade, name it, invite your first crew. Free to run.",
  alternates: { canonical: "/trade-off/yard/canteens/new" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Start a Canteen",
    description: "Pick a trade, name the canteen, invite your first crew.",
    url: absolute("/trade-off/yard/canteens/new")
  }
};

export default function CanteenNewPage() {
  const trades = TRADE_OFF_TRADES.map((t) => ({ slug: t.slug, label: t.label }));

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <XratedHeader/>
      <CanteenCreateShell trades={trades}/>
    </main>
  );
}
