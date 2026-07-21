"use client";

// CanteenMemberInviteModal — owner-only dialog to add trades as members.
//
// v1: type-ahead search over the trade directory (backed by
// /api/trade-off/trades?q=). Tap a result → POST to
// /api/canteens/[slug]/invite-trade → member appears in the left rail.
//
// Same UX pattern as the SiteBook homeowner→trade invite flow.

import { useEffect, useState } from "react";
import { X, Search, Check, Loader2, Users } from "lucide-react";

type SearchResult = {
  slug: string;
  displayName: string;
  primaryTrade: string | null;
  city: string | null;
  avatarUrl: string | null;
};

export function CanteenMemberInviteModal({
  canteenSlug,
  open,
  onClose,
  onInvited
}: {
  canteenSlug: string;
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitingSlug, setInvitingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitedSlugs, setInvitedSlugs] = useState<Set<string>>(new Set());

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (!q.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/trade-off/trades?q=${encodeURIComponent(q.trim())}&limit=12`);
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setResults((data.results ?? []) as SearchResult[]);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, open]);

  async function invite(slug: string) {
    setInvitingSlug(slug);
    setError(null);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/invite-trade`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tradeSlug: slug })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "invite-failed");
      setInvitedSlugs(new Set([...invitedSlugs, slug]));
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setInvitingSlug(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 md:items-center"
      style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="inline-flex items-center gap-2">
            <Users size={16} className="text-neutral-700"/>
            <h2 className="text-[14px] font-black text-neutral-900">Invite trades to your canteen</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
            <X size={16}/>
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search trades by name, trade, or city…"
              className="h-10 w-full rounded-lg border bg-neutral-50 pl-9 pr-3 text-[13px] outline-none focus:bg-white"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            />
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-[11.5px] text-neutral-500">
                <Loader2 size={14} className="inline animate-spin"/> Searching…
              </div>
            )}
            {!loading && q.trim() && results.length === 0 && (
              <p className="p-4 text-center text-[11.5px] text-neutral-500">No trades match &ldquo;{q}&rdquo;.</p>
            )}
            {!loading && !q.trim() && (
              <p className="p-4 text-center text-[11.5px] text-neutral-500">
                Type a name, trade, or city to search.
              </p>
            )}
            {results.length > 0 && (
              <ul className="space-y-1">
                {results.map((r) => {
                  const invited = invitedSlugs.has(r.slug);
                  const busy    = invitingSlug === r.slug;
                  return (
                    <li key={r.slug}>
                      <button
                        type="button"
                        onClick={() => !invited && !busy && invite(r.slug)}
                        disabled={invited || busy}
                        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-black text-neutral-900"
                          style={{
                            backgroundColor: "#FFB300",
                            backgroundImage: r.avatarUrl ? `url('${r.avatarUrl}')` : undefined,
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                          }}
                        >
                          {!r.avatarUrl && r.displayName.charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-black text-neutral-900">{r.displayName}</p>
                          <p className="mt-0.5 truncate text-[10.5px] text-neutral-500">
                            {[r.primaryTrade, r.city].filter(Boolean).join(" · ")}
                          </p>
                        </span>
                        {invited ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-800">
                            <Check size={11}/> Invited
                          </span>
                        ) : busy ? (
                          <Loader2 size={14} className="animate-spin text-neutral-500"/>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-900" style={{ backgroundColor: "#FFB300" }}>
                            Invite
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {error && <p className="mt-2 text-center text-[10.5px] font-bold text-red-700">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
