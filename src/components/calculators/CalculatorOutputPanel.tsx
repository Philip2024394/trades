"use client";

// Shared output panel for every Material Calculator. Renders the line
// list + warnings + optional labour breakdown + Materials total +
// Share-estimate + Add-all-to-cart buttons.

import { useState } from "react";
import { formatGbp } from "@/lib/xratedCart";
import type { CalculatorOutput, CalculatorType } from "@/lib/calculators/types";
import type { CalculatorInputs } from "@/lib/calculators/types";

export function CalculatorOutputPanel({
  type,
  inputs,
  output,
  productSlug,
  listingSlug,
  onAddToCart,
  onShare
}: {
  type: CalculatorType;
  inputs: CalculatorInputs;
  output: CalculatorOutput;
  productSlug: string;
  listingSlug: string;
  /** Add-to-cart handler — the parent reads cart lines from output and
   *  pushes them into the cart. Returns true on success. */
  onAddToCart: () => Promise<boolean>;
  onShare: () => Promise<{ url: string } | null>;
}) {
  const [busy, setBusy] = useState<"cart" | "share" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cartLines = output.lines.filter((l) => l.cart);
  const grandTotal =
    output.materials_total_pence + (output.labour?.total_pence ?? 0);

  async function handleAdd() {
    setBusy("cart");
    setToast(null);
    try {
      const ok = await onAddToCart();
      setToast(ok ? "Added to cart — open the cart to enquire." : "Couldn't add to cart.");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleShare() {
    setBusy("share");
    setToast(null);
    try {
      const res = await onShare();
      if (!res) {
        setToast("Couldn't generate share link.");
        return;
      }
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "My material estimate",
            url: res.url
          });
          setToast("Estimate shared.");
          return;
        } catch {
          /* user cancelled — fall through to clipboard */
        }
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setToast("Link copied — paste it anywhere.");
      } catch {
        setToast(`Share link: ${res.url}`);
      }
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3500);
    }
  }

  // Suppress unused-param warnings — these are wired by future calc UIs.
  void type;
  void inputs;
  void productSlug;
  void listingSlug;

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Your estimate
      </p>

      <ul className="divide-y divide-neutral-100">
        {output.lines.map((line, i) => {
          const tone = line.tone ?? "muted";
          const valueClass =
            tone === "primary"
              ? "text-[18px] font-extrabold text-neutral-900"
              : tone === "warning"
                ? "text-[14px] font-extrabold text-orange-700"
                : "text-[14px] font-bold text-neutral-700";
          return (
            <li key={i} className="flex items-baseline justify-between gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-neutral-900">{line.label}</p>
                {line.detail && (
                  <p className="text-[11px] text-neutral-500">{line.detail}</p>
                )}
              </div>
              <span className={`${valueClass} shrink-0`}>{line.value}</span>
            </li>
          );
        })}
      </ul>

      {output.warnings && output.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {output.warnings.map((w, i) => (
            <li
              key={i}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-800"
            >
              ⚠️ {w}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-bold text-neutral-700">
            Materials total
          </span>
          <span className="text-[15px] font-extrabold text-neutral-900">
            {formatGbp(output.materials_total_pence)}
          </span>
        </div>
        {output.labour && (
          <>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-bold text-neutral-700">
                Installation ({output.labour.trade_label})
              </span>
              <span className="text-[15px] font-extrabold text-neutral-900">
                {formatGbp(output.labour.total_pence)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              {output.labour.quantity} {output.labour.rate_unit} @ {formatGbp(output.labour.rate_pence)}/{output.labour.rate_unit}
            </p>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2">
              <span className="text-[13px] font-extrabold text-neutral-900">Total</span>
              <span className="text-[18px] font-extrabold text-neutral-900">
                {formatGbp(grandTotal)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {cartLines.length > 0 && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy !== null}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-extrabold text-black transition hover:opacity-90 disabled:opacity-60"
            style={{ background: "#FFB300" }}
          >
            {busy === "cart" ? "Adding…" : `Add all to cart (${cartLines.length})`}
          </button>
        )}
        <button
          type="button"
          onClick={handleShare}
          disabled={busy !== null}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-bold text-neutral-900 transition hover:border-[#FFB300] hover:text-[#FFB300] disabled:opacity-60"
        >
          {busy === "share" ? "Sharing…" : "Share estimate"}
        </button>
      </div>

      {toast && (
        <p className="rounded-lg bg-neutral-900 px-3 py-2 text-center text-[12px] font-bold text-white">
          {toast}
        </p>
      )}
    </div>
  );
}
