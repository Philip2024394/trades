// Affiliate dashboard — Social tracker.
//
// Stores affiliate-claimed social links so the Phase-2 cron can later
// poll each URL for HTTP status. For now status defaults to 'active'.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SocialTrackerForm } from "./SocialTrackerForm";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

export default async function AffiliateSocialPage() {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;

  const { data: links } = await supabaseAdmin
    .from("hammerex_affiliate_social_links")
    .select("id, platform, url, status, last_checked_at, created_at")
    .eq("affiliate_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Social tracker
        </h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Log the posts, pages, or videos where you&apos;ve placed your
          affiliate link. Phase 2 will auto-check each URL is still live.
        </p>
      </header>

      <PageExplainer
        title="Where you've posted your links"
        description="Save the URL of every post where you shared your referral link. We check weekly that they're still live. If your post gets deleted, you'll know — and we'll show you which platforms are working best."
        steps={[
          "Post your link on Facebook, Instagram, TikTok etc.",
          "Copy the URL of your post",
          "Add it here with the platform",
          "Watch the status — green = live, red = deleted"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Add each public post URL below. Use the platform dropdown so we can
        group your wins by channel later.
      </p>

      <SocialTrackerForm initialLinks={links ?? []} />
    </div>
  );
}
