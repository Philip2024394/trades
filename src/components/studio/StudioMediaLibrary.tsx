"use client";

// StudioMediaLibrary — grid + upload for merchant media.
//
// Standalone page component. Uploads via the multipart endpoint,
// refreshes the list on success, gracefully surfaces size / MIME errors
// in an inline banner. Used at /studio/media; the image picker modal
// (StudioImagePickerModal) uses the same underlying components for a
// picker-with-upload combo.

import { useEffect, useRef, useState } from "react";
import { STUDIO_MEDIA_MAX_BYTES, formatBytes, type StudioMediaItem } from "@/lib/studio/media";

const YELLOW = "#FFB300";

type Props = {
  brandName: string;
};

export function StudioMediaLibrary({ brandName }: Props) {
  const [items, setItems] = useState<StudioMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState<UploadState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/media");
      const json = (await res.json()) as {
        ok: boolean;
        items?: StudioMediaItem[];
        error?: string;
      };
      if (json.ok && json.items) setItems(json.items);
      else setError(json.error ?? "load-failed");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadState({ kind: "uploading", filename: file.name });
      const uploaded = await uploadOne(file);
      if (uploaded.ok) {
        setItems((prev) => [uploaded.item, ...prev]);
        setUploadState({ kind: "success", item: uploaded.item });
      } else {
        setUploadState({ kind: "error", message: uploaded.error });
        setError(uploaded.error);
        break;
      }
    }
    // Clear ephemeral success state after a moment.
    window.setTimeout(() => {
      setUploadState((s) => (s.kind === "success" ? { kind: "idle" } : s));
    }, 2500);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {brandName} · Media
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            Media library
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
            Every photo you&rsquo;ve uploaded, newest first. Drop any image into
            a section from the toolbar&rsquo;s Replace button, or upload fresh
            files here.
          </p>
        </div>
        <UploadButton onFiles={onFilesChosen} state={uploadState} />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-bold text-red-700"
        >
          Upload error · {error}
        </div>
      )}

      {loading ? (
        <p className="mt-12 text-center text-[13px] text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState onUpload={onFilesChosen} />
      ) : (
        <MediaGrid items={items} />
      )}
    </div>
  );
}

// ─── Upload button ─────────────────────────────────────────────

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; filename: string }
  | { kind: "success"; item: StudioMediaItem }
  | { kind: "error"; message: string };

function UploadButton({
  onFiles,
  state
}: {
  onFiles: (files: FileList | null) => void;
  state: UploadState;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label =
    state.kind === "uploading"
      ? `Uploading ${state.filename}…`
      : state.kind === "success"
        ? "✓ Uploaded"
        : "↑ Upload image";
  const busy = state.kind === "uploading";
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
        style={{ background: "#0A0A0A" }}
      >
        {label}
      </button>
    </>
  );
}

// ─── Grid ────────────────────────────────────────────────────

export function MediaGrid({
  items,
  onPick
}: {
  items: StudioMediaItem[];
  onPick?: (item: StudioMediaItem) => void;
}) {
  return (
    <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.id}>
          <MediaCard item={item} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function MediaCard({
  item,
  onPick
}: {
  item: StudioMediaItem;
  onPick?: (item: StudioMediaItem) => void;
}) {
  const [copied, setCopied] = useState(false);
  const clickable = Boolean(onPick);
  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md">
      <button
        type="button"
        onClick={() => onPick?.(item)}
        disabled={!clickable}
        className="group relative block aspect-square w-full overflow-hidden bg-neutral-100 disabled:cursor-default"
        aria-label={clickable ? `Use ${item.filename}` : item.filename}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.filename}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
        />
        {clickable && (
          <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-black/60 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
            Use this →
          </span>
        )}
      </button>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-neutral-900" title={item.filename}>
            {item.filename}
          </p>
          <p className="text-[10px] text-neutral-500">
            {formatBytes(item.sizeBytes)} · {item.mimeType?.replace("image/", "") ?? "?"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(item.url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50"
          title="Copy public URL"
        >
          {copied ? "✓ Copied" : "URL"}
        </button>
      </div>
    </article>
  );
}

// ─── Empty state ───────────────────────────────────────────────

function EmptyState({
  onUpload
}: {
  onUpload: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onUpload(e.dataTransfer.files);
      }}
      className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center"
    >
      <p className="text-[12px] font-bold text-neutral-500">No media yet.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onUpload(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white"
        style={{ background: "#0A0A0A" }}
      >
        ↑ Upload your first image
      </button>
      <p className="text-[10px] text-neutral-400">
        Or drag files into this box · max{" "}
        {formatBytes(STUDIO_MEDIA_MAX_BYTES)} each
      </p>
    </div>
  );
}

// ─── Upload primitive ──────────────────────────────────────────

type UploadResult =
  | { ok: true; item: StudioMediaItem }
  | { ok: false; error: string };

export async function uploadOne(file: File): Promise<UploadResult> {
  if (file.size > STUDIO_MEDIA_MAX_BYTES) {
    return { ok: false, error: `file over ${formatBytes(STUDIO_MEDIA_MAX_BYTES)}` };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: `unsupported type: ${file.type}` };
  }
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch("/api/studio/media/upload", {
      method: "POST",
      body: form
    });
    const json = (await res.json()) as
      | { ok: true; item: StudioMediaItem }
      | { ok: false; error: string };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: "error" in json ? json.error : `HTTP ${res.status}`
      };
    }
    return { ok: true, item: json.item };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
