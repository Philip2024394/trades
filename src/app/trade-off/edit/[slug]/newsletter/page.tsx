// thenetworkers.app Trade Off — Newsletter subscribers editor.
//
// Server shell. Validates the magic-link edit_token, loads the
// listing's currently-active subscribers (capped at 1000 rows for
// the dashboard table — the CSV export endpoint goes wider) and
// renders the list with a per-row unsubscribe-link copy button + a
// one-click "Export CSV" download.
//
// Gated to merchant-grade trades — service trades get redirected back
// to the dashboard. The add-on toggle itself is gated by the
// AddOnsHub audience filter (so a service trade never sees the
// Newsletter tile in the first place) but we double-defend here.
//
// Model A: Xrated never sends emails. The dashboard help text spells
// this out so the merchant knows to paste the per-row unsubscribe URL
// into every email template they send via their own tool (Mailchimp,
// Brevo, etc) — PECR requires a working unsubscribe in every email.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { isMerchantGradeTrade } from "@/lib/tradeOff";
import { NewsletterSubscribersTable } from "@/components/trade-off/NewsletterSubscribersTable";
import type { HammerexXratedNewsletterSubscriber } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Newsletter subscribers | thenetworkers.app",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffNewsletterEditPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!slug || !token) return <InvalidLink reason="missing-token" />;

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token, display_name, primary_trade")
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  // Visibility gate — Newsletter is merchant-only.
  if (!isMerchantGradeTrade(row.data.primary_trade)) {
    redirect(
      `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}&msg=newsletter-merchant-only`
    );
  }

  const subsRes = await supabaseAdmin
    .from("hammerex_xrated_newsletter_subscribers")
    .select("*")
    .eq("listing_id", row.data.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1000);
  const subscribers = (subsRes.data ?? []) as HammerexXratedNewsletterSubscriber[];

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
  const exportHref = `/api/trade-off/newsletter/export?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-xs font-bold text-brand-muted transition hover:text-brand-accent"
        >
          &larr; Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Add-on &middot; Newsletter
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Newsletter subscribers &mdash; {subscribers.length} active
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          People who&rsquo;ve opted in from your public profile. Export the
          CSV and send updates with your own email tool &mdash; Mailchimp,
          Brevo, anything you already use.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-6">
        <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4">
          <p className="text-sm font-bold text-brand-accent">
            Required by law &mdash; PECR / UK GDPR
          </p>
          <p className="mt-1 text-[13px] text-brand-muted">
            Every marketing email you send must contain the per-subscriber
            unsubscribe URL from this list. Most email tools have a
            &ldquo;custom unsubscribe URL&rdquo; field per recipient &mdash;
            map it to the <code>unsubscribe_url</code> column in the CSV. We
            handle the click-through page at <code>/newsletter/unsubscribe/&lt;token&gt;</code>;
            your subscribers see your trading name and a single confirm
            button.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <NewsletterSubscribersTable
          slug={slug}
          subscribers={subscribers}
          exportHref={exportHref}
        />
      </section>

      <DashboardFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi thenetworkers.app — I'm trying to manage my newsletter subscribers but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          thenetworkers.app
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-xs text-brand-muted">
          The URL you used doesn&rsquo;t match a live profile. Double-check
          the link in your bookmarks &mdash; the token after{" "}
          <code>?token=</code> must be exact.
        </p>
        <p className="mt-2 text-[11px] text-brand-muted">Reference: {reason}</p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-xs font-bold text-white transition hover:opacity-90"
        >
          Message us on WhatsApp
        </a>
      </section>
      <DashboardFooter />
    </main>
  );
}
