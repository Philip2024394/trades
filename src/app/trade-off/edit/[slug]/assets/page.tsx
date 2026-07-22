// /trade-off/edit/[slug]/assets — Merchant free print collateral.
//
// Three tabs: Site Poster · Google Review · Business Card.
// Each tab: pick template → enter headline → generate → download PDF.
// Shows scan + download counters per asset. Upsells:
//   • £2.99 to remove "Powered by The Networkers" footer
//   • £1.99 to skip 30-day refresh cooldown
//   • Scan analytics chart gated to Pro+ (£14.99/mo Pro tier)

import { redirect, notFound } from "next/navigation";
import { getMerchantSlug } from "@/lib/merchantSession";
import { AssetsShell } from "./AssetsShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Free print assets — Thenetworkers",
  description: "Site posters, Google review cards, business cards. Free. Ready to print."
};

export default async function AssetsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getMerchantSlug();
  if (!auth) redirect("/trade-off/signup");
  if (auth !== slug) notFound();
  return <AssetsShell slug={slug} />;
}
