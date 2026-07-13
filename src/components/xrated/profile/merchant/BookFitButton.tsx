"use client";

// BookFitButton — client button rendered per installer card on the
// PDP's "Independent local trades" strip. One tap does three things:
//
//   1. Adds the anchor product to the merchant's cart (per-seller
//      localStorage via xratedCart)
//   2. POSTs to /api/trade-off/nearby-installers/pair to log the
//      lead + get back a pre-composed WhatsApp URL
//   3. Opens WhatsApp in a new tab so the shopper is straight in the
//      installer's inbox
//
// If the server pair POST fails (network / validation) we still open
// WhatsApp with a locally-built message so the shopper isn't stuck —
// the lead just isn't logged. Better a lost analytics event than a
// broken UX at the crucial handoff moment.

import { useState } from "react";
import { Loader2, LinkIcon, AlertTriangle } from "lucide-react";
import { addItem } from "@/lib/xratedCart";

type AnchorSnapshot = {
  productId: string;
  name: string;
  pricePence: number;
  coverUrl: string | null;
  unit: string | null;
  sellerSlug: string;
  sellerName: string;
};

type InstallerSnapshot = {
  serviceId: string;
  serviceName: string;
  pricePence: number;
  sellerName: string;
  sellerWhatsapp: string;
};

function buildFallbackWhatsApp(
  anchor: AnchorSnapshot,
  installer: InstallerSnapshot
): string | null {
  const digits = installer.sellerWhatsapp.replace(/\D/g, "");
  if (!digits) return null;
  const first = installer.sellerName.trim().split(/\s+/)[0] || "there";
  const priceLabel = `£${(installer.pricePence / 100).toFixed(2)}`;
  const msg =
    `Hi ${first} — I'm ordering "${anchor.name}" from ${anchor.sellerName} ` +
    `and I'd like you to fit it. Your listed rate is ${priceLabel}. ` +
    `When could you do it?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export function BookFitButton({
  anchor,
  installer
}: {
  anchor: AnchorSnapshot;
  installer: InstallerSnapshot;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);

    // 1. Add anchor product to the merchant's cart. Runs first so if
    //    the shopper closes the tab immediately after clicking, the
    //    cart already has the product.
    try {
      addItem(anchor.sellerSlug, {
        product_id: anchor.productId,
        name: anchor.name,
        price_pence: anchor.pricePence,
        cover_url: anchor.coverUrl,
        unit: anchor.unit
      });
      window.dispatchEvent(new CustomEvent("xrated-cart-change"));
    } catch {
      // Non-fatal — carry on to WhatsApp handoff even if the local
      // cart write blew up.
    }

    // 2. Log the pairing lead + collect the server-composed WA URL.
    let whatsappUrl: string | null = null;
    try {
      const res = await fetch("/api/trade-off/nearby-installers/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          anchor_product_id: anchor.productId,
          installer_service_id: installer.serviceId,
          source: "pdp"
        })
      });
      const json = (await res.json()) as
        | { ok: true; leadId: string; whatsappUrl: string | null }
        | { ok: false; error: string };
      if (json.ok) {
        whatsappUrl = json.whatsappUrl;
      } else {
        setError(
          json.error === "install_category_mismatch"
            ? "This installer no longer covers this install."
            : "Couldn't log the lead — opening WhatsApp anyway."
        );
      }
    } catch {
      setError("Couldn't log the lead — opening WhatsApp anyway.");
    }

    // 3. Fallback URL if the server call didn't give us one.
    const finalUrl = whatsappUrl ?? buildFallbackWhatsApp(anchor, installer);
    setBusy(false);
    if (finalUrl) {
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } else {
      setError("This installer has no WhatsApp on file.");
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 text-[12.5px] font-black text-[#0A0A0A] shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Working…
          </>
        ) : (
          <>
            <LinkIcon className="h-3.5 w-3.5" aria-hidden />
            Book fit + shop
          </>
        )}
      </button>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-1 text-[11px] font-semibold text-red-700"
        >
          <AlertTriangle
            className="mt-0.5 h-3 w-3 shrink-0"
            aria-hidden
          />
          {error}
        </p>
      )}
    </div>
  );
}
