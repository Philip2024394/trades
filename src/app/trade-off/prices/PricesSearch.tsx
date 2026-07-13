"use client";

// Public live-price search — debounced item + postcode inputs, results
// list, stats block. Same lookup endpoint as the beacon composer hint.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Loader2 } from "lucide-react";

type Result = {
  id: string;
  itemLabel: string;
  unitLabel: string;
  pricePence: number;
  currency: string;
  qtyIncluded: number;
  postcodePrefix: string | null;
  region: string | null;
  updatedAt: string;
  isLocal: boolean;
  merchant: {
    slug: string;
    display_name: string;
    trading_name: string | null;
  } | null;
};

type Stats = {
  currency: string;
  count: number;
  minPence: number;
  maxPence: number;
  avgPence: number;
} | null;

const CUR_SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

function fmt(pence: number, currency: string, qty: number): string {
  const sym = CUR_SYM[currency] ?? "£";
  const amt = pence / 100;
  const base = `${sym}${amt.toLocaleString("en-GB", {
    minimumFractionDigits: amt % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
  return qty > 1 ? `${base} / ${qty}` : base;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function PricesSearch() {
  const [item, setItem] = useState("");
  const [postcode, setPostcode] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [stats, setStats] = useState<Stats>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => item.trim(), [item]);

  useEffect(() => {
    if (!q) {
      setResults([]);
      setStats(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ item: q });
        if (postcode.trim()) params.set("postcode", postcode.trim());
        const res = await fetch(
          `/api/trade-off/prices/lookup?${params.toString()}`
        );
        if (!res.ok) throw new Error("query failed");
        const data = (await res.json()) as {
          ok: boolean;
          results?: Result[];
          stats?: Stats;
        };
        if (cancelled) return;
        setResults(data.results ?? []);
        setStats(data.stats ?? null);
      } catch {
        if (!cancelled) setError("Couldn't fetch prices — try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, postcode]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="rounded-2xl border border-[#1B1A17]/10 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 rounded-full bg-[#FBF6EC] px-3 py-2">
          <Search className="h-4 w-4 text-[#1B1A17]/50" aria-hidden />
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="e.g. angle iron, ballast, blockwork, angle brackets"
            className="flex-1 bg-transparent text-[13.5px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:outline-none"
            autoComplete="off"
          />
          {loading && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-[#1B1A17]/50"
              aria-hidden
            />
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-full bg-[#FBF6EC] px-3 py-2">
          <MapPin className="h-4 w-4 text-[#1B1A17]/50" aria-hidden />
          <input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="Postcode (M3, LS1, BS2) — narrows to nearby merchants first"
            maxLength={8}
            className="flex-1 bg-transparent text-[13.5px] text-[#1B1A17] placeholder:text-[#1B1A17]/45 focus:outline-none"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Stats block */}
      {stats && stats.count > 0 && (
        <div
          className="rounded-2xl border-2 p-4 shadow-sm"
          style={{
            borderColor: "#FFB300",
            background: "linear-gradient(90deg, #FFF7E0 0%, #FFFFFF 60%)"
          }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
            Market range
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[24px] font-black tabular-nums text-[#1B1A17] md:text-[28px]">
              {fmt(stats.minPence, stats.currency, 1)}
            </span>
            <span className="text-[13px] font-bold text-[#1B1A17]/60">
              — {fmt(stats.maxPence, stats.currency, 1)}
            </span>
            <span className="text-[12px] font-semibold text-[#1B1A17]/50">
              avg {fmt(stats.avgPence, stats.currency, 1)} · {stats.count}{" "}
              merchant{stats.count === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}

      {q && !loading && results.length === 0 && !error && (
        <p className="rounded-xl border border-dashed border-[#1B1A17]/15 bg-white p-4 text-[13px] text-[#1B1A17]/60">
          No live prices for &ldquo;{q}&rdquo; yet. Merchants are joining
          daily — check back or ask via a{" "}
          <Link
            href="/trade-off/yard"
            className="font-black text-amber-700 underline-offset-2 hover:underline"
          >
            Beacon
          </Link>
          .
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.id}
              className={`rounded-2xl border p-3 shadow-sm ${
                r.isLocal
                  ? "border-emerald-400 bg-emerald-50/40"
                  : "border-[#1B1A17]/10 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-black text-[#1B1A17]">
                    {r.itemLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#1B1A17]/60">
                    {r.merchant ? (
                      <Link
                        href={`/${r.merchant.slug}`}
                        className="font-bold hover:underline"
                      >
                        {r.merchant.trading_name ?? r.merchant.display_name}
                      </Link>
                    ) : (
                      "Merchant"
                    )}
                    {r.postcodePrefix ? ` · ${r.postcodePrefix}` : ""}
                    {r.region ? ` · ${r.region}` : ""}
                    {" · "}
                    updated {timeAgo(r.updatedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-black tabular-nums text-neutral-900"
                    style={{ background: "#FFB300" }}
                  >
                    {fmt(r.pricePence, r.currency, r.qtyIncluded)}
                  </span>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#1B1A17]/50">
                    per {r.unitLabel}
                  </p>
                  {r.isLocal && (
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      Local
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
