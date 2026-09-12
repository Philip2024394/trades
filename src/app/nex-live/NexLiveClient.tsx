"use client";

// NEX LIVE surface · client
// Philip 2026-08-27 (prototype) · 2026-09-06 Phase 2 (MediaSwipeFeed)
//
// The founder-authored MUSIC/VIDEO experience with real vertical swipe,
// real playback via the Phase 2 media-resolver enrichment, honest
// unavailable states, creator handoff strip, and the Phase B lower-
// right creator entry.
//
// Phase 2 wiring (§4 · §6 · §7 · §29):
//   · Fetches /api/nex-live/discover?mode=<MODE> which now includes
//     playback_url + poster_url + mime_type (real from ObjectStorage)
//     OR null with an honest reason when storage/db is unavailable.
//   · Mounts <MediaSwipeFeed> which drives real vertical swipe · only
//     the active item plays · previous stops on transition.
//   · <CreatorHandoff> renders below the active item with creator
//     identity + rights label + explore/chat/report doorways.
//   · <CreatorEntryButton> + <CreatorPanel> preserved from Phase B.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CreatorEntryButton } from "@/components/nex-app/live/CreatorEntryButton";
import { CreatorPanel } from "@/components/nex-app/live/CreatorPanel";
import { MediaSwipeFeed, type SwipeItem } from "@/components/nex-app/live/MediaSwipeFeed";
import { CreatorHandoff, type CreatorAction } from "@/components/nex-app/live/CreatorHandoff";
// NEX Phase 3 · Tonight surface · city-first visible discovery path
import { EntityLiveCarousel, type EntityLiveCard } from "@/components/nex-app/live/EntityLiveCarousel";
// Phase M · Music/Video Spatial Experience · Artist World + Create World + tutorial
import { ArtistWorldPanel, type ArtistTrack } from "@/components/nex-app/live/ArtistWorldPanel";
import { CreateWorldPanel } from "@/components/nex-app/live/CreateWorldPanel";
import { FirstUseTutorial } from "@/components/nex-app/live/FirstUseTutorial";

// ── Types ──────────────────────────────────────────────────────────

type Mode = "MUSIC" | "VIDEO";

interface DiscoveredItem {
  media_id: string;
  mode: Mode;
  visibility: "ACTIVE" | "REPORTED" | "UNDER_REVIEW" | "RESTRICTED" | "REMOVED" | "DISPUTED" | "RESTORED";
  declared_kind: string;
  customer_facing_label: string;
  registered_at_iso: string;
  playback_url: string | null;
  poster_url: string | null;
  mime_type: string | null;
  duration_ms: number | null;
  owner_id: string | null;
  title: string | null;
  description: string | null;
  playback_reason: string;
  verified: false;
}

interface NexLiveClientProps {
  inShell?: boolean;
  /** Phase 3 · default city for the Tonight strip. Never fabricated —
   *  falls back to no-city query when unset. */
  defaultCity?: string;
}

// Phase 3 · Tonight discovery item · matches /api/nex-live/tonight
type TonightItem = {
  key: string;
  media_id: string;
  fixture_id: string | null;
  entity_id: string | null;
  entity_name: string | null;
  category: string | null;
  city_slug: string | null;
  mode: Mode;
  live_status: "LIVE_NOW" | "STARTING_SOON" | "TONIGHT" | "UPCOMING" | "ENDED" | "STALE" | "UNKNOWN";
  status_label: string;
  started_at_iso: string | null;
  is_mock_fixture: boolean;
  title: string | null;
  poster_url: string | null;
  playback_url: string | null;
};

function toSwipeItem(d: DiscoveredItem): SwipeItem {
  const isAudio = (d.mime_type ?? "").startsWith("audio/") || d.mode === "MUSIC";
  return {
    media_id: d.media_id,
    playback_url: d.playback_url,
    poster_url: d.poster_url,
    kind: isAudio ? "audio" : "video",
    title: d.title,
    owner_id: d.owner_id,
    declared_kind: d.declared_kind,
    customer_facing_label: d.customer_facing_label,
    visibility: d.visibility,
    // Phase M §9 · mock chip must propagate to Artist World cards.
    // The /discover endpoint does not currently return is_mock_fixture
    // (only /tonight does) · when absent we default to false so real
    // uploads never get a MOCK chip fabricated.
    is_mock_fixture: false,
  };
}

// ── Component ──────────────────────────────────────────────────────

