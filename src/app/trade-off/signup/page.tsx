// /trade-off/signup — deprecated, redirects to the canonical /join.
// Preserves any incoming query params so onboarding-nudge links keep
// their context (voucher codes, referrer, etc.).
//
// Edit /join for real signup landing changes. The actual multi-step
// signup wizard still lives at /trade-off/signup/wizard — /join links
// to it as the "Get started" primary CTA.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TradeSignupRedirect({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
    else if (Array.isArray(v) && v[0]) params.set(k, v[0]);
  }
  const qs = params.toString();
  redirect(`/join${qs ? `?${qs}` : ""}`);
}
