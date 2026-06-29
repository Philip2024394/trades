// Affiliate dashboard — white-label landing pages.
//
// List + create + delete. Edit is inline (click → form). Each page is
// published at /affiliates/by/<affiliate_id>/<slug>.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LandingPagesClient } from "./LandingPagesClient";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

type Page = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cta_text: string;
  hero_image_url: string | null;
  body_markdown: string | null;
  created_at: string;
  updated_at: string;
};

export default async function LandingPagesIndex() {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;

  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_landing_pages")
    .select("*")
    .eq("affiliate_id", id)
    .order("created_at", { ascending: false });
  const pages = (data ?? []) as Page[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Landing pages</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Build your own landing pages at{" "}
          <code className="text-brand-accent">/affiliates/by/{id}/&lt;slug&gt;</code>{" "}
          — your referral cookie drops automatically on every visit.
        </p>
      </header>

      <PageExplainer
        title="Your own xratedtrade.com mini-pages"
        description={
          <>
            Make your own landing page on a public URL like{" "}
            <code className="font-mono">
              xratedtrade.com/affiliates/by/{id}/&lt;your-slug&gt;
            </code>
            . Write your own pitch, link to whatever resonates with your
            audience. Every visit drops the referral cookie automatically.
          </>
        }
        steps={[
          "Click 'New landing page'",
          "Pick a slug like 'plumber-deals'",
          "Write your headline and pitch in plain English",
          "Share the URL — visits stamp your referral"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Each landing page is public — anyone with the URL can read it.
        Visits automatically count as referrals for the 30-day cookie
        window.
      </p>

      <LandingPagesClient affiliateId={id} initial={pages} />
    </div>
  );
}
