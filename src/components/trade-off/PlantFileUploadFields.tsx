"use client";

// Reusable file-upload fields for the plant hire editors. Always
// upload — never paste-a-URL. Handles photo (image/*) via
// /api/trade-off/upload-photo and document (PDF/DOC/DOCX) via
// /api/trade-off/upload-document.
//
// Merchant sees: a "Tap to upload" dropzone, filename after upload,
// preview thumb for images, and a small "Replace" button. Backend
// returns the public URL which we store in the field.

import { useRef, useState } from "react";

type BaseProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Optional helper text under the field. */
  hint?: string;
};

export function ImageUploadField({ label, value, onChange, hint }: BaseProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string };
      if (!r.ok || !j.ok || !j.url) throw new Error(j.error ?? "upload failed");
      onChange(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</p>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              loading="lazy"
              className="h-16 w-16 rounded-md border border-brand-line object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Remove"
              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[10px] font-extrabold text-white hover:bg-red-700"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md border-2 border-dashed border-brand-line bg-brand-bg text-[9px] font-bold uppercase text-brand-muted">
            No file
          </div>
        )}
        <label
          className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-3 py-3 text-center text-[11px] font-extrabold uppercase tracking-widest transition ${
            busy
              ? "border-brand-line text-brand-muted"
              : value
                ? "border-brand-accent/60 text-brand-text hover:bg-brand-accent/10"
                : "border-brand-line text-brand-muted hover:border-brand-accent hover:text-brand-text"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => upload(e.target.files)}
          />
          {busy ? "Uploading…" : value ? "Replace image" : "Tap to upload image"}
          <span className="text-[9px] font-normal normal-case text-brand-muted">
            JPG / PNG / WebP / HEIC — up to 5 MB
          </span>
        </label>
      </div>
      {error && <p className="text-[10px] font-bold text-red-500">{error}</p>}
      {hint && <p className="text-[9px] text-brand-muted">{hint}</p>}
    </div>
  );
}

export function PdfUploadField({ label, value, onChange, hint }: BaseProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/trade-off/upload-document", { method: "POST", body: fd });
      const j = (await r.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
        filename?: string;
      };
      if (!r.ok || !j.ok || !j.url) throw new Error(j.error ?? "upload failed");
      onChange(j.url);
      setFilename(j.filename ?? f.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</p>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border border-brand-line bg-brand-bg text-center">
            <span className="text-[18px]" aria-hidden="true">
              📄
            </span>
            <span className="text-[8px] font-bold uppercase text-brand-muted">PDF</span>
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Remove"
              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[10px] font-extrabold text-white hover:bg-red-700"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md border-2 border-dashed border-brand-line bg-brand-bg text-[9px] font-bold uppercase text-brand-muted">
            No file
          </div>
        )}
        <label
          className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-3 py-3 text-center text-[11px] font-extrabold uppercase tracking-widest transition ${
            busy
              ? "border-brand-line text-brand-muted"
              : value
                ? "border-brand-accent/60 text-brand-text hover:bg-brand-accent/10"
                : "border-brand-line text-brand-muted hover:border-brand-accent hover:text-brand-text"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onChange={(e) => upload(e.target.files)}
          />
          {busy
            ? "Uploading…"
            : value
              ? filename
                ? `Replace · ${filename}`
                : "Replace file"
              : "Tap to upload PDF"}
          <span className="text-[9px] font-normal normal-case text-brand-muted">
            PDF / DOC / DOCX — up to 10 MB
          </span>
        </label>
      </div>
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent hover:brightness-95"
        >
          Preview current file →
        </a>
      )}
      {error && <p className="text-[10px] font-bold text-red-500">{error}</p>}
      {hint && <p className="text-[9px] text-brand-muted">{hint}</p>}
    </div>
  );
}
