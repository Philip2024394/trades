"use client";

// CostDocumentUpload — small button + hidden file input that uploads
// a quote / invoice / receipt / spreadsheet / photo.
//
// Two variants:
//   • "chip"   — pill button (used inline on post cards + cost rows)
//   • "block"  — full-width dashed dropzone (used as the empty state
//                for a cost row that has zero docs)
//
// After a successful upload, router.refresh() re-hydrates the page
// so the new doc appears in the thumbnail list.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, Loader2, X } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

export type CostDocumentUploadProps = {
  projectId:  string;
  costId?:    string | null;
  postId?:    string | null;
  variant?:   "chip" | "block";
  label?:     string;
  /** When true, disables the input + shows a message (mock previews). */
  demoMode?:  boolean;
};

export function CostDocumentUpload({
  projectId,
  costId,
  postId,
  variant = "chip",
  label   = "Attach quote / invoice",
  demoMode = false
}: CostDocumentUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (demoMode) {
      setError("Preview mode — uploads land in the real app.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file",      file);
      fd.append("projectId", projectId);
      if (costId) fd.append("costId", costId);
      if (postId) fd.append("postId", postId);
      const res = await fetch("/api/homeowner/costs/documents", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || "Upload failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const accept = "application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/*";

  if (variant === "block") {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-neutral-50 px-3 py-3 text-[11.5px] font-black uppercase tracking-wider text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
          style={{ borderColor: "rgba(0,0,0,0.15)" }}
        >
          {busy ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12} strokeWidth={2.5}/>}
          {busy ? "Uploading…" : label}
        </button>
        {error && <UploadError error={error} onDismiss={() => setError(null)}/>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFile}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1 rounded-full border-2 px-3 text-[10.5px] font-black uppercase tracking-wider transition hover:brightness-95 disabled:opacity-50"
        style={{ borderColor: BRAND_YELLOW, color: "#0A0A0A", backgroundColor: "white" }}
        title="Attach a quote, invoice, receipt or spreadsheet"
      >
        {busy ? <Loader2 size={11} className="animate-spin"/> : <Paperclip size={11} strokeWidth={2.5}/>}
        {busy ? "Uploading…" : label}
      </button>
      {error && <UploadError error={error} onDismiss={() => setError(null)}/>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFile}
      />
    </>
  );
}

function UploadError({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10.5px] font-bold text-red-800">
      {error}
      <button type="button" onClick={onDismiss} className="text-red-800/60 hover:text-red-900">
        <X size={10}/>
      </button>
    </div>
  );
}
