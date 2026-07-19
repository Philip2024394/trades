"use client";

// Client shell for /feed. Filter chips + full posts list + LIVE
// badge + owner delete menu on own posts. Same visual language as the
// canteen mobile dashboard (cream + tan + serif H1 + rounded cards).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Heart,
  MessageSquare,
  Send,
  Bookmark,
  BookmarkCheck,
  Flag
} from "lucide-react";
import type { CanteenChatPost } from "@/lib/canteens.server";
import { CanteenBottomNav } from "@/components/xrated/yard/CanteenBottomNav";
import { ReportContentModal } from "@/components/forms/ReportContentButton";
import { CommentThread, CANTEEN_COMMENT_API } from "@/components/comments/CommentThread";

const CREAM = "#FBF6EC";
const TAN = "#B8860B";
const TAN_SOFT = "#F5E9D3";
const BRAND_BLACK = "#0A0A0A";

// Mock replies now live inside the shared CommentThread component
// (src/components/comments/CommentThread.tsx) — that's the ONE place
// to fix comment behaviour across the platform.

// Fallback mock feed for empty demo canteens — same voices as the
// mobile rotator mock so the page always renders content.
//
// Post spacing rule (per Philip 2026-07-15): consecutive mock posts
// should sit 1–3 days apart, not clustered in hours. Reads as a
// slow-burn trade group where the crew stops in daily, not a
// firehose. `DAY_MS` shorthand keeps the math readable.
const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK_POSTS: CanteenChatPost[] = [
  {
    id: "mock-fd-1",
    canteenId: "demo",
    authorSlug: "mike-watson",
    authorDisplayName: "Mike Watson",
    body: "Fitting the Bosch dishwasher today. Client already picked out the taps. Big handshake job.",
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png"],
    moodSlug: "showcase",
    reactionsLike: 14,
    reactionsAgree: 2,
    reactionsQuestion: 0,
    replyCount: 4,
    createdAt: new Date(Date.now() - 0 * DAY_MS).toISOString()
  },
  {
    id: "mock-fd-2",
    canteenId: "demo",
    authorSlug: "rachel-simms",
    authorDisplayName: "Rachel Simms",
    body: "Anyone doing 24h templating in the NW? Current supplier just went to 5 days.",
    photoUrls: null,
    moodSlug: "question",
    reactionsLike: 4,
    reactionsAgree: 0,
    reactionsQuestion: 3,
    replyCount: 8,
    createdAt: new Date(Date.now() - 1 * DAY_MS).toISOString()
  },
  {
    id: "mock-fd-3",
    canteenId: "demo",
    authorSlug: "tom-fisher",
    authorDisplayName: "Tom Fisher",
    body: "Smashed the Whittington fit-out today. Full 3-day install into a new-build kitchen. Client over the moon.",
    photoUrls: ["https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2009_00_03%20PM.png"],
    moodSlug: "showcase",
    reactionsLike: 22,
    reactionsAgree: 5,
    reactionsQuestion: 0,
    replyCount: 6,
    createdAt: new Date(Date.now() - 3 * DAY_MS).toISOString()
  },
  {
    id: "mock-fd-4",
    canteenId: "demo",
    authorSlug: "craig-mcdermott",
    authorDisplayName: "Craig McDermott",
    body: "Important for anyone on the Alder Grove site — access diverted through the north gate all next week.",
    photoUrls: null,
    moodSlug: "announcement",
    reactionsLike: 22,
    reactionsAgree: 8,
    reactionsQuestion: 0,
    replyCount: 4,
    createdAt: new Date(Date.now() - 6 * DAY_MS).toISOString()
  }
];

const FILTERS = [
  { slug: "all",       label: "All" },
  { slug: "showcase",  label: "Showcase" },
  { slug: "question",  label: "Questions" },
  { slug: "live",      label: "Live now" }
];

