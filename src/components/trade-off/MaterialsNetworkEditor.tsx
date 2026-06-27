"use client";

// Materials Network — tradesperson editor.
//
// Two halves:
//  1. Merchant picker — search + select up to MAX_PICKS=12 builder's
//     merchants, drag-reorder via dnd-kit, edit intro_note inline.
//  2. Earnings ledger — read-only summary of the tradie's referral
//     activity. PRIVACY BOUNDARY: customer name / wa / postcode never
//     reach this surface (server strips them).
//
// All side-effects fire through the /api/trade-off/materials-network/*
// routes. No direct Supabase access here — the editor stays a pure
// client component.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MAX_PICKS, formatGbpPence } from "@/lib/xratedMaterialsNetwork";

type Pick = {
  id: string;
  merchant_listing_id: string;
  merchant_slug: string;
  merchant_display_name: string;
  merchant_city: string;
  merchant_primary_trade: string;
  merchant_avatar_url: string | null;
  merchant_commission_rate: number | null;
  merchant_commission_min_pence: number;
  merchant_paused: boolean;
  intro_note: string | null;
  sort_order: number;
};

type Suggestion = {
  id: string;
  slug: string;
  display_name: string;
  primary_trade: string;
  city: string;
  avatar_url: string | null;
  merchant_commission_rate: number | null;
  merchant_commission_min_pence: number;
  paused: boolean;
};

type Aggregate = {
  pending_count: number;
  pending_estimate_pence: number;
  fulfilled_count: number;
  commission_total_pence: number;
  declined_count: number;
};

type LedgerRow = {
  id: string;
  ref_code: string;
  status: "pending" | "fulfilled" | "declined" | "expired" | "disputed";
  merchant_slug: string | null;
  merchant_display_name: string | null;
  merchant_city: string | null;
  estimated_cart_total_pence: number | null;
  fulfilled_order_value_pence: number | null;
  commission_pence: number | null;
  commission_rate_at_fulfilment: number | null;
  fulfilled_at: string | null;
  declined_reason: string | null;
  expires_at: string;
  created_at: string;
};

