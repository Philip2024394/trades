// /home/sign-in — deprecated, redirects to the canonical /sign-in with
// the customer role preselected. Preserves any incoming ?next= param.
//
// If you're editing customer sign-in, edit /sign-in — this file is
// only a redirect.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomeSignInRedirect({
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
