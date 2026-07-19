"use client";

// CommentThread — the ONE comment implementation for every surface.
//
// Replaces three drift-prone copies:
//   • CanteenPageShell.ReactionRow (canteen home page)
//   • CanteenFeedShell inline reply block (/feed route)
//   • YardCommentsPanel (yard posts)
//
// Design principles:
//   1. One place to fix a comment bug forever. When Philip says
//      "comments don't work," this is the ONLY file to check.
//   2. Mock-safe by default. Any postId starting "mock-" (or empty)
//      triggers a procedural reply generator sized to initialCount,
//      so demo posts always open onto real-looking conversation
//      without touching an API.
//   3. Optimistic-first likes with rollback on server error.
//   4. Auth-gated composer. Guests see a "Sign in" CTA in place of
//      the textarea, never a broken flow.
//   5. Surface-specific endpoints supplied via the `api` prop —
//      canteens and yard use different route names but the client
//      logic is identical.
//
// Adding a NEW comment surface (e.g. Trade Center product Q&A) =
// import this + pass an api adapter. No new comment code should ever
// be written outside this file.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, MessageSquare, Send } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

export type ThreadReply = {
  id: string;
  authorSlug: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  likeCount: number;
};

/** Surface-specific endpoints. Each surface passes the API paths it
 *  uses; the fetch/POST logic here is identical. */
export type CommentThreadApi = {
  /** GET returning `{ ok: true, replies: ThreadReply[] }`. */
  fetchReplies: (postId: string) => Promise<ThreadReply[]>;
  /** POST returning `{ ok: true }`. Body defaults to `{ body: string }`. */
  postReply: (postId: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  /** POST reply-level reaction. Returns updated count + reacted flag. */
  postReplyLike: (replyId: string) => Promise<{ ok: boolean; count?: number; reacted?: boolean }>;
};

/** Standard adapters for the two live surfaces. Consumers pass one
 *  of these; adding a third surface just adds another export here. */
export const CANTEEN_COMMENT_API: CommentThreadApi = {
  async fetchReplies(postId) {
    const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/replies`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok && Array.isArray(data.replies) ? (data.replies as ThreadReply[]) : [];
  },
  async postReply(postId, body) {
    const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, error: data.error };
  },
  async postReplyLike(replyId) {
    // Canteen replies live in the same posts table as top-level posts
    // (with a parent_id set), so the shared reactions endpoint works.
    const res = await fetch(`/api/canteens/posts/${encodeURIComponent(replyId)}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "like" })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, count: data.count, reacted: data.reacted };
  }
};

export const YARD_COMMENT_API: CommentThreadApi = {
  async fetchReplies(postId) {
    const res = await fetch(`/api/trade-off/yard/posts/${encodeURIComponent(postId)}/comments`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !Array.isArray(data.comments)) return [];
    // Yard comments have nested author objects — flatten to ThreadReply shape.
    return (data.comments as Array<{
      id: string;
      body: string;
      createdAt: string;
      author?: { slug: string; display_name: string; trading_name?: string | null; avatar_url: string | null };
      reactions?: { like?: number };
    }>).map((c) => ({
      id: c.id,
      authorSlug: c.author?.slug ?? "unknown",
      authorDisplayName: c.author?.trading_name?.trim() || c.author?.display_name || "Member",
      authorAvatarUrl: c.author?.avatar_url ?? null,
      body: c.body,
      createdAt: c.createdAt,
      likeCount: c.reactions?.like ?? 0
    }));
  },
  async postReply(postId, body) {
    const res = await fetch(`/api/trade-off/yard/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, error: data.error };
  },
  async postReplyLike(replyId) {
    const res = await fetch(`/api/trade-off/yard/comments/${encodeURIComponent(replyId)}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "like" })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, count: data.count, reacted: data.reacted };
  }
};

// ─── Mock reply generator ────────────────────────────────────
//
// Rotates through a pool of realistic trade-voice lines so every
// mock post opens onto conversation matching its displayed count.
// Deterministic per postId so a post always reads the same way.

