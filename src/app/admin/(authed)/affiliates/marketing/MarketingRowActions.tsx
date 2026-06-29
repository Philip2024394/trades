"use client";

// Row actions for the admin marketing-pack table: toggle Featured, open
// the file in a new tab, and Delete (with a confirm prompt).
import { useState } from "react";

export function MarketingRowActions({
  id,
  featured,
  fileUrl
}: {
  id: string;
  featured: boolean;
  fileUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(updates: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/affiliates/marketing?id=${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates)
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
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

  async function remove() {
    if (!confirm("Delete this asset? The file will be removed permanently.")) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/affiliates/marketing?id=${id}`, {
        method: "DELETE"
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Delete failed.");
        return;
      }
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ featured: !featured })}
        className="rounded border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-brand-text hover:bg-brand-line disabled:opacity-60"
      >
        {featured ? "Unfeature" : "Feature"}
      </button>
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-brand-text hover:bg-brand-line"
      >
        Open
      </a>
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        className="rounded border border-red-500 px-2 py-1 text-[13px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
      >
        Delete
      </button>
      {err && <span className="text-[13px] text-red-400">{err}</span>}
    </div>
  );
}
