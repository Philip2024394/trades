"use client";

// Inline Facebook-style comment thread for a Yard post.
//
// Renders under the post card, hidden by default. Tap "Comments (N)" to
// expand. Panel shows the thread + a pinned composer at the bottom.
// One-level nesting (a reply-to-reply is flattened at the API layer).
//
// Auth: comments are trades-only. Reactor identity comes from URL
// query params (?slug=&token=) — same magic-link pattern as the
// existing reaction bar. Un-authed viewers see the thread + a subtle
// "sign in as a trade to reply" hint instead of the composer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  MessageCircle,
  Send,
  ThumbsUp,
  ThumbsDown,
  Reply as ReplyIcon
} from "lucide-react";
import { timeAgoShort } from "@/lib/yardPosts";

type CommentAuthor = {
  slug: string;
  display_name: string;
  trading_name: string | null;
  avatar_url: string | null;
  primary_trade: string;
};

type Comment = {
  id: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: CommentAuthor | null;
  reactions: { like: number; dislike: number };
};

const BRAND_YELLOW = "#FFB300";

// How many top-level comments render before the "View all" link
// collapses the rest. Matches Facebook/Instagram (2–3 preview).
const PREVIEW_COUNT = 3;

// Any comment created within this many seconds of render is "just
// now" — gets a small green pulse dot so the thread feels live.
const FRESH_WINDOW_SECONDS = 30;

