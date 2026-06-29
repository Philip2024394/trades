// Hero status strip — sits directly below PremiumHero on the public
// profile page.
//
// Two modes:
//   1. If the tradesperson has set a `running_marquee` text in their
//      App Studio dashboard, render the existing animated RunningMarquee.
//   2. If `running_marquee` is empty, render PLAIN TEXT (no badge, no
//      dark strip — just a quiet inline sentence) summarising the
//      trade label, city, and current availability so the area is
//      never empty. User direction: "if no running text then show text
//      only no badge type".
//
// Server component. No client state — relies on `computeAvailability`
// for live status determination.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";
import {
  computeAvailability,
  type OperatingHours
} from "@/lib/availabilityStatus";
import { RunningMarquee } from "./RunningMarquee";

export function HeroStatusStrip({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const marqueeText = (listing.running_marquee ?? "").trim();
  const themeColor = listing.theme_color ?? "#FFB300";

  if (marqueeText.length > 0) {
    return <RunningMarquee text={marqueeText} themeColor={themeColor} />;
  }

  // Fallback — plain inline text. No background, no badge, no pill.
  // Single sentence. Each segment separated by a middle dot.
  const trade = tradeLabel(listing.primary_trade);
  const city = listing.city ?? "";
  const availability = computeAvailability(
    listing.accepting_jobs,
    (listing.operating_hours as OperatingHours | null) ?? null
  );

  const parts: string[] = [];
  if (availability.status === "available") {
    parts.push("Live now — replies usually within the hour");
  }
  parts.push(trade);
  if (city) parts.push(city);

  return (
    <p
      className="mx-auto max-w-5xl px-4 py-3 text-center text-[13px] text-neutral-600 sm:px-6 sm:text-sm"
      aria-label="Trade summary"
    >
      {parts.join(" · ")}
    </p>
  );
}
