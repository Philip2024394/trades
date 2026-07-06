// AdminHeroRowActions — Edit / Delete buttons per row. Client
// component so it can call the DELETE endpoint + refresh.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminHeroRowActionsProps = {
  id: string;
};

export function AdminHeroRowActions({ id }: AdminHeroRowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (
      !window.confirm(`Delete ${id}? This can't be undone. Merchants using this image will fall back to another matched image.`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/hero-library/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        router.refresh();
      } else {
        const text = await res.text();
        window.alert(`Delete failed: ${text}`);
      }
    } catch (err) {
      window.alert(`Delete failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/admin/hero-library/${encodeURIComponent(id)}`}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[10px] font-medium text-neutral-700 transition hover:bg-neutral-50"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
      >
        {busy ? "…" : "Delete"}
      </button>
    </div>
  );
}
