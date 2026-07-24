// NEX Brain surface — universal Brain view.
//
// Route: /nex-app/brains/[brain_slug]
// Same code renders every Brain — only the config differs.
// Staircase is the first Brain (uses existing Staircase Trade content).
// Plumbing / Electrical / etc. slot in the same way once configured.

import { notFound } from "next/navigation";
import { loadTradeConfig, listAvailableTrades } from "@/lib/nex-apps/_config-loader";
import { ConversationStateProvider } from "@/components/nex-app/state/ConversationStateProvider";
import { AppShell } from "@/components/nex-app/shell/AppShell";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return listAvailableTrades().map((slug) => ({ brain_slug: slug }));
}

export default async function BrainPage({
  params
}: {
  params: Promise<{ brain_slug: string }>;
}) {
  const { brain_slug } = await params;
  const config = loadTradeConfig(brain_slug);
  if (!config) notFound();

  return (
    <ConversationStateProvider config={config}>
      <AppShell />
    </ConversationStateProvider>
  );
}
