"use client";

// OverVideoSaveButton — save button positioned over the video
// player, top-right. Always visible (over the video whether playing
// or paused), styled to read over any video content.
//
// Auth behaviour:
//   • Authed (merchant OR homeowner) → toggles save/unsave via API
//   • Unauthed → opens a signup-prompt popover with two account paths:
//     - SiteBook (homeowners) → /homeowners/signup
//     - Canteen (trades) → /trade-off/pricing

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Loader2, Home, Wrench, X, CircleCheck } from "lucide-react";

type Props = {
  videoId: string;
};

export function OverVideoSaveButton({ videoId }: Props) {
  const [saved,   setSaved]   = useState<boolean | null>(null);
  const [authed,  setAuthed]  = useState<boolean>(true);
  const [busy,    setBusy]    = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Load initial state
  useEffect(() => {
    fetch(`/api/media/save?media_kind=video&media_id=${videoId}`)
      .then((r) => r.json())
      .then((j) => {
        setSaved(Boolean(j.saved));
        setAuthed(Boolean(j.authed));
      })
      .catch(() => setSaved(false));
  }, [videoId]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [popoverOpen]);

  async function onClick() {
    if (busy) return;
    // Unauthed → open signup popover
    if (!authed) {
      setPopoverOpen(true);
      return;
    }
    setBusy(true);
    const res  = await fetch("/api/media/save", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ media_kind: "video", media_id: videoId })
    });
    const json = await res.json().catch(() => ({ ok: false }));
    if (json.ok) {
      setSaved(Boolean(json.saved));
    } else if (json.error === "auth-required") {
      setAuthed(false);
      setPopoverOpen(true);
    }
    setBusy(false);
  }

  const isSaved = saved === true;

  return (
    <div className="absolute top-0 right-0 z-10 p-4 md:p-6">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || saved === null}
        aria-pressed={isSaved}
        className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.04] active:scale-[0.98] disabled:opacity-60 md:h-11 md:text-[12px]"
        style={
          isSaved
            ? { backgroundColor: "#166534", color: "#FFFFFF" }
            : { backgroundColor: "rgba(10,10,10,0.85)", color: "#FFFFFF", backdropFilter: "blur(8px)" }
        }
      >
        {busy || saved === null ? (
          <Loader2 size={14} className="animate-spin"/>
        ) : isSaved ? (
          <BookmarkCheck size={14} strokeWidth={2.6}/>
        ) : (
          <Bookmark size={14} strokeWidth={2.6}/>
        )}
        {isSaved ? "Saved" : "Save video"}
      </button>

      {/* Signup-prompt popover — appears when unauthed user clicks Save */}
      {popoverOpen && (
        <div
          ref={popRef}
          className="absolute right-0 top-full mt-2 w-[300px] rounded-2xl border-2 bg-white p-4 shadow-2xl md:w-[360px]"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <button
            type="button"
            onClick={() => setPopoverOpen(false)}
            aria-label="Close"
            className="absolute right-2 top-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X size={13}/>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
              <Bookmark size={14} strokeWidth={2.6} className="text-neutral-900"/>
            </div>
            <p className="text-[13px] font-black text-neutral-900">Create a free account to save</p>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-neutral-600">
            Saved videos appear on your SiteBook or Canteen dashboard — one click to find them again, share to Yard, or attach to a quote.
          </p>

          <div className="mt-3 space-y-2">
            <Link
              href="/homeowners/signup"
              className="flex items-start gap-2 rounded-lg border-2 bg-white p-3 hover:-translate-y-0.5 transition"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <Home size={14} strokeWidth={2.6} className="mt-0.5 shrink-0 text-neutral-900"/>
              <div>
                <p className="text-[12px] font-black text-neutral-900">Homeowner · SiteBook</p>
                <p className="text-[10.5px] text-neutral-600">Free · Save videos + track home projects.</p>
              </div>
            </Link>
            <Link
              href="/trade-off/pricing"
              className="flex items-start gap-2 rounded-lg border-2 bg-white p-3 hover:-translate-y-0.5 transition"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <Wrench size={14} strokeWidth={2.6} className="mt-0.5 shrink-0 text-neutral-900"/>
              <div>
                <p className="text-[12px] font-black text-neutral-900">Trade · Canteen</p>
                <p className="text-[10.5px] text-neutral-600">Free tier · Build your video portfolio + Yard presence.</p>
              </div>
            </Link>
          </div>

          <p className="mt-3 text-[10px] text-neutral-500">
            Already have an account?{" "}
            <Link href="/home/sign-in" className="font-black text-neutral-900 hover:underline">Sign in</Link>
          </p>
        </div>
      )}

      {/* Saved confirmation flash */}
      {isSaved && !popoverOpen && (
        <div className="pointer-events-none absolute right-4 top-14 flex items-center gap-1 rounded-full bg-green-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white opacity-0 shadow-lg" style={{ animation: "fadeInOut 2s ease" }}>
          <CircleCheck size={11}/> Saved
        </div>
      )}
    </div>
  );
}
