// /trade-off/yard/canteens/[slug]/first-products
//
// Runs immediately after canteen creation. Three tiny product cards so
// the merchant seeds their canteen (and Trade Center) with something
// before their first visitor lands. Name + price only — anything more
// gets in the way of getting to "live". Skip button routes to the
// canteen page unchanged.

import { FirstProductsShell } from "./FirstProductsShell";

export const dynamic = "force-dynamic";

export default async function FirstProductsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <FirstProductsShell slug={slug}/>;
}
