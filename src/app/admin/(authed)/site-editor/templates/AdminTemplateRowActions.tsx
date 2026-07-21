"use client";

// AdminTemplateRowActions — client component for per-row actions on
// the /admin/site-editor/templates list. Toggle Active <-> Draft,
// deep-link into the editor pre-loaded with the template's state
// via ?admin_template=<slug>, and destructive Delete.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminTemplateRowActions({ id, slug, active }: {
  id:     string;
  slug:   string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "toggle" | "delete">(null);

  const toggleActive = async () => {
    setBusy("toggle");
    try {
      await fetch(`/api/admin/site-editor/templates/${encodeURIComponent(id)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: !active })
      });
      router.refresh();
    } finally { setBusy(null); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete template "${slug}"? This cannot be undone.`)) return;
    setBusy("delete");
    try {
      await fetch(`/api/admin/site-editor/templates/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      router.refresh();
    } finally { setBusy(null); }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={`/site/editor?admin_template=${encodeURIComponent(slug)}`}
        className="inline-flex h-7 items-center rounded-md border border-neutral-200 px-2 text-[10px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={toggleActive}
        disabled={busy !== null}
        className="inline-flex h-7 items-center rounded-md border px-2 text-[10px] font-black uppercase tracking-wider disabled:opacity-60"
        style={{
          borderColor: active ? "#166534" : "#9ca3af",
          color:       active ? "#166534" : "#4b5563"
        }}
      >
        {busy === "toggle" ? "…" : active ? "Unpublish" : "Publish"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="inline-flex h-7 items-center rounded-md border border-red-200 px-2 text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {busy === "delete" ? "…" : "Delete"}
      </button>
    </div>
  );
}
