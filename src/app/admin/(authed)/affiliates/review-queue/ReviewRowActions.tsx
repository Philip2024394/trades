"use client";

// Client island — Mark as reviewed / Suspend account.
import { useState } from "react";

export function ReviewRowActions({
  affiliateId
}: {
  affiliateId: number;
}): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function call(action: "clear" | "suspend") {
    if (action === "suspend" && !confirm("Suspend this affiliate's account?"))
      return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/affiliates/review-queue?id=${affiliateId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action })
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error ?? "Could not update.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => call("clear")}
        disabled={busy}
        className="rounded-lg border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-brand-text hover:bg-brand-line disabled:opacity-60"
      >
        Mark as reviewed
      </button>
      <button
        type="button"
        onClick={() => call("suspend")}
        disabled={busy}
        className="rounded-lg border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-red-400 hover:bg-brand-line disabled:opacity-60"
      >
        Suspend
      </button>
      {err && <span className="text-[13px] text-red-400">{err}</span>}
    </div>
  );
}
