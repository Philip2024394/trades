"use client";

// Click-to-expand modal for Yard posts.
//
// Facebook-feed pattern in our cream theme: click a card's image to open
// a lightbox that shows the full-size photo on top, the poster identity
// row, the full post body, and the comments feed (child posts fetched
// client-side). Cream surface, amber accents, no jarring dark shift.
//
// Used by YardChatPost: the landscape image thumbnail is the trigger.

import { useEffect, useState, useCallback } from "react";
import { X, MessageCircle, Loader2, ExternalLink } from "lucide-react";
import { timeAgoShort } from "@/lib/yardPosts";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  poster_name: string | null;
  poster_slug: string | null;
  poster_avatar_url: string | null;
};

type Poster = {
  slug: string;
  display_name: string;
  trading_name: string | null;
  avatar_url: string | null;
};

const BRAND_YELLOW = "#FFB300";

export function YardPostLightbox({
  postId,
  imageUrl,
  title,
  body,
  poster,
  tradeText,
  region,
  createdAt,
  waReplyUrl,
  variant = "landscape"
}: {
  postId: string;
  imageUrl: string;
  title: string;
  body: string;
  poster: Poster | null;
  tradeText: string;
  region: string | null;
  createdAt: string;
  waReplyUrl: string | null;
  /** Trigger footprint. "landscape" = 16:10-ish rectangle (old
   *  behaviour). "compact" = 44x44 square used in the chat card
   *  header. */
  variant?: "landscape" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch child posts once when opened.
  const loadComments = useCallback(async () => {
    if (comments !== null || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/trade-off/yard/posts?parent_id=${encodeURIComponent(postId)}&limit=5`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as { posts?: Comment[] };
        setComments(data.posts ?? []);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId, comments, loading]);

  useEffect(() => {
    if (open) loadComments();
  }, [open, loadComments]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const posterName =
    poster?.trading_name?.trim() || poster?.display_name || "Member";

  return (
    <>
      {/* Image trigger — landscape (default) or compact 44x44 square */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "compact"
            ? "relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[#1B1A17]/10 bg-[#FBF6EC] transition hover:opacity-90"
            : "relative block h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-[#1B1A17]/10 bg-[#FBF6EC] transition hover:opacity-90 sm:h-20 sm:w-32"
        }
        aria-label="Open post image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </button>

      {/* Lightbox */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          style={{ background: "rgba(20,17,10,0.72)" }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-[#FBF6EC] text-[#1B1A17] shadow-2xl"
            style={{ borderColor: "rgba(27,26,23,0.10)" }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95"
              style={{
                background: "#8B0F0F",
                border: "2px solid rgba(255,255,255,0.85)"
              }}
            >
              <X className="h-4 w-4 text-white" aria-hidden />
            </button>

            {/* Image */}
            <div className="relative aspect-[16/10] w-full bg-[#F7F0E0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              {/* Poster row */}
              <div className="flex items-center gap-2">
                {poster?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={poster.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-[#1B1A17]/10"
                  />
                ) : (
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold text-[#1B1A17]"
                    style={{ background: BRAND_YELLOW }}
                    aria-hidden
                  >
                    {posterName.charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-extrabold text-[#1B1A17]">
                      {posterName}
                    </span>
                    <span
                      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: BRAND_YELLOW }}
                      aria-label="Verified"
                    >
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0A0A0A"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#1B1A17]/60">
                    {tradeText}
                    {region ? ` · ${region}` : ""}
                    {" · "}
                    {timeAgoShort(createdAt)}
                  </p>
                </div>
              </div>

              {/* Title + body */}
              <h3 className="mt-4 text-[18px] font-black leading-tight text-[#1B1A17] sm:text-[20px]">
                {title}
              </h3>
              <p className="mt-2 whitespace-pre-line text-[14px] leading-[1.55] text-[#1B1A17]/80">
                {body}
              </p>

              {/* Comments */}
              <div className="mt-5 border-t border-[#1B1A17]/10 pt-4">
                <div className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-700">
                  <MessageCircle className="h-3 w-3" aria-hidden />
                  Comments
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 text-[12px] text-[#1B1A17]/55">
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden
                    />
                    Loading replies…
                  </div>
                ) : comments && comments.length > 0 ? (
                  <ul className="space-y-3">
                    {comments.map((c) => (
                      <li key={c.id} className="flex gap-2">
                        {c.poster_avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={c.poster_avatar_url}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[#1B1A17]/10"
                          />
                        ) : (
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-[#1B1A17]"
                            style={{ background: BRAND_YELLOW }}
                            aria-hidden
                          >
                            {(c.poster_name ?? "M").charAt(0)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12px] font-extrabold text-[#1B1A17]">
                              {c.poster_name ?? "Member"}
                            </span>
                            <span className="text-[10px] font-semibold text-[#1B1A17]/45">
                              {timeAgoShort(c.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-line text-[13px] leading-[1.45] text-[#1B1A17]/85">
                            {c.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-[#1B1A17]/55">
                    No replies yet. Be the first to open a thread.
                  </p>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-3 border-t border-[#1B1A17]/10 bg-white/50 px-5 py-3 sm:px-6">
              <a
                href={`/trade-off/yard/${postId}`}
                className="inline-flex items-center gap-1 text-[12px] font-extrabold text-amber-700 underline-offset-4 hover:underline"
              >
                Open full thread
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              {waReplyUrl ? (
                <a
                  href={waReplyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-5 text-[12px] font-extrabold text-white shadow-md transition active:scale-[0.97]"
                  style={{
                    background: "#0F7A3F",
                    boxShadow: "0 6px 18px rgba(15,122,63,0.35)"
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
                  </svg>
                  Reply on WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
