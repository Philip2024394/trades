// /trade-off/yard/manage — the trade's own Yard posts, editable.
//
// Server-loads the trade's live posts (any kind), then hands them to a
// client-side manager that supports:
//   • Delete a post (with confirm)
//   • Archive / unarchive
//   • Quick "Boost" link to the paid boost flow
//   • Link to the public post detail
//
// Full-composer edit is deferred to v2 — the composer is create-only
// today. Delete + archive covers the "I posted the wrong thing" and
// "this sold" cases which are the two real user complaints.

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { Info, ArrowRight, Package } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";
import { tradeLabel } from "@/lib/tradeOff";
import { YardManageList, type ManagedPost } from "./YardManageList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage your Yard posts · The Construction Notebook",
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

export default async function YardManagePage({
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
  } | null = null;
  let effectiveToken = token;

  if (slug && token) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, primary_trade, edit_token, status")
      .eq("slug", slug)
      .maybeSingle();
    if (
      data &&
      data.status === "live" &&
      constantTimeEq(data.edit_token, token)
    ) {
      listing = {
        id: data.id,
        slug: data.slug,
        display_name: data.display_name,
        primary_trade: data.primary_trade
      };
    }
  }

  // Session-cookie fallback — signed HMAC cookie the dashboard uses.
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
      if (data && data.status === "live") {
        listing = {
          id: data.id,
          slug: data.slug,
          display_name: data.display_name,
          primary_trade: data.primary_trade
        };
        effectiveToken = data.edit_token;
      }
    }
  }

  let posts: ManagedPost[] = [];
  if (listing) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select(
        "id, kind, title, body, region, image_urls, product_price_pence, price_currency, condition, stock_qty, status, contact_count, comment_count, boost_count, is_boosted_until, created_at, expires_at"
      )
      .eq("listing_id", listing.id)
      .order("is_boosted_until", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(60);
    posts = (data ?? []).map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      body: p.body,
      region: p.region,
      imageUrl: p.image_urls?.[0] ?? null,
      pricePence: p.product_price_pence,
      currency: p.price_currency ?? null,
      condition: p.condition ?? null,
      stockQty: p.stock_qty ?? 0,
      status: p.status,
      contactCount: p.contact_count ?? 0,
      commentCount: p.comment_count ?? 0,
      boostCount: p.boost_count ?? 0,
      isBoostedUntil: p.is_boosted_until ?? null,
      createdAt: p.created_at,
      expiresAt: p.expires_at
    }));
  }

  return (
    <main className="min-h-screen bg-[#FBF6EC] pb-24 pt-6 text-[#1B1A17] md:pt-10">
      <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={
              listing
                ? `/trade-off/edit/${listing.slug}?token=${encodeURIComponent(effectiveToken)}`
                : "/"
            }
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            ← Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <Package className="h-3 w-3" aria-hidden />
            Your Yard posts
          </span>
        </div>

        <h1 className="text-[26px] font-black leading-tight tracking-tight md:text-[36px]">
          Your Yard posts.
        </h1>
        <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.55] text-[#1B1A17]/70 md:text-[15px]">
          Every live and archived post you&apos;ve made — with the
          controls to remove the wrong ones, archive things that
          sold, and boost the ones worth pushing.
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
                Sign in to manage your posts.
              </p>
              <p className="mt-1 text-[12px] leading-[1.5] text-[#1B1A17]/70">
                Grab your magic link from your dashboard email or your
                existing session, then reload this page.
              </p>
              <Link
                href="/trade-off/login?next=/trade-off/yard/manage"
                className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-black text-neutral-900 hover:bg-amber-300"
              >
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        )}

        {listing && (
          <>
            <div className="mt-4 rounded-2xl border border-[#1B1A17]/10 bg-white px-4 py-2 text-[12px] font-semibold text-[#1B1A17]/60">
              Signed in as{" "}
              <b className="text-[#1B1A17]/85">{listing.display_name}</b>
              {" · "}
              {tradeLabel(listing.primary_trade)}
            </div>

            <div className="mt-6">
              <YardManageList
                slug={listing.slug}
                token={effectiveToken}
                initialPosts={posts}
              />
            </div>

            <p className="mt-6 text-[11px] text-[#1B1A17]/50">
              Live posts auto-expire 14 days after creation. Boosted posts
              float to the top of every relevant Yard filter until the
              boost timer ends.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
