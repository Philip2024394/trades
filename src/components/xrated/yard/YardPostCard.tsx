// Yard post card — LANDSCAPE, news-feed style, mobile-first.
//
// Single-column vertical feed. Each row is a landscape card: thumbnail
// on the left (square) + content on the right (title, meta, body,
// WhatsApp CTA). Reads like Twitter/LinkedIn on mobile, not a Facebook
// grid.
//
// Kind chip overlays the thumbnail with a construction icon.
// Price bubble on the thumbnail for product/tools/materials.
// Time-ago top-right.

import { tradeLabel } from "@/lib/tradeOff";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import {
  YARD_KIND_LABELS,
  YARD_KIND_BG,
  YARD_KIND_FG,
  buildYardWhatsappUrl,
  buildYardPurchaseUrl,
  formatDayRate,
  formatPostDateRange,
  formatPostPrice,
  formatPostPriceCurrency,
  YARD_CONDITION_LABEL,
  YARD_DELIVERY_LABEL,
  timeAgoShort
} from "@/lib/yardPosts";
import type { ReactionCounts } from "@/lib/yardReactions";
import { YardReactionBar } from "./YardReactionBar";
import { YardFlagButton } from "./YardFlagButton";
import { YardCommentsPanel } from "./YardCommentsPanel";
import { YardBoostButton } from "./YardBoostButton";
import { PostCardActionsMenu } from "./PostCardActionsMenu";
import {
  HardHat,
  Hammer,
  Wrench,
  Globe,
  Pin,
  Megaphone,
  Handshake,
  Package,
  Truck,
  Search
} from "lucide-react";

const BRAND_YELLOW = "#FFB300";

// Announcement identity — walkie-talkie image. Small enough to read as
// "someone at Xrated is on the radio" without needing a text badge.
// Trades associate the radio with a foreman announcement.
const ANNOUNCEMENT_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2002_20_45%20PM.png";

export type YardPoster = {
  slug: string;
  display_name: string;
  trading_name: string | null;
  city: string | null;
  country: string | null;
  primary_trade: string;
  whatsapp: string;
  avatar_url: string | null;
  // Flip-card back data — added yard v3 to power the "peek" behind the
  // feed post. photos[0] doubles as a banner when the trade hasn't set
  // a dedicated hero image. Socials render as icon row on the back.
  bio: string | null;
  banner_url: string | null;
  tier:
    | "standard"
    | "app_trial"
    | "app_paid"
    | "app_expired"
    | "app_verified"
    | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
  // Business Shops v1 — follower count denorm from
  // hammerex_trade_off_listings.follower_count (kept in sync by trigger).
  follower_count: number;
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  available: HardHat,
  "job-seek": HardHat,
  needed: Hammer,
  "job-offer": Hammer,
  "collab-help": Handshake,
  product: Wrench,
  "tools-sell": Wrench,
  "tools-buy": Search,
  "tools-rent": Truck,
  "materials-surplus": Package,
  "abroad-job": Globe
};

function iconFor(kind: string) {
  return KIND_ICON[kind] ?? HardHat;
}

