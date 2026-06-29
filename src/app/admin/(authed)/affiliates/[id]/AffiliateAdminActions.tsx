"use client";

import { useState } from "react";

export function AffiliateAdminActions({
  affiliateId,
  status
}: {
  affiliateId: number;
  status: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliateId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        temporary_password?: string;
      };
      if (!data.ok) {
        setMsg(data.error || "Failed.");
        return;
      }
      if (action === "reset-password") {
        setMsg(`New temporary password: ${data.temporary_password ?? "(check logs)"}`);
      } else {
        setMsg("Done. Reload to refresh the page.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 text-[13px]">
      <div className="flex gap-2">
        {status === "active" ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => call("suspend")}
            className="rounded-lg border border-red-500 px-3 py-1.5 font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
          >
            Suspend
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => call("activate")}
            className="rounded-lg border border-green-500 px-3 py-1.5 font-bold text-green-400 hover:bg-green-500/10 disabled:opacity-60"
          >
            Activate
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => call("reset-password")}
          className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line disabled:opacity-60"
        >
          Reset password
        </button>
      </div>
      {msg && (
        <p className="rounded border border-brand-line bg-brand-surface px-2 py-1 text-[13px] text-brand-text">
          {msg}
        </p>
      )}
    </div>
  );
}
