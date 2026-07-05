// FileUpload — drag+drop + button + preview grid.
//
// Uncontrolled by default (native file input). Optional preview grid
// for image uploads. Mobile: camera capture supported via
// `accept="image/*"` + `capture="environment"` — perfect for tradies
// photographing a job on-site.

"use client";

import { Camera, ImagePlus, Upload, X } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { FieldGroup } from "./FieldGroup";

export type FileUploadProps = {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  /** MIME filter — "image/*", "application/pdf", etc. */
  accept?: string;
  /** Allow multiple files. */
  multiple?: boolean;
  /** Show image previews for image/* uploads. */
  showPreview?: boolean;
  /** Enable mobile camera capture — sets capture="environment". */
  enableCamera?: boolean;
  /** Called whenever the file list changes. */
  onFilesChange?: (files: File[]) => void;
};

export function FileUpload({
  id,
  label,
  hint,
  error,
  accept = "image/*",
  multiple = true,
  showPreview = true,
  enableCamera = true,
  onFilesChange
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const previews = useMemo(
    () =>
      files.map((f) => ({
        file: f,
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null
      })),
    [files]
  );

  const commit = (next: File[]) => {
    setFiles(next);
    onFilesChange?.(next);
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    commit(multiple ? [...files, ...incoming] : incoming);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.currentTarget.files);
    // reset input so the same file can be re-selected
    e.currentTarget.value = "";
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const remove = (i: number) => {
    commit(files.filter((_, idx) => idx !== i));
  };

  return (
    <FieldGroup id={id} label={label} hint={hint} error={error}>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragging
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100"
        }`}
      >
        <ImagePlus className="h-6 w-6 text-neutral-500" />
        <div className="text-[13px] font-medium text-neutral-900">
          Tap to upload{multiple ? " photos" : " a photo"}
        </div>
        <div className="text-[11px] text-neutral-500">
          Drag &amp; drop or tap to choose from your device
        </div>
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={onInputChange}
        />
      </label>

      {enableCamera ? (
        <>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50 md:hidden"
          >
            <Camera className="h-4 w-4" />
            Take a photo
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onInputChange}
          />
        </>
      ) : null}

      {showPreview && previews.length ? (
        <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4">
          {previews.map((p, i) => (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
            >
              {p.url ? (
                <img
                  src={p.url}
                  alt={p.file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-neutral-500">
                  <Upload className="h-4 w-4" />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${p.file.name}`}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white hover:bg-neutral-900"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </FieldGroup>
  );
}
