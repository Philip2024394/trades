// /studio/social — merchant social hub.
// Connected accounts, auto-publish toggle, posts awaiting approval,
// scheduled + published.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listAccounts } from "@/lib/nex/social";
import { SocialHub } from "@/components/nex/SocialHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social · Studio", robots: { index: false } };

export default async function Page() {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");

  const [{ data: posts }, accounts, { data: merchant }] = await Promise.all([
    supabaseAdmin
      .from("hammerex_nex_social_posts")
      .select("*")
      .eq("merchant_slug", session.merchant.slug)
      .order("created_at", { ascending: false })
      .limit(50),
    listAccounts(session.merchant.slug),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("timezone, auto_publish_enabled, auto_publish_agreed_at")
      .eq("slug", session.merchant.slug)
      .maybeSingle()
  ]);

  return (
    <SocialHub
      merchantName={session.merchant.display_name}
      posts={posts ?? []}
      accounts={accounts}
      timezone={merchant?.timezone ?? "Europe/London"}
      autoPublish={Boolean(merchant?.auto_publish_enabled)}
    />
  );
}