const MOCK_REPLY_POOL: Array<Omit<ThreadReply, "id" | "createdAt">> = [
  { authorSlug: "mike-watson",     authorDisplayName: "Mike Watson",     authorAvatarUrl: null, body: "Nice one. What did you end up using?", likeCount: 2 },
  { authorSlug: "rachel-simms",    authorDisplayName: "Rachel Simms",    authorAvatarUrl: null, body: "This is exactly the info I needed for a job next month — cheers.", likeCount: 4 },
  { authorSlug: "tom-fisher",      authorDisplayName: "Tom Fisher",      authorAvatarUrl: null, body: "Solid work. Any issues with the supplier?", likeCount: 1 },
  { authorSlug: "craig-mcdermott", authorDisplayName: "Craig McDermott", authorAvatarUrl: null, body: "Send us the postcode — I'll happily quote if you're short-handed.", likeCount: 3 },
  { authorSlug: "sarah-lee",       authorDisplayName: "Sarah Lee",       authorAvatarUrl: null, body: "Bookmarking this for the next similar spec.", likeCount: 2 },
  { authorSlug: "james-hall",      authorDisplayName: "James Hall",      authorAvatarUrl: null, body: "Nailed it — how long did it take start to finish?", likeCount: 5 },
  { authorSlug: "paul-webb",       authorDisplayName: "Paul Webb",       authorAvatarUrl: null, body: "Been meaning to try that method. Any prep tips?", likeCount: 1 },
  { authorSlug: "jason-hardy",     authorDisplayName: "Jason Hardy",     authorAvatarUrl: null, body: "Second the recommendation on the supplier — never had a bad batch.", likeCount: 3 }
];

function generateMockReplies(count: number, postKey: string): ThreadReply[] {
  const n = Math.max(0, Math.min(count, MOCK_REPLY_POOL.length));
  if (n === 0) return [];
  let hash = 0;
  for (let i = 0; i < postKey.length; i++) hash = ((hash * 31) + postKey.charCodeAt(i)) >>> 0;
  const offset = hash % MOCK_REPLY_POOL.length;
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const base = MOCK_REPLY_POOL[(offset + i) % MOCK_REPLY_POOL.length];
    return {
      ...base,
      id: `mockreply-${postKey}-${i}`,
      createdAt: new Date(now - (n - i) * 60 * 60 * 1000).toISOString()
    };
  });
}

function isMockId(id: string | null | undefined): boolean {
  return !id || id.startsWith("mock-") || id.startsWith("mockreply-");
}

// ─── Time formatting ─────────────────────────────────────────

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  return `${wk}w`;
}

// ─── Main component ──────────────────────────────────────────

const YELLOW = "#FFB300";
const GREEN_DARK = "#166534";
const BLACK = "#0A0A0A";

export type CommentThreadProps = {
  postId: string | null;
  initialReplyCount: number;
  viewerSlug: string | null;
  api: CommentThreadApi;
  /** Where to route the sign-in link for guests. */
  signInHref?: string;
  /** Compact mode drops the "Comment · N" button and always renders
   *  the panel open — used by Yard where the pattern is always-visible
   *  comments below every post. Default false = toggle button. */
  alwaysOpen?: boolean;
  /** Optional callback so parents can bump their local reply count
   *  when a new comment is posted. */
  onReplyPosted?: () => void;
};

