"use client";

// Shared output panel for every Material Calculator. Renders the line
// list + warnings + optional labour breakdown + Materials total +
// Add-all-to-cart + Enquire-now WhatsApp buttons.
//
// CTAs match the buy column below: yellow Add-to-cart on the left,
// green Enquire Now (WhatsApp) on the right — same colours + intent the
// customer sees on the inline PDP CTAs, so the calculator output stays
// inside the same conversion path. The Enquire link is wa.me/<merchant>
// prefilled with the product Ref + every estimate line + the totals.

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
  productName,
  productRef,
  merchantName,
  merchantWhatsappDigits,
  onAddToCart
}: {
  type: CalculatorType;
  inputs: CalculatorInputs;
  output: CalculatorOutput;
  productSlug: string;
  listingSlug: string;
  productName: string;
  productRef: string;
  merchantName: string;
  /** Digits-only merchant WhatsApp number (no +, no spaces). Passed as
   *  empty string when the merchant has no WhatsApp on file — in that
   *  case the Enquire button is hidden. */
  merchantWhatsappDigits: string;
  /** Add-to-cart handler — the parent reads cart lines from output and
   *  pushes them into the cart. Returns true on success. */
  onAddToCart: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<"cart" | null>(null);
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

  // Build the WhatsApp enquiry URL — prefills the full estimate so the
  // merchant lands on a thread with line items, totals, product ref and
  // a confirm-availability ask. Skipped if the merchant has no WhatsApp.
  const enquireHref = (() => {
    if (!merchantWhatsappDigits) return null;
    const lines = output.lines
      .filter((l) => (l.tone ?? "muted") !== "warning")
      .map((l) => `• ${l.label}: ${l.value}`)
      .join("\n");
    const totalsBlock = output.labour
      ? `Materials: ${formatGbp(output.materials_total_pence)}\nInstallation (${output.labour.trade_label}): ${formatGbp(output.labour.total_pence)}\nTotal: ${formatGbp(grandTotal)}`
      : `Materials total: ${formatGbp(output.materials_total_pence)}`;
    const msg = `Hi ${merchantName}, I've used your material calculator for "${productName}" (Ref: ${productRef}).\n\nEstimate:\n${lines}\n\n${totalsBlock}\n\nCan you confirm pricing and availability? Thanks.`;
    return `https://wa.me/${merchantWhatsappDigits}?text=${encodeURIComponent(msg)}`;
  })();

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

      <div
        className={
          cartLines.length > 0 && enquireHref
            ? "grid grid-cols-2 gap-2 pt-1"
            : "flex flex-wrap gap-2 pt-1"
        }
      >
        {cartLines.length > 0 && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy !== null}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-wider text-black transition hover:opacity-90 disabled:opacity-60"
            style={{ background: "#FFB300" }}
          >
            {busy === "cart" ? "Adding…" : `Add all to cart (${cartLines.length})`}
          </button>
        )}
        {enquireHref && (
          <a
            href={enquireHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
            style={{
              background: "#0F7A3F",
              boxShadow: "0 8px 22px rgba(15,122,63,0.45)"
            }}
            aria-label="Enquire on WhatsApp with this estimate"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
            </svg>
            Enquiry Now
          </a>
        )}
      </div>

      {toast && (
        <p className="rounded-lg bg-neutral-900 px-3 py-2 text-center text-[12px] font-bold text-white">
          {toast}
        </p>
      )}
    </div>
  );
}
