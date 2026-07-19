// /claim/[token]/unsubscribe — one-click unsubscribe from the
// shadow-profile drip.
//
// Server component: performs the unsubscribe on GET so the recipient
// only has to click the email link. No form, no confirm, no dark
// pattern — one click and done. Adds to the suppression list.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:  "Unsubscribed — Thenetworkers",
  robots: { index: false, follow: false }
};

export default async function UnsubscribePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const merchantRes = await supabaseAdmin
    .from("hammerex_shadow_merchants")
    .select("id, email, business_name")
    .eq("claim_token", token)
    .maybeSingle();

  const merchant = merchantRes.data as { id: string; email: string | null; business_name: string } | null;

  if (merchant) {
    // Suppress the email + mark merchant suppressed
    if (merchant.email) {
      await supabaseAdmin
        .from("hammerex_shadow_suppression")
        .upsert(
          { email: merchant.email.toLowerCase(), reason: "unsubscribe" },
          { onConflict: "email" }
        );
    }

    await supabaseAdmin
      .from("hammerex_shadow_merchants")
      .update({ status: "suppressed" })
      .eq("id", merchant.id);

    await supabaseAdmin
      .from("hammerex_shadow_email_events")
      .insert({
        shadow_merchant_id: merchant.id,
        step_index:         0,
        event_type:         "unsubscribe",
        metadata:           { source: "one-click-unsubscribe" }
      });
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader/>
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-neutral-900">You&rsquo;re unsubscribed.</h1>
        <p className="mt-3 text-[14px] text-neutral-700">
          {merchant
            ? `Won't email ${merchant.business_name} again. Your profile reservation has been released.`
            : "This email address is on our permanent do-not-contact list."}
        </p>
        <p className="mt-6 text-[12px] text-neutral-500">
          Changed your mind? You can always <Link href="/trade-off/signup" className="underline">create a fresh profile</Link>.
        </p>
      </section>
      <XratedFooter/>
    </main>
  );
}
