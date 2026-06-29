"use client";

// Inline "Flag" affordance for a Yard post card. Sits in the meta row
// next to the reaction bar so members can quickly report bad content
// without overwhelming the conversion CTA.
//
// Auth model matches YardReactionBar: read ?slug=&token= from the URL
// — if the member isn't authed we still render the icon but tap shows
// a polite sign-in nudge. The flag API resolves slug → listing_id +
// verifies the edit_token against the listings table.
//
// On confirm we POST to /api/trade-off/yard/flag. After success the
// button replaces itself with a small "Flagged for review" line so the
// member sees their action took effect (and can't double-tap).

import { useEffect, useRef, useState } from "react";

export function YardFlagButton({
  postId,
  posterSlug
}: {
  postId: string;
  /** Poster's listing slug. Used to hide the Flag button on the
   *  viewer's own posts (they can delete instead, which is out of
   *  scope here). */
  posterSlug?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [isOwn, setIsOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // Read slug+token from URL on mount — same pattern as the reaction
  // bar. We don't surface the absence of auth as an error up front;
  // the popover handles that on confirm so the affordance still looks
  // tappable to logged-out members. Also detect whether this post
  // belongs to the viewer so we can hide the Flag entirely.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    setAuthed(Boolean(slug && token));
    if (slug && posterSlug && slug === posterSlug) {
      setIsOwn(true);
    }
  }, [posterSlug]);

  if (isOwn) return null;

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(ev: MouseEvent) {
      if (!ref.current) return;
      if (ev.target instanceof Node && !ref.current.contains(ev.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function submit() {
    if (busy) return;
    setError(null);
    if (!authed) {
      setError("Please log in to flag posts.");
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug") ?? "";
    const token = sp.get("token") ?? "";
    setBusy(true);
    try {
      const res = await fetch("/api/trade-off/yard/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_id: postId, slug, token })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.error || `Couldn't flag (${res.status}).`);
        return;
      }
      setOpen(false);
      setFlagged(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (flagged) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-neutral-400">
        Flagged for review
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Flag this post for review"
        aria-expanded={open}
        className="group inline-flex items-center gap-1 text-[13px] font-bold text-neutral-400 transition hover:text-red-600"
      >
        <FlagGlyph />
        Flag
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Confirm flag"
          className="absolute right-0 bottom-full z-20 mb-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
        >
          <p className="text-[13px] leading-snug text-neutral-700">
            Flag this post? Admins review flagged posts within a few hours.
          </p>
          {error && (
            <p className="mt-2 text-[13px] font-bold text-red-600">{error}</p>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={busy}
              className="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-extrabold text-white transition disabled:opacity-60"
              style={{ background: "#DC2626" }}
            >
              {busy ? "…" : "Yes, flag"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlagGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export default YardFlagButton;
