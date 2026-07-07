// PhotoUpload — drag-and-drop or file-picker photo capture.
// Displays a live preview + progress. On success passes the public URL
// back to the parent orchestrator.

"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, RefreshCw } from "lucide-react";

export type PhotoUploadProps = {
  uploadGrant: string;
  onUploaded: (url: string) => void;
  className?: string;
};

export function PhotoUpload({
  uploadGrant,
  onUploaded,
  className = ""
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setError(null);
    setPreview(URL.createObjectURL(f));
    setUploading(true);
    setUploadedUrl(null);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("uploadGrant", uploadGrant);
      const res = await fetch("/api/apps/ai-visualiser/upload", {
        method: "POST",
        body: form
      });
      const data: { ok: boolean; url?: string; error?: string } = await res.json();
      if (!data.ok || !data.url) {
        setError(data.error || "Upload failed. Try again.");
        return;
      }
      setUploadedUrl(data.url);
      onUploaded(data.url);
    } catch {
      setError("Network error uploading.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`.trim()}>
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Step 1
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-neutral-900 md:text-3xl">
          Upload a photo of your space.
        </h2>
        <p className="mt-1 text-[13px] text-neutral-600">
          Bright daylight works best. Stand back so the whole area is
          visible.
        </p>
      </header>

      <label
        htmlFor="ai-viz-upload-input"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="relative flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 transition hover:border-neutral-500"
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <UploadCloud className="h-8 w-8 text-neutral-500" aria-hidden />
            <div className="text-[14px] font-semibold text-neutral-800">
              Tap to choose a photo, or drop one here
            </div>
            <div className="text-[13px] text-neutral-500">
              JPEG / PNG / WEBP / HEIC — up to 8 MB
            </div>
          </div>
        )}

        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <span className="text-[13px] font-semibold">Uploading…</span>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          id="ai-viz-upload-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>

      {error ? (
        <p className="text-[13px] text-red-600">{error}</p>
      ) : null}

      {uploadedUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-neutral-700 underline-offset-2 hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try a different photo
        </button>
      ) : null}
    </div>
  );
}
