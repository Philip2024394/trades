"use client";

// src/app/nex-live/tonight/TonightClient.tsx
//
// NEX LIVE · Master Experience · City-first "what's happening" surface
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build
//
// §2 · §3 · §4 · §9 · §25 · §26 · §55 · Primary discovery answer to
// "what's happening around me tonight?" Renders LIVE_NOW / STARTING_SOON
// / TONIGHT tabs, city selection, and entity groupings.
//
// §11 immutable · commerce is SEPARATE. No product cards here.
// §36 · no attention-manipulating badges / countdowns / notifications.
// §32 · use existing NEX Chat routes for handoffs · no new chat.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityLiveCarousel, type EntityLiveCard } from "@/components/nex-app/live/EntityLiveCarousel";

type LiveStatus = "LIVE_NOW" | "STARTING_SOON" | "TONIGHT" | "UPCOMING" | "ENDED" | "STALE" | "UNKNOWN";

type TonightItem = {
  media_id: string;
  fixture_id: string | null;
  entity_id: string | null;
  entity_name: string | null;
  creator_id: string | null;
  category: string | null;
  city_slug: string | null;
  mode: "MUSIC" | "VIDEO";
  live_status: LiveStatus;
  status_label: string;
  started_at_iso: string | null;
  is_mock_fixture: boolean;
  declared_kind: string;
  customer_facing_label: string;
  visibility: string;
  title: string | null;
  playback_url: string | null;
  poster_url: string | null;
  mime_type: string | null;
  playback_reason: string;
};

const CITY_OPTIONS = [
  { slug: "yogyakarta", label: "Yogyakarta" },
  { slug: "jakarta", label: "Jakarta" },
  { slug: "bandung", label: "Bandung" },
  { slug: "bali", label: "Bali" },
];

type StatusTab = "ALL" | "LIVE_NOW" | "STARTING_SOON" | "TONIGHT";

export function TonightClient() {
  const [city, setCity] = useState<string>("yogyakarta");
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TonightItem[]>([]);

  const load = useCallback(async (cityArg: string, tabArg: StatusTab) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ city: cityArg, limit: "30" });
      if (tabArg !== "ALL") params.set("status", tabArg);
      const r = await fetch(`/api/nex-live/tonight?${params.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(city, tab); }, [load, city, tab]);

  // Group by entity for the "LIVE FROM THIS <ENTITY>" carousels · §8
  const grouped = useMemo(() => {
    const map = new Map<string, { entity_name: string; cards: EntityLiveCard[] }>();
    for (const it of items) {
      const key = it.entity_id ?? "no_entity";
      const entity_name = it.entity_name ?? "Unnamed";
      if (!map.has(key)) map.set(key, { entity_name, cards: [] });
      map.get(key)!.cards.push({
        media_id: it.media_id,
        title: it.title,
        category: it.category,
        live_status: it.live_status,
        status_label: it.status_label,
        poster_url: it.poster_url,
        playback_url: it.playback_url,
        duration_hint_min: null,
        is_mock_fixture: it.is_mock_fixture,
      });
    }
    // Sort groups: LIVE_NOW-containing first
    const arr = Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
    arr.sort((a, b) => {
      const aHasLive = a.cards.some((c) => c.live_status === "LIVE_NOW") ? 0 : 1;
      const bHasLive = b.cards.some((c) => c.live_status === "LIVE_NOW") ? 0 : 1;
      return aHasLive - bHasLive;
    });
    return arr;
  }, [items]);

  const summary = useMemo(() => ({
    live_now: items.filter((i) => i.live_status === "LIVE_NOW").length,
    starting_soon: items.filter((i) => i.live_status === "STARTING_SOON").length,
    tonight: items.filter((i) => i.live_status === "TONIGHT").length,
    upcoming: items.filter((i) => i.live_status === "UPCOMING").length,
  }), [items]);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header · minimal · city + back */}
      <header className="sticky top-0 z-10 bg-black/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">NEX Live</div>
            <div className="text-lg font-semibold">What&#39;s happening</div>
          </div>
          <Link
            href="/nex-live"
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
          >
            ← NEX Live
          </Link>
        </div>

        {/* City selector · §3 no fabricated precise location */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="nex-live-tonight-cities">
          {CITY_OPTIONS.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCity(c.slug)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                city === c.slug ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
              data-testid={`nex-live-tonight-city-${c.slug}`}
              aria-pressed={city === c.slug}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Status tabs */}
        <div className="mt-2 flex items-center gap-2" role="tablist" data-testid="nex-live-tonight-tabs">
          {([
            { id: "ALL" as const, label: "All", count: items.length },
            { id: "LIVE_NOW" as const, label: "Live now", count: summary.live_now },
            { id: "STARTING_SOON" as const, label: "Starting soon", count: summary.starting_soon },
            { id: "TONIGHT" as const, label: "Tonight", count: summary.tonight },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              onClick={() => setTab(t.id)}
              className={`text-xs px-2 py-1 rounded ${
                tab === t.id ? "text-white" : "text-white/40 hover:text-white/60"
              }`}
              aria-selected={tab === t.id}
              data-testid={`nex-live-tonight-tab-${t.id}`}
            >
              {t.label}
              <span className="ml-1 text-[10px] text-white/40">({t.count})</span>
              {tab === t.id && (
                <span className="block h-[2px] w-full bg-white mt-1 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <section className="pb-8">
        {loading && (
          <div className="p-8 text-center text-white/50">Loading Live in {city}…</div>
        )}
        {!loading && error && (
          <div className="p-8 text-center">
            <div className="text-rose-400 text-sm mb-2">Could not reach the Live feed.</div>
            <button
              type="button"
              onClick={() => load(city, tab)}
              className="rounded bg-white/10 px-4 py-2 text-xs hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-white/70 mb-1">Nothing live in {CITY_OPTIONS.find((c) => c.slug === city)?.label ?? city} right now.</div>
            <div className="text-xs text-white/40">
              This is honest. We won&#39;t invent Live sessions that aren&#39;t happening.
            </div>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="divide-y divide-white/5">
            {grouped.map((g) => (
              <EntityLiveCarousel
                key={g.key}
                entity_name={g.entity_name}
                cards={g.cards}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
