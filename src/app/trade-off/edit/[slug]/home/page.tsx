// /trade-off/edit/[slug]/home — the merchant launchpad.
//
// Facebook-easy dashboard home. Every part of the platform is
// reachable in one tap from here. Reads /api/merchant/dashboard/
// summary in a single round-trip so the page paints fast.
//
// Server component just does auth + slug ownership + kicks the
// client shell. All the interactive tiles live in the client
// component so we can hydrate the summary via SWR and refresh
// on focus without a full page reload.

import { redirect, notFound } from "next/navigation";
import { getMerchantSlug } from "@/lib/merchantSession";
import { HomeLaunchpad } from "./HomeLaunchpad";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Thenetworkers",
  description: "Your Networkers home — wallet, inbox, growth, and every tool in one tap."
};

export default async function MerchantHomePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getMerchantSlug();
  if (!auth) redirect("/trade-off/signup");
  if (auth !== slug) notFound();
  return <HomeLaunchpad slug={slug} />;
}
