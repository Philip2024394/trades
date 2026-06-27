"use client";

// Materials Network — merchant-side fulfilment panel.
//
// Two halves:
//  1. Commission config — rate (%), min pence floor, terms blurb,
//     paused toggle. Saves on blur via /commission/upsert.
//  2. Fulfilment tabs — Pending / Fulfilled / Declined. Merchant marks
//     a pending row fulfilled (capturing the order value) or declined
//     (reason enum + free-text note). The commission is computed
//     server-side at fulfilment time using the CURRENT rate so a later
//     rate change can't retro-shift booked earnings.
//
// Only rendered when the listing has wholesale_mode on (the
// "I AM a merchant" signal). Tradespeople without wholesale_mode see
// only the upper picker editor.

import { useCallback, useEffect, useState } from "react";
import { formatGbpPence } from "@/lib/xratedMaterialsNetwork";

type MerchantReferral = {
  id: string;
  ref_code: string;
  status: "pending" | "fulfilled" | "declined" | "expired" | "disputed";
  tradie_slug: string | null;
  tradie_display_name: string | null;
  tradie_city: string | null;
  customer_name: string | null;
  customer_wa_e164: string | null;
  cart_items_snapshot: {
    name: string;
    qty: number;
    price_pence: number;
    unit?: string | null;
    variant_label?: string | null;
  }[];
  estimated_cart_total_pence: number | null;
  fulfilled_order_value_pence: number | null;
  commission_pence: number | null;
  commission_rate_at_fulfilment: number | null;
  fulfilled_at: string | null;
  declined_reason: string | null;
  declined_note: string | null;
  fulfilled_note: string | null;
  expires_at: string;
  created_at: string;
};

const DECLINE_REASONS = [
  { value: "no_order_placed", label: "Customer never placed an order" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "customer_cancelled", label: "Customer cancelled" },
  { value: "duplicate", label: "Duplicate of existing lead" },
  { value: "out_of_area", label: "Out of delivery area" },
  { value: "other", label: "Other (see note)" }
] as const;

type Tab = "pending" | "fulfilled" | "declined";

