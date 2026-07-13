// /trade-off/sell — the "how do I sell?" hub.
//
// Consolidates two previously-orphan sell paths:
//   1. Merchant storefront (shop-mode, permanent product catalogue)
//   2. Yard marketplace (one-off tools-sell / materials-surplus posts)
//
// A trade landing here sees BOTH cards, but the one recommended for
// their trade type is highlighted first — merchant-grade trades (kitchen
// fitters, plant hire, building merchants, tool hire) get the
// storefront recommendation; service trades get the Yard one.
//
// The auth surface handles all three states:
//   • No magic-link → nudge to sign in from the dashboard
//   • Magic-link → shows both cards with recommendation highlight
//   • Session cookie fallback (future) — will use loadTradeSession
//     to identify the trade without requiring URL params.

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  ArrowRight,
  Store,
  ShoppingBag,
  Info,
  CheckCircle2,
  Rocket
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";
import { isMerchantGradeTrade, tradeLabel } from "@/lib/tradeOff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sell products or services · The Construction Notebook",
  description:
    "Two ways to sell on the network — a permanent storefront or a one-off Yard listing. Pick the one that fits.",
  robots: { index: false, follow: false }
};

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function SellHubPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const slug = readParam(sp.slug);
  const token = readParam(sp.token);

  let listing: {
    id: string;
    slug: string;
    display_name: string;
    primary_trade: string;
    tier: string | null;
    edit_token: string;
    status: string;
  } | null = null;
  let effectiveToken = token;

  if (slug && token) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, primary_trade, tier, edit_token, status")
      .eq("slug", slug)
      .maybeSingle();
    if (
      data &&
      data.status === "live" &&
      constantTimeEq(data.edit_token, token)
    ) {
      listing = data;
    }
  }

  // Session-cookie fallback — same HMAC-signed cookie the /edit dashboard
  // uses. Trades signed in via cookie get the hub without needing URL
  // params.
  if (!listing) {
    const jar = await cookies();
    const raw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
    const session = verifyTradeSession(raw);
    if (session) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, display_name, primary_trade, tier, edit_token, status")
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data && data.status === "live") {
        listing = data;
        effectiveToken = data.edit_token;
      }
    }
  }

  const isMerchant = listing
    ? isMerchantGradeTrade(listing.primary_trade)
    : false;

  const shopHref = listing
    ? `/trade-off/edit/${listing.slug}/shop-mode?token=${encodeURIComponent(effectiveToken)}`
    : "/join/start";
  const yardHref = listing
    ? `/trade-off/yard/compose?slug=${encodeURIComponent(listing.slug)}&token=${encodeURIComponent(effectiveToken)}&kind=tools-sell`
    : "/join/start";

  return (
    <main className="min-h-screen bg-[#FBF6EC] pb-24 pt-6 text-[#1B1A17] md:pt-10">
      <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={listing ? `/trade-off/edit/${slug}?token=${encodeURIComponent(effectiveToken)}` : "/"}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            ← Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <ShoppingBag className="h-3 w-3" aria-hidden />
            Sell products or services
          </span>
        </div>

        <h1 className="text-[30px] font-black leading-tight tracking-tight md:text-[42px]">
          What are you selling?
        </h1>
        <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.55] text-[#1B1A17]/70 md:text-[16px]">
          Two paths. One is a permanent storefront that lives on your
          profile forever. The other is a one-off Yard listing that
          reaches the whole marketplace and auto-expires after 14 days.
          Pick the one that matches what you&apos;re selling.
        </p>

        {!listing && (
          <div
            className="mt-6 flex items-start gap-3 rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,179,0,0.4)",
              background: "#FFF7E0"
            }}
          >
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              aria-hidden
            />
            <div>
              <p className="text-[13.5px] font-black text-[#1B1A17]">
                Sign in from your dashboard to unlock selling.
              </p>
              <p className="mt-1 text-[12px] leading-[1.5] text-[#1B1A17]/70">
                Grab your magic link from your dashboard email or from
                your existing session. Both options below require a
                signed-in trade listing.
              </p>
              <Link
                href="/trade-off/login?next=/trade-off/sell"
                className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-black text-neutral-900 hover:bg-amber-300"
              >
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        )}

        {listing && (
          <div className="mt-4 rounded-2xl border border-[#1B1A17]/10 bg-white px-4 py-2 text-[12px] font-semibold text-[#1B1A17]/60">
            Signed in as <b className="text-[#1B1A17]/85">{listing.display_name}</b>
            {" · "}
            {tradeLabel(listing.primary_trade)}
            {isMerchant && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                Merchant grade
              </span>
            )}
          </div>
        )}

        {/* Two paths */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SellCard
            recommended={isMerchant}
            icon={<Store className="h-5 w-5" aria-hidden />}
            eyebrow="Storefront"
            title="Products & shop"
            body="A permanent product catalogue on your profile. Categories, stock, delivery zones, bulk tiers, checkout via WhatsApp. Best for merchants, hire yards, and trades selling from an inventory."
            bullets={[
              "Lives on your public profile forever",
              "Full commerce controls (stock, bulk, delivery)",
              "Products auto-index to Google via your subdomain",
              "Ideal for repeat customers"
            ]}
            cta="Open Products & shop"
            href={shopHref}
            disabled={!listing}
          />
          <SellCard
            recommended={!isMerchant && !!listing}
            icon={<Rocket className="h-5 w-5" aria-hidden />}
            eyebrow="One-off listing"
            title="Sell on The Yard"
            body="A single tool, surplus material, or day-hire spot. Posts to the trades-only marketplace, auto-expires after 14 days. Best for service trades clearing inventory or advertising a specific item."
            bullets={[
              "Photo + price + condition + delivery in one form",
              "Boostable to the top of the Yard for £2/24h",
              "Shows on your profile until it expires",
              "No permanent inventory to maintain"
            ]}
            cta="Post to The Yard"
            href={yardHref}
            disabled={!listing}
          />
        </div>

        {/* Guidance footer */}
        <section
          className="mt-8 rounded-2xl border p-5"
          style={{
            borderColor: "rgba(27,26,23,0.10)",
            background: "white"
          }}
        >
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[#1B1A17]/60"
              aria-hidden
            />
            <div>
              <p className="text-[13px] font-black text-[#1B1A17]">
                Not sure which fits?
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[#1B1A17]/70">
                If you sell the same items regularly (nails, boards,
                paint, hire kits): <b>Storefront</b>. If you have
                one-off surplus, second-hand tools, or want to test
                the market: <b>The Yard</b>. Both are free to list —
                only Yard boosts are paid.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SellCard({
  recommended,
  icon,
  eyebrow,
  title,
  body,
  bullets,
  cta,
  href,
  disabled
}: {
  recommended: boolean;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  cta: string;
  href: string;
  disabled?: boolean;
}) {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white p-5 shadow-sm"
      style={{
        borderColor: recommended ? "#FFB300" : "rgba(27,26,23,0.10)",
        background: recommended
          ? "linear-gradient(180deg, #FFF7E0 0%, #FFFFFF 40%)"
          : "white"
      }}
    >
      {recommended && (
        <span
          className="absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-900 shadow-sm"
          style={{ background: "#FFB300" }}
        >
          Recommended for you
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-900 shadow-sm"
          style={{ background: "#FFB300" }}
        >
          {icon}
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.20em] text-amber-700">
            {eyebrow}
          </p>
          <h2 className="text-[18px] font-black leading-tight text-[#1B1A17]">
            {title}
          </h2>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-[1.55] text-[#1B1A17]/75">
        {body}
      </p>
      <ul className="mt-4 space-y-1.5">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-[12.5px] leading-[1.45] text-[#1B1A17]/85"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex-1" />
      <Link
        href={href}
        aria-disabled={disabled}
        className="inline-flex min-h-[44px] items-center justify-between gap-2 rounded-full px-5 text-[13px] font-black shadow-sm transition active:scale-[0.98]"
        style={{
          background: disabled ? "rgba(27,26,23,0.08)" : "#FFB300",
          color: "#0A0A0A",
          pointerEvents: disabled ? "none" : "auto",
          opacity: disabled ? 0.6 : 1
        }}
      >
        {cta}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </article>
  );
}
