// Message Seller CTA — two-button block used on merchant hero + PDP.
//
// Primary CTA: opens Trade Center native chat (thread new or existing),
// context auto-attached (product / merchant).
//
// Secondary CTA (only if merchant.heroWhatsAppE164 is set): deep-links
// to wa.me/... with a first message prefilled. Trade Center LOGS the
// tap ("WA handoff opened for merchant X on product Y at time T") but
// never sees the WhatsApp conversation itself.
//
// Constitution: Trade Center never blocks off-platform contact; we only
// need to know that first contact happened so the record is complete.

"use client";

import Link from "next/link";
import { MessageCircle, MessageSquare } from "lucide-react";
import { whatsappLinkFor } from "../data/threads";
import type { MarketplaceMerchant } from "@/apps/marketplace/data/merchants";
import type { MarketplaceProduct } from "@/apps/marketplace/types";

type Props = {
  merchant: MarketplaceMerchant;
  product?: MarketplaceProduct;
  variant?: "hero-light" | "hero-dark" | "pdp";
};

/**
 * Very lightweight WA tap-logger. In production this fires to a
 * `/api/track/wa-handoff` route which records to Postgres. For now we
 * pop a console + localStorage row so the audit trail exists client-side
 * and we can wire the server-side later without changing the component.
 */
function logWhatsAppHandoff(merchantSlug: string, productSlug: string | undefined) {
  if (typeof window === "undefined") return;
  const key = "tc.wa-handoff-log";
  const list = JSON.parse(window.localStorage.getItem(key) ?? "[]");
  list.push({
    merchantSlug,
    productSlug: productSlug ?? null,
    firedAtIso: new Date().toISOString()
  });
  window.localStorage.setItem(key, JSON.stringify(list));
}

export function MessageSellerCTA({ merchant, product, variant = "pdp" }: Props) {
  // For MVP, the Trade Center native chat CTA routes to the inbox with
  // a hint. Once thread-creation is wired, this becomes /tc/messages/new
  // with query params.
  const messageHref = `/tc/messages?compose=${merchant.slug}${product ? `&product=${product.slug}` : ""}`;

  const waE164 = merchant.homeCity ? merchant.slug : undefined; // placeholder gate
  // Merchant WhatsApp is opt-in per merchant. For fixtures, we expose
  // WhatsApp only when the fixture explicitly lists a number. Rather
  // than extend MarketplaceMerchant here, we probe the message threads
  // to detect exposure — production uses a merchant.whatsappE164 field.
  const waE164Real = merchantWhatsAppE164For(merchant.slug);
  const showWhatsApp = Boolean(waE164Real);

  const initialText = product
    ? `Hi ${merchant.displayName} — I'm interested in ${product.name} on Trade Center. Any questions before I order?`
    : `Hi ${merchant.displayName} — got a question about your store on Trade Center.`;

  // Style theming per variant
  const messagePrimary =
    variant === "hero-light"
      ? { bg: "#FFB300", fg: "#0A0A0A", border: "transparent" }
      : variant === "hero-dark"
        ? { bg: "#0A0A0A", fg: "#FFB300", border: "transparent" }
        : { bg: "#166534", fg: "#FFFFFF", border: "transparent" };

  const waSecondary =
    variant === "hero-light"
      ? { bg: "rgba(255,255,255,0.10)", fg: "#FFFFFF", border: "rgba(255,255,255,0.35)" }
      : variant === "hero-dark"
        ? { bg: "rgba(255,255,255,0.75)", fg: "#0A0A0A", border: "rgba(10,10,10,0.30)" }
        : { bg: "#FFFFFF", fg: "#0A0A0A", border: "rgba(139,69,19,0.15)" };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Link
        href={messageHref}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider shadow-sm"
        style={{
          backgroundColor: messagePrimary.bg,
          color: messagePrimary.fg,
          border: messagePrimary.border === "transparent" ? "none" : `1px solid ${messagePrimary.border}`
        }}
      >
        <MessageSquare size={13} strokeWidth={2.5}/>
        Message Seller
      </Link>
      {showWhatsApp && waE164Real && (
        <a
          href={whatsappLinkFor(waE164Real, initialText)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => logWhatsAppHandoff(merchant.slug, product?.slug)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-5 text-[12px] font-black uppercase tracking-wider backdrop-blur"
          style={{
            backgroundColor: waSecondary.bg,
            color: waSecondary.fg,
            borderColor: waSecondary.border
          }}
          title="Opens WhatsApp. Trade Center logs the handoff but never sees your conversation."
        >
          <MessageCircle size={13} strokeWidth={2.5}/>
          WhatsApp
        </a>
      )}
    </div>
  );
}

// ─── Fixture bridge ──────────────────────────────────────────────────
// Reads the message fixtures to figure out whether the merchant has
// their WhatsApp exposed. Production replaces this with a merchant.
// whatsappE164 column on the merchants table.

import { MESSAGE_THREAD_FIXTURES } from "../data/threads";

function merchantWhatsAppE164For(merchantSlug: string): string | undefined {
  const thread = MESSAGE_THREAD_FIXTURES.find((t) =>
    t.participants.some((p) => p.slug === merchantSlug) && t.merchantWhatsAppExposed
  );
  return thread?.merchantWhatsAppE164;
}
