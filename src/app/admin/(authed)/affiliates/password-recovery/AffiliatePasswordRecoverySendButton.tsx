"use client";

// "Send via WhatsApp" button for the affiliate password-recovery queue.
// Opens wa.me with pre-filled link AND POSTs to /api/admin/affiliates/
// password-recovery/sent so password_recovery_sent_at is stamped (which
// is what unlocks the link for redemption).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AffiliatePasswordRecoverySendButton({
  affiliateId,
  waUrl
}: {
  affiliateId: number;
  waUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setErr(null);
    if (!waUrl) {
      setErr("Missing WhatsApp or recovery code.");
      return;
    }
    // Open WhatsApp first (popup blockers tolerate window.open during the
    // direct click — awaiting fetch first would lose the gesture).
    window.open(waUrl, "_blank", "noopener,noreferrer");
    try {
      const res = await fetch("/api/admin/affiliates/password-recovery/sent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ affiliate_id: affiliateId })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(body.error || "Could not mark as sent.");
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || !waUrl}
        className="rounded bg-brand-accent px-3 py-1.5 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send via WhatsApp"}
      </button>
      {err && <span className="text-[13px] text-red-300">{err}</span>}
    </div>
  );
}