export function MerchantFulfilmentPanel({
  slug,
  editToken,
  initialCommissionRate,
  initialCommissionMinPence,
  initialCommissionTerms,
  initialPaused
}: {
  slug: string;
  editToken: string;
  initialCommissionRate: number | null;
  initialCommissionMinPence: number;
  initialCommissionTerms: string | null;
  initialPaused: boolean;
}) {
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<MerchantReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Commission config state
  const [rate, setRate] = useState<string>(
    initialCommissionRate !== null ? String(initialCommissionRate) : ""
  );
  const [minPence, setMinPence] = useState<string>(
    String(initialCommissionMinPence ?? 0)
  );
  const [terms, setTerms] = useState<string>(initialCommissionTerms ?? "");
  const [paused, setPaused] = useState<boolean>(initialPaused);
  const [savingConfig, setSavingConfig] = useState(false);

  const refresh = useCallback(
    async (which: Tab = tab) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/trade-off/materials-network/referrals/list?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(editToken)}&role=merchant&status=${which}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!json.ok) {
          setError(json.error ?? "Could not load referrals.");
          return;
        }
        setRows((json.referrals as MerchantReferral[]) ?? []);
      } catch {
        setError("Network error loading referrals.");
      } finally {
        setLoading(false);
      }
    },
    [slug, editToken, tab]
  );

  useEffect(() => {
    refresh(tab);
  }, [refresh, tab]);

  async function saveConfig(patch: Record<string, unknown>) {
    setSavingConfig(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/trade-off/materials-network/commission/upsert",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, edit_token: editToken, ...patch })
        }
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save.");
      }
    } catch {
      setError("Network error saving config.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function markFulfilled(
    ref: MerchantReferral,
    orderValuePence: number,
    note: string
  ) {
    try {
      const res = await fetch(
        "/api/trade-off/materials-network/referrals/fulfil",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: editToken,
            referral_id: ref.id,
            fulfilled_order_value_pence: orderValuePence,
            fulfilled_note: note
          })
        }
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not mark fulfilled.");
        return;
      }
      await refresh(tab);
    } catch {
      setError("Network error.");
    }
  }

  async function markDeclined(
    ref: MerchantReferral,
    reason: string,
    note: string
  ) {
    try {
      const res = await fetch(
        "/api/trade-off/materials-network/referrals/decline",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: editToken,
            referral_id: ref.id,
            declined_reason: reason,
            declined_note: note
          })
        }
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not decline.");
        return;
      }
      await refresh(tab);
    } catch {
      setError("Network error.");
    }
  }

  return (
    <div className="rounded-3xl border border-brand-line bg-brand-surface p-5 sm:p-6">
      <h2 className="text-xl font-extrabold sm:text-2xl">
        Merchant fulfilment
      </h2>
      <p className="mt-1 text-[13px] text-brand-muted">
        You appear in the Materials Network because you run Wholesale Mode.
        Configure your commission and mark referrals fulfilled as orders close.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {error}
        </p>
      )}

      {/* Commission config */}
      <div className="mt-5 rounded-2xl border border-brand-line bg-brand-bg p-4">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-muted">
          Commission settings
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
              Rate (%)
            </span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onBlur={() =>
                saveConfig({
                  commission_rate: rate === "" ? null : Number(rate)
                })
              }
              placeholder="e.g. 8"
              className="mt-1 h-11 w-full rounded-lg border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
              Minimum commission (pence)
            </span>
            <input
              type="number"
              min={0}
              step={50}
              value={minPence}
              onChange={(e) => setMinPence(e.target.value)}
              onBlur={() =>
                saveConfig({
                  commission_min_pence: Number(minPence) || 0
                })
              }
              placeholder="e.g. 500 = £5.00"
              className="mt-1 h-11 w-full rounded-lg border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
            Terms (shown to tradespeople before they pick you)
          </span>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value.slice(0, 500))}
            onBlur={() => saveConfig({ commission_terms: terms })}
            rows={3}
            maxLength={500}
            placeholder="e.g. Paid monthly via bank transfer once invoice is paid. Excludes returns."
            className="mt-1 w-full resize-y rounded-lg border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
          <p className="mt-1 text-[10px] text-brand-muted">
            {terms.length}/500
          </p>
        </label>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => {
              setPaused(e.target.checked);
              saveConfig({ paused: e.target.checked });
            }}
            className="h-4 w-4 rounded border-brand-line bg-brand-surface accent-brand-accent"
          />
          <span className="text-xs text-brand-text">
            Pause new referrals (existing pending ones stay actionable)
          </span>
        </label>
        {savingConfig && (
          <p className="mt-1 text-[10px] text-brand-muted">Saving…</p>
        )}
      </div>

      {/* Fulfilment tabs */}
      <div className="mt-7">
        <div className="flex items-center gap-2 border-b border-brand-line">
          {(["pending", "fulfilled", "declined"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px inline-flex h-10 items-center border-b-2 px-3 text-xs font-extrabold uppercase tracking-widest transition ${
                tab === t
                  ? "border-brand-accent text-brand-accent"
                  : "border-transparent text-brand-muted hover:text-brand-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <ul className="mt-4 flex flex-col gap-3">
          {loading ? (
            <p className="text-xs text-brand-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <li className="rounded-lg border border-dashed border-brand-line bg-brand-bg p-4 text-center text-xs text-brand-muted">
              No {tab} referrals yet.
            </li>
          ) : (
            rows.map((r) => (
              <ReferralRow
                key={r.id}
                referral={r}
                tab={tab}
                rate={rate}
                onFulfil={(value, note) => markFulfilled(r, value, note)}
                onDecline={(reason, note) => markDeclined(r, reason, note)}
              />
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function ReferralRow({
  referral,
  tab,
  rate,
  onFulfil,
  onDecline
}: {
  referral: MerchantReferral;
  tab: Tab;
  rate: string;
  onFulfil: (orderValuePence: number, note: string) => void;
  onDecline: (reason: string, note: string) => void;
}) {
  const [mode, setMode] = useState<null | "fulfil" | "decline">(null);
  const [orderValuePounds, setOrderValuePounds] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [reason, setReason] = useState<string>("no_order_placed");

  const estimatedPence = referral.estimated_cart_total_pence ?? 0;
  const tradieLabel = referral.tradie_display_name
    ? `${referral.tradie_display_name}${referral.tradie_city ? ` (${referral.tradie_city})` : ""}`
    : "Unknown tradie";

  return (
    <li className="rounded-xl border border-brand-line bg-brand-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-extrabold text-brand-accent">
              {referral.ref_code}
            </span>{" "}
            &middot;{" "}
            <span className="font-bold text-brand-text">{tradieLabel}</span>
          </p>
          <p className="mt-1 text-[11px] text-brand-muted">
            {new Date(referral.created_at).toLocaleString("en-GB")}
          </p>
          {referral.customer_name || referral.customer_wa_e164 ? (
            <p className="mt-1 text-xs text-brand-text">
              Customer: {referral.customer_name ?? "—"}
              {referral.customer_wa_e164 ? (
                <>
                  {" · "}
                  <a
                    href={`https://wa.me/${referral.customer_wa_e164.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent underline-offset-2 hover:underline"
                  >
                    WhatsApp
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          {referral.cart_items_snapshot && referral.cart_items_snapshot.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-bold text-brand-muted hover:text-brand-accent">
                {referral.cart_items_snapshot.length} item
                {referral.cart_items_snapshot.length === 1 ? "" : "s"} in cart
              </summary>
              <ul className="mt-1 space-y-0.5 pl-3 text-[11px] text-brand-text">
                {referral.cart_items_snapshot.map((it, i) => (
                  <li key={i}>
                    {it.qty} × {it.name}
                    {it.variant_label ? ` (${it.variant_label})` : ""} —{" "}
                    {formatGbpPence(it.price_pence)}
                    {it.unit ? ` ${it.unit}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {estimatedPence > 0 && (
            <p className="mt-1 text-[11px] text-brand-muted">
              Estimated cart: {formatGbpPence(estimatedPence)}
            </p>
          )}
          {tab === "fulfilled" && (
            <p className="mt-1 text-[12px] text-brand-accent">
              Fulfilled: {formatGbpPence(referral.fulfilled_order_value_pence ?? 0)}{" "}
              · commission {formatGbpPence(referral.commission_pence ?? 0)}
              {typeof referral.commission_rate_at_fulfilment === "number"
                ? ` (${referral.commission_rate_at_fulfilment}%)`
                : ""}
            </p>
          )}
          {tab === "declined" && referral.declined_reason && (
            <p className="mt-1 text-[12px] text-red-400">
              Declined: {referral.declined_reason}
              {referral.declined_note ? ` — ${referral.declined_note}` : ""}
            </p>
          )}
        </div>
      </div>

      {tab === "pending" && mode === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("fulfil");
              setOrderValuePounds(
                estimatedPence > 0 ? (estimatedPence / 100).toFixed(2) : ""
              );
            }}
            className="inline-flex h-9 items-center rounded-lg bg-brand-accent px-3 text-xs font-extrabold text-black transition hover:opacity-90"
          >
            Mark fulfilled
          </button>
          <button
            type="button"
            onClick={() => setMode("decline")}
            className="inline-flex h-9 items-center rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-xs font-extrabold text-red-400 transition hover:bg-red-500/20"
          >
            Decline
          </button>
        </div>
      )}

      {mode === "fulfil" && (
        <div className="mt-3 rounded-lg border border-brand-accent/40 bg-brand-accent/10 p-3">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
              Order value (£)
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={orderValuePounds}
              onChange={(e) => setOrderValuePounds(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <label className="mt-2 block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              maxLength={500}
              className="mt-1 w-full resize-y rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          {rate && Number(rate) > 0 && orderValuePounds && (
            <p className="mt-2 text-[11px] text-brand-muted">
              Commission preview: ~{formatGbpPence(
                Math.round(Number(orderValuePounds) * 100 * Number(rate) / 100)
              )}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const pence = Math.round(Number(orderValuePounds) * 100);
                if (!Number.isFinite(pence) || pence <= 0) return;
                onFulfil(pence, note);
                setMode(null);
                setOrderValuePounds("");
                setNote("");
              }}
              className="inline-flex h-9 items-center rounded-lg bg-brand-accent px-3 text-xs font-extrabold text-black"
            >
              Confirm fulfilled
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="inline-flex h-9 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "decline" && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-400">
              Reason
            </span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            >
              {DECLINE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              maxLength={500}
              className="mt-1 w-full resize-y rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onDecline(reason, note);
                setMode(null);
                setNote("");
              }}
              className="inline-flex h-9 items-center rounded-lg bg-red-500 px-3 text-xs font-extrabold text-white"
            >
              Confirm decline
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="inline-flex h-9 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
