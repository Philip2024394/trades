"use client";

// StudioImagePickerModal — pick an image for a specific config field.
//
// Opened by StudioLiveMirror when the image toolbar's Replace / Upload
// tool fires. Shows the merchant's uploaded media as a grid; picking
// one calls onPick(url). An Upload primitive at the top handles fresh
// uploads inline; on success the new item is auto-picked so merchants
// don't have to double-click.

import { useEffect, useRef, useState } from "react";
import { MediaGrid, uploadOne } from "./StudioMediaLibrary";
import type { StudioMediaItem } from "@/lib/studio/media";
import { STUDIO_MEDIA_MAX_BYTES, formatBytes } from "@/lib/studio/media";

const YELLOW = "#FFB300";

type Props = {
  instanceId: string;
  elementKey: string;
  currentUrl: string;
  onPick: (url: string) => void;
  onClose: () => void;
};

export function StudioImagePickerModal({
  instanceId,
  elementKey,
  currentUrl,
  onPick,
  onClose
}: Props) {
  const [items, setItems] = useState<StudioMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/studio/media");
        const json = (await res.json()) as {
          ok: boolean;
          items?: StudioMediaItem[];
        };
        if (json.ok && json.items) setItems(json.items);
      } catch {
        // ignore — user can still upload fresh
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    for (let i = 0; i < files.length; i++) {
      const result = await uploadOne(files[i]);
      if (!result.ok) {
        setError(result.error);
        break;
      }
      setItems((prev) => [result.item, ...prev]);
      // Auto-pick the last uploaded so merchants don't need a second click.
      if (i === files.length - 1) {
        onPick(result.item.url);
        setUploading(false);
        return;
      }
    }
    setUploading(false);
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Replace image"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-4 border-b border-neutral-200 p-5">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              Replace image
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
              Pick an image or upload a new one
            </h2>
            <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
              instance {instanceId} · field {elementKey}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
              style={{ background: "#0A0A0A" }}
            >
              {uploading ? "Uploading…" : "↑ Upload"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full text-[15px] font-extrabold text-neutral-500 transition hover:bg-neutral-100"
            >
              ✕
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="border-b border-red-200 bg-red-50 p-3 text-[12px] font-bold text-red-700"
          >
            Upload error · {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {currentUrl && (
            <div className="mb-6">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Current
              </p>
              <div className="mt-1 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentUrl}
                  alt="Current"
                  className="h-16 w-16 rounded-md object-cover"
                />
                <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-500">
                  {currentUrl}
                </p>
                <button
                  type="button"
                  onClick={() => onPick("")}
                  className="rounded-md border border-neutral-200 px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest text-red-600 transition hover:bg-red-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-[13px] text-neutral-500">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFiles(e.dataTransfer.files);
              }}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-12 text-center"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                No images yet
              </p>
              <p className="max-w-sm text-[13px] font-bold text-neutral-700">
                Add your first image to unlock the picker.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
                style={{ background: "#0A0A0A" }}
              >
                ↑ Upload an image
              </button>
              <p className="text-[10px] text-neutral-400">
                Or drop files here · max {formatBytes(STUDIO_MEDIA_MAX_BYTES)} each
              </p>
            </div>
          ) : (
            <MediaGrid items={items} onPick={(item) => onPick(item.url)} />
          )}
        </div>
      </div>
    </div>
  );
}
