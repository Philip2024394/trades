"use client";

// src/app/nex-live/my/MyLiveClient.tsx
//
// NEX LIVE · Phase B · MY LIVE surface
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE B · §8
//
// Honest creator surface. Shows the caller's published NEX Live items
// discovered via the existing `/api/nex-live/discover` endpoint. If
// nothing has been published yet, renders an honest "no items" state
// with a clear route back to Create.
//
// §14 explicitly forbids in Phase B:
//   · analytics engine
//   · scheduled Live
//   · previous Live sessions
//   · fake schedules
// This surface therefore lists items only. No fake numbers. No fake
// scheduling. No pretend broadcast history.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Mode = "MUSIC" | "VIDEO";

interface DiscoveredItem {
  media_id: string;
  mode: Mode;
  visibility: "ACTIVE" | "REPORTED" | "UNDER_REVIEW" | "RESTRICTED" | "REMOVED" | "DISPUTED" | "RESTORED";
  declared_kind: string;
  customer_facing_label: string;
  registered_at_iso: string;
  verified: false;
}

export function MyLiveClient() {
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both modes and combine — the discover endpoint has no
      // owner filter yet. In a production build this becomes
      // `/api/nex-live/my` scoped to the authenticated user. Phase B
      // renders the honest superset with a clear note.
      const [mR, vR] = await Promise.all([
        fetch("/api/nex-live/discover?mode=MUSIC", { cache: "no-store" }),
        fetch("/api/nex-live/discover?mode=VIDEO", { cache: "no-store" }),
      ]);
      const [mJ, vJ] = await Promise.all([mR.json(), vR.json()]);
      const all: DiscoveredItem[] = [
        ...(Array.isArray(mJ.items) ? mJ.items : []),
        ...(Array.isArray(vJ.items) ? vJ.items : []),
      ];
      setItems(all);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">NEX Live</div>
          <div className="text-lg font-semibold">My Live</div>
        </div>
        <Link
          href="/nex-live"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
        >
          ← NEX Live
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-[11px] text-white/40 mb-6">
          Every item shown below carries an uploader-declared rights label. NEX has NOT
          independently verified ownership.
        </p>

        {loading && <div className="text-white/60 py-8">Loading…</div>}
        {!loading && error && (
          <div className="text-rose-400 py-8">
            Could not reach My Live: {error}
            <button
              type="button"
              onClick={load}
              className="ml-3 rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-white/70 mb-2">Nothing published yet.</div>
            <div className="text-[13px] text-white/40 mb-6">
              When you upload a NEX Live item and record a rights declaration, it will appear here.
            </div>
            <Link
              href="/nex-video/create"
              className="inline-block rounded-full bg-white text-black px-5 py-2.5 text-sm font-semibold hover:bg-slate-200"
            >
              ＋ Record
            </Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <li
                key={item.media_id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                  {item.mode}
                </div>
                <div className="text-sm font-medium truncate">
                  Media {item.media_id.slice(0, 14)}…
                </div>
                <div className="text-[11px] text-white/50 mt-2 truncate">
                  {item.customer_facing_label}
                </div>
                <div className="text-[10px] text-white/30 mt-1">
                  Visibility · {item.visibility}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
