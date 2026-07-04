"use client";

// SmartPayButton — the runtime wrapper every payment variant renders.
//
// Responsibilities:
//   • In edit / preview modes → click is a no-op (Studio safety)
//   • In published mode with amount + brandId configured →
//       POST /api/pay/session, redirect on success, show handoff modal
//       for offline methods (COD / bank transfer)
//   • Falls back to the button's href if the provider isn't
//       implemented server-side or config is missing (dev-safe default)
//
// Uses the existing useButtonState-derived visual states via the state
// prop the outer renderer passes in.

import { useState } from "react";
import Link from "next/link";
import { usePaymentSession, type PayState } from "./usePaymentSession";

export type SmartPayContext = {
  /** The button's provider — matches the processor registry id. */
  providerId: string;
  /** Merchant brand id — needed by /api/pay/session to load creds. */
  brandId?: string;
  /** Amount in minor units (cents, paise, rupiah). If omitted the
   *  button falls back to plain href navigation. */
  amountMinor?: number;
  currency?: string;
  /** Merchant order reference. Defaults to a random slug. */
  orderRef?: string;
  description?: string;
  customerEmail?: string;
  returnUrl?: string;
  cancelUrl?: string;
};

export function SmartPayButton({
  href,
  mode,
  ctx,
  render
}: {
  href: string;
  mode: "preview" | "edit" | "published";
  ctx: SmartPayContext;
  /** Callback the outer variant uses to render its own styled shell.
   *  We hand it the current state so it can flip visuals. */
  render: (args: {
    onClick: (e: React.MouseEvent) => void;
    payState: PayState;
    handoff: string | null;
    dismissHandoff: () => void;
  }) => React.ReactNode;
}) {
  const { state, start } = usePaymentSession();
  const [handoff, setHandoff] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    // Edit/preview modes — never actually charge.
    if (mode !== "published") {
      e.preventDefault();
      return;
    }
    // Fall through to the href if we can't create a session client-side.
    if (
      !ctx.brandId ||
      !ctx.amountMinor ||
      !ctx.currency ||
      !ctx.orderRef
    ) {
      // Let the <Link>/anchor navigate to href as-is.
      return;
    }
    e.preventDefault();
    void (async () => {
      const res = await start({
        brandId: ctx.brandId!,
        providerId: ctx.providerId,
        amountMinor: ctx.amountMinor!,
        currency: ctx.currency!,
        orderRef: ctx.orderRef!,
        description: ctx.description,
        customerEmail: ctx.customerEmail,
        returnUrl: ctx.returnUrl ?? href,
        cancelUrl: ctx.cancelUrl ?? window.location.href
      });
      if (!res.ok && res.notImplemented) {
        // Provider not wired — degrade to plain navigation.
        window.location.assign(href);
      }
    })();
    if (state.kind === "handoff") setHandoff(state.instructions);
  }

  return (
    <>
      {render({
        onClick,
        payState: state,
        handoff,
        dismissHandoff: () => setHandoff(null)
      })}
      {handoff && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setHandoff(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              background: "#FFFFFF",
              padding: 24,
              borderRadius: 16,
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)"
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#525252",
                marginBottom: 8
              }}
            >
              Order confirmed
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "system-ui, sans-serif",
                fontSize: 14,
                lineHeight: 1.5,
                margin: 0,
                color: "#0A0A0A"
              }}
            >
              {handoff}
            </pre>
            <button
              type="button"
              onClick={() => setHandoff(null)}
              style={{
                marginTop: 16,
                padding: "10px 18px",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: "#0A0A0A",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                cursor: "pointer"
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Convenience — a plain <Link>-style shell many variants want when
 *  the merchant hasn't wired a session (edit mode, previews, dev). */
export function DefaultPayShell({
  href,
  onClick,
  children,
  style
}: {
  href: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  return (
    <Link href={href || "#"} onClick={onClick} style={style}>
      {children}
    </Link>
  );
}
