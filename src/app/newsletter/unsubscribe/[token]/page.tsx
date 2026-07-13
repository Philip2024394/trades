// xratedtrade.com — Newsletter unsubscribe (public, no auth).
//
// Reachable via the per-subscriber unsubscribe URL the merchant
// includes in every marketing email. Looks up the subscriber by the
// unsubscribe_token (uuid) and shows a single-click confirm button
// that hits /api/trade-off/newsletter/unsubscribe.
//
// PECR / GDPR Article 21(2)+(3) — unsubscribe must be effective
// immediately, single-click, no login. This page satisfies the rule
// by showing exactly one button (Confirm) and toasting a success
// state on the same URL.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NewsletterUnsubscribeConfirm } from "./NewsletterUnsubscribeConfirm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe | The Network",
  robots: { index: false, follow: false }
};

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type Params = Promise<{ token: string }>;

export default async function NewsletterUnsubscribePage({
  params
}: {
  params: Params;
}) {
  const { token } = await params;

  if (!token || !UUID_RE.test(token)) {
    return <InvalidLink />;
  }

  const row = await supabaseAdmin
    .from("hammerex_xrated_newsletter_subscribers")
    .select("id, email, status, listing_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!row.data) return <InvalidLink />;

  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, slug")
    .eq("id", row.data.listing_id)
    .maybeSingle();
  const merchantName = listingRes.data?.display_name ?? "this merchant";

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Newsletter
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          Unsubscribe from {merchantName}
        </h1>
        <p className="mt-4 text-[13px] text-brand-muted">
          We&rsquo;ll stop sending marketing emails to{" "}
          <span className="font-semibold text-brand-text">{row.data.email}</span>{" "}
          from {merchantName} as soon as you tap confirm.
        </p>
        <div className="mt-6">
          <NewsletterUnsubscribeConfirm
            token={token}
            merchantName={merchantName}
            alreadyUnsubscribed={row.data.status !== "active"}
          />
        </div>
        <p className="mt-6 text-[12px] text-brand-muted">
          Subscribed by mistake? You can resubscribe any time from{" "}
          {listingRes.data?.slug ? (
            <a
              href={`/${listingRes.data.slug}`}
              className="font-semibold text-brand-accent underline-offset-4 hover:underline"
            >
              {merchantName}&rsquo;s profile
            </a>
          ) : (
            <>their profile</>
          )}
          .
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}

function InvalidLink() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          xratedtrade.com
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This unsubscribe link is invalid or has expired.
        </h1>
        <p className="mt-4 text-[13px] text-brand-muted">
          Use the unsubscribe link in the most recent marketing email you
          received &mdash; older links may be expired.
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}
