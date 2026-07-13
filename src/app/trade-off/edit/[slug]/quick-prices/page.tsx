// /trade-off/edit/[slug]/quick-prices — 5-price onboarding.
//
// After a trade publishes, they land here (post-publish) or reach it
// from the drawer any time. We show a per-trade starter template
// (see src/lib/quickPriceTemplates.ts), pre-tagged with service
// categories so the moment the trade saves, the rows appear on
// matching product PDPs' "Independent local trades" strip.
//
// If the trade's primary_trade has no template mapping, we render a
// short empty-state pointing at the full taxonomy in the shop editor.

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { ArrowLeft, ArrowRight, DollarSign, Info } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";
import { tradeLabel } from "@/lib/tradeOff";
import { quickPricesFor } from "@/lib/quickPriceTemplates";
import { QuickPricesForm } from "./QuickPricesForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add 5 fixed prices · The Construction Notebook",
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
type RouteParams = Promise<{ slug: string }>;

function readParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function QuickPricesPage({
  params,
  searchParams
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const token = readParam(sp.token);

  let listing: {
    id: string;
    slug: string;
    display_name: string;
    primary_trade: string;
    edit_token: string;
  } | null = null;
  if (slug && token) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, primary_trade, edit_token, status")
      .eq("slug", slug)
      .maybeSingle();
    if (data && data.status === "live" && constantTimeEq(data.edit_token, token)) {
      listing = {
        id: data.id,
        slug: data.slug,
        display_name: data.display_name,
        primary_trade: data.primary_trade,
        edit_token: data.edit_token
      };
    }
  }
  if (!listing) {
    const jar = await cookies();
    const raw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
    const session = verifyTradeSession(raw);
    if (session) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, display_name, primary_trade, edit_token, status")
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data && data.status === "live" && data.slug === slug) {
        listing = {
          id: data.id,
          slug: data.slug,
          display_name: data.display_name,
          primary_trade: data.primary_trade,
          edit_token: data.edit_token
        };
      }
    }
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-[#FBF6EC] px-4 pt-16 text-[#1B1A17]">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-400/40 bg-[#FFF7E0] p-6">
          <p className="text-[14px] font-black text-[#1B1A17]">
            Sign in to add your quick prices.
          </p>
          <Link
            href={`/trade-off/login?next=/trade-off/edit/${encodeURIComponent(slug)}/quick-prices`}
            className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-black text-[#0A0A0A] hover:bg-amber-300"
          >
            Sign in
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </main>
    );
  }

  const template = quickPricesFor(listing.primary_trade);

  return (
    <main className="min-h-screen bg-[#FBF6EC] pb-24 pt-6 text-[#1B1A17] md:pt-10">
      <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/trade-off/edit/${encodeURIComponent(listing.slug)}?token=${encodeURIComponent(listing.edit_token)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
            <DollarSign className="h-3 w-3" aria-hidden />
            Quick prices
          </span>
        </div>

        <h1 className="text-[26px] font-black leading-tight tracking-tight md:text-[36px]">
          Get on the network in 60 seconds.
        </h1>
        <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.55] text-[#1B1A17]/70 md:text-[15px]">
          Add 5 fixed prices for {tradeLabel(listing.primary_trade)}. Each
          one auto-appears on any product page where a shopper might need
          that install — no manual pairing required. Edit any price
          before you save, or bin the ones that don&apos;t apply.
        </p>

        <div
          className="mt-4 flex items-start gap-3 rounded-2xl border p-4"
          style={{
            borderColor: "rgba(27,26,23,0.10)",
            background: "white"
          }}
        >
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[#1B1A17]/60"
            aria-hidden
          />
          <p className="text-[12.5px] leading-[1.5] text-[#1B1A17]/70">
            Starter prices are pulled from{" "}
            <b>UK cost-guide averages</b> published by Checkatrade,
            MyBuilder + HomeRewire (July 2026). Edit anything that
            doesn&apos;t match your region or overheads before saving.
          </p>
        </div>

        {template.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white px-6 py-10 text-center">
            <p className="text-[14px] font-black text-[#1B1A17]">
              No starter template for {tradeLabel(listing.primary_trade)} yet.
            </p>
            <p className="mt-2 text-[12.5px] text-[#1B1A17]/60">
              You can still add fixed-price services one at a time from
              the shop editor — they&apos;ll surface on product PDPs the
              same way.
            </p>
            <Link
              href={`/trade-off/edit/${encodeURIComponent(listing.slug)}/shop-mode?token=${encodeURIComponent(listing.edit_token)}`}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-black text-[#0A0A0A] hover:bg-amber-300"
            >
              Open shop editor
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <QuickPricesForm
              slug={listing.slug}
              editToken={listing.edit_token}
              template={template}
            />
          </div>
        )}
      </div>
    </main>
  );
}
