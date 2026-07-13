// /trade-off/edit/[slug]/notifications?token=...
//
// Trade's targeted-post inbox. Shows every promo delivered to this
// trade's audience with a 5-day countdown chip. Read state is
// updated lazily on view via the API route.

import type { Metadata } from "next";
import Link from "next/link";
import { createHash } from "node:crypto";
import { ChevronLeft, Inbox, Clock } from "lucide-react";
import { tradeLabel } from "@/lib/tradeOff";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications · The Yard · XRatedTrade",
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

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default async function NotificationsPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token ?? "";

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, edit_token, primary_trade")
    .eq("slug", slug)
    .maybeSingle();

  const authed = listing && token && constantTimeEq(listing.edit_token, token);

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
        <div className="mx-auto max-w-xl px-4 py-16">
          <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-6 shadow-sm">
            <h1 className="text-[20px] font-black">Sign-in required</h1>
            <p className="mt-2 text-[13px] text-[#1B1A17]/70">
              Grab a fresh notifications link from your dashboard.
            </p>
            <Link
              href={`/trade-off/edit/${slug}`}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full px-5 text-[13px] font-extrabold text-neutral-900 shadow-md"
              style={{ background: "#FFB300" }}
            >
              Open dashboard →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { data: rows } = await supabaseAdmin
    .from("hammerex_yard_targeted_notifications")
    .select(
      `id, is_read, delivered_at, expires_at,
       post:hammerex_trade_off_yard_posts!inner(
         id, kind, trade_slug, title, body, image_urls, product_price_pence,
         listing:hammerex_trade_off_listings!hammerex_trade_off_yard_posts_listing_id_fkey(display_name, slug, avatar_url)
       )`
    )
    .eq("recipient_listing_id", listing!.id)
    .order("delivered_at", { ascending: false })
    .limit(100);

  // Fire-and-forget mark-as-read on the batch we just showed.
  const unreadIds = (rows ?? [])
    .filter((r) => !r.is_read)
    .map((r) => r.id);
  if (unreadIds.length > 0) {
    supabaseAdmin
      .from("hammerex_yard_targeted_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => {}, () => {});
  }

  const items = rows ?? [];

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href={`/trade-off/edit/${slug}?token=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <Inbox className="h-3 w-3" aria-hidden />
            Notifications
          </span>
        </div>

        <div className="mt-6">
          <h1 className="text-[26px] font-black leading-tight text-[#1B1A17] md:text-[32px]">
            Promos for {tradeLabel(listing!.primary_trade)}s
          </h1>
          <p className="mt-2 text-[13px] leading-[1.55] text-[#1B1A17]/60">
            Targeted posts land here, not the public feed. They auto-delete
            after 5 days so this inbox stays lean.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white p-8 text-center">
            <Inbox
              className="mx-auto h-8 w-8 text-[#1B1A17]/30"
              aria-hidden
            />
            <p className="mt-3 text-[13px] text-[#1B1A17]/60">
              Nothing here yet. When a supplier or another trade sends you a
              promo, it lands here — not the feed.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((n) => {
              const post = Array.isArray(n.post) ? n.post[0] : n.post;
              const posterListing = post?.listing
                ? Array.isArray(post.listing)
                  ? post.listing[0]
                  : post.listing
                : null;
              const days = daysUntil(n.expires_at);
              const heroImage = post?.image_urls?.[0] ?? null;
              return (
                <li
                  key={n.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                    n.is_read
                      ? "border-[#1B1A17]/10"
                      : "border-amber-400/50 ring-1 ring-amber-200/50"
                  }`}
                >
                  <div className="flex gap-3 p-3 sm:p-4">
                    <div className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#FBF6EC] sm:h-28 sm:w-28">
                      {heroImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={heroImage}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="absolute inset-0 flex items-center justify-center bg-amber-50"
                        >
                          <Inbox
                            className="h-8 w-8 text-amber-700/40"
                            aria-hidden
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-extrabold text-[#1B1A17]">
                          {posterListing?.display_name ?? "Vendor"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B1A17]/50">
                          <Clock className="h-2.5 w-2.5" aria-hidden />
                          {days}d left
                        </span>
                      </div>
                      <h3 className="mt-1 text-[14px] font-black leading-snug text-[#1B1A17] sm:text-[15px]">
                        {post?.title}
                      </h3>
                      <p
                        className="mt-1 text-[12.5px] leading-[1.45] text-[#1B1A17]/70"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}
                      >
                        {post?.body}
                      </p>
                      {posterListing?.slug ? (
                        <a
                          href={`/${posterListing.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700 underline-offset-4 hover:underline"
                        >
                          Open vendor profile →
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
