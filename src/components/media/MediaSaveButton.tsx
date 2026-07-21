"use client";

// MediaSaveButton — toggle save state on any video or photo.
// Auto-detects auth (works for both homeowner + merchant sessions).
// Used on: video leaf, video grid cards (later), photo cards (later).
//
// Fires POST /api/media/save which:
//   • Creates a save row on first click
//   • Deletes it on second click (toggle)
//   • Fires the notebook_save metric event on save
//   • Bumps the video's save_count for hot-path reads

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

type Props = {
  mediaKind:  "video" | "photo";
  mediaId:    string;
  variant?:   "primary" | "compact";
};

export function MediaSaveButton({ mediaKind, mediaId, variant = "primary" }: Props) {
  const [saved,  setSaved]  = useState<boolean | null>(null);   // null = loading initial state
  const [authed, setAuthed] = useState(true);
  const [busy,   setBusy]   = useState(false);

  // Load initial saved state
  useEffect(() => {
    fetch(`/api/media/save?media_kind=${mediaKind}&media_id=${mediaId}`)
      .then((r) => r.json())
      .then((j) => {
        setSaved(Boolean(j.saved));
        setAuthed(Boolean(j.authed));
      })
      .catch(() => setSaved(false));
  }, [mediaKind, mediaId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/media/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ media_kind: mediaKind, media_id: mediaId })
    });
    const json = await res.json().catch(() => ({ ok: false }));
    if (json.ok) {
      setSaved(Boolean(json.saved));
    } else if (json.error === "auth-required") {
      setAuthed(false);
    }
    setBusy(false);
  }

  if (!authed) {
    return (
      <a
        href="/home/sign-in"
        className={`inline-flex items-center gap-1.5 rounded-lg border-2 bg-white font-black uppercase tracking-wider text-neutral-900 hover:-translate-y-0.5 transition ${
          variant === "compact" ? "h-9 px-3 text-[10.5px]" : "h-11 px-5 text-[11.5px]"
        }`}
        style={{ borderColor: "rgba(139,69,19,0.20)" }}
      >
        <Bookmark size={variant === "compact" ? 11 : 13} strokeWidth={2.6}/>
        Sign in to save
      </a>
    );
  }

  const isSaved = saved === true;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || saved === null}
      aria-pressed={isSaved}
      className={`inline-flex items-center gap-1.5 rounded-lg font-black uppercase tracking-wider transition disabled:opacity-60 ${
        variant === "compact" ? "h-9 px-3 text-[10.5px]" : "h-11 px-5 text-[11.5px]"
      }`}
      style={
        isSaved
          ? { backgroundColor: "#166534", color: "#FFFFFF" }
          : { backgroundColor: "#FFB300", color: "#0A0A0A" }
      }
    >
      {busy || saved === null ? (
        <Loader2 size={variant === "compact" ? 11 : 13} className="animate-spin"/>
      ) : isSaved ? (
        <BookmarkCheck size={variant === "compact" ? 11 : 13} strokeWidth={2.6}/>
      ) : (
        <Bookmark size={variant === "compact" ? 11 : 13} strokeWidth={2.6}/>
      )}
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
