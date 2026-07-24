// /nex — the conversational surface. Merchants type or say what they
// want; Nex resolves intent + invokes the right Studio or edit path.
//
// Opening isn't a stateless greeting. It's the daily briefing:
// time-of-day greeting, then observations Nex noticed (pending reviews,
// posts awaiting approval, scheduled posts due, gallery gap, stale
// knowledge). Feels like walking into your office.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NexChat } from "@/components/nex/NexChat";
import { buildDailyBriefing, briefingToSpeech } from "@/lib/nex/briefing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nex", robots: { index: false } };

export default async function NexPage() {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("nex_last_seen_at")
    .eq("slug", session.merchant.slug)
    .maybeSingle();

  const briefing = await buildDailyBriefing({
    firstName:    session.merchant.display_name,
    lastSeenAt:   listing?.nex_last_seen_at ?? null,
    merchantSlug: session.merchant.slug
  });

  return (
    <NexChat
      merchantName={session.merchant.display_name}
      greeting={briefingToSpeech(briefing)}
      briefing={briefing.bullets.length > 0 ? `${briefing.signals.length} thing${briefing.signals.length === 1 ? "" : "s"} noticed` : null}
      signals={briefing.signals}
    />
  );
}
