// EditableGallerySection — merchant portfolio grid. Adds/removes/
// reorders images. Public view shows a responsive grid with lightbox
// on click; edit view has reorder handles + captions.

"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditMode } from "./EditModeContext";
import { EditableSection } from "./EditableSection";

export type GalleryImage = {
  id: string;
  url: string;
  caption?: string;
};

export type EditableGallerySectionProps = {
  id: string;
  initial?: {
    heading?: string;
    subhead?: string;
    images?: GalleryImage[];
  };
};

function newImageId(): string {
  return `img-${Math.random().toString(36).slice(2, 8)}`;
}

export function EditableGallerySection({
  id,
  initial
}: EditableGallerySectionProps) {
  const editCtx = useEditMode();
  const [heading, setHeading] = useState(initial?.heading ?? "Recent work");
  const [subhead, setSubhead] = useState(
    initial?.subhead ?? "A few jobs from the last few months."
  );
  const [images, setImages] = useState<GalleryImage[]>(initial?.images ?? []);
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    editCtx.registerSectionState(id, { heading, subhead, images });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, heading, subhead, images]);

  const patchHead = (field: "heading" | "subhead", v: string) => {
    if (field === "heading") setHeading(v);
    else setSubhead(v);
    editCtx.markDirty();
  };

  const addFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImages((prev) => [
          ...prev,
          { id: newImageId(), url: reader.result as string }
        ]);
        editCtx.markDirty();
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (imgId: string) => {
    setImages((prev) => prev.filter((i) => i.id !== imgId));
    editCtx.markDirty();
  };

  const patchCaption = (imgId: string, caption: string) => {
    setImages((prev) =>
      prev.map((i) => (i.id === imgId ? { ...i, caption } : i))
    );
    editCtx.markDirty();
  };

  const moveImage = (imgId: string, direction: "left" | "right") => {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.id === imgId);
      if (idx < 0) return prev;
      const target = direction === "left" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    editCtx.markDirty();
  };

  return (
    <EditableSection
      id={id}
      type="gallery"
      label="Gallery"
      onEdit={() => setEditing(true)}
    >
      <div className="px-4 py-10">
        <div className="mb-6 text-center">
          <h2 className="text-[22px] font-bold text-neutral-900 md:text-[28px]">
            {heading}
          </h2>
          {subhead ? (
            <p className="mx-auto mt-1 max-w-2xl text-[13px] text-neutral-600 md:text-[14px]">
              {subhead}
            </p>
          ) : null}
        </div>
        {images.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-[12px] text-neutral-500">
            No images yet. Tap this section in edit mode to add photos of your work.
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightbox(idx)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-neutral-200"
              >
                <img
                  src={img.url}
                  alt={img.caption ?? ""}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {img.caption ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-[11px] font-medium text-white">
                    {img.caption}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && images[lightbox] ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Close"
            onClick={() => setLightbox(null)}
          >
            <X className="h-4 w-4" />
          </button>
          {lightbox > 0 ? (
            <button
              type="button"
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((v) => (v !== null ? v - 1 : 0));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          {lightbox < images.length - 1 ? (
            <button
              type="button"
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((v) => (v !== null ? v + 1 : 0));
              }}
              style={{ right: 60 }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          <img
            src={images[lightbox].url}
            alt=""
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {images[lightbox].caption ? (
            <div className="absolute bottom-8 left-4 right-4 text-center text-[13px] font-medium text-white">
              {images[lightbox].caption}
            </div>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4">
          <div className="pointer-events-auto w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">
                  Edit gallery
                </div>
                <div className="text-[10px] text-neutral-500">
                  Add photos of your recent work. Drag order handles to
                  arrange.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close editor"
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Heading
                </span>
                <input
                  type="text"
                  value={heading}
                  onChange={(e) => patchHead("heading", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Subhead
                </span>
                <input
                  type="text"
                  value={subhead}
                  onChange={(e) => patchHead("subhead", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
            </div>

            <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {images.map((img, idx) => (
                <li
                  key={img.id}
                  className="rounded-lg border border-neutral-200 bg-white p-2"
                >
                  <div className="relative mb-1 aspect-square overflow-hidden rounded-md bg-neutral-100">
                    <img
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      aria-label="Remove"
                      className="absolute right-1 top-1 rounded-md bg-red-600 p-1 text-white shadow-md transition hover:bg-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={img.caption ?? ""}
                    onChange={(e) => patchCaption(img.id, e.currentTarget.value)}
                    placeholder="Caption"
                    className="mb-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px]"
                  />
                  <div className="flex justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => moveImage(img.id, "left")}
                      disabled={idx === 0}
                      aria-label="Move left"
                      className="rounded-md border border-neutral-200 bg-white px-1 py-0.5 text-[10px] text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(img.id, "right")}
                      disabled={idx === images.length - 1}
                      aria-label="Move right"
                      className="rounded-md border border-neutral-200 bg-white px-1 py-0.5 text-[10px] text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 aspect-square">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center gap-1 text-neutral-500 transition hover:text-neutral-800"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-[11px] font-medium">Add photo</span>
                </button>
              </li>
            </ul>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.currentTarget.files ?? []);
                files.forEach(addFromFile);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      ) : null}
    </EditableSection>
  );
}
