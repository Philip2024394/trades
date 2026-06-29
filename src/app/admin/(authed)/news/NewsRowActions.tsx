"use client";

// Client island for per-row actions on the /admin/news table.
// Wires Edit / Archive / Restore / Delete to /api/admin/news/<id>.
// Archive flips status to 'archived' (and hides the yard echo).
// Restore flips status back to 'live'. Delete is a hard DELETE.

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  postId: string;
  status: string;
  slug: string;
};

export function NewsRowActions({ postId, status, slug }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patchStatus(next: "live" | "archived") {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/news/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(`Update failed: ${j?.error ?? r.status}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function hardDelete() {
    if (
      !window.confirm(
        `Delete /news/${slug}? This is permanent. The Yard cross-post will also be hidden.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/news/${postId}`, {
        method: "DELETE"
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(`Delete failed: ${j?.error ?? r.status}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <a
        href={`/admin/news/${postId}/edit`}
        className="rounded border border-brand-line px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-text hover:bg-brand-line"
      >
        Edit
      </a>
      {status === "live" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patchStatus("archived")}
          className="rounded border border-brand-line px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-text hover:bg-brand-line disabled:opacity-50"
        >
          Archive
        </button>
      )}
      {(status === "archived" || status === "draft") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => patchStatus("live")}
          className="rounded border border-brand-line px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-text hover:bg-brand-line disabled:opacity-50"
        >
          {status === "draft" ? "Publish" : "Restore"}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={hardDelete}
        className="rounded border border-red-900/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-400 hover:bg-red-900/20 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
