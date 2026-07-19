// /claim/[token] — public landing page where merchants land from the
// shadow-profile drip emails.
//
// Shows the pre-scraped record + a "Claim my profile" button that
// carries the token forward into the normal signup flow. On completion
// the shadow profile is flipped to 'claimed' and the reserved slug
// becomes the merchant's live URL.
//
// If the token doesn't match anything, show a friendly "not found"
// with a link to normal signup — never expose whether a specific
// token exists (token enumeration protection).

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tradeLabelFromSlug } from "@/lib/shadowMerchants/personalizer";
import type { ShadowMerchant } from "@/lib/shadowMerchants/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim your Thenetworkers profile",
  robots: { index: false, follow: false }
};

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export default async function ClaimPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await supabaseAdmin
    .from("hammerex_shadow_merchants")
    .select("*")
    .eq("claim_token", token)
    .maybeSingle();

  const merchant = res.data as ShadowMerchant | null;

  // Not-found: show a friendly fallback that DOES NOT confirm the token existed
  if (!merchant) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
        <XratedHeader/>
        <section className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-black text-neutral-900">This claim link is no longer active.</h1>
          <p className="mt-3 text-[14px] text-neutral-700">
            The link may have expired or the profile has already been claimed. You can still create a fresh profile — free forever, takes 60 seconds.
          </p>
          <Link
            href="/trade-off/signup"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            Start free →
          </Link>
        </section>
        <XratedFooter/>
      </main>
    );
  }

  // Already claimed → redirect visitor to the live profile
  if (merchant.status === "claimed" && merchant.reserved_slug) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
        <XratedHeader/>
        <section className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-black text-neutral-900">This profile is already live.</h1>
          <p className="mt-3 text-[14px] text-neutral-700">
            <Link href={`/${merchant.reserved_slug}`} className="font-black underline">View the live profile →</Link>
          </p>
        </section>
        <XratedFooter/>
      </main>
    );
  }

  const tradeLabel = tradeLabelFromSlug(merchant.trade_type);
  const cityCopy   = merchant.city ? ` in ${merchant.city}` : "";
  const yearsCopy  = merchant.years_established && merchant.years_established > 0
    ? ` · Established ${merchant.years_established} year${merchant.years_established === 1 ? "" : "s"}`
    : "";

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader/>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="rounded-3xl border-2 shadow-lg" style={{ borderColor: BRAND_YELLOW, backgroundColor: "#FFFFFF" }}>
          <div className="px-6 py-8 sm:px-10 sm:py-12">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: BRAND_YELLOW }}>
              Reserved for you
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-neutral-900 sm:text-4xl">
              {merchant.business_name}
            </h1>
            <p className="mt-2 text-[13px] text-neutral-600 sm:text-[14px]">
              Your reserved URL: <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-900">thenetworkers.app/{merchant.reserved_slug}</code>
            </p>
            <p className="mt-1 text-[12px] text-neutral-500">
              {tradeLabel}{cityCopy}{yearsCopy}
            </p>

            <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">What you get, free forever</p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-neutral-800">
                <li>✅ Your own live URL — <span className="font-black">thenetworkers.app/{merchant.reserved_slug}</span></li>
                <li>✅ Installable mobile app (PWA) — your brand, your customers' home screen</li>
                <li>✅ Community canteen page + The Yard feed access</li>
                <li>✅ 10,800 Google-indexed city × trade pages carrying your listing</li>
                <li>✅ Verified WhatsApp leads from £0.05 each — pay only when a customer contacts you</li>
                <li>✅ No card. No commission. No contract.</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={`/trade-off/signup?slug=${encodeURIComponent(merchant.reserved_slug)}&claim=${encodeURIComponent(token)}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-lg transition hover:brightness-95"
                style={{ backgroundColor: BRAND_YELLOW, boxShadow: `0 4px 20px ${BRAND_YELLOW}66` }}
              >
                Claim my profile — free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </a>
              <Link
                href={`/${merchant.reserved_slug}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-6 text-[12px] font-bold uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
              >
                Preview my URL
              </Link>
            </div>

            <p className="mt-5 text-[10.5px] leading-snug text-neutral-500">
              Not interested? <Link href={`/claim/${token}/unsubscribe`} className="underline">Unsubscribe here</Link> — we won&rsquo;t email you again.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-[11px] leading-snug text-neutral-500">
          We reserved this profile after finding your business on Companies House (public register). If you don&rsquo;t want us to reach out again, one click on the unsubscribe link above stops everything permanently.
        </p>
      </section>
      <XratedFooter/>
    </main>
  );
}
