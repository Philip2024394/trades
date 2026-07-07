// Client component — the checkout CTA. Calls /api/os/vault/checkout,
// then redirects to the Stripe hosted checkout URL returned.
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/platform/ui";

export function CheckoutButton({
  planKey,
  interval,
  disabled,
  label
}: {
  planKey: string;
  interval: "monthly" | "annual" | "one_off";
  disabled: boolean;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/os/vault/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, interval })
      });
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "Checkout failed.");
        setBusy(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned.");
      setBusy(false);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={disabled || busy}
        intent={disabled ? "secondary" : "primary"}
        size="md"
        icon={busy ? Loader2 : undefined}
      >
        {busy ? "Redirecting…" : label}
      </Button>
      {error ? (
        <p className="text-[13px] text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
