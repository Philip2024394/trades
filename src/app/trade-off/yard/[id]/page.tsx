// /trade-off/yard/[id] — public detail view for a single Yard post.
//
// Every list-side link (YardManageList "View", YardPostLightbox "Open
// full post") + the sitemap entries route here. Before this route
// existed those all 404'd — the entire sitemap of live yard listings
// was dead. Now the post renders standalone with the same card the
// feed uses, plus comments and a session-aware CTA:
//   • signed-in trade → interactive reaction/comment/WhatsApp actions
//     (inherits from YardPostCard)
//   • no session      → sign-in nudge that bounces back to this URL
//
// Hidden / spam moderation states + expired / archived statuses render
// a friendly "Post is no longer live" panel instead of the raw card so
// Google-indexed URLs never turn into gravestones.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight, Info, MessageCircle } from "lucide-react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import { YardPostCard, type YardPoster } from "@/components/xrated/yard/YardPostCard";
import { YardReplyComposer } from "@/components/xrated/yard/YardReplyComposer";
import type { ReactionCounts } from "@/lib/yardReactions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Post — The Yard | The Network" };
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("title, body")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { title: "Post — The Yard | The Network" };
  const title = `${data.title} — The Yard | The Network`;
  const description = (data.body ?? "").slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/trade-off/yard/${id}` },
    robots: { index: true, follow: true }
  };
}

export default async function YardPostDetailPage({
  params
}: {
  params: Params;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const { data: post } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();

  const typedPost = post as HammerexTradeOffYardPost;
  const isHiddenMod =
    typedPost.moderation_status === "hidden" ||
    typedPost.moderation_status === "spam";
  const isExpired =
    !!typedPost.expires_at && Date.parse(typedPost.expires_at) < Date.now();
  const isArchived = typedPost.status === "archived";
  const isNoLongerLive = isHiddenMod || isExpired || isArchived;

  const [posterRes, reactionsRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, trading_name, city, country, primary_trade, whatsapp, avatar_url, bio, tier, instagram, facebook, tiktok, youtube, photos, follower_count"
      )
      .eq("id", typedPost.listing_id)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_trade_off_yard_post_reactions")
      .select("kind")
      .eq("post_id", id)
  ]);

  const posterRow = posterRes.data;
  const poster: YardPoster | null = posterRow
    ? {
        slug: posterRow.slug,
        display_name: posterRow.display_name,
        trading_name: posterRow.trading_name,
        city: posterRow.city,
        country: posterRow.country,
        primary_trade: posterRow.primary_trade,
        whatsapp: posterRow.whatsapp ?? "",
        avatar_url: posterRow.avatar_url,
        bio: posterRow.bio ?? null,
        banner_url:
          Array.isArray(posterRow.photos) && posterRow.photos.length > 0
            ? (posterRow.photos[0] as string)
            : null,
        tier: posterRow.tier ?? null,
        instagram: posterRow.instagram,
        facebook: posterRow.facebook,
        tiktok: posterRow.tiktok,
        youtube: posterRow.youtube,
        follower_count: posterRow.follower_count ?? 0
      }
    : null;

  const reactions: ReactionCounts = {};
  for (const r of reactionsRes.data ?? []) {
    const k = r.kind as keyof ReactionCounts;
    reactions[k] = (reactions[k] ?? 0) + 1;
  }

  // Auth lookup — HMAC session cookie → resolve slug + edit_token so
  // the reply composer can post without URL magic-link params. Only
  // active listings are unlocked; expired / archived trades fall back
  // to the sign-in nudge.
  let viewer: {
    slug: string;
    editToken: string;
    displayName: string;
  } | null = null;
  const jar = await cookies();
  const rawCookie = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
  const session = verifyTradeSession(rawCookie);
  if (session) {
    const { data: viewerRow } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, edit_token, display_name, status")
      .eq("id", session.listing_id)
      .maybeSingle();
    if (viewerRow && viewerRow.status === "live") {
      viewer = {
        slug: viewerRow.slug,
        editToken: viewerRow.edit_token,
        displayName:
          (viewerRow.display_name as string | null)?.split(/\s+/)[0] ||
          "You"
      };
    }
  }

  // Comments — merge legacy child yard_posts (historical replies from
  // pre-v3) with new hammerex_yard_comments rows. Both are trades-only
  // reads, but public GET is fine — no PII beyond what the poster chose
  // to share on their profile.
  type CommentDTO = {
    id: string;
    body: string;
    authorId: string;
    createdAt: string;
    source: "legacy" | "v3";
  };

  const [legacyRes, v3Res] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select("id, body, listing_id, created_at, moderation_status")
      .eq("parent_id", id)
      .order("created_at", { ascending: true })
      .limit(50),
    supabaseAdmin
      .from("hammerex_yard_comments")
      .select("id, body, author_listing_id, created_at, moderation_status, deleted_at")
      .eq("post_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200)
  ]);

  const legacyComments: CommentDTO[] = (legacyRes.data ?? [])
    .filter(
      (c) =>
        c.moderation_status !== "hidden" && c.moderation_status !== "spam"
    )
    .map((c) => ({
      id: c.id,
      body: c.body ?? "",
      authorId: c.listing_id,
      createdAt: c.created_at,
      source: "legacy" as const
    }));
  const v3Comments: CommentDTO[] = (v3Res.data ?? [])
    .filter((c) => c.moderation_status === "live")
    .map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.author_listing_id,
      createdAt: c.created_at,
      source: "v3" as const
    }));
  const visibleComments: CommentDTO[] = [...legacyComments, ...v3Comments].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );

  const commentAuthorIds = Array.from(
    new Set(visibleComments.map((c) => c.authorId))
  );
  const commentAuthors = new Map<string, { slug: string; name: string }>();
  if (commentAuthorIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, trading_name")
      .in("id", commentAuthorIds);
    for (const row of data ?? []) {
      commentAuthors.set(row.id, {
        slug: row.slug,
        name: row.trading_name?.trim() || row.display_name || "Member"
      });
    }
  }

  return (
    <main className="min-h-screen text-[#1B1A17]" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />

      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 md:pt-10">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/trade-off/yard"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            ← Back to The Yard
          </Link>
        </div>

        {isNoLongerLive ? (
          <section
            className="rounded-2xl border p-6 shadow-sm"
            style={{
              borderColor: "rgba(255,179,0,0.4)",
              background: "#FFF7E0"
            }}
          >
            <div className="flex items-start gap-3">
              <Info
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                aria-hidden
              />
              <div>
                <p className="text-[14.5px] font-black text-[#1B1A17]">
                  This post is no longer live.
                </p>
                <p className="mt-1 text-[13px] leading-[1.5] text-[#1B1A17]/70">
                  {isHiddenMod
                    ? "It's been removed by moderation."
                    : isExpired
                      ? "It auto-expired 14 days after posting."
                      : "The trade archived it — likely because the item sold or the job filled."}
                </p>
                <Link
                  href="/trade-off/yard"
                  className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-black text-[#0A0A0A] hover:bg-amber-300"
                >
                  See live posts
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <YardPostCard
            post={typedPost}
            poster={poster}
            reactions={reactions}
          />
        )}

        {/* Comments — public read, sign-in required to add. */}
        {!isNoLongerLive && (
          <section className="mt-6">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#1B1A17]/60">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                {visibleComments.length}{" "}
                {visibleComments.length === 1 ? "reply" : "replies"}
              </h2>
              {!viewer && (
                <Link
                  href={`/trade-off/login?next=/trade-off/yard/${id}`}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#1B1A17]/15 bg-white px-3 text-[12px] font-black text-[#1B1A17]/80 hover:border-amber-400"
                >
                  Sign in to reply
                </Link>
              )}
            </header>
            {viewer && (
              <div className="mb-4">
                <YardReplyComposer
                  slug={viewer.slug}
                  token={viewer.editToken}
                  postId={id}
                  displayName={viewer.displayName}
                />
              </div>
            )}
            {visibleComments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#1B1A17]/15 bg-white px-4 py-4 text-center text-[12.5px] text-[#1B1A17]/60">
                No replies yet — be the first from your dashboard&apos;s
                reaction bar.
              </p>
            ) : (
              <ol className="space-y-2">
                {visibleComments.map((c) => {
                  const author = commentAuthors.get(c.authorId);
                  return (
                    <li
                      key={`${c.source}-${c.id}`}
                      className="rounded-xl border border-[#1B1A17]/10 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-baseline gap-2">
                        {author ? (
                          <Link
                            href={`/trade/${author.slug}`}
                            className="text-[13px] font-black text-[#1B1A17] hover:underline"
                          >
                            {author.name}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-black text-[#1B1A17]">
                            Member
                          </span>
                        )}
                        <time className="text-[11px] text-[#1B1A17]/50">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </time>
                      </div>
                      {c.body && (
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-[#1B1A17]/85">
                          {c.body}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
