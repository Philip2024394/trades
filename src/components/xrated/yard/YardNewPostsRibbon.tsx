"use client";

// Floating "N new posts ▲" chip pinned to the top of the Yard viewport.
// Polls /api/trade-off/yard/count-since every 30s. Tapping the chip
// triggers router.refresh() to pull the fresh feed in place — no full
// page reload, keeps scroll position on newer posts.
//
// Renders nothing until at least 1 new post exists so it stays out of
// the way on quiet days.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

export function YardNewPostsRibbon({ loadedAt }: { loadedAt: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(
          `/api/trade-off/yard/count-since?since=${encodeURIComponent(loadedAt)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; count?: number };
        if (!cancelled && data.ok) setCount(data.count ?? 0);
      } catch {
        /* silent — try again next tick */
      }
    }
    // First tick after 30s (don't immediately show 0 → N flicker on load)
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [loadedAt]);

  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center">
      <button
        type="button"
        onClick={() => {
          setCount(0);
          router.refresh();
        }}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-[0.16em] shadow-lg transition hover:scale-105 active:scale-95"
        style={{ background: "#FFB300", color: "#0A0A0A" }}
      >
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        {count === 1 ? "1 new post" : `${count} new posts`}
      </button>
    </div>
  );
}