export function YardCommentsPanel({
  postId,
  initialCount,
  postAuthorSlug
}: {
  postId: string;
  initialCount: number;
  /** The OP's slug — used to pin an OP follow-up comment above the
   *  newest 3 preview when the OP has replied to their own thread
   *  (clarification, postcode, day rate, etc.). Optional so existing
   *  call sites keep compiling. */
  postAuthorSlug?: string;
}) {
  // Comment preview state — newest 3 shown by default. Merchant taps
  // "View all N" to expand inline; collapses back with "Show fewer".
  const [expanded, setExpanded] = useState(false);
  // Comments panel is always open per Philip 2026-07-13 — no collapse
  // toggle. Kept as a state variable so the load effect still fires.
  const [open] = useState(true);
  const [count, setCount] = useState(initialCount);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [auth, setAuth] = useState<{ slug: string; token: string } | null>(
    null
  );
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Auth precedence: URL magic-link params → cookie trade session.
  // Cookie sessions authenticate downstream on the POST endpoint (see
  // the endpoint's readTradeSession fallback), so the token can be
  // empty here — we still show the composer and let the server verify.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const urlSlug = sp.get("slug");
    const urlToken = sp.get("token");
    if (urlSlug && urlToken) {
      setAuth({ slug: urlSlug, token: urlToken });
      setAuthed(true);
      return;
    }
    let cancelled = false;
    fetch("/api/trade-off/session", { credentials: "include", cache: "no-store" })
      .then((res) => res.ok ? res.json() : { ok: false })
      .then((body: { ok?: boolean; slug?: string }) => {
        if (cancelled) return;
        if (body?.ok && body.slug) {
          // Token is empty; the endpoint reads the cookie session.
          setAuth({ slug: body.slug, token: "" });
          setAuthed(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(postId)}/comments`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { ok: boolean; comments?: Comment[] };
      if (res.ok && data.ok && data.comments) {
        setComments(data.comments);
        setCount(data.comments.length);
      } else {
        setError("Couldn't load comments.");
      }
    } catch {
      setError("Network error loading comments.");
    } finally {
      setLoading(false);
    }
  }, [postId, loading]);

  useEffect(() => {
    if (open && comments === null) load();
  }, [open, comments, load]);

  // Comment tree — group by parent so we render top-level + their
  // replies without a second query.
  const { topLevel, repliesByParent } = useMemo(() => {
    const top: Comment[] = [];
    const replies: Record<string, Comment[]> = {};
    for (const c of comments ?? []) {
      if (!c.parentCommentId) top.push(c);
      else {
        const list = replies[c.parentCommentId] ?? [];
        list.push(c);
        replies[c.parentCommentId] = list;
      }
    }
    return { topLevel: top, repliesByParent: replies };
  }, [comments]);

  // Preview slicing:
  //   - Newest 3 comments render by default (bottom of the list — the
  //     most recent responses to the OP)
  //   - Any comment authored by the OP inside the hidden set is pinned
  //     ABOVE the newest 3 with a small "author" chip so buyers don't
  //     miss OP clarifications (postcode / day rate / update)
  //   - "View all N comments" text link toggles the full list
  //   - When expanded, a "Show fewer" collapse sits at the bottom
  const { visibleTop, hiddenCount, pinnedOp } = useMemo(() => {
    if (expanded || topLevel.length <= PREVIEW_COUNT) {
      return { visibleTop: topLevel, hiddenCount: 0, pinnedOp: null as Comment | null };
    }
    const sliceStart = topLevel.length - PREVIEW_COUNT;
    const visible = topLevel.slice(sliceStart);
    const hidden = topLevel.slice(0, sliceStart);
    // First OP-authored comment in the hidden set — the most
    // context-carrying one (usually the OP's early clarification).
    const opFollow = postAuthorSlug
      ? hidden.find((c) => c.author?.slug === postAuthorSlug) ?? null
      : null;
    return { visibleTop: visible, hiddenCount: hidden.length, pinnedOp: opFollow };
  }, [expanded, topLevel, postAuthorSlug]);

  // "Just now" freshness check — comment created inside the fresh window.
  const nowMs = Date.now();
  function isFresh(iso: string): boolean {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return false;
    return (nowMs - t) / 1000 <= FRESH_WINDOW_SECONDS;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (posting) return;
    if (!auth) {
      setError("Sign in as a trade to reply.");
      return;
    }
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(postId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Send the session cookie so cookie-auth sessions (Dev Pass
          // + normal login) authenticate on the server even when the
          // token isn't in the body.
          credentials: "include",
          body: JSON.stringify({
            slug: auth.slug,
            edit_token: auth.token,
            body,
            parent_comment_id: replyTo ?? undefined
          })
        }
      );
      const data = (await res.json()) as {
        ok: boolean;
        commentId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "unauthorised"
            ? "Your sign-in expired. Grab a fresh magic link from your dashboard."
            : data.error === "listing_not_live"
              ? "Your listing isn't live yet."
              : "Couldn't post — try again."
        );
        return;
      }
      // Refetch to pick up the new row + its author denorm.
      setDraft("");
      setReplyTo(null);
      await load();
    } catch {
      setError("Network error posting comment.");
    } finally {
      setPosting(false);
    }
  }

  async function react(commentId: string, kind: "like" | "dislike") {
    if (!auth) return;
    // Optimistic bump
    setComments((prev) => {
      if (!prev) return prev;
      return prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              reactions: {
                ...c.reactions,
                [kind]: c.reactions[kind] + 1
              }
            }
          : c
      );
    });
    try {
      await fetch(
        `/api/trade-off/yard/comments/${encodeURIComponent(commentId)}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: auth.slug, token: auth.token, kind })
        }
      );
    } catch {
      /* silent; the count will drift by 1 until refetch */
    }
  }

  return (
    <div className="mt-2 border-t border-neutral-100 pt-2">
      {/* Keyframes for the "just now" fresh dot on comment avatars.
          Same 2.2s pulse cadence used elsewhere on the platform so
          "live" indicators feel consistent. */}
      <style>{`
        @keyframes yc-fresh-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(22,101,52,0.55); }
          70%  { box-shadow: 0 0 0 5px rgba(22,101,52,0); }
          100% { box-shadow: 0 0 0 0 rgba(22,101,52,0); }
        }
      `}</style>
      <div
        className="inline-flex w-full items-center gap-1.5 px-2 py-2 text-[12px] font-extrabold text-neutral-700"
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        Comments ({count})
      </div>

      {open && (
        <div className="mt-1 rounded-xl bg-neutral-50 px-3 py-3">
          {loading && !comments ? (
            <div className="flex items-center gap-2 py-4 text-[12px] text-neutral-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading comments…
            </div>
          ) : comments && comments.length === 0 ? (
            <p className="py-2 text-[12px] text-neutral-500">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Pinned OP follow-up — only when there's a hidden OP
                  comment above the newest 3. Rendered with a small
                  "author" chip so buyers spot the OP context first. */}
              {pinnedOp && (
                <div>
                  <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.14em] text-amber-800">
                    From the poster
                  </div>
                  <CommentRow
                    comment={pinnedOp}
                    fresh={isFresh(pinnedOp.createdAt)}
                    onReact={authed ? react : undefined}
                  />
                </div>
              )}

              {/* "View all" text link — only visible when there are
                  hidden comments and the panel is collapsed. Right-
                  aligned + generous tap area so trade fingers hit
                  it cleanly without accidentally tapping a comment. */}
              {!expanded && hiddenCount > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[12.5px] font-black text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 active:scale-[0.98]"
                  >
                    View all {count} comments
                    <span aria-hidden className="text-[11px]">↓</span>
                  </button>
                </div>
              )}

              <ul className="space-y-3">
                {visibleTop.map((c) => (
                  <li key={c.id}>
                    <CommentRow
                      comment={c}
                      fresh={isFresh(c.createdAt)}
                      onReact={authed ? react : undefined}
                      onReply={
                        authed
                          ? (id) => {
                              setReplyTo(id);
                              setTimeout(() => composerRef.current?.focus(), 0);
                            }
                          : undefined
                      }
                    />
                    {repliesByParent[c.id]?.length ? (
                      <ul className="ml-8 mt-2 space-y-2 border-l-2 border-neutral-200 pl-3">
                        {repliesByParent[c.id].map((r) => (
                          <li key={r.id}>
                            <CommentRow
                              comment={r}
                              small
                              fresh={isFresh(r.createdAt)}
                              onReact={authed ? react : undefined}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/* Collapse — visible when expanded, right-aligned +
                  same tap area as the "View all" trigger for consistency. */}
              {expanded && topLevel.length > PREVIEW_COUNT && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[12px] font-black text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 active:scale-[0.98]"
                  >
                    <span aria-hidden className="text-[11px]">↑</span>
                    Show fewer comments
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Composer */}
          {authed ? (
            <form onSubmit={submit} className="mt-3 space-y-1.5">
              {replyTo && (
                <div className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                  <span>Replying</span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-amber-800/70 hover:text-amber-900"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    replyTo ? "Write your reply…" : "Write a comment…"
                  }
                  rows={1}
                  maxLength={2000}
                  className="flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-[1.4] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                  }}
                />
                <button
                  type="submit"
                  disabled={posting || draft.trim().length === 0}
                  className="inline-flex h-9 items-center justify-center rounded-full px-3 text-[12px] font-black text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:opacity-50"
                  style={{ background: BRAND_YELLOW }}
                  aria-label="Post comment"
                >
                  {posting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
              {error && (
                <p className="text-[11px] font-semibold text-red-700">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <p className="mt-3 rounded-md bg-white px-2 py-1.5 text-[11px] text-neutral-500">
              Sign in as a trade from your dashboard to reply.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  small = false,
  fresh = false,
  onReact,
  onReply
}: {
  comment: Comment;
  small?: boolean;
  /** True when this comment was posted inside the fresh window
   *  (≤30s ago). Renders a small green pulse dot next to the avatar
   *  so the thread feels live without motion elsewhere. */
  fresh?: boolean;
  onReact?: (id: string, kind: "like" | "dislike") => void;
  onReply?: (parentId: string) => void;
}) {
  const author = comment.author;
  const name =
    author?.trading_name?.trim() || author?.display_name || "Member";
  const avatarSize = small ? "h-6 w-6" : "h-7 w-7";
  return (
    <div className="flex gap-2">
      <div className="relative shrink-0">
        {author?.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={author.avatar_url}
            alt=""
            className={`${avatarSize} rounded-full object-cover ring-1 ring-neutral-200`}
          />
        ) : (
          <span
            className={`${avatarSize} inline-flex items-center justify-center rounded-full text-[10px] font-black text-neutral-900`}
            style={{ background: BRAND_YELLOW }}
            aria-hidden
          >
            {name.charAt(0)}
          </span>
        )}
        {/* Just-now pulse — small green dot on the corner of the
            avatar with the same 2.2s glow cadence used elsewhere. */}
        {fresh && (
          <span
            aria-label="Just posted"
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white"
            style={{
              backgroundColor: "#166534",
              animation: "yc-fresh-pulse 2.2s ease-out infinite"
            }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="inline-block rounded-2xl bg-white px-3 py-1.5 shadow-sm">
          <div className="flex items-baseline gap-1.5">
            {author ? (
              <a
                href={`/${author.slug}`}
                className="text-[12px] font-extrabold text-neutral-900 hover:underline"
              >
                {name}
              </a>
            ) : (
              <span className="text-[12px] font-extrabold text-neutral-500">
                {name}
              </span>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[1.4] text-neutral-800">
            {comment.body}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-3 pl-2 text-[10px] font-bold text-neutral-500">
          <span>{timeAgoShort(comment.createdAt)}</span>
          {onReact && (
            <>
              <button
                type="button"
                onClick={() => onReact(comment.id, "like")}
                className="inline-flex items-center gap-0.5 hover:text-amber-700"
              >
                <ThumbsUp className="h-3 w-3" aria-hidden />
                {comment.reactions.like > 0 && (
                  <span>{comment.reactions.like}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onReact(comment.id, "dislike")}
                className="inline-flex items-center gap-0.5 hover:text-neutral-700"
              >
                <ThumbsDown className="h-3 w-3" aria-hidden />
                {comment.reactions.dislike > 0 && (
                  <span>{comment.reactions.dislike}</span>
                )}
              </button>
            </>
          )}
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="inline-flex items-center gap-0.5 hover:text-amber-700"
            >
              <ReplyIcon className="h-3 w-3" aria-hidden />
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