export function MaterialsNetworkEditor({
  slug,
  editToken,
  isPaid,
  addonOn
}: {
  slug: string;
  editToken: string;
  isPaid: boolean;
  addonOn: boolean;
}) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const refreshPicks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trade-off/materials-network/picks/list?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(editToken)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not load picks.");
        return;
      }
      setPicks(json.picks as Pick[]);
    } catch {
      setError("Network error loading picks.");
    } finally {
      setLoading(false);
    }
  }, [slug, editToken]);

  const refreshLedger = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/trade-off/materials-network/referrals/list?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(editToken)}&role=tradie&include_aggregate=1`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.ok) {
        setAggregate((json.aggregate as Aggregate) ?? null);
        setLedger((json.referrals as LedgerRow[]) ?? []);
      }
    } catch {
      // soft fail — ledger panel will show an empty state.
    }
  }, [slug, editToken]);

  useEffect(() => {
    refreshPicks();
    refreshLedger();
  }, [refreshPicks, refreshLedger]);

  // Debounced suggestion search.
  useEffect(() => {
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/trade-off/materials-network/picks/suggestions?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(editToken)}&q=${encodeURIComponent(query)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json.ok) setSuggestions(json.merchants as Suggestion[]);
        else setSuggestions([]);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, slug, editToken]);

  async function addPick(merchant: Suggestion) {
    if (picks.length >= MAX_PICKS) {
      setError(`You can pick up to ${MAX_PICKS} merchants.`);
      return;
    }
    try {
      const res = await fetch("/api/trade-off/materials-network/picks/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          merchant_slug: merchant.slug
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not add merchant.");
        return;
      }
      await refreshPicks();
      setQuery("");
    } catch {
      setError("Network error adding merchant.");
    }
  }

  async function deletePick(pickId: string) {
    try {
      const res = await fetch("/api/trade-off/materials-network/picks/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, pick_id: pickId })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not remove merchant.");
        return;
      }
      setPicks((prev) => prev.filter((p) => p.id !== pickId));
    } catch {
      setError("Network error removing merchant.");
    }
  }

  async function updateIntroNote(pick: Pick, note: string) {
    try {
      const res = await fetch("/api/trade-off/materials-network/picks/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          merchant_slug: pick.merchant_slug,
          pick_id: pick.id,
          intro_note: note
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save note.");
      }
    } catch {
      setError("Network error saving note.");
    }
  }

  async function persistOrder(next: Pick[]) {
    try {
      await fetch("/api/trade-off/materials-network/picks/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          ordered_ids: next.map((p) => p.id)
        })
      });
    } catch {
      setError("Network error saving order.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = picks.findIndex((p) => p.id === active.id);
    const newIndex = picks.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(picks, oldIndex, newIndex);
    setPicks(next);
    persistOrder(next);
  }

  const pickIds = useMemo(() => picks.map((p) => p.id), [picks]);

  return (
    <div className="rounded-3xl border border-brand-line bg-brand-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold sm:text-2xl">
            Merchant picks
          </h2>
          <p className="mt-1 text-[13px] text-brand-muted">
            Pick up to {MAX_PICKS} builder&rsquo;s merchants you actually buy from.
            Drag the cards to set the order customers see.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-brand-bg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
          {picks.length}/{MAX_PICKS}
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {error}
        </p>
      )}

      {/* Search picker */}
      <div className="mt-5">
        <label className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
          Find a merchant
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, trade, or city…"
          className="mt-1 h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none transition focus:border-brand-accent"
        />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestions.length === 0 && !searching && (
            <p className="col-span-full text-xs text-brand-muted">
              No suggestions yet &mdash; type a merchant name, trade, or city.
            </p>
          )}
          {suggestions.map((s) => {
            const disabled = picks.length >= MAX_PICKS;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => addPick(s)}
                disabled={disabled}
                className="flex items-start gap-3 rounded-xl border border-brand-line bg-brand-bg p-3 text-left transition hover:border-brand-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-300">
                  {s.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.avatar_url}
                      alt={s.display_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-black text-xs font-extrabold text-brand-accent">
                      {s.display_name[0]?.toUpperCase() ?? "M"}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-brand-text">
                    {s.display_name}
                  </p>
                  <p className="truncate text-xs text-brand-muted">
                    {s.city} &middot; {s.primary_trade}
                  </p>
                  {typeof s.merchant_commission_rate === "number" && (
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-brand-accent">
                      {s.merchant_commission_rate}% commission
                    </p>
                  )}
                  {s.paused && (
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-red-400">
                      Paused
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Picks list — sortable */}
      <div className="mt-7">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-muted">
          Your picks
        </h3>
        {loading ? (
          <p className="mt-3 text-xs text-brand-muted">Loading…</p>
        ) : picks.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-brand-line bg-brand-bg p-5 text-center">
            <p className="text-sm font-bold text-brand-text">
              No merchants picked yet.
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Search above to add the merchants you buy from.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={pickIds} strategy={verticalListSortingStrategy}>
              <ul className="mt-3 flex flex-col gap-2">
                {picks.map((p) => (
                  <SortablePickCard
                    key={p.id}
                    pick={p}
                    onDelete={() => deletePick(p.id)}
                    onSaveNote={(note) => updateIntroNote(p, note)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {(!isPaid || !addonOn) && picks.length > 0 && (
        <p className="mt-3 text-xs text-brand-muted">
          Your picks save now, but won&rsquo;t render on your public profile until
          Materials Network is on and your tier is paid.
        </p>
      )}

      {/* Earnings ledger — read-only */}
      <div className="mt-10 rounded-2xl border border-brand-line bg-brand-bg p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-muted">
              Earnings ledger
            </h3>
            <p className="mt-1 text-[12px] text-brand-muted">
              Trust-based commission. The merchant marks each lead fulfilled
              &mdash; you see the same ledger. Customer details stay with the
              merchant (privacy boundary).
            </p>
          </div>
        </div>

        {aggregate && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Stat label="Pending" value={aggregate.pending_count} />
            <Stat label="Estimated" value={formatGbpPence(aggregate.pending_estimate_pence)} />
            <Stat label="Fulfilled" value={aggregate.fulfilled_count} />
            <Stat
              label="Earned"
              value={formatGbpPence(aggregate.commission_total_pence)}
              accent
            />
            <Stat label="Declined" value={aggregate.declined_count} />
          </div>
        )}

        <ul className="mt-5 flex flex-col gap-2">
          {ledger.length === 0 ? (
            <p className="text-xs text-brand-muted">
              No referrals yet. As soon as a customer sends a quote from your
              materials page, it lands here.
            </p>
          ) : (
            ledger.slice(0, 50).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-brand-line bg-brand-surface px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-brand-text">
                    <span className="font-extrabold">{r.ref_code}</span>{" "}
                    &middot; {r.merchant_display_name ?? "—"}
                  </p>
                  <p className="truncate text-[11px] text-brand-muted">
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                    {r.merchant_city ? ` · ${r.merchant_city}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
                    r.status === "fulfilled"
                      ? "bg-brand-accent/20 text-brand-accent"
                      : r.status === "pending"
                        ? "bg-blue-500/15 text-blue-400"
                        : r.status === "declined"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-neutral-500/15 text-neutral-400"
                  }`}
                >
                  {r.status}
                </span>
                {r.status === "fulfilled" && r.commission_pence !== null && (
                  <span className="text-xs font-extrabold text-brand-accent">
                    {formatGbpPence(r.commission_pence)}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-2">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-brand-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-extrabold ${accent ? "text-brand-accent" : "text-brand-text"}`}
      >
        {value}
      </p>
    </div>
  );
}

