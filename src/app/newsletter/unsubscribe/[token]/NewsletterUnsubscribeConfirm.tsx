"use client";

// Single-button unsubscribe confirm — POSTs the token to
// /api/trade-off/newsletter/unsubscribe and toasts a success state on
// the same URL. No login, no email-typing, no second confirmation
// (PECR demands single-click).

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function NewsletterUnsubscribeConfirm({
  token,
  merchantName,
  alreadyUnsubscribed
}: {
  token: string;
  merchantName: string;
  alreadyUnsubscribed: boolean;
}) {
  const [state, setState] = useState<State>(
    alreadyUnsubscribed ? { kind: "success" } : { kind: "idle" }
  );

  async function onConfirm() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/trade-off/newsletter/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const json: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        setState({
          kind: "error",
          message: json.error ?? "Could not unsubscribe — try again."
        });
        return;
      }
      setState({ kind: "success" });
    } catch {
      setState({ kind: "error", message: "Network error — try again." });
    }
  }

  if (state.kind === "success") {
    return (
      <p
        role="status"
        className="inline-flex items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-[13px] font-semibold text-emerald-700"
      >
        You&rsquo;ve been unsubscribed from {merchantName}&rsquo;s newsletter.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onConfirm}
        disabled={state.kind === "loading"}
        className="inline-flex h-11 items-center rounded-xl bg-brand-accent px-6 text-[13px] font-extrabold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        {state.kind === "loading"
          ? "Unsubscribing…"
          : "Confirm unsubscribe"}
      </button>
      {state.kind === "error" && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-700"
        >
          {state.message}
        </p>
      )}
    </>
  );
}
