"use client";

// Inline image-upload widget for service / product card editors.
// Replaces the previous "paste a URL" text fields so a tradesperson
// doesn't need to host their own image somewhere first.
//
// Uploads to /api/trade-off/upload-photo (the same endpoint the cover
// banner + portfolio uses) and writes the returned URL back via
// onChange. Renders a thumbnail preview when set and a dashed
// "Add image" tile when empty.

import { useRef, useState } from "react";

export function InlinePhotoInput({
  value,
  onChange,
  label,
  aspect = "square"
}: {
  value: string;
  onChange: (url: string) => void;
  /** Tile label when empty — "Add cover", "Add before", etc. */
  label: string;
  /** "square" (default) for thumbnails, "video" for 16:9 cover banners. */
  aspect?: "square" | "video";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", {
        method: "POST",
        body: fd
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!body.ok || !body.url) {
        setErr(body.error || "Upload failed");
        return;
      }
      onChange(body.url);
    } catch {
      setErr("Upload error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const aspectClass = aspect === "video" ? "aspect-[16/9]" : "aspect-square";

  if (value) {
    return (
      <div className="space-y-1.5">
        <div className={`relative overflow-hidden rounded-xl border border-brand-line bg-brand-surface ${aspectClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xl border border-brand-line bg-white px-3 text-[12px] font-bold text-brand-text transition hover:border-brand-accent">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={busy}
            />
            {busy ? "Uploading…" : "Replace"}
          </label>
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-brand-line bg-white px-3 text-[12px] font-bold text-red-600 transition hover:border-red-300"
          >
            Remove
          </button>
        </div>
        {err && <p className="text-[11px] font-semibold text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand-line bg-brand-surface text-center text-[12px] text-brand-muted transition hover:border-brand-accent hover:text-brand-text ${aspectClass}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={busy}
      />
      <span className="text-2xl">+</span>
      <span className="font-bold text-brand-text">
        {busy ? "Uploading…" : label}
      </span>
      {err && <span className="text-[11px] font-semibold text-red-600">{err}</span>}
    </label>
  );
}
