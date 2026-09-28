"use client";

// src/app/nex-native/settings/profile/_avatar-uploader.tsx
//
// Client-side image picker + preview + submit for the settings/profile
// avatar slot. Renders the current avatar (or initials fallback), opens
// a file picker when tapped, shows a live preview, and posts the file
// to uploadAvatarAction on submit.

import { useRef, useState } from "react";
import { uploadAvatarAction } from "../../_actions";

interface Props {
  currentAvatarUrl: string | null;
  displayName: string;
  handle: string | null;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function NexAvatarUploader({ currentAvatarUrl, displayName, handle }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const displayed = preview ?? currentAvatarUrl;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setSelectedName(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(`Image must be ≤ 5 MB · yours is ${(file.size / 1024 / 1024).toFixed(1)} MB`);
      e.target.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg(`Only JPEG, PNG, or WebP · got ${file.type || "unknown"}`);
      e.target.value = "";
      return;
    }
    setSelectedName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form
      ref={formRef}
      action={uploadAvatarAction}
      className="mb-4 rounded border border-neutral-300 bg-white p-4"
      data-nex-avatar-uploader
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-lg font-semibold text-neutral-700 hover:border-neutral-500"
          aria-label="Choose profile image"
          data-nex-avatar-choose
        >
          {displayed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={displayed}
              alt="Profile"
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span>{initialsFrom(displayName)}</span>
          )}
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-neutral-900 text-xs text-white"
          >
            📷
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-neutral-900">Profile image</div>
          <div className="mt-1 text-xs text-neutral-500">
            JPEG, PNG, or WebP · up to 5 MB · shown on your NEX cards and profile.
          </div>
          {selectedName && (
            <div className="mt-2 text-xs text-neutral-700" data-nex-avatar-selected>
              Selected: <span className="font-medium">{selectedName}</span>
            </div>
          )}
          {handle && (
            <div className="mt-1 text-[10px] text-neutral-400">
              Path <code className="font-mono">{handle}/avatar</code>
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {errorMsg && (
        <p
          className="mt-3 rounded bg-red-50 px-2 py-1 text-xs text-red-800"
          role="status"
          data-nex-avatar-error
        >
          {errorMsg}
        </p>
      )}

      {preview && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            className="min-h-[36px] rounded bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
            data-nex-avatar-upload
          >
            Upload image
          </button>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setSelectedName(null);
              setErrorMsg(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="min-h-[36px] rounded border border-neutral-300 px-4 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}
