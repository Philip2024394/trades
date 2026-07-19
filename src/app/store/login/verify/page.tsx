// /store/login/verify?token=X
//
// Server component that verifies the magic-link token, cross-checks
// the email against the memberships table (must still be active),
// sets the si-member cookie, and redirects to /store/browse. Any
// failure lands on the login page with an error param.

import { redirect } from "next/navigation";
import { verifyMagicToken } from "@/lib/storeMagicLink";
import { setMemberCookie } from "@/lib/storeMemberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function MagicLinkVerifyPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const p     = await searchParams;
  const token = p.token;
  if (!token) redirect("/store/login?error=missing-token");

  const parsed = verifyMagicToken(token);
  if (!parsed) redirect("/store/login?error=invalid-or-expired");

  // Re-verify active membership at redeem time (in case they cancelled
  // after the link was minted).
  const res = await supabaseAdmin
    .from("hammerex_store_memberships")
    .select("id, current_period_end, status")
    .eq("email",  parsed.email)
    .eq("status", "active")
    .maybeSingle();
  if (res.error || !res.data) {
    redirect("/store/login?error=inactive");
  }

  await setMemberCookie(parsed.email);
  redirect("/store/browse?welcome=1");
}