function isLive(iso: string): boolean {
  return Date.now() - Date.parse(iso) < 5 * 60 * 1000;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function CanteenFeedShell({
  canteenSlug,
  canteenName,
  tradeLabel,
  hostSlug,
  hostDisplayName,
  viewerSlug,
  isHost,
  posts,
  filter,
  initialSavedIds = []
}: {
  canteenSlug: string;
  canteenName: string;
  tradeLabel: string;
  hostSlug: string;
  hostDisplayName: string;
  viewerSlug: string | null;
  isHost: boolean;
  posts: CanteenChatPost[];
  filter: string;
  /** Post ids the signed-in viewer has already server-side saved.
   *  Hydrates the UI so the Saved pill + Unsave menu label render on
   *  first paint. Empty for guests. Union'd with localStorage for
   *  per-device guest bookmarks. */
  initialSavedIds?: string[];
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // Saved-posts set. Two sources merged:
  //   1. `initialSavedIds` from the server (authed viewer's DB rows)
  //   2. localStorage (per-device convenience, guests included)
  // The DB save is what actually exempts a post from the 30-post
  // feed rotation. The localStorage set is a guest-friendly UX layer
  // that survives a refresh but does not protect the post server-side.
  // When an authed viewer saves, we hit the API AND write localStorage;
  // when they un-save we do the same in reverse. Failures on the API
  // roll back the local state so the UI stays honest.
  const savedStorageKey = `canteen_saved_posts_${canteenSlug}`;
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(initialSavedIds));
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(savedStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const localIds = parsed.filter((v): v is string => typeof v === "string");
      // Merge with server-hydrated ids — server is source of truth for
      // authed viewers, localStorage adds guest / per-device saves that
      // haven't been server-persisted.
      setSavedIds((prev) => {
        const next = new Set(prev);
        for (const id of localIds) next.add(id);
        return next;
      });
    } catch {
      // Corrupt entry — leave the server-hydrated set as-is.
    }
  }, [savedStorageKey]);
  const persistLocal = useCallback(
    (next: Set<string>) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(savedStorageKey, JSON.stringify(Array.from(next)));
      } catch {
        // Storage quota / disabled — silently ignore.
      }
    },
    [savedStorageKey]
  );
  const toggleSaved = useCallback(
    async (postId: string) => {
      const wasSaved = savedIds.has(postId);
      // Optimistic swap so the menu label + Saved pill flip instantly.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(postId);
        else next.add(postId);
        persistLocal(next);
        return next;
      });
      // Only hit the server when the viewer is signed in — the DB row
      // is what protects the post from rotation. Guests keep the
      // localStorage save as a per-device convenience only.
      if (!viewerSlug) return;
      try {
        const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/save`, {
          method: wasSaved ? "DELETE" : "POST"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error ?? "save-failed");
      } catch {
        // Roll back on failure so the UI matches server truth.
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(postId);
          else next.delete(postId);
          persistLocal(next);
          return next;
        });
      }
    },
    [persistLocal, savedIds, viewerSlug]
  );

  const source = posts.length > 0 ? posts : MOCK_POSTS;
  const filtered = useMemo(() => {
    const visible = source.filter((p) => !removed.has(p.id));
    if (filter === "showcase") return visible.filter((p) => p.moodSlug === "showcase");
    if (filter === "question") return visible.filter((p) => p.moodSlug === "question");
    if (filter === "live") return visible.filter((p) => isLive(p.createdAt));
    return visible;
  }, [source, filter, removed]);

  async function deletePost(postId: string) {
    // Optimistic — hide instantly, then confirm.
    setRemoved((s) => new Set(s).add(postId));
    try {
      await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
      router.refresh();
    } catch {
      // Rollback on failure.
      setRemoved((s) => {
        const next = new Set(s);
        next.delete(postId);
        return next;
      });
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: CREAM }}>
      {/* Header */}
      <section className="mx-auto max-w-4xl px-3 pt-4 md:px-6 md:pt-6">
        <Link
          href={`/trade-off/yard/canteens/${canteenSlug}`}
          className="mb-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600"
        >
          <ArrowLeft size={12}/>
          Home
        </Link>
        <h1
          className="text-[28px] font-black leading-[1.02] text-neutral-900 sm:text-[34px]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          Live Feed
          <span
            aria-hidden
            className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full align-middle"
            style={{ backgroundColor: TAN }}
          />
        </h1>
        <p className="mt-1 text-[12.5px] font-bold text-neutral-600">
          Every post from {canteenName}
        </p>

        {/* Filter chips */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => {
            const active = filter === f.slug;
            return (
              <Link
                key={f.slug}
                href={f.slug === "all"
                  ? `/trade-off/yard/canteens/${canteenSlug}/feed`
                  : `/trade-off/yard/canteens/${canteenSlug}/feed?filter=${f.slug}`}
                className="inline-flex h-8 flex-shrink-0 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
                style={{
                  backgroundColor: active ? BRAND_BLACK : "#FFFFFF",
                  color:           active ? "#FFFFFF"    : "#525252",
                  borderColor:     active ? BRAND_BLACK : "rgba(139,69,19,0.15)"
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Feed */}
      <section className="mx-auto max-w-4xl px-3 pb-20 pt-4 md:px-6 md:pt-6">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div className="text-[13px] font-black text-neutral-900">Nothing matches this filter.</div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-snug text-neutral-600">
              Try switching to All, or head back to the canteen and post something.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 md:gap-4">
            {filtered.map((p) => (
              <li key={p.id}>
                <FeedCard
                  post={p}
                  hostSlug={hostSlug}
                  hostDisplayName={hostDisplayName}
                  viewerSlug={viewerSlug}
                  isHost={isHost}
                  onDelete={deletePost}
                  canteenSlug={canteenSlug}
                  tradeLabel={tradeLabel}
                  isSaved={savedIds.has(p.id)}
                  onToggleSaved={toggleSaved}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bottom nav */}
      <CanteenBottomNav canteenSlug={canteenSlug}/>
    </main>
  );
}

// ─── Individual post card ─────────────────────────────────

function FeedCard({
  post,
  hostSlug,
  hostDisplayName: _hostDisplayName,
  viewerSlug,
  isHost,
  onDelete,
  canteenSlug,
  tradeLabel,
  isSaved,
  onToggleSaved
}: {
  post: CanteenChatPost;
  hostSlug: string;
  hostDisplayName: string;
  viewerSlug: string | null;
  isHost: boolean;
  onDelete: (id: string) => void;
  canteenSlug: string;
  tradeLabel: string;
  isSaved: boolean;
  onToggleSaved: (postId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Report-content modal state — opened from the 3-dots menu.
  // Lifted here so the menu can close before the modal opens
  // (avoids stacking two layers of overlay awkwardly).
  const [reportOpen, setReportOpen] = useState(false);
  // Inline comments panel — expands directly under the reactions row
  // when the viewer taps the "N comments" chip. Fetches replies lazily
  // on first open from /api/canteens/posts/[id]/replies. Second click
  // collapses without re-fetching (cached in `replies`).
  // Toggle for the CommentThread panel. Panel state (replies, likes,
  // composer, mock/DB fetching) lives inside CommentThread — parent
  // just decides when to mount it.
  const [threadOpen, setThreadOpen] = useState(false);
  const openThread = useCallback(() => setThreadOpen(true), []);

  // Owner controls: viewer is host OR viewer is the post's author.
  const canDelete = isHost || (viewerSlug !== null && viewerSlug === post.authorSlug);
  // Save is open to everyone (including guests) — the flag lives in the
  // viewer's own localStorage so no auth required to bookmark.
  const isHostPost = post.authorSlug === hostSlug;
  const isQuestion = post.moodSlug === "question";
  const isShowcase = post.moodSlug === "showcase";
  const isAnnouncement = post.moodSlug === "announcement";
  const live = isLive(post.createdAt);
  // Live comment chip count. Bumped optimistically by CommentThread
  // via onReplyPosted so the chip stays in sync without a refresh.
  const [localReplyCount, setLocalReplyCount] = useState<number>(post.replyCount);
  useEffect(() => {
    setLocalReplyCount(post.replyCount);
  }, [post.replyCount]);

  return (
    <article
      className="relative rounded-2xl border bg-white p-4 shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-black text-white"
          style={{ backgroundColor: TAN }}
          aria-hidden
        >
          {post.authorDisplayName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-black text-neutral-900">
              {post.authorDisplayName}
            </span>
            {isHostPost && (
              <span
                className="rounded-sm px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em]"
                style={{ backgroundColor: BRAND_BLACK, color: "#FFFFFF" }}
              >
                Host
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500">
            <span>{tradeLabel}</span>
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        {/* Post-type badge — top-right */}
        {live && (
          <span
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ backgroundColor: "rgba(184,134,11,0.15)", color: TAN }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: TAN }}
            />
            LIVE
          </span>
        )}
        {!live && isShowcase && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ backgroundColor: TAN_SOFT, color: TAN }}
          >
            Showcase
          </span>
        )}
        {!live && isQuestion && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ backgroundColor: "#DBEAFE", color: "#1E3A8A" }}
          >
            Question
          </span>
        )}
        {!live && isAnnouncement && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ backgroundColor: BRAND_BLACK, color: "#FFB300" }}
          >
            Notice
          </span>
        )}
        {/* 3-dots menu — always visible so ANYONE can save the post.
            Save/Unsave shown to every viewer (localStorage-backed, no
            auth required). Delete shown only when the viewer owns the
            post (host or post author). This is the only way to delete
            content: per-comment delete is intentionally not exposed —
            an owner who wants a comment gone must delete the whole
            parent post. Saved bookmarks are exempt from the future
            30-post rotation cap (server side, next pass). */}
        <div className="relative">
          <button
            type="button"
            aria-label="Post actions"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
          >
            <MoreHorizontal size={16}/>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}/>
              <div
                className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg border bg-white shadow-lg"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onToggleSaved(post.id); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-neutral-800 hover:bg-neutral-50"
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck size={13} strokeWidth={2.4}/>
                      Unsave post
                    </>
                  ) : (
                    <>
                      <Bookmark size={13} strokeWidth={2.4}/>
                      Save post
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[12px] font-bold text-neutral-800 hover:bg-neutral-50"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <Flag size={13} strokeWidth={2.4}/>
                  Report post
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onDelete(post.id); }}
                    className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[12px] font-bold text-red-600 hover:bg-red-50"
                    style={{ borderColor: "rgba(139,69,19,0.10)" }}
                  >
                    <Trash2 size={13}/>
                    Delete post
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-800">
        {post.body}
      </p>

      {/* Photo grid */}
      {post.photoUrls && post.photoUrls.length > 0 && (
        <div className={`mt-3 grid gap-1 ${post.photoUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.photoUrls.slice(0, 4).map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative aspect-square overflow-hidden rounded-lg"
              style={{
                backgroundImage: `url('${url}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: "#F3F4F6"
              }}
              aria-hidden
            />
          ))}
        </div>
      )}

      {/* Reactions row */}
      <div className="mt-3 flex items-center justify-between border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
        <div className="flex items-center gap-3 text-[11px] font-black text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <Heart size={13} strokeWidth={2.2}/>
            {post.reactionsLike}
          </span>
          {/* Comments chip — toggles the inline dropdown BELOW instead
              of navigating away. If it says "4 comments", tapping it
              expands the panel and shows all 4 (fetched lazily from
              /api/canteens/posts/[id]/replies on first open). */}
          <button
            type="button"
            onClick={() => (threadOpen ? setThreadOpen(false) : openThread())}
            className="inline-flex items-center gap-1 transition hover:text-neutral-900"
            style={{ color: threadOpen ? BRAND_BLACK : undefined }}
          >
            <MessageSquare size={13} strokeWidth={2.2}/>
            {localReplyCount} <span className="text-neutral-400">comments</span>
          </button>
          {isSaved && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider"
              style={{ color: TAN }}
              title="Saved — exempt from feed rotation once server-side cap ships"
            >
              <BookmarkCheck size={12} strokeWidth={2.4}/>
              Saved
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => (threadOpen ? setThreadOpen(false) : openThread())}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97]"
          style={{ backgroundColor: TAN, color: "#FFFFFF" }}
        >
          <Send size={11} strokeWidth={2.5}/>
          {threadOpen ? "Hide" : "Reply"}
        </button>
      </div>

      {/* Inline comments panel — delegated to the shared
          <CommentThread> so bug fixes land on every surface at once.
          Parent still owns the "Comment · N" toggle chip above; when
          threadOpen we mount the thread in alwaysOpen mode. */}
      {threadOpen && (
        <div className="mt-3">
          <CommentThread
            postId={post.id}
            initialReplyCount={localReplyCount}
            viewerSlug={viewerSlug}
            api={CANTEEN_COMMENT_API}
            signInHref={`/sign-in?next=${encodeURIComponent(`/trade-off/yard/canteens/${canteenSlug}/feed`)}`}
            alwaysOpen
            onReplyPosted={() => setLocalReplyCount((n) => n + 1)}
          />
        </div>
      )}

      {/* Report modal — CSAM/sexual reports auto-hide the post via
          moderation_hidden_at column set by /api/support/tickets. */}
      {reportOpen && (
        <ReportContentModal
          context={{
            targetKind:  "canteen_post",
            targetId:    post.id,
            targetUrl:   typeof window !== "undefined"
              ? `${window.location.origin}/trade-off/yard/canteens/${canteenSlug}/post?reply=${encodeURIComponent(post.id)}`
              : `/trade-off/yard/canteens/${canteenSlug}/post?reply=${encodeURIComponent(post.id)}`,
            targetLabel: `${post.authorDisplayName}'s post in ${tradeLabel}`
          }}
          onClose={() => setReportOpen(false)}
        />
      )}
    </article>
  );
}
