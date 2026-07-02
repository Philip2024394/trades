"use client";

// Cart page contents — reads localStorage, shows items, submits the
// full list as a WhatsApp message.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  cartTotalPence,
  clearCart,
  readCart,
  removeFromCart,
  updateCartQuantity,
  type PlantCartItem
} from "@/lib/plantCart";

export function PlantCartClient({
  merchantSlug,
  merchantName,
  waHref
}: {
  merchantSlug: string;
  merchantName: string;
  waHref: string | null;
}) {
  const [items, setItems] = useState<PlantCartItem[]>([]);
  const [postcode, setPostcode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(readCart(merchantSlug));
    setMounted(true);
    const onChange = () => setItems(readCart(merchantSlug));
    window.addEventListener("plant-cart-change", onChange);
    return () => window.removeEventListener("plant-cart-change", onChange);
  }, [merchantSlug]);

  const remove = (idx: number) => setItems(removeFromCart(merchantSlug, idx));
  const update = (idx: number, qty: number) =>
    setItems(updateCartQuantity(merchantSlug, idx, qty));
  const clear = () => {
    clearCart(merchantSlug);
    setItems([]);
  };

  const total = cartTotalPence(items);
  const canSubmit = items.length > 0 && name.trim().length > 1 && phone.trim().length >= 6;

  const submit = () => {
    if (!canSubmit) return;
    const parts: string[] = [
      `🛒 *HIRE LIST — ${merchantName}*`,
      "",
      "*Machines*"
    ];
    for (const i of items) {
      const wet = i.wet_hire ? " (wet-hire)" : "";
      const line = `• ${i.label} × ${i.quantity} — 1 ${i.duration}${wet} · £${(
        (i.unit_price_pence * i.quantity) /
        100
      ).toFixed(2)}`;
      parts.push(line);
    }
    parts.push("");
    parts.push(`💷 Total (excl. delivery): £${(total / 100).toFixed(2)}`);
    parts.push("");
    if (dateFrom) parts.push(`📅 Requested start: ${dateFrom}`);
    if (postcode) parts.push(`📍 Delivery to: ${postcode}`);
    parts.push("");
    parts.push(`👤 ${name} · ${phone}`);
    if (notes) parts.push(`📝 ${notes}`);
    parts.push("");
    parts.push("Please confirm availability + delivery cost.");
    const msg = encodeURIComponent(parts.join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  if (!mounted) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-[12px] text-neutral-500">Loading your hire list…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center">
        <p className="text-[14px] font-extrabold text-neutral-900">Your hire list is empty.</p>
        <p className="mt-2 text-[12px] text-neutral-500">
          Browse the fleet and tap &ldquo;Add to hire list&rdquo; on any machine.
        </p>
        <Link
          href={`/${merchantSlug}/plant-hire/machines`}
          className="mt-4 inline-flex h-11 items-center rounded-xl bg-[#FFB300] px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
        >
          Browse fleet →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2 rounded-3xl border border-neutral-200 bg-white p-3 sm:p-4">
        {items.map((i, idx) => {
          const line = i.unit_price_pence * i.quantity;
          return (
            <li
              key={i.slug + idx}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-neutral-50 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-extrabold leading-tight text-neutral-900">
                  {i.label}
                </p>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  1 {i.duration}
                  {i.wet_hire ? " · wet-hire" : ""} · £{(i.unit_price_pence / 100).toFixed(0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => update(idx, i.quantity - 1)}
                  className="h-8 w-8 rounded-lg border border-neutral-200 bg-white text-[16px] font-extrabold text-neutral-900 hover:bg-neutral-100"
                >
                  −
                </button>
                <span className="w-6 text-center text-[14px] font-extrabold">{i.quantity}</span>
                <button
                  type="button"
                  onClick={() => update(idx, i.quantity + 1)}
                  className="h-8 w-8 rounded-lg border border-neutral-200 bg-white text-[16px] font-extrabold text-neutral-900 hover:bg-neutral-100"
                >
                  +
                </button>
              </div>
              <p className="w-20 text-right text-[14px] font-extrabold text-neutral-900">
                £{(line / 100).toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="Remove"
                className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 hover:text-red-600"
              >
                Del
              </button>
            </li>
          );
        })}
        <li className="flex items-center justify-between border-t border-neutral-100 px-3 pt-3">
          <button
            type="button"
            onClick={clear}
            className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 hover:text-red-600"
          >
            Clear list
          </button>
          <div className="text-right">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Subtotal (excl. delivery)
            </p>
            <p className="text-[22px] font-extrabold text-neutral-900">
              £{(total / 100).toFixed(2)}
            </p>
          </div>
        </li>
      </ul>

      <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Send list on WhatsApp
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Delivery postcode
            </span>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="LS10 1LG"
              className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[13px] font-bold uppercase outline-none focus:border-[#FFB300] focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Preferred start date
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[13px] outline-none focus:border-[#FFB300] focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              Your name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[13px] outline-none focus:border-[#FFB300] focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
              WhatsApp / phone
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[13px] outline-none focus:border-[#FFB300] focus:bg-white"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Anything else? (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] outline-none focus:border-[#FFB300] focus:bg-white"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={`mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl text-[12px] font-extrabold uppercase tracking-widest transition ${
            canSubmit
              ? "bg-[#25D366] text-white hover:brightness-95"
              : "cursor-not-allowed bg-neutral-200 text-neutral-500"
          }`}
        >
          Send list on WhatsApp →
        </button>
      </div>
    </div>
  );
}
