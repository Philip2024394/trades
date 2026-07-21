// /trade-off/edit/[slug]/trust-ladder — the full ladder view.
//
// Merchants land here from the dashboard TrustLadderPanel's
// "Full ladder →" button. Shows all 4 tiers, every criterion
// with its status, direct action buttons, and the two paid
// upgrade paths (skip-queue £4.99, custom badge £2.99).

import { redirect, notFound } from "next/navigation";
import { getMerchantSlug } from "@/lib/merchantSession";
import { TrustLadderFullView } from "./TrustLadderFullView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trust ladder — Thenetworkers",
  description: "Climb Bronze → Silver → Gold → Platinum. Every step unlocks real perks."
};

export default async function TrustLadderPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getMerchantSlug();
  if (!auth) redirect("/trade-off/signup");
  if (auth !== slug) notFound();
  return <TrustLadderFullView slug={slug} />;
}
