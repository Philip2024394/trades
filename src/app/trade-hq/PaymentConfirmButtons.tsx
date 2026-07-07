"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X, Loader2 } from "lucide-react";

export function PaymentConfirmButtons({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "dispute" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "dispute") {
    if (busy) return;
    setError(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/trade/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not update.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act("confirm")}
          disabled={busy !== null}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-emerald-500 px-4 text-[12px] font-bold text-emerald-50 hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy === "confirm" ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          )}
          Received
        </button>
        <button
          type="button"
          onClick={() => act("dispute")}
          disabled={busy !== null}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-red-400/40 bg-red-500/5 px-3 text-[12px] font-bold text-red-200 hover:bg-red-500/15 disabled:opacity-60"
        >
          {busy === "dispute" ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <X className="h-3 w-3" aria-hidden />
          )}
          Dispute
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
