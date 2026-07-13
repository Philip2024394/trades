"use client";

// Canteen creation form — POST /api/canteens/create.
//
// Slug is auto-derived from the name on first-touch, then user can
// override. Trade picker is a searchable listbox over TRADE_OFF_TRADES.
// On success we redirect to the newly-created canteen page.

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Search, Sparkles, Send, AlertCircle } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(["manage", "new", "edit", "settings", "admin", "api"]);

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function CanteenCreateShell({ trades }: { trades: Array<{ slug: string; label: string }> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [tradeSlug, setTradeSlug] = useState<string>("");
  const [headerBgUrl, setHeaderBgUrl] = useState("");
  const [tradeQuery, setTradeQuery] = useState("");
  const [tradePickerOpen, setTradePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive slug from name until the user edits the slug field
  // themselves.
  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(name));
  }, [name, slugTouched]);

  const selectedTrade = useMemo(
    () => trades.find((t) => t.slug === tradeSlug) ?? null,
    [trades, tradeSlug]
  );

  const filteredTrades = useMemo(() => {
    const q = tradeQuery.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter((t) => t.label.toLowerCase().includes(q) || t.slug.includes(q));
  }, [trades, tradeQuery]);

  const slugValid = slug.length >= 3 && slug.length <= 60 && SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
  const nameValid = name.trim().length >= 3;
  const tradeValid = Boolean(selectedTrade);
  const canSubmit = nameValid && slugValid && tradeValid && !submitting;

  async function submit() {
    if (!canSubmit || !selectedTrade) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/canteens/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          tagline: tagline.trim() || undefined,
          tradeSlug: selectedTrade.slug,
          tradeLabel: selectedTrade.label,
          headerBgUrl: headerBgUrl.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "not-authenticated") setError("Log in first — the canteen belongs to your merchant account.");
        else if (data.error === "slug-taken") setError("That URL slug is taken. Try another.");
        else if (data.error === "reserved-slug") setError("That slug is reserved. Pick another.");
        else setError(data.error ?? "unknown-error");
        return;
      }
      router.push(`/trade-off/yard/canteens/${encodeURIComponent(data.slug)}`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link
        href="/trade-off/yard/canteens"
        className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft size={12} strokeWidth={2.5}/>
        All canteens
      </Link>

      <div className="mb-2 flex items-center gap-2">
        <span className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRAND_YELLOW }} aria-hidden="true"/>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Start a canteen
        </span>
      </div>
      <h1 className="text-[24px] font-black leading-tight text-neutral-900 sm:text-[30px]">
        Pick a trade. Name it. Invite your crew.
      </h1>
      <p className="mt-1.5 max-w-xl text-[13px] leading-snug text-neutral-600 sm:text-[14px]">
        Canteens are open groups scoped to one trade — chats, product listings, and The Counter marketplace. Free to run. You'll be the host.
      </p>

      {/* Form */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-6" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        {/* Trade picker */}
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Trade
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setTradePickerOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white p-3 text-left text-[13px] font-bold text-neutral-800 shadow-sm transition hover:border-yellow-400"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              aria-haspopup="listbox"
              aria-expanded={tradePickerOpen}
            >
              <span className={selectedTrade ? "text-neutral-900" : "text-neutral-400"}>
                {selectedTrade ? selectedTrade.label : "Pick a trade…"}
              </span>
              <ChevronDown size={14} className="text-neutral-500"/>
            </button>
            {tradePickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTradePickerOpen(false)}/>
                <div
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-hidden rounded-lg border bg-white shadow-xl"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <div className="relative border-b" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                    <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
                    <input
                      type="text"
                      value={tradeQuery}
                      onChange={(e) => setTradeQuery(e.target.value)}
                      placeholder="Search trades…"
                      className="w-full border-none bg-transparent py-2 pl-9 pr-3 text-[12px] focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <ul className="max-h-56 overflow-y-auto" role="listbox">
                    {filteredTrades.length === 0 && (
                      <li className="px-3 py-3 text-[12px] text-neutral-500">No matching trade.</li>
                    )}
                    {filteredTrades.map((t) => {
                      const active = tradeSlug === t.slug;
                      return (
                        <li key={t.slug}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              setTradeSlug(t.slug);
                              setTradePickerOpen(false);
                              setTradeQuery("");
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] font-bold transition hover:bg-neutral-50"
                            style={{
                              backgroundColor: active ? "#FEF3C7" : "transparent",
                              color: active ? BRAND_BLACK : "#374151"
                            }}
                          >
                            {t.label}
                            <span className="text-[10px] font-normal text-neutral-400">/{t.slug}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Canteen name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            placeholder="e.g. UK Kitchen Fitters"
            className="w-full rounded-lg border bg-white p-3 text-[14px] font-bold text-neutral-900 shadow-sm focus:border-yellow-400 focus:outline-none"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
          <p className="mt-1 text-[10px] text-neutral-500">3–120 characters. Show up how you want people to find you.</p>
        </div>

        {/* Slug */}
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            URL slug
          </label>
          <div className="flex items-center gap-1 rounded-lg border bg-white p-3 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <span className="whitespace-nowrap text-[11px] font-mono text-neutral-500">/canteens/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60)); }}
              placeholder="uk-kitchen-fitters"
              className="flex-1 border-none bg-transparent p-0 text-[13px] font-black text-neutral-900 focus:outline-none"
            />
          </div>
          {!slugValid && slug.length > 0 && (
            <p className="mt-1 text-[10px] font-bold text-red-600">
              {RESERVED_SLUGS.has(slug) ? "Reserved — pick another." : "Lowercase letters, digits, dashes only. 3–60 chars."}
            </p>
          )}
        </div>

        {/* Tagline */}
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Tagline <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 200))}
            rows={2}
            placeholder="One line that tells passers-by what this canteen's for."
            className="w-full rounded-lg border bg-white p-3 text-[13px] text-neutral-800 shadow-sm focus:border-yellow-400 focus:outline-none"
            style={{ borderColor: "rgba(139,69,19,0.15)", resize: "none" }}
          />
        </div>

        {/* Header image URL */}
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Header image URL <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="url"
            value={headerBgUrl}
            onChange={(e) => setHeaderBgUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border bg-white p-3 text-[13px] text-neutral-800 shadow-sm focus:border-yellow-400 focus:outline-none"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
          <p className="mt-1 text-[10px] text-neutral-500">Skip this — you can upload one from Manage later.</p>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
            <AlertCircle size={13} strokeWidth={2.5}/>
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <Send size={13} strokeWidth={2.5}/>
            {submitting ? "Starting…" : "Start canteen"}
          </button>
          <Link
            href="/trade-off/yard/canteens"
            className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700"
          >
            Cancel
          </Link>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <Sparkles size={11} style={{ color: BRAND_GREEN_DARK }}/>
          First 100 canteens get the topic app free for 12 months.
        </div>
      </div>
    </section>
  );
}
