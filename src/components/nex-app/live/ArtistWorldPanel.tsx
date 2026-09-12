"use client";

// src/components/nex-app/live/ArtistWorldPanel.tsx
//
// NEX Music/Video · Artist World · Phase M · §3 §4 §9 §18 §19
//
// Slides in from the LEFT when the user swipes ← on the media screen.
// Represents the CURRENT PLAYING ARTIST (owner_id · continuity §9).
// Sections: PLAYLIST · LYRICS · LIVE · EVENTS · CHAT.
//
// Data discipline (§29 truth):
//   · Playlist is derived from the caller-supplied `artistTracks` slice
//     (peer items sharing the current owner_id). No fake tracks.
//   · Lyrics · honest "Lyrics aren't available for this track yet."
//     placeholder when no source · never invent.
//   · Live · shown only when caller-supplied `hasLiveNow` is true.
//   · Events · honest empty state if no data.
//   · Book / Contact · only when caller-supplied capability flag is
//     true · otherwise the row is disabled with an honest chip.
//   · No fake streams / followers / popularity anywhere.

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, Music2, MessageCircle, Radio, CalendarDays, FileText } from "lucide-react";

export type ArtistTrack = {
  media_id: string;
  title: string | null;
  is_current: boolean;
  is_mock_fixture: boolean;
};

export type ArtistWorldPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
  /** Current playing artist identifier · owner_id from active media */
  artistId: string | null;
  artistDisplayName: string | null;
  /** Peer tracks sharing this owner_id · caller supplies · never invented */
  artistTracks: ArtistTrack[];
  /** True only when caller has verified this artist has a Live session now */
  hasLiveNow?: boolean;
  /** Capability gates · honest disabled state when false */
  chatCapabilityAvailable?: boolean;
  /** Fires when user picks a peer track in the playlist */
  onSelectTrack?: (media_id: string) => void;
  /** Fires when user taps Chat · caller routes to the NEX chat surface */
  onOpenChat?: () => void;
};

