"use client";

// Renders a tiny "market range" card under the beacon body when the
// trade's typed text matches published merchant prices. Debounced,
// silent when no match, no error surface — this is a nice-to-have hint
// not a load-bearing signal.

import { useEffect, useState } from "react";
import { Sparkles, MapPin } from "lucide-react";

type Stats = {
  currency: string;
  count: number;
  minPence: number;
  maxPence: number;
  avgPence: number;
} | null;

const CUR: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

function fmt(pence: number, currency: string): string {
  const sym = CUR[currency] ?? "£";
  const amt = pence / 100;
  return `${sym}${amt.toLocaleString("en-GB", {
    minimumFractionDigits: amt % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

export function YardBeaconPriceHint({
  query,
  postcode
}: {
  query: string;
  postcode?: string | null;
}) {
  const [stats, setStats] = useState<Stats>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setStats(null);
      setCount(0);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ item: q });
        if (postcode) params.set("postcode", postcode);
        const res = await fetch(
          `/api/trade-off/prices/lookup?${params.toString()}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          stats?: Stats;
          results?: unknown[];
        };
        if (cancelled) return;
        setStats(data.stats ?? null);
        setCount(Array.isArray(data.results) ? data.results.length : 0);
      } catch {
        /* silent */
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, postcode]);

  if (!stats || stats.count === 0) return null;

  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]"
      style={{ borderColor: "rgba(255,179,0,0.4)", background: "#FFF7E0" }}
    >
      <Sparkles
        className="h-3.5 w-3.5 shrink-0 text-amber-700"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-black text-amber-900">
          Market range from {stats.count} merchant
          {stats.count === 1 ? "" : "s"}
        </p>
        <p className="mt-0.5 truncate text-amber-900/80">
          {fmt(stats.minPence, stats.currency)} –{" "}
          {fmt(stats.maxPence, stats.currency)} (avg{" "}
          {fmt(stats.avgPence, stats.currency)})
          {postcode && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" aria-hidden />
              near {postcode}
            </span>
          )}
        </p>
      </div>
      {count > stats.count && (
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
          +{count - stats.count} more
        </span>
      )}
    </div>
  );
}
