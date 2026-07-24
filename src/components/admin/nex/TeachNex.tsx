"use client";

// Teach Nex — upload UI. Client requests a signed URL from the API
// then PUTs the file directly to Supabase Storage. Extraction happens
// server-side in a worker (not shipped this pass; row lands with
// status='queued').

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertCircle, Clock, FileText } from "lucide-react";

type Upload = {
  id: string; original_filename: string; mime_type: string; size_bytes: number | null;
  trade_hint: string | null; topic_hint: string | null;
  uploaded_by: string; uploaded_by_kind: string; uploaded_at: string;
  extraction_status: string; extracted_entries_count: number;
};

export function TeachNex({ uploads }: { uploads: Upload[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) { setMsg({ ok: false, text: "Pick a file first" }); return; }

    setBusy(true); setMsg(null);
    try {
      const create = await fetch("/api/admin/nex/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_filename: file.name,
          mime_type:         file.type || "application/octet-stream",
          size_bytes:        file.size,
          trade_hint:        String(fd.get("trade_hint") ?? "").trim() || undefined,
          topic_hint:        String(fd.get("topic_hint") ?? "").trim() || undefined,
          notes:             String(fd.get("notes") ?? "").trim() || undefined
        })
      });
      const created = await create.json();
      if (!created.ok) { setMsg({ ok: false, text: created.error ?? "record_failed" }); setBusy(false); return; }

      // Upload the file bytes directly to storage.
      const put = await fetch(created.signed_upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!put.ok) { setMsg({ ok: false, text: `Storage upload failed (${put.status})` }); setBusy(false); return; }

      setMsg({ ok: true, text: `Uploaded. Nex will read it and draft entries for Review.` });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "network_error" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <form onSubmit={submit} className="mb-6 rounded-2xl border border-neutral-900 bg-white p-4">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-neutral-500">Upload teaching material</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">File *</span>
            <input type="file" name="file" required className="mt-1 w-full text-[12px]"/>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Trade hint</span>
            <input name="trade_hint" placeholder="carpentry" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"/>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Topic hint</span>
            <input name="topic_hint" placeholder="staircases" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"/>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Notes</span>
            <textarea name="notes" rows={2} placeholder="What is this? Why should Nex know it?" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-[13px]"/>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[12px] font-black text-white disabled:opacity-40">
            {busy ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>} Teach Nex
          </button>
          {msg && (
            <span className={"ml-auto inline-flex items-center gap-1 text-[11px] font-black " + (msg.ok ? "text-green-700" : "text-red-700")}>
              {msg.ok ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>} {msg.text}
            </span>
          )}
        </div>
      </form>

      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">Recent uploads</p>
      <div className="space-y-2">
        {uploads.length === 0 && <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center text-[12px] text-neutral-500">No uploads yet.</div>}
        {uploads.map((u) => <UploadRow key={u.id} upload={u}/>)}
      </div>
    </>
  );
}

function UploadRow({ upload }: { upload: Upload }) {
  const statusIcon =
    upload.extraction_status === "extracted" ? <CheckCircle2 size={12} className="text-green-700"/> :
    upload.extraction_status === "failed"    ? <AlertCircle  size={12} className="text-red-700"/> :
    upload.extraction_status === "extracting" ? <Loader2 size={12} className="animate-spin text-neutral-500"/> :
                                                 <Clock size={12} className="text-amber-700"/>;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-[12px]">
      <FileText size={14} className="text-neutral-500"/>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black">{upload.original_filename}</p>
        <p className="text-[10px] text-neutral-500">
          {upload.uploaded_by_kind}:{upload.uploaded_by} · {new Date(upload.uploaded_at).toLocaleString("en-GB")}
          {upload.trade_hint ? ` · ${upload.trade_hint}` : ""}
        </p>
      </div>
      <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
        {statusIcon} {upload.extraction_status}
      </div>
      {upload.extracted_entries_count > 0 && (
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-white">{upload.extracted_entries_count} drafts</span>
      )}
    </div>
  );
}
