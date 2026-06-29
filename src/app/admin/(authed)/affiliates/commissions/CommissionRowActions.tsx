"use client";

import { useState } from "react";

export function CommissionRowActions({
  id,
  status
}: {
  id: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(updates: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/affiliates/commissions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates)
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!body.ok) {
        setErr(body.error || "Failed.");
        return;
      }
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "paid") return <span className="text-brand-muted">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {status === "pending" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ status: "approved" })}
          className="rounded bg-green-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-green-600 disabled:opacity-60"
        >
          Approve
        </button>
      )}
      {status === "approved" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ status: "paid" })}
          className="rounded bg-brand-accent px-2 py-1 text-[11px] font-bold text-black hover:opacity-90 disabled:opacity-60"
        >
          Mark paid
        </button>
      )}
      {(status === "pending" || status === "approved") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ status: "cancelled", cancelled_reason: "admin_action" })}
          className="rounded border border-red-500 px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
        >
          Cancel
        </button>
      )}
      {err && <span className="text-[11px] text-red-400">{err}</span>}
    </div>
  );
}
