"use client";

// usePaymentSession — hook every payment button renderer calls.
//
// Given a providerId + amount + orderRef, POSTs to /api/pay/session,
// handles the redirect (or renders the handoff instructions). Also
// exposes a `state` machine (`idle → loading → success | error`) so
// the button can flip visuals via the existing state machine.

import { useState } from "react";

export type PayState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "handoff"; instructions: string }
  | { kind: "success" }
  | { kind: "error"; message: string };

export type PayRequest = {
  brandId: string;
  providerId: string;
  amountMinor: number;
  currency: string;
  orderRef: string;
  description?: string;
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
};

export function usePaymentSession() {
  const [state, setState] = useState<PayState>({ kind: "idle" });

  async function start(req: PayRequest) {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/pay/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req)
      });
      const json = (await res.json()) as
        | { ok: true; kind: "redirect"; checkoutUrl: string }
        | { ok: true; kind: "handoff"; instructions: string }
        | { ok: false; kind?: "not-implemented"; error: string };

      if (!json.ok) {
        // Not-implemented → caller can fall back to the button's href.
        setState({ kind: "error", message: json.error });
        return { ok: false, notImplemented: json.kind === "not-implemented" };
      }
      if (json.kind === "redirect") {
        setState({ kind: "success" });
        window.location.assign(json.checkoutUrl);
        return { ok: true };
      }
      if (json.kind === "handoff") {
        setState({ kind: "handoff", instructions: json.instructions });
        return { ok: true };
      }
      setState({ kind: "error", message: "Unknown response" });
      return { ok: false };
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message ?? "network" });
      return { ok: false };
    }
  }

  function reset() {
    setState({ kind: "idle" });
  }

  return { state, start, reset };
}
