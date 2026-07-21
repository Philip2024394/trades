"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2, ShieldQuestion } from "lucide-react";
import type { GdprRequest } from "@/lib/gdpr/engine";

const BRAND_RED   = "#B91C1C";
const BRAND_GREEN = "#166534";

export function GdprRequestRow({ request: r }: { request: GdprRequest }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundleDownloadUrl, setBundleDownloadUrl] = useState<string | null>(null);

  function fulfill() {
    if (r.request_kind === "delete" && !confirmDelete) { setConfirmDelete(true); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/gdpr/${r.id}/fulfill`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Failed"); return; }
      if (r.request_kind === "export" && data.bundle) {
        const blob = new Blob([JSON.stringify(data.bundle, null, 2)], { type: "application/json" });
        setBundleDownloadUrl(URL.createObjectURL(blob));
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: r.request_kind === "delete" ? BRAND_RED : BRAND_GREEN }}>
          {r.request_kind}
        </span>
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
          {r.subject_kind}
        </span>
        <span className="text-[10.5px] text-neutral-500">via {r.submission_source.replace(/_/g, " ")}</span>
      </div>

      <p className="mt-2 text-[13.5px] font-black text-neutral-900">{r.subject_email}</p>
      <p className="mt-0.5 truncate text-[10.5px] text-neutral-500 tabular-nums">Subject ID: {r.subject_id}</p>
      <p className="mt-0.5 text-[10.5px] text-neutral-500 tabular-nums">Submitted {new Date(r.submitted_at).toLocaleString("en-GB")}</p>
      {r.reason && <p className="mt-1 rounded-lg bg-neutral-50 p-2 text-[11.5px] italic text-neutral-700">"{r.reason}"</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
        <button
          type="button" onClick={fulfill} disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: r.request_kind === "delete" ? BRAND_RED : BRAND_GREEN }}
        >
          {pending ? <Loader2 size={12} className="animate-spin"/> :
            r.request_kind === "delete" ? <Trash2 size={12}/> : <Download size={12}/>}
          {r.request_kind === "delete"
            ? (confirmDelete ? "Confirm erase" : "Erase")
            : "Build export bundle"}
        </button>
        {bundleDownloadUrl && (
          <a href={bundleDownloadUrl} download={`gdpr-export-${r.subject_id}.json`}
             className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-125">
            <Download size={12}/> Download bundle
          </a>
        )}
        {error && <p className="text-[10.5px] font-bold text-red-800">{error}</p>}
      </div>
      {confirmDelete && !pending && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[10.5px] font-bold text-red-900">
          <ShieldQuestion size={11}/> Erase is Rule-3 non-destructive — snapshot goes to audit log before nulling.
        </p>
      )}
    </li>
  );
}
