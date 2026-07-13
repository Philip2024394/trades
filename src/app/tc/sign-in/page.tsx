// /tc/sign-in — deprecated, redirects to the canonical /sign-in.
// Preserves any incoming ?next= param + hints the customer flow (Trade
// Center buyers are almost always homeowners/DIYers).
//
// Edit /sign-in for real customer-side sign-in changes.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TcSignInRedirect({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  const params = new URLSearchParams();
  params.set("role", "customer");
  if (next) params.set("next", next);
  redirect(`/sign-in?${params.toString()}`);
}
