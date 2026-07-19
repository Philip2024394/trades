"use client";

// FullGalleryView — the "See all" surface that takes over the /sitebook
// center feed when ?view=gallery is set.
//
// Filter chips (Project / Stage) removed per Philip 2026-07-19 — the
// gallery is a flat reverse-chronological grid. Filters return when
// photo volume warrants them.
//
// Layout:
//   • Header — back link + title + upload button (+ project picker when >1)
//   • 4-column grid of larger thumbnails (square, aspect-1)
//   • Click a thumbnail → lightbox

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, X, ArrowUpRight, Loader2, Plus } from "lucide-react";
import type { SiteBookPhoto } from "@/lib/homeowners/photos";

const BRAND_YELLOW = "#FFB300";

export function FullGalleryView({
  photos,
  projects        = [],
  hrefBase        = "/sitebook",
  postHrefPrefix  = "/sitebook",
  demoMode        = false
}: {
  photos:         SiteBookPhoto[];
  projects?:      { id: string; title: string }[];
  hrefBase?:      string;
  postHrefPrefix?: string;
  demoMode?:      boolean;
}) {
  const router = useRouter();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Upload state
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState<string>(projects[0]?.id ?? "");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (demoMode) {
      setUploadError("Preview mode — uploads land in the real app.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!uploadProjectId) {
      setUploadError("Create a project first.");
      return;
    }
    startTransition(async () => {
      setUploadError(null);
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const res  = await fetch(`/api/homeowner/projects/${uploadProjectId}/photos`, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setUploadError(data.error || "Upload failed");
          break;
        }
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <section>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={hrefBase}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
        >
          <ArrowLeft size={11} strokeWidth={2.5}/> Back to feed
        </Link>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <select
              value={uploadProjectId}
              onChange={(e) => setUploadProjectId(e.target.value)}
              className="h-8 rounded-full border border-neutral-300 bg-white px-2 text-[11px] font-bold text-neutral-800 outline-none focus:border-neutral-500"
              aria-label="Upload target project"
              title="Upload target project"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm hover:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            {pending
              ? <><Loader2 size={12} className="animate-spin"/> Uploading</>
              : <><Plus size={12} strokeWidth={2.6}/> Add photo</>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFile}/>
        </div>
      </div>

      <h1 className="text-[22px] font-black leading-tight text-neutral-900">
        Photo library
        <span className="ml-2 text-[13px] font-bold text-neutral-500 tabular-nums">
          {photos.length}
        </span>
      </h1>
      <p className="mt-1 text-[12.5px] text-neutral-600">
        Every photo you or your trades add to a post. Photos stay here even if the source post is deleted.
      </p>

      {uploadError && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-800">
          {uploadError}
        </p>
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed bg-white p-10 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <Camera size={22} className="mx-auto text-neutral-400" strokeWidth={2.2}/>
          <p className="mt-2 text-[14px] font-black text-neutral-900">No photos yet</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
            Add a photo above, or attach one from any post.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-100 transition hover:opacity-95 hover:shadow-md"
              title={p.caption || (p.stage ?? "Photo")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.storage_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {p.stage && (
                <span
                  className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                  style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                >
                  {p.stage === "in-progress" ? "WIP" : p.stage}
                </span>
              )}
              {p.uploaded_by_name && (
                <span
                  className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[9.5px] font-bold text-white"
                >
                  {p.uploaded_by_name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && photos[lightboxIdx] && (
        <Lightbox
          photo={photos[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
          onPrev={lightboxIdx > 0 ? () => setLightboxIdx(lightboxIdx - 1) : undefined}
          onNext={lightboxIdx < photos.length - 1 ? () => setLightboxIdx(lightboxIdx + 1) : undefined}
          postHrefPrefix={postHrefPrefix}
        />
      )}
    </section>
  );
}

function Lightbox({
  photo, onClose, onPrev, onNext, postHrefPrefix
}: {
  photo:          SiteBookPhoto;
  onClose:        () => void;
  onPrev?:        () => void;
  onNext?:        () => void;
  postHrefPrefix: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-neutral-600">
            <span className="font-black uppercase tracking-wider text-neutral-800">
              {photo.stage ? (photo.stage === "in-progress" ? "In progress" : photo.stage) : "Photo"}
            </span>
            {photo.uploaded_by_name && (
              <>
                <span>·</span>
                <span>{photo.uploaded_by_name}</span>
              </>
            )}
            <span>·</span>
            <span>{new Date(photo.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X size={15}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.storage_url}
            alt={photo.caption ?? ""}
            className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain shadow-md"
          />
          {photo.caption && (
            <p className="mx-auto mt-3 max-w-2xl text-center text-[12.5px] text-neutral-700">
              {photo.caption}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2">
          <div className="flex items-center gap-1">
            {onPrev && (
              <button type="button" onClick={onPrev} className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50">
                Prev
              </button>
            )}
            {onNext && (
              <button type="button" onClick={onNext} className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50">
                Next
              </button>
            )}
          </div>
          {photo.post_id ? (
            <Link
              href={`${postHrefPrefix}?post=${photo.post_id}`}
              className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm hover:brightness-95"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              Open post <ArrowUpRight size={11} strokeWidth={2.5}/>
            </Link>
          ) : (
            <span className="text-[10.5px] font-bold text-neutral-500">Source post removed</span>
          )}
        </div>
      </div>
    </div>
  );
}