export function YardPostCard({
  post,
  poster,
  reactions = {},
  inCircle = false,
  currentListingId = null
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster | null;
  reactions?: ReactionCounts;
  /** Viewer signed in with magic link and this post's author is in
   *  their Trade Circle — painted as a subtle amber corner ribbon. */
  inCircle?: boolean;
  /** Signed-in merchant's listing_id. If it matches post.listing_id,
   *  the 3-dot actions menu appears top-right. */
  currentListingId?: string | null;
}) {
  const isOwnPost = currentListingId !== null && post.listing_id === currentListingId;
  const kindBg = YARD_KIND_BG[post.kind];
  const kindFg = YARD_KIND_FG[post.kind];
  const KindIcon = iconFor(post.kind);
  const tradeText = tradeLabel(post.trade_slug);
  const dateRange = formatPostDateRange(post.start_date, post.end_date);
  const dayRate = formatDayRate(post.day_rate_pence);
  const region = post.region ?? "";
  const posterName =
    poster?.trading_name?.trim() || poster?.display_name || "Member";

  const isProduct =
    post.kind === "product" ||
    post.kind === "tools-sell" ||
    post.kind === "materials-surplus";
  const isAbroad =
    post.kind === "abroad-job" || (post.country && post.country !== "UK");
  const isAnnouncement = post.is_admin_announcement === true;
  const isBoosted = Boolean(
    post.is_boosted_until && Date.parse(post.is_boosted_until) > Date.now()
  );

  const waUrl = poster
    ? isProduct
      ? buildYardPurchaseUrl({
          whatsapp: poster.whatsapp,
          posterName: poster.display_name.split(/\s+/)[0] || posterName,
          postTitle: post.title,
          price: post.product_price_pence
        })
      : buildYardWhatsappUrl({
          whatsapp: poster.whatsapp,
          posterName: poster.display_name.split(/\s+/)[0] || posterName,
          postTitle: post.title
        })
    : null;

  const heroImage = post.image_urls?.[0] ?? null;

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border transition hover:shadow-md ${
        isAnnouncement
          ? "border-amber-400/70 bg-amber-50/60"
          : "border-[#1B1A17]/10 bg-white shadow-sm"
      }`}
    >
      {/* Trade Circle ribbon — top-right, painted only when the signed-in
          viewer has an endorsement edge with this post's author. Hidden
          for the viewer's own posts (the 3-dot actions menu takes that
          slot instead). */}
      {inCircle && !isOwnPost && (
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 select-none rounded-bl-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            background: "linear-gradient(135deg, #FFB300 0%, #B8860B 100%)",
            color: "#1B1A17"
          }}
          title="From your Trade Circle"
        >
          Your Circle
        </div>
      )}

      {/* Owner-only actions menu — top-right pulse-dot trigger + drop
          down / bottom sheet with View / Boost / Archive / Delete.
          Replaces the deleted /trade-off/yard/manage dashboard. */}
      {isOwnPost && (
        <div className="absolute right-2 top-2 z-20">
          <PostCardActionsMenu
            postId={post.id}
            status={post.status === "archived" ? "archived" : "live"}
            onDeleted={() => {
              // Reload the page to remove the deleted card from the
              // feed. Simpler than surgically splicing the list — the
              // feed is server-rendered per SSR fetch.
              if (typeof window !== "undefined") window.location.reload();
            }}
            onArchived={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          />
        </div>
      )}
      {/* Boosted ribbon — top-left when the post has an active boost.
          Distinct from the announcement/circle ribbons (top-right) so
          both can co-exist without collision. */}
      {isBoosted && (
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 select-none rounded-br-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white"
          style={{ background: "#0F7A3D" }}
          title="Boosted — paid promotion"
        >
          Boosted
        </div>
      )}
      {/* Landscape row: thumbnail left, content right. */}
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        {/* Thumbnail */}
        <div className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#FBF6EC] sm:h-28 sm:w-28">
          {heroImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={heroImage}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background:
                  "radial-gradient(80% 60% at 50% 30%, rgba(255,179,0,0.20) 0%, transparent 65%), #F7F0E0"
              }}
            >
              <KindIcon className="h-10 w-10 text-amber-700/45" />
            </div>
          )}

          {/* Walkie-talkie badge on the top-right of the thumbnail for
              announcements — no text, small, recognizable to trades. */}
          {isAnnouncement && (
            <span
              className="absolute -right-1 -top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-amber-400"
              title="Announcement"
              aria-label="Announcement"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ANNOUNCEMENT_IMAGE}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            </span>
          )}

          {/* Kind chip on thumb — bottom-left. Announcement now uses the
              walkie-talkie badge above; regular posts still get the chip. */}
          {!isAnnouncement && (
            <span
              className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-sm"
              style={{
                background: kindBg ?? BRAND_YELLOW,
                color: kindFg ?? "#0A0A0A"
              }}
            >
              <KindIcon className="h-2.5 w-2.5" aria-hidden />
              {(YARD_KIND_LABELS[post.kind] ?? post.kind).replace(/^./, (c) =>
                c.toUpperCase()
              )}
            </span>
          )}

          {/* Price bubble top-right of thumb */}
          {isProduct && post.product_price_pence !== null && (
            <span
              className="absolute right-1 top-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums shadow-md"
              style={{ background: BRAND_YELLOW, color: "#0A0A0A" }}
              aria-label="Price"
            >
              {formatPostPriceCurrency(
                post.product_price_pence,
                post.price_currency
              )}
            </span>
          )}

          {/* Video indicator — small play badge, bottom-left of thumb.
              Signals to buyers "there's a walkaround clip on this one". */}
          {post.video_urls && post.video_urls.length > 0 && (
            <span
              className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/85 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md"
              aria-label="Video attached"
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Video
            </span>
          )}
        </div>

        {/* Content column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top row — poster + time-ago */}
          <div className="flex items-center justify-between gap-2">
            {poster ? (
              <a
                href={`/${poster.slug}`}
                className="flex min-w-0 items-center gap-1.5"
              >
                {poster.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={poster.avatar_url}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-[#1B1A17]/10"
                  />
                ) : (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-[#1B1A17]"
                    style={{ background: BRAND_YELLOW }}
                    aria-hidden
                  >
                    {posterName.charAt(0)}
                  </span>
                )}
                <span className="truncate text-[12px] font-extrabold text-[#1B1A17]">
                  {posterName}
                </span>
                <span
                  className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full"
                  style={{ background: BRAND_YELLOW }}
                  aria-hidden
                  title="Verified"
                >
                  <svg
                    width="7"
                    height="7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0A0A0A"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              </a>
            ) : (
              <span className="text-[12px] text-[#1B1A17]/55">
                Poster removed
              </span>
            )}

            <div className="flex shrink-0 items-center gap-1.5">
              {post.is_pinned && !isAnnouncement && (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1B1A17]/5"
                  title="Pinned"
                >
                  <Pin className="h-2.5 w-2.5 text-[#1B1A17]/70" aria-hidden />
                </span>
              )}
              {!post.is_sample && (
                <span className="text-[10px] font-semibold text-[#1B1A17]/45">
                  {timeAgoShort(post.created_at)}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="mt-1 text-[14px] font-black leading-snug text-[#1B1A17] sm:text-[15px]">
            {post.title}
          </h3>

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#1B1A17]/60">
            <span className="font-bold text-[#1B1A17]/85">{tradeText}</span>
            {region ? <span>· {region}</span> : null}
            {dateRange ? <span>· {dateRange}</span> : null}
            {post.kind === "needed" && post.crew_size_needed !== null ? (
              <span>· {post.crew_size_needed} crew</span>
            ) : null}
            {dayRate ? (
              <span className="font-bold text-[#1B1A17]">· {dayRate}</span>
            ) : null}
            {isAbroad ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800"
              >
                <Globe className="h-2.5 w-2.5" aria-hidden />
                {post.country && post.country !== "UK" ? post.country : "Abroad"}
              </span>
            ) : null}
          </div>

          {/* Body — 2 line clamp */}
          <p
            className="mt-2 text-[12.5px] leading-[1.45] text-[#1B1A17]/75 sm:text-[13px]"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {post.body}
          </p>

          {/* Commerce meta — condition · stock · delivery chips.
              Renders only for marketplace kinds and only when the
              trade actually filled the fields (nothing empty). */}
          {isProduct &&
            (post.condition ||
              post.stock_qty > 0 ||
              (post.delivery_options && post.delivery_options.length > 0)) && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {post.condition && (
                  <span className="inline-flex items-center rounded-full bg-[#1B1A17]/5 px-1.5 py-0.5 text-[10px] font-bold text-[#1B1A17]/70">
                    {YARD_CONDITION_LABEL[post.condition] ?? post.condition}
                  </span>
                )}
                {post.stock_qty > 1 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    {post.stock_qty} in stock
                  </span>
                )}
                {post.stock_qty === 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                    Out of stock
                  </span>
                )}
                {post.delivery_options?.slice(0, 2).map((opt) => (
                  <span
                    key={opt}
                    className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                  >
                    {YARD_DELIVERY_LABEL[opt] ?? opt}
                  </span>
                ))}
                {(post.delivery_options?.length ?? 0) > 2 && (
                  <span className="text-[10px] font-bold text-[#1B1A17]/50">
                    +{(post.delivery_options?.length ?? 0) - 2}
                  </span>
                )}
              </div>
            )}

          {/* Footer — reactions + WhatsApp */}
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#1B1A17]/8 pt-2">
            <div className="min-w-0 flex-1">
              <YardReactionBar postId={post.id} initialCounts={reactions} />
            </div>

            {!isAnnouncement && (
              <YardFlagButton
                postId={post.id}
                posterSlug={poster?.slug ?? null}
              />
            )}

            {/* Boost — only renders when the viewer's magic-link slug
                matches this post's poster (client-side ownership check). */}
            {poster && !isAnnouncement && (
              <YardBoostButton
                postId={post.id}
                posterSlug={poster.slug}
              />
            )}

            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-extrabold text-white shadow-md transition active:scale-[0.97]"
                style={{
                  background: "#0F7A3F",
                  boxShadow: "0 4px 12px rgba(15,122,63,0.35)"
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
                </svg>
                {isProduct ? "Buy" : "WhatsApp"}
              </a>
            ) : null}
          </div>

          {/* Public conversation — trades-only inline thread. */}
          <YardCommentsPanel
            postId={post.id}
            initialCount={post.comment_count ?? 0}
          />
        </div>
      </div>
    </article>
  );
}