export function ArtistWorldPanel({
  isOpen, onClose, panelId,
  artistId, artistDisplayName, artistTracks,
  hasLiveNow = false, chatCapabilityAvailable = false,
  onSelectTrack, onOpenChat,
}: ArtistWorldPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Escape / back-swipe closes
  useEffect(() => {
    if (!isOpen) return;
    const h = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); onClose(); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const handleSelectTrack = useCallback((id: string) => {
    if (onSelectTrack) onSelectTrack(id);
    onClose();
  }, [onSelectTrack, onClose]);

  if (!isOpen) return null;

  const displayName = artistDisplayName ?? (artistId ? artistId.slice(0, 20) : "Unknown artist");

  return (
    <div
      ref={rootRef}
      id={panelId}
      role="dialog"
      aria-modal="false"
      aria-label={`Artist world · ${displayName}`}
      data-testid="nex-artist-world-panel"
      className="absolute inset-0 z-40 flex bg-black/40 backdrop-blur-md animate-[nex-aw-fade_140ms_ease-out]"
      onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full bg-neutral-950 text-white overflow-y-auto flex flex-col animate-[nex-aw-slide-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
        data-testid="nex-artist-world-body"
      >
        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-4 border-b border-white/10 sticky top-0 bg-neutral-950/95 backdrop-blur z-10">
          <button
            type="button"
            aria-label="Close Artist World"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            data-testid="nex-artist-world-close"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Artist</div>
            <div className="text-lg font-semibold truncate">{displayName}</div>
          </div>
        </header>

        {/* Playlist */}
        <section aria-labelledby={`${panelId}-playlist`} className="px-4 py-4">
          <h3 id={`${panelId}-playlist`} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 mb-2">
            <Music2 size={12} strokeWidth={2.4} /> Music
          </h3>
          {artistTracks.length === 0 ? (
            <div className="text-[12px] text-white/40 py-3" data-testid="nex-artist-world-playlist-empty">
              No other tracks from this artist yet.
            </div>
          ) : (
            <ul className="space-y-1" role="list" data-testid="nex-artist-world-playlist">
              {artistTracks.map((t) => (
                <li key={t.media_id}>
                  <button
                    type="button"
                    onClick={() => handleSelectTrack(t.media_id)}
                    aria-current={t.is_current ? "true" : undefined}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-white/[0.06] active:bg-white/[0.10] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      t.is_current ? "bg-white/[0.08]" : ""
                    }`}
                    data-testid={`nex-artist-world-track-${t.media_id}`}
                  >
                    <span
                      aria-hidden
                      className={`grid place-items-center h-8 w-8 rounded-md ${
                        t.is_current ? "bg-orange-500 text-white" : "bg-white/[0.06] text-white/70"
                      }`}
                    >
                      <Music2 size={14} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] truncate">
                        {t.title ?? "Untitled"}
                      </span>
                      {t.is_current && (
                        <span className="block text-[10px] text-orange-400 mt-0.5">
                          Now playing
                        </span>
                      )}
                    </span>
                    {t.is_mock_fixture && (
                      <span className="text-[9px] uppercase tracking-wider text-amber-400 bg-black/40 rounded-full px-2 py-0.5">
                        Mock
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Lyrics · honest empty state · never invented */}
        <section aria-labelledby={`${panelId}-lyrics`} className="px-4 py-3 border-t border-white/5">
          <h3 id={`${panelId}-lyrics`} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 mb-2">
            <FileText size={12} strokeWidth={2.4} /> Lyrics
          </h3>
          <div className="text-[12.5px] text-white/50 leading-relaxed" data-testid="nex-artist-world-lyrics">
            Lyrics aren&apos;t available for this track yet.
          </div>
        </section>

        {/* Live · honest gated · shown only when caller confirms */}
        <section aria-labelledby={`${panelId}-live`} className="px-4 py-3 border-t border-white/5">
          <h3 id={`${panelId}-live`} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 mb-2">
            <Radio size={12} strokeWidth={2.4} /> Live
          </h3>
          {hasLiveNow ? (
            <div className="text-[12.5px] text-red-400" data-testid="nex-artist-world-live-now">
              Live now
            </div>
          ) : (
            <div className="text-[12.5px] text-white/40" data-testid="nex-artist-world-live-none">
              No upcoming Live sessions from this artist.
            </div>
          )}
        </section>

        {/* Events · honest placeholder · never fabricated */}
        <section aria-labelledby={`${panelId}-events`} className="px-4 py-3 border-t border-white/5">
          <h3 id={`${panelId}-events`} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 mb-2">
            <CalendarDays size={12} strokeWidth={2.4} /> Events
          </h3>
          <div className="text-[12.5px] text-white/40">
            No verified events yet.
          </div>
        </section>

        {/* Chat · gated by capability · falls back to disabled honest chip */}
        <section aria-labelledby={`${panelId}-chat`} className="px-4 py-3 border-t border-white/5">
          <h3 id={`${panelId}-chat`} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 mb-2">
            <MessageCircle size={12} strokeWidth={2.4} /> Chat
          </h3>
          {chatCapabilityAvailable && onOpenChat ? (
            <button
              type="button"
              onClick={() => { onOpenChat(); onClose(); }}
              className="w-full rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-[13px] font-semibold py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              data-testid="nex-artist-world-chat"
            >
              Chat with this creator
            </button>
          ) : (
            <div
              className="w-full rounded-lg bg-white/[0.04] text-[12px] text-white/40 py-2.5 text-center"
              data-testid="nex-artist-world-chat-unavailable"
            >
              Chat not available yet for this creator
            </div>
          )}
        </section>

        <div className="flex-1" />
        <div className="px-4 py-3 text-[10px] text-white/30 leading-relaxed">
          Artist World reflects the current playing track. Swipe right to return.
          NEX never fabricates lyrics, streams, followers, or events.
        </div>

        <style>{`
          @keyframes nex-aw-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes nex-aw-slide-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        `}</style>
      </div>
    </div>
  );
}