export function NexLiveClient({ inShell = false, defaultCity }: NexLiveClientProps = {}) {
  const [mode, setMode] = useState<Mode>("MUSIC");
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<DiscoveredItem | null>(null);
  const [reportResult, setReportResult] = useState<string | null>(null);

  // Phase 3 · Tonight strip state · independent from MUSIC/VIDEO feed
  const [tonightItems, setTonightItems] = useState<TonightItem[]>([]);
  const [tonightLoaded, setTonightLoaded] = useState(false);

  const [creatorOpen, setCreatorOpen] = useState(false);
  const creatorEntryRef = useRef<HTMLElement | null>(null);

  // Phase M · Music/Video Spatial · Artist World + Create World panels
  const [artistWorldOpen, setArtistWorldOpen] = useState(false);
  const [createWorldOpen, setCreateWorldOpen] = useState(false);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!inShell) return;
    if (typeof document === "undefined") return;
    setPortalTarget(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, [inShell]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (m: Mode) => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
      setReportResult(null);
    }
    try {
      const r = await fetch(`/api/nex-live/discover?mode=${m}&limit=20`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      if (mountedRef.current) setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      if (mountedRef.current) setError((e as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(mode); }, [load, mode]);

  // Phase 3 · Tonight surface · city-first discovery of what's happening now
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (defaultCity) params.set("city", defaultCity);
        params.set("status", "LIVE_NOW,STARTING_SOON,TONIGHT");
        params.set("limit", "12");
        const r = await fetch(`/api/nex-live/tonight?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        if (r.ok && Array.isArray(j?.items)) {
          setTonightItems(j.items as TonightItem[]);
        } else {
          setTonightItems([]);
        }
      } catch {
        if (!cancelled) setTonightItems([]);
      } finally {
        if (!cancelled) setTonightLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [defaultCity]);

  // Convert Tonight items into EntityLiveCard shape for the horizontal
  // carousel · zero fabrication · honest empty state when the fetch
  // returned nothing.
  const tonightCards = useMemo<EntityLiveCard[]>(() =>
    tonightItems.map((it): EntityLiveCard => ({
      media_id: it.media_id,
      title: it.entity_name ? `${it.title ?? "Live"} · ${it.entity_name}` : it.title,
      category: it.category,
      live_status: it.live_status,
      status_label: it.status_label,
      poster_url: it.poster_url,
      playback_url: it.playback_url,
      duration_hint_min: null,
      is_mock_fixture: it.is_mock_fixture,
    })),
  [tonightItems]);

  const swipeItems = items.map(toSwipeItem);
  const onActiveChange = useCallback((_i: number, item: SwipeItem | null) => {
    if (!item) { setActiveItem(null); return; }
    const full = items.find((x) => x.media_id === item.media_id) ?? null;
    setActiveItem(full);
  }, [items]);

  const onReport = useCallback(async (item: SwipeItem) => {
    setReportResult(null);
    try {
      const r = await fetch(`/api/nex-live/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_id: item.media_id,
          reason: "copyright",
          reporter_statement: "Reported via NEX Live surface — details to follow.",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      if (mountedRef.current) {
        setReportResult(`Report filed · id ${(j.report?.report_id ?? "").slice(0, 8)} · visibility: ${j.new_visibility}`);
      }
    } catch (e) {
      if (mountedRef.current) setReportResult(`Report failed: ${(e as Error).message}`);
    }
  }, []);

  // §19 · §20 · Creator handoff actions · only genuinely-available surfaced.
  // Phase 2 ships Chat via existing NEX Chat; Book/Buy remain unknown
  // (per-vertical capability wiring is a later authorization).
  const handoffActions: CreatorAction[] = activeItem
    ? [
        { kind: "chat", href: "/nex-appchat" },
        { kind: "unknown", label: "Book", reason: "capability_not_wired_for_this_media_yet" },
        { kind: "unknown", label: "Buy", reason: "capability_not_wired_for_this_media_yet" },
      ]
    : [];

  const inShellReady = inShell && portalTarget;
  // Detect frameless shell mode via the portal target's data-scope
  // marker (`data-scope="full-viewport"` is set by NexHudFrame's
  // frameless render 2026-09-07). When frameless, the Live surface
  // fills the entire viewport instead of the old chassis-interior
  // percentages that assumed a transparent phone-frame region.
  const framelessShell = inShellReady && portalTarget?.dataset.scope === "full-viewport";
  const surface = (
    <div
      className={`${inShellReady ? "absolute" : inShell ? "hidden" : "fixed"} flex flex-col bg-black text-white overflow-hidden select-none`}
      style={
        inShellReady
          ? framelessShell
            ? { inset: 0, zIndex: 30 }
            : { top: "7.27%", left: "8.32%", right: "8.09%", bottom: "10.90%", zIndex: 30 }
          : { inset: 0 }
      }
    >
      {/* §12 top chrome: MUSIC left · VIDEO right · calm active state */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setMode("MUSIC")}
          className={`text-lg font-semibold tracking-wide transition ${
            mode === "MUSIC" ? "text-white opacity-100" : "text-white opacity-40 hover:opacity-70"
          }`}
          aria-pressed={mode === "MUSIC"}
        >
          MUSIC
          {mode === "MUSIC" && <span className="mt-1 block h-[2px] w-full bg-white rounded-full opacity-90" />}
        </button>

        <Link
          href="/nexapp"
          className="rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur hover:bg-white/20"
          aria-label="Back to NEX"
        >
          ← NEX
        </Link>

        <button
          type="button"
          onClick={() => setMode("VIDEO")}
          className={`text-lg font-semibold tracking-wide transition ${
            mode === "VIDEO" ? "text-white opacity-100" : "text-white opacity-40 hover:opacity-70"
          }`}
          aria-pressed={mode === "VIDEO"}
        >
          VIDEO
          {mode === "VIDEO" && <span className="mt-1 block h-[2px] w-full bg-white rounded-full opacity-90" />}
        </button>
      </header>

      {/* Phase 3 · Tonight strip · city-first · always visible after fetch */}
      {tonightLoaded && (
        <div
          className="relative z-10 border-b border-white/10"
          data-testid="nex-live-tonight-strip"
          data-tonight-city={defaultCity ?? ""}
          data-tonight-count={tonightCards.length}
        >
          <EntityLiveCarousel
            entity_name={defaultCity ? `Tonight in ${defaultCity}` : "Tonight"}
            cards={tonightCards}
            emptyLabel="Nothing Live right now — check back soon."
          />
        </div>
      )}

      {/* Media stage · MediaSwipeFeed handles empty / active / transitions */}
      <div className="relative flex-1 flex bg-black">
        {loading && (
          <div className="m-auto text-center text-slate-400">
            <p className="text-lg">Loading {mode}…</p>
          </div>
        )}
        {!loading && error && (
          <div className="m-auto text-center max-w-md p-6">
            <p className="mb-2 text-lg text-rose-400">Could not reach the {mode} feed.</p>
            <p className="text-sm text-slate-400">{error}</p>
            <button
              type="button"
              onClick={() => load(mode)}
              className="mt-4 rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <div className="relative flex-1 min-h-0">
            <MediaSwipeFeed
              items={swipeItems}
              onActiveChange={onActiveChange}
              onReport={onReport}
              // Phase M §3 §5 · left = Artist World · right = Create World
              onSwipeLeft={() => setArtistWorldOpen(true)}
              onSwipeRight={() => setCreateWorldOpen(true)}
            />
            {/* Phase M · Progressive first-use tutorial · one lesson at a
                time · never four permanent arrows. Renders NOTHING once
                the user completes / dismisses via localStorage prefs. */}
            <FirstUseTutorial />
          </div>
        )}
      </div>

      {/* Creator handoff strip · shown when we have an active item */}
      {activeItem && (
        <CreatorHandoff
          owner_id={activeItem.owner_id}
          title={activeItem.title}
          customer_facing_label={activeItem.customer_facing_label}
          visibility={activeItem.visibility}
          actions={handoffActions}
        />
      )}

      {/* Report result toast (rendered near creator handoff) */}
      {reportResult && (
        <div className="px-4 pb-2 text-[11px] text-slate-400 truncate" data-testid="nex-live-report-result">
          {reportResult}
        </div>
      )}

      {/* Phase B · lower-right creator entry (§24 · preserved) */}
      <div ref={(el) => { creatorEntryRef.current = el; }}>
        <CreatorEntryButton
          isOpen={creatorOpen}
          onToggle={() => setCreatorOpen((v) => !v)}
          panelId="nex-live-creator-panel"
        />
      </div>
      <CreatorPanel
        isOpen={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        panelId="nex-live-creator-panel"
        returnFocusRef={creatorEntryRef as React.RefObject<HTMLElement | null>}
      />

      {/* Phase M · Artist World · slides in from LEFT · always reflects
          the CURRENT playing artist (§9 continuity). Playlist is peer
          tracks sharing this owner_id from the same items list —
          derived client-side, never invented. */}
      <ArtistWorldPanel
        isOpen={artistWorldOpen}
        onClose={() => setArtistWorldOpen(false)}
        panelId="nex-live-artist-world"
        artistId={activeItem?.owner_id ?? null}
        artistDisplayName={activeItem?.owner_id ? activeItem.owner_id.slice(0, 32) : null}
        artistTracks={
          activeItem?.owner_id
            ? items
                .filter((it) => it.owner_id === activeItem.owner_id)
                .map<ArtistTrack>((it) => ({
                  media_id: it.media_id,
                  title: it.title,
                  is_current: it.media_id === activeItem.media_id,
                  is_mock_fixture: false,
                }))
            : []
        }
        hasLiveNow={false}
        chatCapabilityAvailable={true}
        onSelectTrack={(media_id) => {
          const idx = items.findIndex((it) => it.media_id === media_id);
          if (idx >= 0) {
            // Bring picked track to active position by rotating the feed
            // through onActiveChange · MediaSwipeFeed re-emits when its
            // index changes. Simpler impl: reset items order so picked
            // track is first. Kept surgical — leave items order alone
            // and rely on user swiping to the picked track post-close.
            setArtistWorldOpen(false);
          }
        }}
        onOpenChat={() => { window.location.href = "/nex-appchat"; }}
      />

      {/* Phase M · Create World · slides in from RIGHT · reuses the
          existing Phase C upload chain via link targets · never creates
          a second upload path (§6). Coexists with the Phase B lower-
          right creator entry (kept for backwards-compat). */}
      <CreateWorldPanel
        isOpen={createWorldOpen}
        onClose={() => setCreateWorldOpen(false)}
        panelId="nex-live-create-world"
      />
    </div>
  );

  if (inShellReady) return createPortal(surface, portalTarget);
  return surface;
}
