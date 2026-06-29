"use client";

// Client island for the campaigns admin table — End and Cancel
// buttons. PATCHes /api/admin/affiliates/campaigns with the new
// status.
import { useState } from "react";

export function CampaignRowActions({
  id,
  status
}: {
  id: string;
  status: "active" | "ended" | "cancelled";
}): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function setStatus(next: "ended" | "cancelled") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/affiliates/campaigns?id=${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next })
      });
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

  if (status !== "active") {
    return <span className="text-brand-muted">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setStatus("ended")}
        disabled={busy}
        className="rounded-lg border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-brand-text hover:bg-brand-line disabled:opacity-60"
      >
        End
      </button>
      <button
        type="button"
        onClick={() => setStatus("cancelled")}
        disabled={busy}
        className="rounded-lg border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-red-400 hover:bg-brand-line disabled:opacity-60"
      >
        Cancel
      </button>
      {err && <span className="text-[13px] text-red-400">{err}</span>}
    </div>
  );
}
