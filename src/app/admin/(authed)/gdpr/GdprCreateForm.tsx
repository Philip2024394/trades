"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

export function GdprCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subjectKind,  setSubjectKind]  = useState<"homeowner" | "trade" | "merchant">("homeowner");
  const [subjectId,    setSubjectId]    = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [requestKind,  setRequestKind]  = useState<"export" | "delete">("export");
  const [reason,       setReason]       = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk]       = useState(false);

  function submit() {
    if (!subjectId.trim() || !subjectEmail.trim()) {
      setError("subjectId + subjectEmail required"); return;
    }
    setError(null); setOk(false);
    startTransition(async () => {
      const res = await fetch("/api/admin/gdpr", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subjectKind, subjectId: subjectId.trim(), subjectEmail: subjectEmail.trim(), requestKind, reason: reason.trim() || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Failed"); return; }
      setOk(true);
      setSubjectId(""); setSubjectEmail(""); setReason("");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
      <select
        value={subjectKind} onChange={(e) => setSubjectKind(e.target.value as never)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-[12px] outline-none"
      >
        <option value="homeowner">Homeowner</option>
        <option value="trade">Trade</option>
        <option value="merchant">Merchant</option>
      </select>
      <input
        value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
        placeholder="Subject ID (UUID or slug)"
        className="col-span-2 h-9 rounded-md border border-neutral-200 px-2 text-[12px] outline-none focus:border-neutral-500"
      />
      <input
        type="email"
        value={subjectEmail} onChange={(e) => setSubjectEmail(e.target.value)}
        placeholder="Contact email"
        className="col-span-2 h-9 rounded-md border border-neutral-200 px-2 text-[12px] outline-none focus:border-neutral-500"
      />
      <select
        value={requestKind} onChange={(e) => setRequestKind(e.target.value as never)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-[12px] outline-none"
      >
        <option value="export">Export</option>
        <option value="delete">Delete</option>
      </select>
      <input
        value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Reason / reference (optional)"
        className="col-span-5 h-9 rounded-md border border-neutral-200 px-2 text-[12px] outline-none focus:border-neutral-500"
      />
      <button
        type="button" onClick={submit} disabled={pending}
        className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-neutral-900 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-125 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>} Log
      </button>
      {error && <p className="col-span-6 text-[11px] font-bold text-red-800">{error}</p>}
      {ok    && <p className="col-span-6 text-[11px] font-bold text-green-800">Request logged.</p>}
    </div>
  );
}
