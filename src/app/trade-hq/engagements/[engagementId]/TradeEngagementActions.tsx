"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X, Loader2 } from "lucide-react";

export function TradeEngagementActions({
  engagementId,
  currentStatus
}: {
  engagementId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "dispute" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "dispute") {
    if (busy) return;
    setError(null);
    setBusy(action);
    try {
      const res = await fetch(
        `/api/trade/engagements/${engagementId}/confirm`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action })
        }
      );
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

  if (currentStatus === "signed_off") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
          <div>
            <p className="text-[14px] font-bold text-[#1B1A17]">Signed off.</p>
            <p className="mt-1 text-[13px] text-[#1B1A17]/60">
              The site owner has closed this engagement. It&apos;s on your record
              forever.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentStatus === "cancelled") {
    return (
      <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 text-[13px] text-[#1B1A17]/60">
        This engagement was cancelled by the site owner.
      </div>
    );
  }

  if (currentStatus === "disputed") {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-[13px] text-red-100">
        <b className="text-[#1B1A17]">Disputed.</b> The site owner will see this and
        respond. Everything you record here stays on the audit trail.
      </div>
    );
  }

  const canAccept =
    currentStatus === "pending" || currentStatus === "accepted";
  const alreadyAccepted = currentStatus !== "pending";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canAccept ? (
          <button
            type="button"
            onClick={() => act("accept")}
            disabled={busy !== null || alreadyAccepted}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-emerald-500 px-5 text-[13px] font-bold text-emerald-50 hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy === "accept" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {alreadyAccepted ? "You accepted" : "Accept the hire"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => act("dispute")}
          disabled={busy !== null}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-red-400/40 bg-red-500/5 px-5 text-[13px] font-bold text-red-200 hover:bg-red-500/15 disabled:opacity-60"
        >
          {busy === "dispute" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden />
          )}
          Dispute
        </button>
      </div>
      {error ? <p className="text-[13px] text-red-300">{error}</p> : null}
      <p className="text-[12px] leading-[1.5] text-[#1B1A17]/55">
        Accepting confirms the terms shown above. Disputing pauses the
        engagement and both sides see a flag — resolve directly with the site
        owner.
      </p>
    </div>
  );
}
