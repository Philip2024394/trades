"use client";

// Materials Network — customer "Send quote on WhatsApp" button.
//
// On click:
// 1. Reads the per-merchant cart from localStorage (Xrated Shop Mode
//    cart uses the merchant's slug as the storage scope key).
// 2. POSTs to /api/trade-off/materials-network/referrals/create to mint
//    a ref_code (or reuse one inside the 24h sticky window).
// 3. Opens https://wa.me/<merchant whatsapp> with a structured message
//    that:
//      - declares the referring tradesperson by name
//      - shows the MN-{ref_code} attribution token at the top
//      - lists the cart items if present (or an empty placeholder)
// 4. Falls back to a plain WhatsApp link if the create fails so the
//    customer never sees a dead button.

import { useState } from "react";
import { readCart, cartTotalPence, formatGbp } from "@/lib/xratedCart";

function whatsappDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D+/g, "");
}

export function MaterialsQuoteButton({
  tradieSlug,
  merchantSlug,
  merchantDisplayName,
  merchantWhatsapp,
  tradieDisplayName
}: {
  tradieSlug: string;
  merchantSlug: string;
  merchantDisplayName: string;
  merchantWhatsapp: string;
  tradieDisplayName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const cart = readCart(merchantSlug);
    const subtotal = cartTotalPence(cart);
    const cartSnapshot = cart.items.map((it) => ({
      name: it.name,
      qty: it.qty,
      price_pence: it.price_pence,
      unit: it.unit ?? null,
      variant_label: it.variant_label ?? null
    }));

    const digits = whatsappDigits(merchantWhatsapp);

    let refCode: string | null = null;
    try {
      const res = await fetch(
        "/api/trade-off/materials-network/referrals/create",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tradie_slug: tradieSlug,
            merchant_slug: merchantSlug,
            cart_items_snapshot: cartSnapshot,
            estimated_cart_total_pence: subtotal > 0 ? subtotal : null
          })
        }
      );
      const json = await res.json();
      if (json.ok && typeof json.ref_code === "string") {
        refCode = json.ref_code;
      } else if (json.error) {
        setError(json.error);
      }
    } catch {
      setError("Network error — opening WhatsApp without a ref code.");
    } finally {
      setBusy(false);
    }

    const lines: string[] = [];
    if (refCode) {
      lines.push(`Hi ${merchantDisplayName} — ${refCode}`);
    } else {
      lines.push(`Hi ${merchantDisplayName} — referral via Xrated`);
    }
    lines.push("");
    lines.push(`Referred by ${tradieDisplayName} (Xrated).`);
    lines.push("");
    if (cartSnapshot.length > 0) {
      lines.push("Items I'd like to quote:");
      for (const it of cartSnapshot) {
        const variantSuffix = it.variant_label ? ` (${it.variant_label})` : "";
        const unitSuffix = it.unit ? ` ${it.unit}` : "";
        lines.push(
          `• ${it.qty} × ${it.name}${variantSuffix} — ${formatGbp(it.price_pence)}${unitSuffix}`
        );
      }
      lines.push("");
      lines.push(`Estimated subtotal: ${formatGbp(subtotal)}`);
    } else {
      lines.push("Items I'd like to quote:");
      lines.push("(I'll list them in a follow-up message.)");
    }
    lines.push("");
    lines.push("Could you confirm pricing & delivery? Thanks.");

    const url = `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = url;
  }

  return (
    <>
      <a
        href={`https://wa.me/${whatsappDigits(merchantWhatsapp)}`}
        onClick={handleClick}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-neutral-900 shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "#FFB300" }}
        aria-disabled={busy}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.077 4.487.71.306 1.263.489 1.695.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488z" />
        </svg>
        {busy ? "Preparing…" : `Send quote on WhatsApp`}
      </a>
      {error && (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      )}
    </>
  );
}
