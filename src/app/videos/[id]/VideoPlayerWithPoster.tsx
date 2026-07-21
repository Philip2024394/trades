"use client";

// VideoPlayerWithPoster — leaf-page video player.
//
// v2 architecture (fixes the "won't play" bug from v1):
//   • ALWAYS renders the <video> element (never conditionally
//     remounted) — ref stays stable, .play() reliably fires
//   • Poster + play-button overlay conditionally shown ON TOP of
//     the video via absolute positioning
//   • On play-button click: overlay hides, video.play() fires,
//     native controls take over (including full-screen button)
//   • YouTube-scale play button (~80/112px) — not 640px
//
// Fires 'view' metric on first play, 'view_complete' on ended.

import { useRef, useState } from "react";
import { PLAY_BUTTON_URL } from "../config";
import { OverVideoSaveButton } from "@/components/media/OverVideoSaveButton";

type Props = {
  videoId:         string;
  videoUrl:        string;
  posterUrl:       string;
  title:           string;
  merchantSlug?:   string;
  viewCount?:      number;
  saveCount?:      number;
  publishedAt?:    string | null;
  durationSeconds?: number | null;
  memberCount?:    number;  // trades in this trade's network — placeholder until follow-model lands
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <p className="text-[9.5px] font-black uppercase tracking-[0.24em] opacity-70 md:text-[10.5px]">{label}</p>
      <p className="mt-0.5 text-[13px] font-black tabular-nums md:text-[15px]">{value}</p>
    </li>
  );
}

function fmtDuration(s?: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function VideoPlayerWithPoster({
  videoId, videoUrl, posterUrl, title, merchantSlug,
  viewCount = 0, saveCount = 0, publishedAt = null,
  durationSeconds = null, memberCount = 0
}: Props) {
  const videoRef             = useRef<HTMLVideoElement>(null);
  const [overlayHidden, setOverlayHidden] = useState(false);

  function handlePlay() {
    const el = videoRef.current;
    if (!el) return;
    // Hide overlay + fire play. Native controls handle the rest.
    setOverlayHidden(true);
    el.play().catch(() => { /* silent — user gesture already satisfied by button click */ });
    fetch(`/api/videos/${videoId}/metric`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "view", actor_kind: "anonymous" })
    }).catch(() => undefined);
  }

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-2xl bg-black shadow-2xl"
      style={{ maxHeight: "70vh" }}
    >
      {/* Persistent title header — sits OVER the video at the top-left,
          visible whether the video is playing or paused. Streaming-app
          pattern (BBC iPlayer / Netflix chyron). Save button lives on
          the right side of the same header bar. Pointer-events-none on
          the container; interactive elements re-enable it. */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 z-10 flex items-start justify-between gap-3 p-4 md:p-6"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)" }}
      >
        <p
          className="text-[15px] font-black leading-tight text-white md:text-[20px]"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}
        >
          {title}
        </p>
      </div>

      {/* Save Video button — top-right, over the video. Handles unauth
          with a signup-prompt popover directing to SiteBook OR Canteen. */}
      <div className="pointer-events-auto">
        <OverVideoSaveButton videoId={videoId}/>
      </div>

      {/* Always-rendered <video>. Ref stable → .play() reliably fires
          on click. Native controls include full-screen, scrub, volume.
          max-h-[70vh] caps height so the whole player + metadata +
          play button stay visible without scrolling on any laptop. */}
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={posterUrl}
        className="mx-auto block h-auto w-full"
        style={{ maxHeight: "70vh" }}
        src={videoUrl}
        onPlay={() => setOverlayHidden(true)}
        onEnded={() => {
          fetch(`/api/videos/${videoId}/metric`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ event: "view_complete", actor_kind: "anonymous" })
          }).catch(() => undefined);
        }}
      />

      {/* Poster + play button overlay — absolute, on top of the video.
          Hides on first play (either via button click or native controls). */}
      {!overlayHidden && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Play ${title}`}
          className="absolute inset-0 block cursor-pointer"
        >
          {/* Full poster image — matches video dimensions.
              object-contain (not cover) so the poster shows fully
              within the max-h-[70vh] container without cropping. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-contain"
          />
          {/* Subtle darkening for play-button contrast */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.32) 100%)" }}
          />
          {/* Centered play button — YouTube-scale (80/112px) */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center transition-transform hover:scale-[1.06] active:scale-[0.96]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PLAY_BUTTON_URL}
              alt=""
              aria-hidden="true"
              className="h-20 w-20 drop-shadow-2xl md:h-28 md:w-28"
            />
          </div>
          {/* Left-side metadata overlay — offset from top so the
              persistent title header above doesn't overlap. Title now
              lives in the top header, not here. */}
          <div className="pointer-events-none absolute top-[64px] left-0 flex w-1/3 max-w-[420px] flex-col justify-start gap-4 p-6 md:top-[80px] md:p-10">
            <ul className="space-y-2.5 text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>
              <MetaRow label="Plays"         value={viewCount.toLocaleString("en-GB")}/>
              <MetaRow label="Saves"         value={saveCount.toLocaleString("en-GB")}/>
              <MetaRow label="Trade members" value={memberCount.toLocaleString("en-GB")}/>
              <MetaRow label="Uploaded"      value={fmtDate(publishedAt)}/>
              <MetaRow label="Length"        value={fmtDuration(durationSeconds)}/>
            </ul>
            {merchantSlug && (
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-neutral-100 md:text-[11.5px]" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
                by {merchantSlug.replace(/-/g, " ")}
              </p>
            )}
          </div>
        </button>
      )}
    </div>
  );
}