function SortablePickCard({
  pick,
  onDelete,
  onSaveNote
}: {
  pick: Pick;
  onDelete: () => void;
  onSaveNote: (note: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pick.id });
  const [note, setNote] = useState(pick.intro_note ?? "");
  const [dirty, setDirty] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div className="flex items-start gap-3 rounded-xl border border-brand-line bg-brand-bg p-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className="mt-1 inline-flex h-9 w-7 cursor-grab items-center justify-center rounded text-brand-muted hover:bg-brand-surface"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>
        <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-300">
          {pick.merchant_avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={pick.merchant_avatar_url}
              alt={pick.merchant_display_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-black text-xs font-extrabold text-brand-accent">
              {pick.merchant_display_name[0]?.toUpperCase() ?? "M"}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-brand-text">
            {pick.merchant_display_name}
          </p>
          <p className="truncate text-[11px] text-brand-muted">
            {pick.merchant_city}
            {typeof pick.merchant_commission_rate === "number"
              ? ` · ${pick.merchant_commission_rate}% commission`
              : ""}
            {pick.merchant_paused ? " · PAUSED" : ""}
          </p>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value.slice(0, 200));
              setDirty(true);
            }}
            onBlur={() => {
              if (dirty) {
                onSaveNote(note);
                setDirty(false);
              }
            }}
            rows={2}
            maxLength={200}
            placeholder="Short note (optional) — e.g. 'Best plasterboard prices in north Manchester'"
            className="mt-2 w-full resize-none rounded-lg border border-brand-line bg-brand-surface px-2.5 py-1.5 text-[12px] text-brand-text outline-none transition focus:border-brand-accent"
          />
          <p className="mt-1 text-[10px] text-brand-muted">{note.length}/200</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${pick.merchant_display_name}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-muted transition hover:bg-red-500/15 hover:text-red-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </li>
  );
}
