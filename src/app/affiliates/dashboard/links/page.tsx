// Affiliate dashboard — Link generator.
//
// Server shell + client form that appends ?ref=N to any
// xratedtrade.com URL. Provides quick-link buttons for the most
// commonly shared pages.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { LinkGeneratorForm } from "./LinkGeneratorForm";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

export default async function AffiliateLinksPage() {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Link generator
        </h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Build a referral link for any page on xratedtrade.com. Your
          affiliate ID is appended automatically.
        </p>
      </header>

      <PageExplainer
        title="Make a custom link for any page"
        description="Your main referral link sends people to the homepage. But sometimes you want to point them at a specific page — pricing, the showcase, a particular trade demo. This page stamps your referral code onto any URL."
        steps={[
          "Paste any xratedtrade.com URL",
          "Click Generate",
          "Copy the result",
          "Share it — the cookie still works for 30 days"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Tip: use the Quick links below for the most-shared pages, or paste
        your own URL into the input above.
      </p>

      <LinkGeneratorForm affiliateId={session.affiliate_id} />
    </div>
  );
}
