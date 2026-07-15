"use client";

// Admin shell for Featured Placement management.
//
// Left column: create-new form (trade slug + category + days +
// admin note). Right column: active placements grouped by
// category, showing remaining seats vs SEATS_PER_CATEGORY.
// Bottom: recent placement history including expired / cancelled.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Sparkles, Trash2, X } from "lucide-react";
import type { FeaturedPlacement } from "@/lib/featuredPlacements";

const CREAM = "#FBF6EC";
const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const GREEN = "#166534";
const RED = "#B91C1C";

export function AdminFeaturedPlacementsShell({
  initialPlacements,
  seatsPerCategory
}: {
  initialPlacements: FeaturedPlacement[];
  seatsPerCategory: number;
}) {
  const [placements, setPlacements] = useState<FeaturedPlacement[]>(initialPlacements);
  const [tradeSlug, setTradeSlug] = useState("");
  const [category, setCategory] = useState("");
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const now = Date.now();
  const active = useMemo(
    () => placements.filter((p) => p.status === "active" && new Date(p.expiresAt).getTime() > now),
    [placements, now]
  );
  const byCategory = useMemo(() => {
    const map = new Map<string, FeaturedPlacement[]>();
    for (const p of active) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [active]);

  async function createNew() {
    if (!tradeSlug.trim() || !category.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/featured-placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeSlug: tradeSlug.trim(),
          category: category.trim().toLowerCase(),
          days,
          adminNote: note.trim() || null,
          override
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error === "category-full"
          ? `Category is full (${seatsPerCategory} seats). Tick "Override" to force.`
          : data.error === "trade-already-featured"
            ? "This trade already holds a slot in that category."
            : "Create failed. Try again.");
        return;
      }
      setPlacements((prev) => [data.placement as FeaturedPlacement, ...prev]);
      setTradeSlug("");
      setCategory("");
      setNote("");
      setDays(7);
      setOverride(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    if (cancellingId) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/featured-placements/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError("Cancel failed.");
        return;
      }
      setPlacements((prev) => prev.map((p) => p.id === id ? { ...p, status: "cancelled" as const } : p));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <header className="border-b bg-white" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft size={12}/>
            Admin
          </Link>
          <span className="text-neutral-300">/</span>
          <h1 className="text-[15px] font-black text-neutral-900">Featured Placements</h1>
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-white">
            {active.length} active
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:px-6">
        {/* Create form */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Add featured slot
          </div>
          <h2 className="mt-1 text-[16px] font-black text-neutral-900">Boost a trade</h2>
          <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
            {seatsPerCategory} seats per category. When all are full, next purchase queues until one expires.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <Field label="Trade slug (host)">
              <input
                type="text"
                value={tradeSlug}
                onChange={(e) => setTradeSlug(e.target.value.slice(0, 120))}
                placeholder="demo-gareth-tomlinson-loft-ladders-birmingham"
                className="w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] text-neutral-900 focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
            </Field>
            <Field label="Category (search keyword)">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value.toLowerCase().slice(0, 60))}
                placeholder="loft ladders"
                className="w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] text-neutral-900 focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
            </Field>
            <Field label="Duration (days)">
              <input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 7)))}
                className="w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] text-neutral-900 focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
            </Field>
            <Field label="Admin note (optional)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="Why this trade, for the record"
                className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[12.5px] text-neutral-900 focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-neutral-700">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="h-4 w-4"/>
              Override seat cap (use sparingly)
            </label>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black" style={{ color: RED }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={createNew}
              disabled={submitting || !tradeSlug.trim() || !category.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[11.5px] font-black uppercase tracking-wider shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
            >
              {submitting ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13} strokeWidth={2.6}/>}
              Feature this trade
            </button>
          </div>
        </section>

        {/* Active + history */}
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Active by category
            </div>
            <h2 className="mt-1 text-[16px] font-black text-neutral-900">Currently boosted</h2>
            {byCategory.length === 0 && (
              <p className="mt-3 text-[12.5px] text-neutral-500">No active placements. Add one on the left.</p>
            )}
            <ul className="mt-3 flex flex-col gap-3">
              {byCategory.map(([cat, rows]) => (
                <li key={cat} className="rounded-xl border p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[13px] font-black text-neutral-900">{cat}</h3>
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                      {rows.length} / {seatsPerCategory} seats
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {rows.map((p) => (
                      <PlacementRow key={p.id} placement={p} onCancel={cancel} cancelling={cancellingId === p.id}/>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Recent history</div>
            <h2 className="mt-1 text-[16px] font-black text-neutral-900">All placements</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {placements.slice(0, 30).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2 text-[11.5px]"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black text-neutral-900">{p.tradeSlug}</div>
                    <div className="text-[10.5px] text-neutral-500">
                      {p.category} · {p.billingSource} · £{(p.paidAmountGbp / 100).toFixed(2)}
                    </div>
                  </div>
                  <StatusPill status={p.status}/>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">{label}</div>
      {children}
    </label>
  );
}

function PlacementRow({
  placement,
  onCancel,
  cancelling
}: {
  placement: FeaturedPlacement;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  const expires = new Date(placement.expiresAt);
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 p-2 text-[11.5px]">
      <div className="min-w-0 flex-1">
        <div className="truncate font-black text-neutral-900">{placement.tradeSlug}</div>
        <div className="text-[10.5px] text-neutral-500">
          Expires {expires.toLocaleDateString()} ({placement.billingSource})
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCancel(placement.id)}
        disabled={cancelling}
        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        {cancelling ? <Loader2 size={10} className="animate-spin"/> : <Trash2 size={10}/>}
        Cancel
      </button>
    </li>
  );
}

function StatusPill({ status }: { status: FeaturedPlacement["status"] }) {
  const map: Record<string, { label: string; color: string }> = {
    active:    { label: "Active",    color: GREEN },
    queued:    { label: "Queued",    color: BRAND_YELLOW },
    expired:   { label: "Expired",   color: "#737373" },
    refunded:  { label: "Refunded",  color: "#737373" },
    cancelled: { label: "Cancelled", color: RED }
  };
  const cfg = map[status] ?? { label: status, color: "#737373" };
  return (
    <span
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
    >
      {status === "active" ? <Check size={9}/> : <X size={9}/>}
      {cfg.label}
    </span>
  );
}
