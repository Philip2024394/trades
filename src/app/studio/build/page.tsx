// Studio Builder — split-pane AI app builder.
//
// Left pane:  prompt input → pipeline timeline → chat refinement
// Right pane: live iframe preview of the composed plan
//
// This is the Lovable-shaped experience: type what you want, watch
// the AI build it in real time. Composition runs at
// /api/studio/ai/pipeline-v2, preview iframe renders
// /studio/build/preview.
//
// Auth: cookie-based Studio session.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { StudioBuilderShell } from "@/components/studio/builder/StudioBuilderShell";

export const dynamic = "force-dynamic";

export default async function StudioBuildPage({
  searchParams
}: {
  searchParams: Promise<{ prompt?: string; trade?: string }>;
}) {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");

  const sp = await searchParams;
  const initialPrompt = typeof sp.prompt === "string" ? sp.prompt : "";
  const initialTrade = typeof sp.trade === "string" ? sp.trade : "";

  return (
    <StudioBuilderShell
      brandId={session.brand.id}
      trades={TRADE_OFF_TRADES.map((t) => ({ slug: t.slug, label: t.label }))}
      initialPrompt={initialPrompt}
      initialTrade={initialTrade}
    />
  );
}
