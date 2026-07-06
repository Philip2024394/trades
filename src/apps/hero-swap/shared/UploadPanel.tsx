// UploadPanel — merchant can upload their own image. Guidance on the
// best size + auto-generates a data URL preview. Real image
// processing (crop, resize) happens on save via a canvas pipeline —
// this component owns the client-side selection + preview only.

"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";

export type UploadPanelProps = {
  onUpload: (dataUrl: string) => void;
  uploadUrl: string | null;
};

const RECOMMENDED_MIN_W = 2400;
const RECOMMENDED_MIN_H = 1350;

export function UploadPanel({ onUpload, uploadUrl }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onUpload(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Upload your own
      </div>
      <div
        className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center"
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {uploadUrl ? (
          <img
            src={uploadUrl}
            alt="Your upload preview"
            className="mb-2 max-h-32 w-full rounded object-cover"
          />
        ) : (
          <Upload className="h-6 w-6 text-neutral-500" />
        )}
        <div className="text-[12px] font-semibold text-neutral-900">
          {uploadUrl ? "Replace image" : "Drop image or click to browse"}
        </div>
        <div className="text-[10px] text-neutral-500">
          Best size: {RECOMMENDED_MIN_W} × {RECOMMENDED_MIN_H} px or larger
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      <div className="mt-2 text-[10px] leading-relaxed text-neutral-500">
        We&apos;ll auto-crop your image to fit desktop, tablet, and mobile aspect
        ratios so it looks right on every device.
      </div>
    </div>
  );
}
