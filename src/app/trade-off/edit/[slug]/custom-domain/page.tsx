// Hammerex Trade Off — Custom Domain editor.
//
// Server shell. Validates the magic-link edit_token, loads the
// listing's domain state + paid tier, and hands them to the
// <CustomDomainEditor> client island.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { effectiveTier } from "@/lib/xratedTrades";
import { isVercelConfigured } from "@/lib/vercelDomains";
import { CustomDomainEditor } from "@/components/trade-off/CustomDomainEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Custom Domain | Hammerex Trade Off",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffCustomDomainEditPage({
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
    .select(
      "id, slug, edit_token, display_name, tier, trial_expires_at, custom_domain, custom_domain_status, custom_domain_verification, custom_domain_last_error"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid";

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(
    slug
  )}&token=${encodeURIComponent(token)}`;
  const backHref = `/trade-off/edit/${encodeURIComponent(
    slug
  )}?token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
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
          Add-on &middot; Custom Domain
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Custom Domain
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          Use your own domain (e.g. <code>yourtrade.co.uk</code>) for your
          Xrated profile. Free first 30 days, then £5/mo.
        </p>
      </section>

      <CustomDomainEditor
        slug={slug}
        editToken={token}
        initialDomain={row.data.custom_domain ?? null}
        initialStatus={
          (row.data.custom_domain_status as
            | "pending"
            | "dns_pending"
            | "verifying"
            | "live"
            | "ssl_failed"
            | "dns_lost"
            | "expired"
            | "disconnected"
            | "blocked"
            | null) ?? null
        }
        initialVerification={
          Array.isArray(row.data.custom_domain_verification)
            ? (row.data.custom_domain_verification as {
                type: string;
                domain: string;
                value: string;
                reason?: string;
              }[])
            : []
        }
        initialLastError={row.data.custom_domain_last_error ?? null}
        isPaidTier={isPaid}
        upgradeHref={upgradeHref}
        vercelConfigured={isVercelConfigured()}
      />

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Hammerex — I'm trying to set up Custom Domain but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Trade Off
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-xs text-brand-muted">
          The URL you used doesn&rsquo;t match a live profile. Double-check the
          link in your bookmarks &mdash; the token after <code>?token=</code> must
          be exact.
        </p>
        <p className="mt-2 text-[11px] text-brand-muted">Reference: {reason}</p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-xs font-bold text-white transition hover:opacity-90"
        >
          Message Hammerex on WhatsApp
        </a>
      </section>
      <XratedFooter />
    </main>
  );
}