export function CommentThread({
  postId,
  initialReplyCount,
  viewerSlug,
  api,
  signInHref,
  alwaysOpen = false,
  onReplyPosted
}: CommentThreadProps) {
  const [threadOpen, setThreadOpen] = useState(alwaysOpen);
  const [replies, setReplies] = useState<ThreadReply[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyCount, setReplyCount] = useState(initialReplyCount);
  const [likedReplyIds, setLikedReplyIds] = useState<Set<string>>(new Set());
  const [replyLikeCounts, setReplyLikeCounts] = useState<Record<string, number>>({});

  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep replyCount in sync when parents re-render with fresh count.
  useEffect(() => setReplyCount(initialReplyCount), [initialReplyCount]);

  const openThread = useCallback(async () => {
    setThreadOpen(true);
    if (replies !== null) return;
    // Mock fast-path: no API call, procedural reply set sized to count.
    if (isMockId(postId)) {
      setReplies(generateMockReplies(replyCount, postId ?? "mock"));
      return;
    }
    setLoading(true);
    try {
      const list = await api.fetchReplies(postId!);
      setReplies(list);
    } catch {
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [postId, replies, replyCount, api]);

  // Auto-load when alwaysOpen mode.
  useEffect(() => {
    if (alwaysOpen && replies === null) openThread();
  }, [alwaysOpen, replies, openThread]);

  async function submitReply() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    if (!viewerSlug) {
      setError("Sign in to comment.");
      return;
    }
    // Mock post: optimistic append only.
    if (isMockId(postId)) {
      setReplies((prev) => [
        ...(prev ?? []),
        {
          id: `local-${Date.now()}`,
          authorSlug: viewerSlug,
          authorDisplayName: viewerSlug,
          authorAvatarUrl: null,
          body: trimmed,
          createdAt: new Date().toISOString(),
          likeCount: 0
        }
      ]);
      setReplyCount((n) => n + 1);
      setBody("");
      onReplyPosted?.();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.postReply(postId!, trimmed);
      if (!result.ok) {
        if (result.error === "not-authenticated") setError("Sign in to comment.");
        else if (result.error === "not-a-member") setError("Join the canteen to comment.");
        else if (result.error === "body-too-short") setError("Write a bit more.");
        else setError("Comment failed. Try again.");
        return;
      }
      setBody("");
      setReplyCount((n) => n + 1);
      onReplyPosted?.();
      // Refetch so the fresh reply appears with its real timestamp + resolved author.
      try {
        const fresh = await api.fetchReplies(postId!);
        setReplies(fresh);
      } catch { /* silent — count already bumped */ }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(replyId: string, baseCount: number) {
    const already = likedReplyIds.has(replyId);
    const next = new Set(likedReplyIds);
    if (already) next.delete(replyId); else next.add(replyId);
    setLikedReplyIds(next);
    const current = replyLikeCounts[replyId] ?? baseCount;
    setReplyLikeCounts({ ...replyLikeCounts, [replyId]: Math.max(0, current + (already ? -1 : 1)) });

    if (isMockId(replyId)) return; // optimistic-only for mocks

    try {
      const result = await api.postReplyLike(replyId);
      if (result.ok && typeof result.count === "number") {
        setReplyLikeCounts((prev) => ({ ...prev, [replyId]: result.count! }));
        if (typeof result.reacted === "boolean") {
          setLikedReplyIds((prev) => {
            const set = new Set(prev);
            if (result.reacted) set.add(replyId); else set.delete(replyId);
            return set;
          });
        }
      } else {
        // Rollback on failure.
        setLikedReplyIds((prev) => {
          const set = new Set(prev);
          if (already) set.add(replyId); else set.delete(replyId);
          return set;
        });
        setReplyLikeCounts((prev) => ({ ...prev, [replyId]: current }));
      }
    } catch {
      setLikedReplyIds((prev) => {
        const set = new Set(prev);
        if (already) set.add(replyId); else set.delete(replyId);
        return set;
      });
      setReplyLikeCounts((prev) => ({ ...prev, [replyId]: current }));
    }
  }

  function beginReplyTo(authorDisplayName: string) {
    const mention = `@${authorDisplayName.split(/\s+/)[0]} `;
    setBody((prev) => prev.startsWith(mention) ? prev : `${mention}${prev}`);
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle button — hidden in alwaysOpen mode */}
      {!alwaysOpen && (
        <button
          type="button"
          onClick={() => (threadOpen ? setThreadOpen(false) : openThread())}
          className="inline-flex items-center gap-1 self-start text-[11px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
          style={{ color: threadOpen ? BLACK : undefined }}
        >
          <MessageSquare size={13}/>
          <span>{threadOpen ? "Hide" : "Comment"}</span>
          <span className="text-neutral-400">·</span>
          <span>{replyCount}</span>
        </button>
      )}

      {threadOpen && (
        <div className="rounded-lg border bg-neutral-50 p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500">
              <Loader2 size={11} className="animate-spin"/> Loading…
            </div>
          )}
          {!loading && replies !== null && replies.length === 0 && (
            <div className="text-[11.5px] text-neutral-500">No comments yet — be the first.</div>
          )}
          {replies && replies.length > 0 && (
            <ul className="flex flex-col gap-2">
              {replies.map((r) => (
                <CommentItem
                  key={r.id}
                  reply={r}
                  liked={likedReplyIds.has(r.id)}
                  likeCount={replyLikeCounts[r.id] ?? r.likeCount}
                  onLike={() => toggleLike(r.id, r.likeCount)}
                  onReply={() => beginReplyTo(r.authorDisplayName)}
                  canReply={viewerSlug !== null}
                />
              ))}
            </ul>
          )}

          {/* Composer or sign-in CTA */}
          {viewerSlug ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                ref={composerRef}
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 4000))}
                placeholder="Write a comment…"
                rows={2}
                className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[12.5px] leading-snug text-neutral-800 placeholder:text-neutral-400 focus:border-yellow-400 focus:outline-none"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
              <div className="flex items-center justify-between gap-2">
                {error ? (
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600">{error}</span>
                ) : (
                  <span className="text-[10px] text-neutral-400">Comments go live immediately.</span>
                )}
                <button
                  type="button"
                  onClick={submitReply}
                  disabled={submitting || body.trim().length === 0}
                  className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: YELLOW }}
                >
                  <Send size={11} strokeWidth={2.5}/>
                  {submitting ? "Posting…" : "Comment"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-white p-2.5" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
              <span className="text-[11.5px] leading-snug text-neutral-700">
                Free to read every comment. Create an account to reply.
              </span>
              <Link
                href={signInHref ?? "/sign-in"}
                className="inline-flex h-9 flex-shrink-0 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: BLACK }}
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── One comment row ─────────────────────────────────────────

function CommentItem({
  reply,
  liked,
  likeCount,
  onLike,
  onReply,
  canReply
}: {
  reply: ThreadReply;
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  onReply: () => void;
  canReply: boolean;
}) {
  const initial = reply.authorDisplayName.charAt(0).toUpperCase();
  return (
    <li
      className="flex items-start gap-2 rounded-lg bg-neutral-100 p-2"
      style={{ border: "1px solid rgba(139,69,19,0.06)" }}
    >
      {reply.authorAvatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={reply.authorAvatarUrl}
          alt=""
          className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black text-neutral-900"
          style={{ backgroundColor: YELLOW }}
        >
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-[10px] font-black uppercase tracking-wider">
          <Link href={`/trade/${reply.authorSlug}`} className="text-neutral-900 hover:underline">
            {reply.authorDisplayName}
          </Link>
          <span className="text-neutral-400">{formatAgo(reply.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-snug text-neutral-800">{reply.body}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <button
            type="button"
            onClick={onLike}
            className="inline-flex items-center gap-1 transition hover:text-neutral-900"
            style={{ color: liked ? GREEN_DARK : undefined }}
          >
            <Heart size={11} fill={liked ? GREEN_DARK : "none"}/>
            <span>Like</span>
            {likeCount > 0 && (
              <>
                <span className="text-neutral-400">·</span>
                <span>{likeCount}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onReply}
            className="inline-flex items-center gap-1 transition hover:text-neutral-900"
            disabled={!canReply}
            title={canReply ? "Reply" : "Sign in to reply"}
          >
            <MessageSquare size={11}/>
            <span>Reply</span>
          </button>
        </div>
      </div>
    </li>
  );
}
