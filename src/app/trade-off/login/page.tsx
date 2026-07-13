// /trade-off/login — deprecated, redirects to the canonical /sign-in.
//
// Kept as a redirect so any bookmarked/emailed links from before the
// consolidation still land the merchant on the right page. Preserves
// the `?next=` param + copies `role=merchant` so the tab opens on
// the merchant flow automatically.
//
// If you're editing merchant login logic, edit /sign-in — this file
// is only a redirect.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TradeOffLoginRedirect({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  const params = new URLSearchParams();
  params.set("role", "merchant");
  if (next) params.set("next", next);
  redirect(`/sign-in?${params.toString()}`);
}
