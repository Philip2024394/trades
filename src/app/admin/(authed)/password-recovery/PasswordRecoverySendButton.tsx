"use client";

// One-click "Send via WhatsApp" button for the admin password-recovery
// queue. On click we BOTH:
//   1. Open wa.me in a new tab with the pre-filled message.
//   2. POST to /api/admin/password-recovery/sent so sent_at is stamped
//      (and the row leaves the queue + the recovery_code becomes
//      redeemable).
//
// After the POST resolves we refresh the route so the queue is
// regenerated server-side.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PasswordRecoverySendButton({
  listingId,
  waUrl
}: {
  listingId: string;
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
    // Open WhatsApp FIRST — popup blockers tolerate window.open when
    // it's the direct result of a click. If we awaited the fetch first,
    // the new-tab open would be blocked in most browsers.
    window.open(waUrl, "_blank", "noopener,noreferrer");

    try {
      const res = await fetch("/api/admin/password-recovery/sent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listing_id: listingId })
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
        className="rounded bg-brand-accent px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send via WhatsApp"}
      </button>
      {err && <span className="text-[11px] text-red-300">{err}</span>}
    </div>
  );
}
